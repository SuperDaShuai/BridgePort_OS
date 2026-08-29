const express = require('express');
const pool = require('../config/db');
const { asyncHandler, parsePagination, pickFields } = require('../utils/helpers');

const router = express.Router();

const ALLOWED = [
  'sample_number', 'client_id', 'product_id', 'model_custom', 'spec_desc',
  'qty', 'courier_name', 'tracking_number', 'sent_date',
  'sample_fee', 'freight_cost', 'feedback_status', 'client_feedback_note', 'rfq_id'
];
const REQUIRED = ['sample_number', 'client_id'];

// 列表：联查客户/产品，支持关键词 + 反馈状态筛选
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
        '(s.sample_number LIKE ? OR c.name_en LIKE ? OR s.model_custom LIKE ? OR s.tracking_number LIKE ?)'
      );
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (status) {
      conditions.push('s.feedback_status = ?');
      params.push(status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM samples_tracking s LEFT JOIN clients c ON s.client_id = c.id ${where}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT s.*, c.name_en AS client_name, p.model AS product_model
       FROM samples_tracking s
       LEFT JOIN clients c ON s.client_id = c.id
       LEFT JOIN products p ON s.product_id = p.id
       ${where} ORDER BY s.id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    res.success({ list: rows, total, page, pageSize });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [[sample]] = await pool.query('SELECT * FROM samples_tracking WHERE id = ?', [req.params.id]);
    if (!sample) return res.fail('样品单不存在', 404);
    res.success(sample);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    const missing = REQUIRED.filter((k) => !data[k]);
    if (missing.length) return res.fail(`缺少必填字段: ${missing.join(', ')}`, 400);

    const [r] = await pool.query('INSERT INTO samples_tracking SET ?', data);
    res.success({ id: r.insertId }, '创建成功');
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    if (Object.keys(data).length === 0) return res.fail('无可更新字段', 400);

    const [r] = await pool.query('UPDATE samples_tracking SET ? WHERE id = ?', [data, req.params.id]);
    if (r.affectedRows === 0) return res.fail('样品单不存在', 404);
    res.success({ id: Number(req.params.id) }, '更新成功');
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const [r] = await pool.query('DELETE FROM samples_tracking WHERE id = ?', [req.params.id]);
    if (r.affectedRows === 0) return res.fail('样品单不存在', 404);
    res.success({ id: Number(req.params.id) }, '删除成功');
  })
);

module.exports = router;
