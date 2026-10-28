const express = require('express');
const pool = require('../config/db');
const { asyncHandler, parsePagination, pickFields, isScopedOperator, checkOwnership, addDetailThumbToWorksheet, clearUnusedDetailRows, rebuildPoMerges, rebuildDetailMerges } = require('../utils/helpers');
const { generateDefaultDocuments, buildSupplierMaps } = require('../utils/documents');
const { logOperation, ownerOf } = require('../utils/operation-log');

const router = express.Router();

const ALLOWED = [
  'pi_number', 'signing_date', 'client_id', 'supplier_id',
  'currency', 'trade_terms', 'customs_responsibility', 'bank_account_id', 'alipay_qrcode',
  'payment_terms', 'delivery_date', 'loading_port', 'destination_port',
  'packing_desc', 'special_req', 'shipping_mark', 'show_special_req', 'show_stamp', 'show_hs_code',
  'total_amount', 'current_node', 'progress_percent', 'quotation_id',
  'purchase_contract', 'production_order', 'booking_data', 'customs_data', 'decl_data'
];
const REQUIRED = ['pi_number', 'signing_date', 'client_id'];

// JSON 字段需序列化为字符串
const JSON_FIELDS = ['purchase_contract', 'production_order', 'booking_data', 'customs_data', 'decl_data'];
function serializeJsonFields(data) {
  for (const f of JSON_FIELDS) {
    if (f in data && data[f] !== null && typeof data[f] === 'object') {
      data[f] = JSON.stringify(data[f]);
    }
  }
  return data;
}

const ITEM_FIELDS = [
  'product_id', 'model', 'supplier_model', 'name_en', 'hs_code', 'unit',
  'img_url', 'spec',
  'pcs_per_ctn', 'ctns', 'qty',
  'price', 'price_rmb', 'cost_cny', 'subtotal_amount',
  'nw_per_ctn', 'gw_per_ctn', 'cbm_per_ctn'
];

// 明细行清洗：从 products 取采购价 cost_cny，price 为外销价；联动重算小计
async function normalizeItems(items, conn) {
  const arr = (Array.isArray(items) ? items : [])
    .filter((it) => it && (it.model || it.product_id || it.name_en))
    .map((it) => ({ ...it }));

  // 1. 批量从产品库取采购价（cost_cny 权威来源）
  const productIds = arr.map(it => it.product_id).filter(Boolean);
  const productCostMap = new Map();
  if (productIds.length > 0 && conn) {
    const [prods] = await conn.query(
      `SELECT id, purchase_cost_rmb FROM products WHERE id IN (${productIds.join(',')})`
    );
    for (const p of prods) productCostMap.set(p.id, Number(p.purchase_cost_rmb) || 0);
  }

  // 2. 逐行填充缺失的采购价，联动小计
  return arr.map((row) => {
    // cost_cny 取值优先级：① 前端显式传 ② 产品库 purchase_cost_rmb ③ 兜底为 price
    if (row.cost_cny === undefined || row.cost_cny === null || row.cost_cny === '') {
      if (row.product_id && productCostMap.has(row.product_id)) {
        row.cost_cny = productCostMap.get(row.product_id);
      } else {
        row.cost_cny = Number(row.price) || 0;
      }
    } else {
      row.cost_cny = Number(row.cost_cny) || 0;
    }

    // price 兜底：外销价缺失时用 cost_cny（外销订单没有采购价概念时）
    if (row.price === undefined || row.price === null || row.price === '') {
      row.price = row.cost_cny;
    }
    row.price = Number(row.price) || 0;

    // 联动重算箱数
    const qty = Number(row.qty || 0);
    const pcs = Number(row.pcs_per_ctn || 0);
    if (pcs > 0 && (!row.ctns || Number(row.ctns) === 0)) row.ctns = Math.ceil(qty / pcs);

    // 小计用外销价 × 数量
    row.subtotal_amount = Number(((qty || 0) * row.price).toFixed(2));

    // 按 ITEM_FIELDS 顺序输出数组
    return ITEM_FIELDS.map((f) => (row[f] === undefined || row[f] === '' ? null : row[f]));
  });
}

// 布尔字段归一为 0/1
function toBool(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return v ? 1 : 0;
  if (typeof v === 'string') {
    if (v === 'true' || v === '1' || v === 'on') return 1;
    if (v === 'false' || v === '0') return 0;
  }
  return null;
}

// 清洗 date 字段：空字符串 → null，防止 MySQL 拒绝 '' as date
const DATE_FIELDS = ['signing_date', 'delivery_date'];
function sanitizeDates(data) {
  for (const f of DATE_FIELDS) {
    if (f in data && (data[f] === '' || data[f] === undefined)) {
      data[f] = null;
    }
  }
  return data;
}

