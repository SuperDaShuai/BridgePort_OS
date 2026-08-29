const express = require('express');
const pool = require('../config/db');
const { asyncHandler, parsePagination, pickFields } = require('../utils/helpers');

const router = express.Router();

const ALLOWED = ['route_type', 'bank_name', 'account_number', 'swift_code', 'routing_note'];
const REQUIRED = ['route_type', 'bank_name', 'account_number', 'swift_code'];

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req);
    const q = (req.query.q || '').trim();
    const where = q ? 'WHERE route_type LIKE ? OR bank_name LIKE ? OR account_number LIKE ?' : '';
    const params = q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [];

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM bank_accounts ${where}`, params);
    const [rows] = await pool.query(
      `SELECT * FROM bank_accounts ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    res.success({ list: rows, total, page, pageSize });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    const missing = REQUIRED.filter((k) => !data[k]);
    if (missing.length) return res.fail(`缺少必填字段: ${missing.join(', ')}`, 400);

    const [r] = await pool.query('INSERT INTO bank_accounts SET ?', data);
    res.success({ id: r.insertId }, '创建成功');
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    if (Object.keys(data).length === 0) return res.fail('无可更新字段', 400);

    const [r] = await pool.query('UPDATE bank_accounts SET ? WHERE id = ?', [data, req.params.id]);
    if (r.affectedRows === 0) return res.fail('银行账户不存在', 404);
    res.success({ id: Number(req.params.id) }, '更新成功');
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const [r] = await pool.query('DELETE FROM bank_accounts WHERE id = ?', [req.params.id]);
    if (r.affectedRows === 0) return res.fail('银行账户不存在', 404);
    res.success({ id: Number(req.params.id) }, '删除成功');
  })
);

module.exports = router;
