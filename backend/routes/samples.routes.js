const express = require('express');
const pool = require('../config/db');
const { asyncHandler, parsePagination, pickFields, isScopedOperator, checkOwnership } = require('../utils/helpers');
const { generateDefaultDocuments } = require('../utils/documents');
const { logOperation, ownerOf } = require('../utils/operation-log');
const ExcelJS = require('exceljs');
const path = require('path');

const router = express.Router();
const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', '采购订货单_模板.xlsx');

// 解析 production_order JSON 字段（字符串/对象兼容）
function parsePo(val) {
  if (!val) return {};
  if (typeof val === 'string') {
    try { return JSON.parse(val) || {} } catch { return {} }
  }
  return val;
}

// 样品单主表允许写入的字段
const ALLOWED = [
  'sample_number', 'client_id', 'supplier_id', 'rfq_id',
  'courier_name', 'tracking_number', 'sent_date',
  'sample_fee', 'freight_cost', 'feedback_status', 'client_feedback_note',
  // 关联订单化字段（027 迁移新增）
  'signing_date', 'delivery_date', 'trade_terms', 'currency',
  'bank_account_id', 'alipay_qrcode', 'payment_terms',
  'packing_desc', 'special_req', 'remarks',
  'show_special_req', 'show_stamp', 'show_hs_code',
  // 购销合同/生产任务单（033 迁移新增，样品单按客户自行报关逻辑生成）
  'purchase_contract', 'production_order'
];
const REQUIRED = ['sample_number', 'client_id'];

// 明细行允许写入的字段（对齐 order_items，保留样品特有的 model_custom/notes）
const ITEM_FIELDS = [
  'product_id', 'model', 'name_en', 'hs_code',
  'img_url', 'spec', 'qty', 'unit', 'model_custom', 'notes',
  // 对齐订单明细的价格/包装字段（028 迁移新增）
  'price', 'price_rmb', 'cost_cny', 'subtotal_amount',
  'nw_per_ctn', 'gw_per_ctn', 'cbm_per_ctn'
];

// 明细行清洗：必须有型号
function normalizeItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter((it) => it && it.model)
    .map((it) => ITEM_FIELDS.map((f) => (it[f] === undefined || it[f] === '' ? null : it[f])));
}

// date 字段空字符串 → null
const DATE_FIELDS = ['sent_date', 'signing_date', 'delivery_date'];
function sanitizeDates(data) {
  for (const f of DATE_FIELDS) {
    if (f in data && (data[f] === '' || data[f] === undefined)) {
      data[f] = null;
    }
  }
  return data;
}

// JSON 字段需序列化为字符串
const JSON_FIELDS = ['purchase_contract', 'production_order'];
function serializeJsonFields(data) {
  for (const f of JSON_FIELDS) {
    if (f in data && data[f] !== null && typeof data[f] === 'object') {
      data[f] = JSON.stringify(data[f]);
    }
  }
  return data;
}

// 生成下一个样品单号（格式 SMP-YYYY-NNN，年内递增）
router.get(
  '/next-number',
  asyncHandler(async (req, res) => {
    const year = new Date().getFullYear();
    const prefix = 'SMP-' + year;
    const [[row]] = await pool.query(
      `SELECT sample_number FROM samples_tracking
       WHERE sample_number LIKE ?
       ORDER BY sample_number DESC LIMIT 1`,
      [prefix + '-%']
    );
    let seq = 1;
    if (row) {
      const m = row.sample_number.match(/-(\d{3})$/);
      if (m) seq = parseInt(m[1], 10) + 1;
    }
    res.success(prefix + '-' + String(seq).padStart(3, '0'));
  })
);

// 列表：联查客户 + 明细品类数 + 总数量
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req);
    const q = (req.query.q || '').trim();
    const status = (req.query.status || '').trim();
    const conditions = [];
    const params = [];
    if (q) {
      conditions.push(
        '(s.sample_number LIKE ? OR c.name_en LIKE ? OR s.tracking_number LIKE ?)'
      );
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (status) {
      conditions.push('s.feedback_status = ?');
      params.push(status);
    }
    // 业务员只能看到自己创建的样品单
    if (isScopedOperator(req)) {
      conditions.push('s.owner_id = ?');
      params.push(req.operator.id);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM samples_tracking s LEFT JOIN clients c ON s.client_id = c.id ${where}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT s.*, c.name_en AS client_name,
              (SELECT COUNT(*) FROM sample_items si WHERE si.sample_id = s.id) AS item_count,
              (SELECT COALESCE(SUM(si.qty), 0) FROM sample_items si WHERE si.sample_id = s.id) AS total_qty,
              (SELECT GROUP_CONCAT(si.model SEPARATOR ', ') FROM sample_items si WHERE si.sample_id = s.id LIMIT 3) AS product_models
       FROM samples_tracking s
       LEFT JOIN clients c ON s.client_id = c.id
       ${where} ORDER BY s.id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    res.success({ list: rows, total, page, pageSize });
  })
);