// 生成下一个 PI 号（格式 MT${yy}NNN，两位年份后缀区分年份，跨年自动重置序号）
router.get(
  '/next-number',
  asyncHandler(async (req, res) => {
    const yy = String(new Date().getFullYear()).slice(2);
    const prefix = 'MT' + yy;
    const [[row]] = await pool.query(
      `SELECT pi_number FROM orders
       WHERE pi_number LIKE ?
       ORDER BY CAST(RIGHT(pi_number, LENGTH(pi_number) - ${prefix.length}) AS UNSIGNED) DESC
       LIMIT 1`,
      [prefix + '%']
    );
    let seq = 1;
    if (row) {
      const m = row.pi_number.match(/(\d{3})$/);
      if (m) seq = parseInt(m[1], 10) + 1;
    }
    res.success(prefix + String(seq).padStart(3, '0'));
  })
);

// 列表：联查客户名 + 明细数量 + 明细品类数量
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req);
    const q = (req.query.q || '').trim();
    const status = (req.query.status || '').trim();
    const customsResp = (req.query.customs_responsibility || '').trim();
    const conditions = [];
    const params = [];
    if (q) {
      conditions.push('(o.pi_number LIKE ? OR c.name_en LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
    if (status) {
      conditions.push('o.current_node = ?');
      params.push(status);
    }
    if (customsResp) {
      conditions.push('o.customs_responsibility = ?');
      params.push(customsResp);
    }
    // 业务员只能看到自己负责的订单
    if (isScopedOperator(req)) {
      conditions.push('o.owner_id = ?');
      params.push(req.operator.id);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM orders o LEFT JOIN clients c ON o.client_id = c.id ${where}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT o.*, c.name_en AS client_name, c.short_name AS client_short_name, c.country AS client_country, s.name AS supplier_name,
              (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
              (SELECT COUNT(DISTINCT oi.product_id) FROM order_items oi WHERE oi.order_id = o.id) AS product_kind_count,
              (SELECT COALESCE(SUM(oi.qty), 0) FROM order_items oi WHERE oi.order_id = o.id) AS total_qty,
              (SELECT COALESCE(SUM(oi.qty * oi.cost_cny), 0) FROM order_items oi WHERE oi.order_id = o.id) AS cny_purchase_cost,
              (SELECT COALESCE(SUM(oi.ctns), 0) FROM order_items oi WHERE oi.order_id = o.id) AS total_ctns,
              (SELECT COALESCE(SUM(oi.ctns * oi.gw_per_ctn), 0) FROM order_items oi WHERE oi.order_id = o.id) AS total_gw,
              (SELECT COALESCE(SUM(oi.ctns * oi.cbm_per_ctn), 0) FROM order_items oi WHERE oi.order_id = o.id) AS total_cbm
       FROM orders o
       LEFT JOIN clients c ON o.client_id = c.id
       LEFT JOIN suppliers s ON o.supplier_id = s.id
       ${where} ORDER BY o.id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    res.success({ list: rows, total, page, pageSize });
  })
);

// 详情：主表 + 明细行 + 客户/供应商名称（供采购订货单等单据关联使用）
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [[order]] = await pool.query(
      `SELECT o.*, c.name_en AS client_name, c.short_name AS client_short_name, s.name AS supplier_name
       FROM orders o
       LEFT JOIN clients c ON o.client_id = c.id
       LEFT JOIN suppliers s ON o.supplier_id = s.id
       WHERE o.id = ?`,
      [req.params.id]
    );
    if (!order) return res.fail('订单不存在', 404);
    const denied = checkOwnership(order, req, '订单');
    if (denied) return res.fail(denied, 404);
    const [items] = await pool.query(
      `SELECT oi.*, p.spec_cn, p.our_model AS product_our_model, p.purchase_cost_rmb AS product_purchase_cost,
              p.supplier_id AS product_supplier_id, p.product_type AS product_type, s.name AS product_supplier_name,
              p.hs_code AS product_hs_code,
              MIN(h.product_name) AS hs_product_name,
              MIN(h.declaration_elements) AS hs_elements
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       LEFT JOIN hs_codes h ON p.hs_code COLLATE utf8mb4_general_ci = h.hs_code COLLATE utf8mb4_general_ci
       WHERE oi.order_id = ?
       GROUP BY oi.id
       ORDER BY oi.id ASC`,
      [order.id]
    );
    res.success({ ...order, items });
  })
);

// 采购订货单 .xlsx 下载：基于新模板（8列 A-H 结构）填值
const ExcelJS = require('exceljs');
const path = require('path');
const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', '采购订货单_模板.xlsx');

function parsePo(val) {
  if (!val) return {};
  if (typeof val === 'string') {
    try { return JSON.parse(val) || {} } catch { return {} }
  }
  return val;
}

// 格式化装箱量：4 → "4 pcs/ctn"，空值 → ''
function formatPcsPerCtn(v) {
  if (v === null || v === undefined || v === '' || v === 0) return '';
  return `${v} pcs/ctn`;
}

