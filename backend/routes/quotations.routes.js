const express = require('express');
const pool = require('../config/db');
const { asyncHandler, parsePagination, pickFields } = require('../utils/helpers');

const router = express.Router();

const ALLOWED = [
  'quotation_number', 'quotation_date', 'valid_until', 'client_id',
  'currency', 'price_terms', 'lead_time', 'payment_terms',
  'loading_port', 'destination_port', 'remark', 'total_amount', 'status', 'rfq_id'
];
const REQUIRED = ['quotation_number', 'quotation_date', 'client_id'];
const ITEM_FIELDS = ['product_id', 'model', 'img_url', 'spec', 'packing_desc', 'price', 'moq', 'load_quantity_desc'];

// 明细行清洗：必须有型号与单价，其余字段做快照透传
function normalizeItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter((it) => it && it.model && it.price !== undefined && it.price !== '')
    .map((it) => ITEM_FIELDS.map((f) => (it[f] === undefined || it[f] === '' ? null : it[f])));
}

// 列表：联查客户名，支持关键词 + 状态筛选
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req);
    const q = (req.query.q || '').trim();
    const status = (req.query.status || '').trim();
    const conditions = [];
    const params = [];
    if (q) {
      conditions.push('(qt.quotation_number LIKE ? OR c.name_en LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
    if (status) {
      conditions.push('qt.status = ?');
      params.push(status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM quotations qt LEFT JOIN clients c ON qt.client_id = c.id ${where}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT qt.*, c.name_en AS client_name,
              (SELECT COUNT(*) FROM quotation_items qi WHERE qi.quotation_id = qt.id) AS item_count
       FROM quotations qt
       LEFT JOIN clients c ON qt.client_id = c.id
       ${where} ORDER BY qt.id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    res.success({ list: rows, total, page, pageSize });
  })
);

// 详情：主表 + 明细行
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [[quotation]] = await pool.query('SELECT * FROM quotations WHERE id = ?', [req.params.id]);
    if (!quotation) return res.fail('报价单不存在', 404);
    const [items] = await pool.query(
      'SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id ASC',
      [quotation.id]
    );
    res.success({ ...quotation, items });
  })
);

// 创建：主表 + 明细整体在事务内写入
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    const missing = REQUIRED.filter((k) => !data[k]);
    if (missing.length) return res.fail(`缺少必填字段: ${missing.join(', ')}`, 400);
    const items = normalizeItems(req.body.items);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.query('INSERT INTO quotations SET ?', data);
      if (items.length) {
        await conn.query(
          `INSERT INTO quotation_items (quotation_id, ${ITEM_FIELDS.join(', ')}) VALUES ?`,
          [items.map((row) => [r.insertId, ...row])]
        );
      }
      await conn.commit();
      res.success({ id: r.insertId, item_count: items.length }, '创建成功');
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
    const hasItems = Array.isArray(req.body.items);
    if (Object.keys(data).length === 0 && !hasItems) return res.fail('无可更新字段', 400);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.query('UPDATE quotations SET ? WHERE id = ?', [data, req.params.id]);
      if (r.affectedRows === 0) {
        await conn.rollback();
        return res.fail('报价单不存在', 404);
      }
      if (hasItems) {
        await conn.query('DELETE FROM quotation_items WHERE quotation_id = ?', [req.params.id]);
        const items = normalizeItems(req.body.items);
        if (items.length) {
          await conn.query(
            `INSERT INTO quotation_items (quotation_id, ${ITEM_FIELDS.join(', ')}) VALUES ?`,
            [items.map((row) => [Number(req.params.id), ...row])]
          );
        }
      }
      await conn.commit();
      res.success({ id: Number(req.params.id) }, '更新成功');
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

// 删除：明细无外键约束，事务内先删明细
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM quotation_items WHERE quotation_id = ?', [req.params.id]);
      const [r] = await conn.query('DELETE FROM quotations WHERE id = ?', [req.params.id]);
      if (r.affectedRows === 0) {
        await conn.rollback();
        return res.fail('报价单不存在', 404);
      }
      await conn.commit();
      res.success({ id: Number(req.params.id) }, '删除成功');
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

module.exports = router;
