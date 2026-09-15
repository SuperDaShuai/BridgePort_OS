const express = require('express');
const pool = require('../config/db');
const { asyncHandler, parsePagination, pickFields } = require('../utils/helpers');

const router = express.Router();

const ALLOWED = ['hs_code', 'product_name', 'declaration_elements'];

// 列表：支持按 HS编码 / 产品名称 搜索
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req);
    const q = (req.query.q || '').trim();
    const conditions = [];
    const params = [];
    if (q) {
      conditions.push('(hs_code LIKE ? OR product_name LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM hs_codes ${where}`, params);
    const [rows] = await pool.query(
      `SELECT * FROM hs_codes ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    res.success({ list: rows, total, page, pageSize });
  })
);

// 详情
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [[row]] = await pool.query('SELECT * FROM hs_codes WHERE id = ?', [req.params.id]);
    if (!row) return res.fail('HS编码记录不存在', 404);
    res.success(row);
  })
);

// 新增
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    if (!data.hs_code) return res.fail('HS编码为必填', 400);
    if (!data.product_name) return res.fail('HS产品名称为必填', 400);

    const [r] = await pool.query('INSERT INTO hs_codes SET ?', data);
    res.success({ id: r.insertId }, '创建成功');
  })
);

// 更新
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    if (Object.keys(data).length === 0) return res.fail('无可更新字段', 400);

    const [r] = await pool.query('UPDATE hs_codes SET ? WHERE id = ?', [data, req.params.id]);
    if (r.affectedRows === 0) return res.fail('HS编码记录不存在', 404);
    res.success({ id: Number(req.params.id) }, '更新成功');
  })
);

// 删除
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const [r] = await pool.query('DELETE FROM hs_codes WHERE id = ?', [req.params.id]);
    if (r.affectedRows === 0) return res.fail('HS编码记录不存在', 404);
    res.success({ id: Number(req.params.id) }, '删除成功');
  })
);

module.exports = router;