// 详情：主表 + 明细行
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [[sample]] = await pool.query('SELECT * FROM samples_tracking WHERE id = ?', [req.params.id]);
    if (!sample) return res.fail('样品单不存在', 404);
    const denied = checkOwnership(sample, req, '样品单');
    if (denied) return res.fail(denied, 404);
    const [items] = await pool.query(
      'SELECT * FROM sample_items WHERE sample_id = ? ORDER BY id ASC',
      [sample.id]
    );
    res.success({ ...sample, items });
  })
);

// 创建：主表 + 明细整体在事务内写入
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    sanitizeDates(data);
    // 布尔字段归一为 0/1
    if (data.show_special_req !== undefined) data.show_special_req = data.show_special_req ? 1 : 0;
    if (data.show_stamp !== undefined) data.show_stamp = data.show_stamp ? 1 : 0;
    if (data.show_hs_code !== undefined) data.show_hs_code = data.show_hs_code ? 1 : 0;

    // 样品单号自动生成 + 唯一性校验
    const year = new Date().getFullYear();
    const prefix = 'SMP-' + year;
    if (!data.sample_number) {
      const [[row]] = await pool.query(
        `SELECT sample_number FROM samples_tracking
         WHERE sample_number LIKE ? ORDER BY sample_number DESC LIMIT 1`,
        [prefix + '-%']
      );
      let seq = 1;
      if (row) {
        const m = row.sample_number.match(/-(\d{3})$/);
        if (m) seq = parseInt(m[1], 10) + 1;
      }
      data.sample_number = prefix + '-' + String(seq).padStart(3, '0');
    } else {
      const [[dup]] = await pool.query(
        'SELECT id FROM samples_tracking WHERE sample_number = ?',
        [data.sample_number]
      );
      if (dup) {
        const [[row]] = await pool.query(
          `SELECT sample_number FROM samples_tracking
           WHERE sample_number LIKE ? ORDER BY sample_number DESC LIMIT 1`,
          [prefix + '-%']
        );
        let seq = (row ? parseInt(row.sample_number.match(/-(\d{3})$/)[1], 10) : 0) + 1;
        data.sample_number = prefix + '-' + String(seq).padStart(3, '0');
      }
    }

    const missing = REQUIRED.filter((k) => !data[k]);
    if (missing.length) return res.fail(`缺少必填字段: ${missing.join(', ')}`, 400);
    // 负责人自动写入当前登录人
    data.owner_name = ownerOf(req.operator);
    data.owner_id = req.operator.id;

    const items = normalizeItems(req.body.items);
    if (items.length === 0) return res.fail('请至少添加一行样品明细', 400);

    // 自动生成购销合同 + 生产任务单（样品单按「客户自行报关」逻辑，不生成订舱/清关/报关）
    const rawItems = (req.body.items || []).filter(it => it && it.model);
    const [coRows] = await pool.query('SELECT name_cn, name_en, tel FROM company_settings LIMIT 1');
    const co = coRows[0] || {};
    const [clRows] = data.client_id ? await pool.query('SELECT name_en FROM clients WHERE id = ?', [data.client_id]) : [[]];
    const cl = clRows[0] || {};
    const [suRows] = [[[]]]; // 样品单无供应商
    const su = {};
    const docs = generateDefaultDocuments(data.sample_number, data.signing_date, '客户自行报关', rawItems, {
      client_id: data.client_id,
      company_name_cn: co.name_cn, company_name_en: co.name_en, company_tel: co.tel,
      client_name_en: cl.name_en,
      supplier_name: su.name,
      currency: data.currency, trade_terms: data.trade_terms,
      loading_port: '', destination_port: '',
      delivery_date: data.delivery_date, payment_terms: data.payment_terms
    });
    data.purchase_contract = docs.purchase_contract;
    data.production_order = docs.production_order;
    serializeJsonFields(data);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.query('INSERT INTO samples_tracking SET ?', data);
      await conn.query(
        `INSERT INTO sample_items (sample_id, ${ITEM_FIELDS.join(', ')}) VALUES ?`,
        [items.map((row) => [r.insertId, ...row])]
      );
      await logOperation(conn, {
        module: 'sample', action: '新增',
        targetId: r.insertId, targetNo: data.sample_number, operator: req.operator
      });
      await conn.commit();
      res.success({ id: r.insertId, item_count: items.length, sample_number: data.sample_number }, '创建成功');
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