// 子任务单字段合并：优先用 subOrder 的独立字段覆盖顶层 po（保证两个子合同内容独立）
// 模块3+4合并后只处理 plug_photos 和 remark_note
function mergeSubFields(po, subOrder) {
  if (!subOrder) return po;
  const merged = { ...po };
  const perSubKeys = [
    'product_config_types', 'product_config_data', 'product_config_text',
    'plug_photos', 'remark_note'
  ];
  for (const k of perSubKeys) {
    if (subOrder[k] !== undefined && subOrder[k] !== null) {
      merged[k] = subOrder[k];
    }
  }
  return merged;
}

// 构建统一采购备注文本：优先用 product_config_text（多行文本），其次用旧格式
function buildGeneralRemarks(po, configFields, configData) {
  // 新格式：直接返回多行文本内容
  if (po.product_config_text && typeof po.product_config_text === 'string' && po.product_config_text.trim()) {
    return po.product_config_text.trim();
  }
  // 旧格式：从 configFields + configData 逐字段生成
  const lines = [];
  let idx = 1;
  if (configFields && configFields.length) {
    for (const f of configFields) {
      const val = configData[f.key];
      if (val) lines.push(`${idx++}. ${f.label}：${val}`);
    }
  } else {
    // 旧格式回退
    if (configData.board_model) lines.push(`${idx++}. 主板型号：${configData.board_model}`);
    if (configData.charge_mode) lines.push(`${idx++}. 充电模式：${configData.charge_mode}`);
    if (configData.work_voltage) lines.push(`${idx++}. 工作电压：${configData.work_voltage}`);
    if (configData.battery_spec) lines.push(`${idx++}. 电池规格：${configData.battery_spec}`);
    if (configData.ptc_protection) lines.push(`${idx++}. PTC保护：${configData.ptc_protection}`);
  }
  if (po.face_sticker_req) lines.push(`${idx++}. 面贴要求：${po.face_sticker_req}`);
  if (po.nameplate_seal_req) lines.push(`${idx++}. 铭牌/铅封/说明书：${po.nameplate_seal_req}`);
  if (po.power_cord_spec) lines.push(`${idx++}. 插头：${po.power_cord_spec}`);
  if (po.remark_note) lines.push(`${idx++}. ${po.remark_note}`);
  return lines.join('\n');
}

// 构建包装与运输说明文本
function buildPackingRemarks(po) {
  const lines = [];
  let idx = 1;
  if (po.packing_desc && po.packing_desc !== '无') lines.push(`${idx++}. ${po.packing_desc}`);
  if (po.mark_req) lines.push(`${idx++}. 唛头：${po.mark_req}`);
  return lines.join('\n');
}

