const express = require('express');
const pool = require('../config/db');
const { asyncHandler, parsePagination, pickFields } = require('../utils/helpers');
const { generateDefaultDocuments } = require('../utils/documents');

const router = express.Router();

const ALLOWED = [
  'pi_number', 'signing_date', 'client_id', 'supplier_id',
  'currency', 'trade_terms', 'customs_responsibility', 'bank_account_id', 'alipay_qrcode',
  'payment_terms', 'delivery_date', 'loading_port', 'destination_port',
  'packing_desc', 'special_req', 'show_special_req', 'show_stamp', 'show_hs_code',
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
  'product_id', 'model', 'name_en', 'hs_code', 'unit',
  'img_url', 'spec',
  'pcs_per_ctn', 'ctns', 'qty',
  'price', 'cost_cny', 'subtotal_amount',
  'nw_per_ctn', 'gw_per_ctn', 'cbm_per_ctn'
];

// 明细行清洗：必须有型号与单价；联动重算箱数与外销小计
function normalizeItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter((it) => it && it.model && it.price !== undefined && it.price !== '')
    .map((it) => {
      const row = { ...it };
      const qty = Number(row.qty || 0);
      const pcs = Number(row.pcs_per_ctn || 0);
      if (pcs > 0) row.ctns = Math.ceil(qty / pcs);
      row.subtotal_amount = Number((qty * Number(row.price || 0)).toFixed(2));
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

// 生成下一个 PI 号（格式 BP-YYYY-NNN，年内递增）
router.get(
  '/next-number',
  asyncHandler(async (req, res) => {
    const year = new Date().getFullYear();
    const prefix = 'BP-' + year;
    const [[row]] = await pool.query(
      `SELECT pi_number FROM orders
       WHERE pi_number LIKE ?
       ORDER BY pi_number DESC LIMIT 1`,
      [prefix + '-%']
    );
    let seq = 1;
    if (row) {
      const m = row.pi_number.match(/-(\d{3})$/);
      if (m) seq = parseInt(m[1], 10) + 1;
    }
    res.success(prefix + '-' + String(seq).padStart(3, '0'));
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
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM orders o LEFT JOIN clients c ON o.client_id = c.id ${where}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT o.*, c.name_en AS client_name, s.name AS supplier_name,
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

// 详情：主表 + 明细行
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.fail('订单不存在', 404);
    const [items] = await pool.query(
      `SELECT oi.*, p.spec_cn
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?
       ORDER BY oi.id ASC`,
      [order.id]
    );
    res.success({ ...order, items });
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

    // PI 号自动生成 + 唯一性校验
    const year = new Date().getFullYear();
    const prefix = 'BP-' + year;
    if (!data.pi_number) {
      const [[row]] = await pool.query(
        `SELECT pi_number FROM orders
         WHERE pi_number LIKE ? ORDER BY pi_number DESC LIMIT 1`,
        [prefix + '-%']
      );
      let seq = 1;
      if (row) {
        const m = row.pi_number.match(/-(\d{3})$/);
        if (m) seq = parseInt(m[1], 10) + 1;
      }
      data.pi_number = prefix + '-' + String(seq).padStart(3, '0');
    } else {
      const [[dup]] = await pool.query(
        'SELECT id FROM orders WHERE pi_number = ?',
        [data.pi_number]
      );
      if (dup) {
        const [[row]] = await pool.query(
          `SELECT pi_number FROM orders
           WHERE pi_number LIKE ? ORDER BY pi_number DESC LIMIT 1`,
          [prefix + '-%']
        );
        let seq = 1;
        if (row) {
          const m = row.pi_number.match(/-(\d{3})$/);
          if (m) seq = parseInt(m[1], 10) + 1;
        }
        data.pi_number = prefix + '-' + String(seq).padStart(3, '0');
      }
    }

    const missing = REQUIRED.filter((k) => !data[k]);
    if (missing.length) return res.fail(`缺少必填字段: ${missing.join(', ')}`, 400);

    // 自动计算订单总金额（若前端未传）
    const items = normalizeItems(req.body.items);
    if (items.length === 0) return res.fail('请至少添加一行商品明细', 400);
    if (data.total_amount === undefined || data.total_amount === null) {
      data.total_amount = items.reduce((s, row) => {
        const idx = ITEM_FIELDS.indexOf('subtotal_amount');
        return s + (Number(row[idx]) || 0);
      }, 0);
    }

    // 自动生成单据默认数据（购销合同/生产任务单/订舱委托书/报关要素/清关资料）
    const rawItems = (req.body.items || []).filter(it => it && it.model);
    const customsResp = data.customs_responsibility || '我司代办报关';
    // 收集单据默认值所需上下文（企业抬头/客户/供应商）
    const [coRows] = await pool.query('SELECT name_cn, name_en, tel FROM company_settings LIMIT 1');
    const co = coRows[0] || {};
    const [clRows] = data.client_id ? await pool.query('SELECT name_en FROM clients WHERE id = ?', [data.client_id]) : [[]];
    const cl = clRows[0] || {};
    const [suRows] = data.supplier_id ? await pool.query('SELECT name FROM suppliers WHERE id = ?', [data.supplier_id]) : [[]];
    const su = suRows[0] || {};
    const docs = generateDefaultDocuments(data.pi_number, data.signing_date, customsResp, rawItems, {
      client_id: data.client_id,
      company_name_cn: co.name_cn, company_name_en: co.name_en, company_tel: co.tel,
      client_name_en: cl.name_en,
      supplier_name: su.name,
      currency: data.currency, trade_terms: data.trade_terms,
      loading_port: data.loading_port, destination_port: data.destination_port,
      delivery_date: data.delivery_date, payment_terms: data.payment_terms
    });
    Object.assign(data, docs);

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

      let docsGenerated = false;
      const newResp = data.customs_responsibility !== undefined
        ? data.customs_responsibility
        : oldRow.customs_responsibility;
      const docsMissing = !oldRow.purchase_contract && !oldRow.production_order;
      if (REAL_CUSTOMS.includes(newResp) && docsMissing) {
        // 合并更新前后的字段作为单据生成上下文
        const merged = { ...oldRow, ...data };
        const rawItems = hasItems
          ? req.body.items.filter((it) => it && it.model)
          : (await conn.query('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]))[0];
        const [coRows] = await conn.query('SELECT name_cn, name_en, tel FROM company_settings LIMIT 1');
        const co = coRows[0] || {};
        const [clRows] = merged.client_id ? await conn.query('SELECT name_en FROM clients WHERE id = ?', [merged.client_id]) : [[]];
        const cl = clRows[0] || {};
        const [suRows] = merged.supplier_id ? await conn.query('SELECT name FROM suppliers WHERE id = ?', [merged.supplier_id]) : [[]];
        const su = suRows[0] || {};
        const docs = generateDefaultDocuments(merged.pi_number, merged.signing_date, newResp, rawItems, {
          client_id: merged.client_id,
          company_name_cn: co.name_cn, company_name_en: co.name_en, company_tel: co.tel,
          client_name_en: cl.name_en,
          supplier_name: su.name,
          currency: merged.currency, trade_terms: merged.trade_terms,
          loading_port: merged.loading_port, destination_port: merged.destination_port,
          delivery_date: merged.delivery_date, payment_terms: merged.payment_terms
        });
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
        const items = normalizeItems(req.body.items);
        if (items.length) {
          await conn.query(
            `INSERT INTO order_items (order_id, ${ITEM_FIELDS.join(', ')}) VALUES ?`,
            [items.map((row) => [Number(req.params.id), ...row])]
          );
        }
      }
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