// 更新：主表更新，items 若传入则整体替换
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    sanitizeDates(data);
    // 布尔字段归一为 0/1
    if (data.show_special_req !== undefined) data.show_special_req = data.show_special_req ? 1 : 0;
    if (data.show_stamp !== undefined) data.show_stamp = data.show_stamp ? 1 : 0;
    if (data.show_hs_code !== undefined) data.show_hs_code = data.show_hs_code ? 1 : 0;
    const hasItems = Array.isArray(req.body.items);
    if (Object.keys(data).length === 0 && !hasItems) return res.fail('无可更新字段', 400);

    // 归属校验：业务员只能修改自己的样品单
    const [[before]] = await pool.query('SELECT * FROM samples_tracking WHERE id = ?', [req.params.id]);
    if (!before) return res.fail('样品单不存在', 404);
    const denied = checkOwnership(before, req, '样品单');
    if (denied) return res.fail(denied, 404);

    // 补生成缺失的购销合同/生产任务单（仅当两者都缺失时触发，避免覆盖已编辑数据）
    let docsGenerated = false;
    if (!before.purchase_contract && !before.production_order) {
      const [[sRow2]] = await pool.query('SELECT sample_number, signing_date, client_id, currency, trade_terms, delivery_date, payment_terms FROM samples_tracking WHERE id = ?', [req.params.id]);
      if (sRow2) {
        const rawItems = hasItems
          ? req.body.items.filter(it => it && it.model)
          : (await pool.query('SELECT * FROM sample_items WHERE sample_id = ?', [req.params.id]))[0];
        const [coRows] = await pool.query('SELECT name_cn, name_en, tel FROM company_settings LIMIT 1');
        const co = coRows[0] || {};
        const [clRows] = sRow2.client_id ? await pool.query('SELECT name_en FROM clients WHERE id = ?', [sRow2.client_id]) : [[]];
        const cl = clRows[0] || {};
        const docs = generateDefaultDocuments(sRow2.sample_number, sRow2.signing_date, '客户自行报关', rawItems, {
          client_id: sRow2.client_id,
          company_name_cn: co.name_cn, company_name_en: co.name_en, company_tel: co.tel,
          client_name_en: cl.name_en,
          supplier_name: '',
          currency: sRow2.currency, trade_terms: sRow2.trade_terms,
          loading_port: '', destination_port: '',
          delivery_date: sRow2.delivery_date, payment_terms: sRow2.payment_terms
        });
        data.purchase_contract = docs.purchase_contract;
        data.production_order = docs.production_order;
        docsGenerated = true;
      }
    }
    serializeJsonFields(data);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.query('UPDATE samples_tracking SET ? WHERE id = ?', [data, req.params.id]);
      if (r.affectedRows === 0) {
        await conn.rollback();
        return res.fail('样品单不存在', 404);
      }
      if (hasItems) {
        await conn.query('DELETE FROM sample_items WHERE sample_id = ?', [req.params.id]);
        const items = normalizeItems(req.body.items);
        if (items.length) {
          await conn.query(
            `INSERT INTO sample_items (sample_id, ${ITEM_FIELDS.join(', ')}) VALUES ?`,
            [items.map((row) => [Number(req.params.id), ...row])]
          );
        }
      }
      // 取业务编号记录操作日志
      const [[sRow]] = await conn.query('SELECT sample_number FROM samples_tracking WHERE id = ?', [req.params.id]);
      await logOperation(conn, {
        module: 'sample', action: '修改',
        targetId: Number(req.params.id), targetNo: sRow?.sample_number, operator: req.operator
      });
      await conn.commit();
      res.success({ id: Number(req.params.id), docs_generated: docsGenerated }, '更新成功');
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

// 删除：事务内先删明细，再删主表
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const sampleId = Number(req.params.id);

    // 归属校验：业务员只能删除自己的样品单
    const [[before]] = await pool.query('SELECT * FROM samples_tracking WHERE id = ?', [sampleId]);
    if (!before) return res.fail('样品单不存在', 404);
    const denied = checkOwnership(before, req, '样品单');
    if (denied) return res.fail(denied, 404);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM sample_items WHERE sample_id = ?', [sampleId]);
      const [r] = await conn.query('DELETE FROM samples_tracking WHERE id = ?', [sampleId]);
      if (r.affectedRows === 0) {
        await conn.rollback();
        return res.fail('样品单不存在', 404);
      }
      await conn.commit();
      res.success({ id: sampleId }, '删除成功');
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