router.get(
  '/:id/purchase-order-xlsx',
  asyncHandler(async (req, res) => {
    // 业务员(3)只读：不可下载采购订货单 Excel
    if (req.operator.permission_level === 3) return res.fail('业务员无权下载采购订货单 Excel', 403);
    const [[order]] = await pool.query(
      `SELECT o.*, COALESCE(NULLIF(c.short_name, ''), c.name_en) AS client_name, s.name AS supplier_name
       FROM orders o
       LEFT JOIN clients c ON o.client_id = c.id
       LEFT JOIN suppliers s ON o.supplier_id = s.id
       WHERE o.id = ?`,
      [req.params.id]
    );
    if (!order) return res.fail('订单不存在', 404);
    const denied = checkOwnership(order, req, '订单');
    if (denied) return res.fail(denied, 404);

    const [items] = await pool.query(
      `SELECT oi.*, p.spec_cn, p.our_model AS product_our_model, p.supplier_id AS product_supplier_id,
              p.product_type AS product_type, p.pcs_per_ctn AS pcs_per_ctn
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ? ORDER BY oi.id ASC`,
      [order.id]
    );

    const po = parsePo(order.production_order);
    const exts = po.item_extensions || [];

    // 子任务单过滤
    const subIndex = req.query.sub_index !== undefined ? parseInt(req.query.sub_index, 10) : null;
    let filteredItems = items;
    let subOrder = null;
    if (subIndex !== null && Array.isArray(po.sub_orders) && po.sub_orders[subIndex]) {
      subOrder = po.sub_orders[subIndex];
      // 优先用 sub_order.product_ids 快照过滤（一旦归类就固定，不受产品库 supplier_id 变化影响）
      const pids = Array.isArray(subOrder.product_ids) ? subOrder.product_ids.filter(Boolean) : [];
      if (pids.length > 0) {
        const idSet = new Set(pids.map(id => Number(id)));
        filteredItems = items.filter(it => idSet.has(Number(it.product_id)));
      } else if (subOrder.supplier_id !== null && subOrder.supplier_id !== undefined) {
        // 无 product_ids 快照时回退按 supplier_id 过滤（旧数据兼容）
        const sid = Number(subOrder.supplier_id);
        filteredItems = items.filter(it => Number(it.product_supplier_id) === sid);
      } else {
        // supplier_id 也为空：只显示自定义产品（product_id 为空）
        filteredItems = items.filter(it => !it.product_id);
      }
    }

    // 子任务单字段合并：优先用 subOrder 的独立字段覆盖顶层（保证两个子合同内容独立）
    const src = mergeSubFields(po, subOrder);

    // 查询产品配置字段定义（用于统一采购备注的标签）
    let configFields = [];
    const configTypes = Array.isArray(src.product_config_types) ? src.product_config_types : [];
    if (configTypes.length) {
      const [cfgRows] = await pool.query(
        `SELECT product_type, config_fields FROM product_configs WHERE product_type IN (?)`,
        [configTypes]
      );
      const typeMap = new Map();
      for (const r of cfgRows) {
        let fields = r.config_fields;
        if (typeof fields === 'string') { try { fields = JSON.parse(fields); } catch { fields = []; } }
        if (Array.isArray(fields)) typeMap.set(r.product_type, fields);
      }
      const seen = new Set();
      for (const t of configTypes) {
        const fields = typeMap.get(t) || [];
        for (const f of fields) {
          if (!seen.has(f.key)) { seen.add(f.key); configFields.push(f); }
        }
      }
    }

    // 兼容 product_config_data 和旧字段
    const configData = (src.product_config_data && typeof src.product_config_data === 'object')
      ? src.product_config_data
      : {
          board_model: src.board_model || '',
          charge_mode: src.charge_mode || '',
          work_voltage: src.work_voltage || '',
          battery_spec: src.battery_spec || '',
          ptc_protection: src.ptc_protection || ''
        };

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE_PATH);
    const ws = wb.getWorksheet('采购附件明细 (PO Attachment)') || wb.getWorksheet(1);
    if (!ws) return res.fail('模板文件缺失或工作表名错误', 500);

    // ===== 抬头区 =====
    ws.getCell('C3').value = order.client_name || '';
    ws.getCell('G3').value = src.po_number || subOrder?.po_number || subOrder?.sub_contract_no || po.po_number || po.po_no || (order.pi_number ? order.pi_number + 'PO' : '');
    ws.getCell('C4').value = (req.operator && (req.operator.display_name || req.operator.username)) || '';
    ws.getCell('E4').value = new Date().toISOString().slice(0, 10);
    ws.getCell('G4').value = (order.delivery_date || '').slice(0, 10);

    // ===== 明细行准备 =====
    const hasSnapshot = !subOrder && exts.length > 0 && exts[0] && exts[0].model !== undefined;
    // 扩展映射：按 product_id 做 key（子任务单模式下 exts 是全量数组，filteredItems 是过滤后的，位置可能错位）
    const extMap = new Map();
    for (const e of exts) {
      const pid = Number(e.product_id);
      if (!Number.isNaN(pid)) extMap.set(pid, e);
    }
    const detailRows = hasSnapshot
      ? exts.map((e) => ({
          model: e.supplier_model || e.model || '',
          qty: Number(e.qty) || 0,
          img_url: e.img_url || '',
          pcs_per_ctn: e.pcs_per_ctn || '',
          detail_spec: e.detail_spec || '',
          remark: e.remark || ''
        }))
      : filteredItems.map((it) => {
          const ext = extMap.get(Number(it.product_id)) || {};
          return {
            model: (it.supplier_model || it.model) || '',
            qty: Number(it.qty) || 0,
            img_url: it.img_url || '',
            pcs_per_ctn: it.pcs_per_ctn || ext.pcs_per_ctn || '',
            detail_spec: ext.detail_spec || '',
            remark: ext.remark || ''
          };
        });

    // ===== 插行（超 3 行时）=====
    const DETAIL_START = 7;
    const DETAIL_CAPACITY = 3;
    const extra = Math.max(0, detailRows.length - DETAIL_CAPACITY);
    for (let k = 0; k < extra; k++) {
      const newRow = ws.insertRow(DETAIL_START + DETAIL_CAPACITY + k, []);
      const srcRow = ws.getRow(DETAIL_START + DETAIL_CAPACITY - 1);
      for (let c = 1; c <= 8; c++) {
        newRow.getCell(c).style = { ...(srcRow.getCell(c).style || {}) };
      }
      newRow.commit();
    }

    // ===== 重建固定区合并（插行后原合并下移但 _merges 不动）=====
    rebuildPoMerges(ws, extra);
    // ===== 重建明细行 F:G 合并 =====
    rebuildDetailMerges(ws, DETAIL_START, Math.max(detailRows.length, DETAIL_CAPACITY + extra));

    // ===== 明细写入 =====
    // 列映射：A序号 B型号 C图片 D数量 E装箱量 F:G详细规范 H备注
    detailRows.forEach((r, i) => {
      const row = DETAIL_START + i;
      ws.getRow(row).height = 85;
      ws.getCell(`A${row}`).value = i + 1;
      ws.getCell(`B${row}`).value = r.model;
      ws.getCell(`D${row}`).value = r.qty;
      ws.getCell(`E${row}`).value = formatPcsPerCtn(r.pcs_per_ctn);
      ws.getCell(`F${row}`).value = r.detail_spec || '';
      ws.getCell(`H${row}`).value = r.remark || '';
      addDetailThumbToWorksheet(ws, row, r.img_url);
    });
    // 清空明细区未使用行
    clearUnusedDetailRows(ws, DETAIL_START, detailRows.length, DETAIL_CAPACITY + extra);

    // ===== 统一采购备注（A12，插行后为 A(12+extra)）：写入模块2 电气配置数据 =====
    const remarksText = buildGeneralRemarks(src, configFields, configData);
    if (remarksText) {
      ws.getCell(`A${12 + extra}`).value = remarksText;
    }

    // ===== 实物图片（A15+extra，靠左独占一行，每张 100x100）=====
    const photos = Array.isArray(src.plug_photos) ? src.plug_photos.filter(p => typeof p === 'string' && p.startsWith('data:image')) : [];
    const photoRow = 15 + extra;
    for (let pi = 0; pi < photos.length; pi++) {
      const dataUrl = photos[pi];
      try {
        const ext = dataUrl.startsWith('data:image/png') ? 'png' : 'jpeg';
        const base64 = dataUrl.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
        const imgId = wb.addImage({ base64, extension: ext });
        ws.addImage(imgId, {
          tl: { col: 0 + pi * 0.135, row: (photoRow - 1) + 0.05 },
          ext: { width: 100, height: 100 },
          editAs: 'oneCell'
        });
      } catch { /* 图片嵌入失败不阻断 */ }
    }
    if (photos.length > 0) {
      ws.getRow(photoRow).height = 80;
    }

    // ===== 备注（A16+extra）：写入模块3 备注 =====
    ws.getCell(`A${16 + extra}`).value = src.remark_note || '无';

    // ===== 输出 .xlsx =====
    const fileSuffix = subOrder ? `-${subIndex + 1}` : '';
    const filename = `PurchaseOrder_${order.pi_number || 'export'}${fileSuffix}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    await wb.xlsx.write(res);
    res.end();
  })
);

// 创建：主表 + 明细整体在事务内写入
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);

    // date 字段空字符串 → null
    sanitizeDates(data);

    // 布尔字段归一
    if (data.show_special_req !== undefined) data.show_special_req = toBool(data.show_special_req);
    if (data.show_stamp !== undefined) data.show_stamp = toBool(data.show_stamp);
    if (data.show_hs_code !== undefined) data.show_hs_code = toBool(data.show_hs_code);

    // PI 号自动生成 + 唯一性校验（格式 MT${yy}NNN，两位年份后缀区分年份）
    const yy = String(new Date().getFullYear()).slice(2);
    const prefix = 'MT' + yy;
    if (!data.pi_number) {
      const [[row]] = await pool.query(
        `SELECT pi_number FROM orders
         WHERE pi_number LIKE ?
         ORDER BY CAST(RIGHT(pi_number, LENGTH(pi_number) - ${prefix.length}) AS UNSIGNED) DESC
         LIMIT 1`,
        [prefix + '%']
      );
      let seq = 1;
      if (row) {
        const m = row.pi_number.match(/(\d{3})$/);
        if (m) seq = parseInt(m[1], 10) + 1;
      }
      data.pi_number = prefix + String(seq).padStart(3, '0');
    } else {
      const [[dup]] = await pool.query(
        'SELECT id FROM orders WHERE pi_number = ?',
        [data.pi_number]
      );
      if (dup) {
        const [[row]] = await pool.query(
          `SELECT pi_number FROM orders
           WHERE pi_number LIKE ?
           ORDER BY CAST(RIGHT(pi_number, LENGTH(pi_number) - ${prefix.length}) AS UNSIGNED) DESC
           LIMIT 1`,
          [prefix + '%']
        );
        let seq = 1;
        if (row) {
          const m = row.pi_number.match(/(\d{3})$/);
          if (m) seq = parseInt(m[1], 10) + 1;
        }
        data.pi_number = prefix + String(seq).padStart(3, '0');
      }
    }

    const missing = REQUIRED.filter((k) => !data[k]);
    if (missing.length) return res.fail(`缺少必填字段: ${missing.join(', ')}`, 400);
    // 负责人自动写入当前登录人
    data.owner_name = ownerOf(req.operator);
    data.owner_id = req.operator.id;

    // 自动计算订单总金额（若前端未传）
    const items = await normalizeItems(req.body.items, pool);
    if (items.length === 0) return res.fail('请至少添加一行商品明细', 400);
    if (data.total_amount === undefined || data.total_amount === null) {
      data.total_amount = items.reduce((s, row) => {
        const idx = ITEM_FIELDS.indexOf('subtotal_amount');
        return s + (Number(row[idx]) || 0);
      }, 0);
    }

    // 自动生成单据默认数据（报关责任未选=请选择时不生成，保存时再按实际值生成）
    const rawItems = (req.body.items || []).filter(it => it && it.model);
    const customsResp = data.customs_responsibility || '';
    if (REAL_CUSTOMS.includes(customsResp)) {
      // 收集单据默认值所需上下文（企业抬头/客户/供应商）
      const [coRows] = await pool.query('SELECT name_cn, name_en, tel FROM company_settings LIMIT 1');
      const co = coRows[0] || {};
      const [clRows] = data.client_id ? await pool.query('SELECT name_en FROM clients WHERE id = ?', [data.client_id]) : [[]];
      const cl = clRows[0] || {};
      const [suRows] = data.supplier_id ? await pool.query('SELECT name FROM suppliers WHERE id = ?', [data.supplier_id]) : [[]];
      const su = suRows[0] || {};
      // 按供应商分组拆分子合同：从 product_id 反查 products.supplier_id
      const queryFn = async (sql, params) => (await pool.query(sql, params))[0];
      const { productSupplierMap, suppliersMap } = await buildSupplierMaps(rawItems, queryFn);
      const docs = generateDefaultDocuments(data.pi_number, data.signing_date, customsResp, rawItems, {
        client_id: data.client_id,
        company_name_cn: co.name_cn, company_name_en: co.name_en, company_tel: co.tel,
        client_name_en: cl.name_en,
        supplier_name: su.name,
        currency: data.currency, trade_terms: data.trade_terms,
        loading_port: data.loading_port, destination_port: data.destination_port,
        delivery_date: data.delivery_date, payment_terms: data.payment_terms,
        productSupplierMap, suppliersMap
      });
      Object.assign(data, docs);
    }

    // JSON 字段序列化为字符串
    serializeJsonFields(data);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.query('INSERT INTO orders SET ?', data);
      await conn.query(
        `INSERT INTO order_items (order_id, ${ITEM_FIELDS.join(', ')}) VALUES ?`,
        [items.map((row) => [r.insertId, ...row])]
      );
      await logOperation(conn, {
        module: 'order', action: '新增',
        targetId: r.insertId, targetNo: data.pi_number, operator: req.operator
      });
      await conn.commit();
      res.success({ id: r.insertId, item_count: items.length, pi_number: data.pi_number }, '创建成功');
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

// 更新：主表更新，items 若传入则整体替换
// 报关责任从「请选择」变为正式值（或责任已明确但单据缺失）时，自动补生成单据默认数据
const REAL_CUSTOMS = ['我司代办报关', '客户自行报关'];
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    sanitizeDates(data);
    if (data.show_special_req !== undefined) data.show_special_req = toBool(data.show_special_req);
    if (data.show_stamp !== undefined) data.show_stamp = toBool(data.show_stamp);
    if (data.show_hs_code !== undefined) data.show_hs_code = toBool(data.show_hs_code);
    const hasItems = Array.isArray(req.body.items);

    // 权限剥离：
    // - 业务员(3)：不可编辑任何单据数据（5 个单据字段全部剥离）
    // - 跟单(5)：可编辑 PO/合同 + 报关物流（负责生产跟单和订舱报关）
    // - 主管(2)/管理员(1)：全部字段可编辑
    const lvl = Number(req.operator?.permission_level);
    if (lvl === 3) {
      for (const f of ['purchase_contract', 'production_order', 'booking_data', 'customs_data', 'decl_data']) {
        delete data[f];
      }
    }

    if (Object.keys(data).length === 0 && !hasItems) return res.fail('无可更新字段', 400);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 读取原订单（行锁），用于判断报关责任转变与单据缺失
      const [[oldRow]] = await conn.query(
        'SELECT * FROM orders WHERE id = ? FOR UPDATE',
        [req.params.id]
      );
      if (!oldRow) {
        await conn.rollback();
        return res.fail('订单不存在', 404);
      }
      const denied = checkOwnership(oldRow, req, '订单');
      if (denied) {
        await conn.rollback();
        return res.fail(denied, 404);
      }

      let docsGenerated = false;
      const oldResp = oldRow.customs_responsibility;
      const newResp = data.customs_responsibility !== undefined
        ? data.customs_responsibility
        : oldResp;
      const docsMissing = !oldRow.purchase_contract && !oldRow.production_order;
      const respChanged = oldResp !== newResp && REAL_CUSTOMS.includes(newResp);
      // 明细变更时也触发重新生成（保留用户已编辑字段）
      const itemsChanged = hasItems;

      // 报关责任变为「客户自行报关」时，清理我司专属单据（订舱/清关/报关）
      // 覆盖场景：请选择→客户自行报关、我司代办→客户自行报关
      if (respChanged && newResp === '客户自行报关') {
        data.booking_data = null;
        data.customs_data = null;
        data.decl_data = null;
      }

      if (REAL_CUSTOMS.includes(newResp) && (docsMissing || respChanged || itemsChanged)) {
        // 合并更新前后的字段作为单据生成上下文
        const merged = { ...oldRow, ...data };
        const rawItems = hasItems
          ? req.body.items.filter((it) => it && (it.model || it.supplier_model || it.product_id || it.name_en))
          : (await conn.query('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]))[0];
        const [coRows] = await conn.query('SELECT name_cn, name_en, tel FROM company_settings LIMIT 1');
        const co = coRows[0] || {};
        const [clRows] = merged.client_id ? await conn.query('SELECT name_en FROM clients WHERE id = ?', [merged.client_id]) : [[]];
        const cl = clRows[0] || {};
        const [suRows] = merged.supplier_id ? await conn.query('SELECT name FROM suppliers WHERE id = ?', [merged.supplier_id]) : [[]];
        const su = suRows[0] || {};
        // 按供应商分组拆分子合同
        const queryFn = async (sql, params) => (await conn.query(sql, params))[0];
        const { productSupplierMap, suppliersMap } = await buildSupplierMaps(rawItems, queryFn);
        const docs = generateDefaultDocuments(merged.pi_number, merged.signing_date, newResp, rawItems, {
          client_id: merged.client_id,
          company_name_cn: co.name_cn, company_name_en: co.name_en, company_tel: co.tel,
          client_name_en: cl.name_en,
          supplier_name: su.name,
          currency: merged.currency, trade_terms: merged.trade_terms,
          loading_port: merged.loading_port, destination_port: merged.destination_port,
          delivery_date: merged.delivery_date, payment_terms: merged.payment_terms,
          productSupplierMap, suppliersMap
        });

        // 保留旧 production_order / purchase_contract 中用户已编辑的字段
        if (!docsMissing) {
          let oldPo = {};
          try { oldPo = typeof oldRow.production_order === 'string' ? JSON.parse(oldRow.production_order) : (oldRow.production_order || {}); } catch {}
          const preservePoKeys = ['item_extensions', 'product_config_data', 'product_config_types', 'plug_photos', 'remark_note', 'po_number'];
          for (const k of preservePoKeys) {
            if (oldPo[k] !== undefined && oldPo[k] !== null) docs.production_order[k] = oldPo[k];
          }
          // 核心修复：如果旧单据已有 sub_orders（已归类），保留旧分组结构（product_ids/supplier_id）
          // 只更新编号和独立字段，不重新 groupBySupplier——防止产品因 supplier_id 变化跳槽
          if (Array.isArray(oldPo.sub_orders) && oldPo.sub_orders.length > 0) {
            docs.production_order.sub_orders = oldPo.sub_orders.map((oldSub, idx) => {
              const newSub = (Array.isArray(docs.production_order.sub_orders) && docs.production_order.sub_orders[idx]) || {};
              // 保留旧分组结构，更新编号（如果需要递增）和独立字段
              return {
                ...oldSub,
                // 允许新生成的编号覆盖（如果旧编号为空）
                po_number: oldSub.po_number || newSub.po_number || '',
                sub_contract_no: oldSub.sub_contract_no || newSub.sub_contract_no || '',
                // 独立字段优先保留旧值
                tech_req: oldSub.tech_req || newSub.tech_req || '',
                mark_req: oldSub.mark_req || newSub.mark_req || ''
              };
            });
          } else if (Array.isArray(oldPo.sub_orders) && Array.isArray(docs.production_order.sub_orders)) {
            // 旧单据无 sub_orders，新生成的有 → 正常用新生成的分组
            docs.production_order.sub_orders.forEach(newSub => {
              const oldSub = oldPo.sub_orders.find(s => s.supplier_id === newSub.supplier_id);
              if (oldSub) {
                const subKeys = ['product_config_data', 'product_config_types', 'plug_photos', 'remark_note', 'tech_req', 'mark_req'];
                for (const k of subKeys) {
                  if (oldSub[k] !== undefined && oldSub[k] !== null) newSub[k] = oldSub[k];
                }
              }
            });
          }

          let oldPc = {};
          try { oldPc = typeof oldRow.purchase_contract === 'string' ? JSON.parse(oldRow.purchase_contract) : (oldRow.purchase_contract || {}); } catch {}
          const preservePcKeys = ['bank_account_id', 'delivery_address', 'contract_date', 'signing_date', 'payment_route_type', 'payment_routing_note'];
          for (const k of preservePcKeys) {
            if (oldPc[k] !== undefined && oldPc[k] !== null) docs.purchase_contract[k] = oldPc[k];
          }
          // 核心修复：旧单据已有 sub_contracts（已归类）→ 保留旧分组结构（product_ids/supplier_id）
          if (Array.isArray(oldPc.sub_contracts) && oldPc.sub_contracts.length > 0) {
            docs.purchase_contract.sub_contracts = oldPc.sub_contracts.map((oldSub, idx) => {
              const newSub = (Array.isArray(docs.purchase_contract.sub_contracts) && docs.purchase_contract.sub_contracts[idx]) || {};
              return {
                ...oldSub,
                contract_no: oldSub.contract_no || newSub.contract_no || ''
              };
            });
          } else if (Array.isArray(oldPc.sub_contracts) && Array.isArray(docs.purchase_contract.sub_contracts)) {
            docs.purchase_contract.sub_contracts.forEach(newSub => {
              const oldSub = oldPc.sub_contracts.find(s => s.supplier_id === newSub.supplier_id);
              if (oldSub) {
                const subKeys = ['bank_account_id', 'delivery_address', 'contract_date', 'signing_date', 'payment_route_type', 'payment_routing_note'];
                for (const k of subKeys) {
                  if (oldSub[k] !== undefined && oldSub[k] !== null) newSub[k] = oldSub[k];
                }
              }
            });
          }
        }

        // 弹窗本次提交的合同字段优先于重新生成的默认值（收款方式/路由备注/各条款等）
        let bodyPc = {};
        try { bodyPc = typeof data.purchase_contract === 'string' ? JSON.parse(data.purchase_contract) : (data.purchase_contract || {}); } catch {}
        const submittedPcKeys = ['contract_no', 'sign_date', 'buyer_name', 'buyer_credit_code', 'buyer_address',
          'supplier_name', 'supplier_credit_code', 'supplier_address',
          'quality_notes',
          'delivery_location', 'delivery_time', 'packing_req',
          'payment_route_type', 'payment_routing_note',
          'other_clauses'];
        for (const k of submittedPcKeys) {
          if (bodyPc[k] !== undefined) docs.purchase_contract[k] = bodyPc[k];
        }
        if (Array.isArray(bodyPc.sub_contracts) && Array.isArray(docs.purchase_contract.sub_contracts)) {
          docs.purchase_contract.sub_contracts.forEach(newSub => {
            const bodySub = bodyPc.sub_contracts.find(s => s.supplier_id === newSub.supplier_id);
            if (bodySub) {
              for (const k of submittedPcKeys) {
                if (bodySub[k] !== undefined) newSub[k] = bodySub[k];
              }
            }
          });
        }

        // 仅覆盖当前责任应生成的单据，避免 null 覆盖
        Object.assign(data, docs);
        docsGenerated = true;
      }

      serializeJsonFields(data);
      if (Object.keys(data).length > 0) {
        const [r] = await conn.query('UPDATE orders SET ? WHERE id = ?', [data, req.params.id]);
        if (r.affectedRows === 0) {
          await conn.rollback();
          return res.fail('订单不存在', 404);
        }
      }
      if (hasItems) {
        await conn.query('DELETE FROM order_items WHERE order_id = ?', [req.params.id]);
        const items = await normalizeItems(req.body.items, conn);
        if (items.length) {
          await conn.query(
            `INSERT INTO order_items (order_id, ${ITEM_FIELDS.join(', ')}) VALUES ?`,
            [items.map((row) => [Number(req.params.id), ...row])]
          );
        }
      }
      // 记录操作日志（oldRow 在事务开头已读取，含 pi_number）
      await logOperation(conn, {
        module: 'order', action: '修改',
        targetId: Number(req.params.id), targetNo: oldRow.pi_number, operator: req.operator
      });
      await conn.commit();
      res.success(
        { id: Number(req.params.id), docs_generated: docsGenerated },
        docsGenerated ? '更新成功，已根据报关责任自动生成购销合同等单据默认数据' : '更新成功'
      );
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

// 删除：事务内先删明细，再删主表，最后回退关联报价单状态
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const orderId = Number(req.params.id);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 0. 删除前捕获关联报价单 ID（回退用）
      const [[orderBefore]] = await conn.query(
        'SELECT quotation_id FROM orders WHERE id = ?',
        [orderId]
      );
      if (!orderBefore) {
        await conn.rollback();
        return res.fail('订单不存在', 404);
      }
      const denied = checkOwnership(orderBefore, req, '订单');
      if (denied) {
        await conn.rollback();
        return res.fail(denied, 404);
      }

      await conn.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
      const [r] = await conn.query('DELETE FROM orders WHERE id = ?', [orderId]);
      if (r.affectedRows === 0) {
        await conn.rollback();
        return res.fail('订单不存在', 404);
      }

      // 1. 若报价单曾被标记为「已转PI」，且当前没有其他订单仍引用它 → 回退为「已报价」
      if (orderBefore && orderBefore.quotation_id) {
        const quotationId = orderBefore.quotation_id;
        const [[{ cnt }]] = await conn.query(
          'SELECT COUNT(*) AS cnt FROM orders WHERE quotation_id = ?',
          [quotationId]
        );
        if (cnt === 0) {
          await conn.query(
            "UPDATE quotations SET status = '已报价' WHERE id = ? AND status = '已转PI'",
            [quotationId]
          );
        }
      }

      await conn.commit();
      res.success({ id: orderId }, '删除成功');
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

module.exports = router;
