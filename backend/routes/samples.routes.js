const express = require('express');
const pool = require('../config/db');
const { asyncHandler, parsePagination, pickFields, isScopedOperator, checkOwnership, addDetailThumbToWorksheet, clearUnusedDetailRows, rebuildPoMerges, rebuildDetailMerges } = require('../utils/helpers');
const { generateDefaultDocuments, buildSupplierMaps } = require('../utils/documents');
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
  'sample_number', 'client_id', 'supplier_id', 'address', 'rfq_id',
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
  'product_id', 'model', 'supplier_model', 'name_en', 'hs_code',
  'img_url', 'spec', 'qty', 'unit', 'model_custom', 'notes',
  // 对齐订单明细的价格/包装字段（028 迁移新增）
  'price', 'price_rmb', 'cost_cny', 'subtotal_amount',
  'nw_per_ctn', 'gw_per_ctn', 'cbm_per_ctn'
];

// 明细行清洗：允许 model 为空（自定义产品），price 允许为 0；联动重算小计
function normalizeItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter((it) => it && (it.model || it.model_custom || it.product_id || it.name_en))
    .map((it) => {
      const row = { ...it };
      const qty = Number(row.qty || 0);
      const pcs = Number(row.pcs_per_ctn || 0);
      // 单价：cost_cny 优先，price 回退，都空给 0
      const price = Number(row.cost_cny !== undefined && row.cost_cny !== ''
        ? row.cost_cny
        : (row.price !== undefined && row.price !== '' ? row.price : 0));
      row.price = price;
      row.cost_cny = price;
      if (pcs > 0) row.ctns = Math.ceil(qty / pcs);
      row.subtotal_amount = Number((qty * price).toFixed(2));
      return ITEM_FIELDS.map((f) => (row[f] === undefined || row[f] === '' ? null : row[f]));
    });
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