// 样品单导出采购订货单 .xlsx（基于上传模板填值，100% 保留模板样式）
router.get(
  '/:id/purchase-order-xlsx',
  asyncHandler(async (req, res) => {
    const [[sample]] = await pool.query(
      `SELECT s.*, c.name_en AS client_name
       FROM samples_tracking s
       LEFT JOIN clients c ON s.client_id = c.id
       WHERE s.id = ?`,
      [req.params.id]
    );
    if (!sample) return res.fail('样品单不存在', 404);
    const denied = checkOwnership(sample, req, '样品单');
    if (denied) return res.fail(denied, 404);

    const [items] = await pool.query(
      `SELECT si.*, p.spec_cn, p.our_model AS supplier_model FROM sample_items si
       LEFT JOIN products p ON si.product_id = p.id
       WHERE si.sample_id = ? ORDER BY si.id ASC`,
      [sample.id]
    );

    const po = parsePo(sample.production_order);
    const exts = po.item_extensions || [];

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE_PATH);
    const ws = wb.getWorksheet('采购订货单');
    if (!ws) return res.fail('模板文件缺失或工作表名错误', 500);

    // ===== 抬头区 =====
    ws.getCell('C3').value = sample.client_name || '';
    ws.getCell('I3').value = po.po_number || (sample.sample_number ? sample.sample_number + '-POD' : '');
    ws.getCell('C4').value = new Date().toISOString().slice(0, 10);
    ws.getCell('E4').value = (sample.delivery_date || '').slice(0, 10);
    ws.getCell('I4').value = (req.operator && (req.operator.display_name || req.operator.username)) || '';

    // ===== 一、产品明细清单（模板预留 5 行：8-12）=====
    for (let i = 0; i < 5; i++) {
      const row = 8 + i;
      const it = items[i];
      const ext = exts[i] || {};
      ws.getCell(`A${row}`).value = i + 1;
      ws.getCell(`B${row}`).value = (it && (it.supplier_model || it.model)) || '';
      ws.getCell(`C${row}`).value = it ? (Number(it.qty) || 0) : '';
      ws.getCell(`D${row}`).value = ext.shell_color || '';
      ws.getCell(`E${row}`).value = ext.screen_spec || '';
      ws.getCell(`F${row}`).value = ext.sensor || '';
      ws.getCell(`G${row}`).value = ext.bracket || '';
      ws.getCell(`H${row}`).value = ext.pan_spec || '';
      ws.getCell(`I${row}`).value = ext.remark || '';
    }

    // ===== 二、核心电气、传感器与部件配置 =====
    ws.getCell('C18').value = po.board_model || '';
    ws.getCell('H18').value = po.charge_mode || '';
    ws.getCell('C19').value = po.work_voltage || '';
    ws.getCell('H19').value = po.ptc_protection || '';
    ws.getCell('C20').value = po.battery_spec || '';
    ws.getCell('H20').value = po.nameplate_seal_req || '';
    ws.getCell('C21').value = po.face_sticker_req || '';
    ws.getCell('H21').value = po.client_logo_req || '';
    ws.getCell('C22').value = po.packing_desc || '';
    // 值单元格统一靠左（模板中 C19/C20/C21 为居中，统一改为左对齐）
    for (const addr of ['C18', 'H18', 'C19', 'H19', 'C20', 'H20', 'C21', 'H21', 'C22']) {
      ws.getCell(addr).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    }

    // ===== 三、电源线规格 =====
    ws.getCell('C24').value = po.power_cord_spec || '';

    // ===== 四、质量要求与补充说明（C31-C36，从 production_order.quality_notes 读取） =====
    const DEFAULT_QUALITY_NOTES = [
      '面贴、外壳铭牌及彩盒/外箱所印客户LOGO必须严格按照确认矢量图档执行，确保字迹清晰、色号准确、无重影毛刺；',
      '工作电压、充电模式、电池规格、PTC保护等核心电气参数必须严格按本订单货单第二区块配置执行，出厂前每台需进行 100% 满负荷老化与连续通电测试 ≥ 24 小时；',
      '整机结构密封严格，主板做加厚防潮三防漆喷涂，按键手感灵敏，传感器经四角偏差及线性度校准；',
      '必须使用带PTC保护板电池，出厂前每台需进行 100% 满负荷老化与连续通电测试 ≥ 24 小时；',
      '每台包含主秤 1 台、不锈钢秤盘 1 块、标配电源线 1 条、中文说明书 1 份、合格证/保修卡 1 份、高透防尘罩 1 个；',
      '外箱清晰印制客户LOGO、产品型号、额定电压、净重/毛重、箱规尺寸及生产批次号，严禁混装。'
    ];
    const qualityNotes = Array.isArray(po.quality_notes) && po.quality_notes.length
      ? po.quality_notes
      : DEFAULT_QUALITY_NOTES.map((c) => ({ title: '', content: c }));
    for (let i = 0; i < 6; i++) {
      const cellRef = `C${31 + i}`;
      const item = qualityNotes[i] || { content: '' };
      ws.getCell(cellRef).value = item.content || DEFAULT_QUALITY_NOTES[i] || '';
    }

    // ===== 输出 .xlsx =====
    const filename = `PurchaseOrder_${sample.sample_number || 'export'}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    await wb.xlsx.write(res);
    res.end();
  })
);

module.exports = router;