// 生成下一个样品单号（格式 SMPNNN，无前缀横杠和年份，全局递增）
router.get(
  '/next-number',
  asyncHandler(async (req, res) => {
    const yy = String(new Date().getFullYear()).slice(2);
    const prefix = 'SMP' + yy;
    const [[row]] = await pool.query(
      `SELECT sample_number FROM samples_tracking
       WHERE sample_number LIKE ?
       ORDER BY CAST(RIGHT(sample_number, LENGTH(sample_number) - ${prefix.length}) AS UNSIGNED) DESC
       LIMIT 1`,
      [prefix + '%']
    );
    let seq = 1;
    if (row) {
      const m = row.sample_number.match(/(\d{3})$/);
      if (m) seq = parseInt(m[1], 10) + 1;
    }
    res.success(prefix + String(seq).padStart(3, '0'));
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
      `SELECT s.*, c.name_en AS client_name, c.short_name AS client_short_name, c.country AS country,
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

// 详情：主表（含客户名称/简称）+ 明细行
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [[sample]] = await pool.query(
      `SELECT s.*, c.name_en AS client_name, c.short_name AS client_short_name
       FROM samples_tracking s
       LEFT JOIN clients c ON s.client_id = c.id
       WHERE s.id = ?`,
      [req.params.id]
    );
    if (!sample) return res.fail('样品单不存在', 404);
    const denied = checkOwnership(sample, req, '样品单');
    if (denied) return res.fail(denied, 404);
    const [items] = await pool.query(
      `SELECT si.*, p.spec_cn, p.our_model AS product_our_model, p.purchase_cost_rmb AS product_purchase_cost,
              p.supplier_id AS product_supplier_id, p.product_type AS product_type, s.name AS product_supplier_name
       FROM sample_items si
       LEFT JOIN products p ON si.product_id = p.id
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE si.sample_id = ?
       ORDER BY si.id ASC`,
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

    // 样品单号自动生成 + 唯一性校验（格式 SMP${yy}NNN，两位年份后缀区分年份）
    const yy = String(new Date().getFullYear()).slice(2);
    const prefix = 'SMP' + yy;
    if (!data.sample_number) {
      const [[row]] = await pool.query(
        `SELECT sample_number FROM samples_tracking
         WHERE sample_number LIKE ?
         ORDER BY CAST(RIGHT(sample_number, LENGTH(sample_number) - ${prefix.length}) AS UNSIGNED) DESC
         LIMIT 1`,
        [prefix + '%']
      );
      let seq = 1;
      if (row) {
        const m = row.sample_number.match(/(\d{3})$/);
        if (m) seq = parseInt(m[1], 10) + 1;
      }
      data.sample_number = prefix + String(seq).padStart(3, '0');
    } else {
      const [[dup]] = await pool.query(
        'SELECT id FROM samples_tracking WHERE sample_number = ?',
        [data.sample_number]
      );
      if (dup) {
        const [[row]] = await pool.query(
          `SELECT sample_number FROM samples_tracking
           WHERE sample_number LIKE ?
           ORDER BY CAST(RIGHT(sample_number, LENGTH(sample_number) - ${prefix.length}) AS UNSIGNED) DESC
           LIMIT 1`,
          [prefix + '%']
        );
        let seq = 1;
        if (row) {
          const m = row.sample_number.match(/(\d{3})$/);
          if (m) seq = parseInt(m[1], 10) + 1;
        }
        data.sample_number = prefix + String(seq).padStart(3, '0');
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
    // 按供应商分组拆分子合同：从 product_id 反查 products.supplier_id
    const queryFn = async (sql, params) => (await pool.query(sql, params))[0];
    const { productSupplierMap, suppliersMap } = await buildSupplierMaps(rawItems, queryFn);
    const docs = generateDefaultDocuments(data.sample_number, data.signing_date, '客户自行报关', rawItems, {
      client_id: data.client_id,
      company_name_cn: co.name_cn, company_name_en: co.name_en, company_tel: co.tel,
      client_name_en: cl.name_en,
      supplier_name: su.name,
      currency: data.currency, trade_terms: data.trade_terms,
      loading_port: '', destination_port: '',
      delivery_date: data.delivery_date, payment_terms: data.payment_terms,
      productSupplierMap, suppliersMap
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

    // 明细变更（hasItems）或单据缺失时，重新生成购销合同/生产任务单
    // 保留用户已编辑的字段（item_extensions / 电气配置 / 图片 / 备注 / 收款账号 等）
    let docsGenerated = false;
    const oldHasDocs = before.purchase_contract && before.production_order;
    const needRegen = hasItems || !oldHasDocs;
    if (needRegen) {
      const [[sRow2]] = await pool.query('SELECT sample_number, signing_date, client_id, currency, trade_terms, delivery_date, payment_terms FROM samples_tracking WHERE id = ?', [req.params.id]);
      if (sRow2) {
        const rawItems = hasItems
          ? req.body.items.filter(it => it && (it.model || it.supplier_model || it.product_id || it.name_en || it.model_custom))
          : (await pool.query('SELECT * FROM sample_items WHERE sample_id = ?', [req.params.id]))[0];
        const [coRows] = await pool.query('SELECT name_cn, name_en, tel FROM company_settings LIMIT 1');
        const co = coRows[0] || {};
        const [clRows] = sRow2.client_id ? await pool.query('SELECT name_en FROM clients WHERE id = ?', [sRow2.client_id]) : [[]];
        const cl = clRows[0] || {};
        // 按供应商分组拆分子合同
        const queryFn2 = async (sql, params) => (await pool.query(sql, params))[0];
        const { productSupplierMap: psMap, suppliersMap: sMap } = await buildSupplierMaps(rawItems, queryFn2);
        const docs = generateDefaultDocuments(sRow2.sample_number, sRow2.signing_date, '客户自行报关', rawItems, {
          client_id: sRow2.client_id,
          company_name_cn: co.name_cn, company_name_en: co.name_en, company_tel: co.tel,
          client_name_en: cl.name_en,
          supplier_name: '',
          currency: sRow2.currency, trade_terms: sRow2.trade_terms,
          loading_port: '', destination_port: '',
          delivery_date: sRow2.delivery_date, payment_terms: sRow2.payment_terms,
          // 按供应商分组拆分子合同
          productSupplierMap: psMap, suppliersMap: sMap
        });

        // 保留旧 production_order 中用户已编辑的字段
        if (oldHasDocs) {
          let oldPo = {};
          try { oldPo = typeof before.production_order === 'string' ? JSON.parse(before.production_order) : (before.production_order || {}); } catch {}
          const preservePoKeys = ['item_extensions', 'product_config_data', 'product_config_types', 'plug_photos', 'remark_note', 'po_number'];
          for (const k of preservePoKeys) {
            if (oldPo[k] !== undefined && oldPo[k] !== null) docs.production_order[k] = oldPo[k];
          }
          // 核心修复：旧单据已有 sub_orders（已归类）→ 保留旧分组结构（product_ids/supplier_id）
          if (Array.isArray(oldPo.sub_orders) && oldPo.sub_orders.length > 0) {
            docs.production_order.sub_orders = oldPo.sub_orders.map((oldSub, idx) => {
              const newSub = (Array.isArray(docs.production_order.sub_orders) && docs.production_order.sub_orders[idx]) || {};
              return {
                ...oldSub,
                po_number: oldSub.po_number || newSub.po_number || '',
                sub_contract_no: oldSub.sub_contract_no || newSub.sub_contract_no || '',
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

          // 保留旧 purchase_contract 中用户已编辑的字段
          let oldPc = {};
          try { oldPc = typeof before.purchase_contract === 'string' ? JSON.parse(before.purchase_contract) : (before.purchase_contract || {}); } catch {}
          const preservePcKeys = ['bank_account_id', 'delivery_address', 'contract_date', 'signing_date', 'payment_route_type', 'payment_routing_note'];
          for (const k of preservePcKeys) {
            if (oldPc[k] !== undefined && oldPc[k] !== null) docs.purchase_contract[k] = oldPc[k];
          }
          // 核心修复：旧单据已有 sub_contracts（已归类）→ 保留旧分组结构
          if (Array.isArray(oldPc.sub_contracts) && oldPc.sub_contracts.length > 0) {
            docs.purchase_contract.sub_contracts = oldPc.sub_contracts.map((oldSub, idx) => {
              const newSub = (Array.isArray(docs.purchase_contract.sub_contracts) && docs.purchase_contract.sub_contracts[idx]) || {};
              return {
                ...oldSub,
                contract_no: oldSub.contract_no || newSub.contract_no || ''
              };
            });
          } else if (Array.isArray(oldPc.sub_contracts) && Array.isArray(docs.purchase_contract.sub_contracts)) {
            // 旧单据无 sub_contracts，新生成的有 → 正常用新生成的分组
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

// 构建统一采购备注文本：从 product_config_data + 其他字段 + remark_note 组装
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

// 样品单导出采购订货单 .xlsx（基于新8列模板填值）
router.get(
  '/:id/purchase-order-xlsx',
  asyncHandler(async (req, res) => {
    // 业务员(3)只读：不可下载采购订货单 Excel
    if (req.operator.permission_level === 3) return res.fail('业务员无权下载采购订货单 Excel', 403);
    const [[sample]] = await pool.query(
      `SELECT s.*, COALESCE(NULLIF(c.short_name, ''), c.name_en) AS client_name
       FROM samples_tracking s
       LEFT JOIN clients c ON s.client_id = c.id
       WHERE s.id = ?`,
      [req.params.id]
    );
    if (!sample) return res.fail('样品单不存在', 404);
    const denied = checkOwnership(sample, req, '样品单');
    if (denied) return res.fail(denied, 404);

    const [items] = await pool.query(
      `SELECT si.*, p.spec_cn, p.our_model AS product_our_model, p.supplier_id AS product_supplier_id,
              p.pcs_per_ctn AS pcs_per_ctn
       FROM sample_items si
       LEFT JOIN products p ON si.product_id = p.id
       WHERE si.sample_id = ? ORDER BY si.id ASC`,
      [sample.id]
    );

    const po = parsePo(sample.production_order);
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

    // 查询产品配置字段定义
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
    ws.getCell('C3').value = sample.client_name || '';
    ws.getCell('G3').value = src.po_number || subOrder?.po_number || subOrder?.sub_contract_no || po.po_number || po.po_no || (sample.sample_number ? sample.sample_number + 'PO' : '');
    ws.getCell('C4').value = (req.operator && (req.operator.display_name || req.operator.username)) || '';
    ws.getCell('E4').value = new Date().toISOString().slice(0, 10);
    ws.getCell('G4').value = (sample.delivery_date || '').slice(0, 10);

    // ===== 明细行准备 =====
    const hasSnapshot = !subOrder && exts.length > 0 && exts[0] && exts[0].model !== undefined;
    const detailRows = hasSnapshot
      ? exts.map((e) => ({
          model: e.supplier_model || e.model || '',
          qty: Number(e.qty) || 0,
          img_url: e.img_url || '',
          pcs_per_ctn: e.pcs_per_ctn || '',
          detail_spec: e.detail_spec || '',
          remark: e.remark || ''
        }))
      : filteredItems.map((it, i) => {
          const ext = exts[i] || {};
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

    // ===== 重建固定区合并 =====
    rebuildPoMerges(ws, extra);
    // ===== 重建明细行 F:G 合并 =====
    rebuildDetailMerges(ws, DETAIL_START, Math.max(detailRows.length, DETAIL_CAPACITY + extra));

    // ===== 明细写入 =====
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
    const filename = `PurchaseOrder_${sample.sample_number || 'export'}${fileSuffix}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    await wb.xlsx.write(res);
    res.end();
  })
);

module.exports = router;
