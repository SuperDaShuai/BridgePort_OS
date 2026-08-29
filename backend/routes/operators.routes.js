const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { asyncHandler, parsePagination, pickFields } = require('../utils/helpers');

const router = express.Router();

// 仅超级管理员（permission_level=1）可管理员工
const requireAdmin = (req, res, next) => {
  if (req.operator.permission_level !== 1) return res.fail('仅超级管理员可操作', 403);
  next();
};

// 员工管理全部接口：需要登录 + 管理员权限
router.use(auth, requireAdmin);

const ALLOWED = [
  'username', 'display_name', 'role', 'phone', 'email',
  'permission_level', 'status', 'hide_purchase_and_profit', 'hide_supplier_info'
];

// 列表（不返回密码哈希）
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req);
    const q = (req.query.q || '').trim();
    const where = q ? 'WHERE username LIKE ? OR display_name LIKE ? OR role LIKE ?' : '';
    const params = q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [];

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM operators ${where}`, params);
    const [rows] = await pool.query(
      `SELECT id, username, display_name, role, permission_level, status,
              hide_purchase_and_profit, hide_supplier_info, phone, email, created_at
       FROM operators ${where}
       ORDER BY permission_level ASC, id ASC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    res.success({ list: rows, total, page, pageSize });
  })
);

// 创建（初始密码必填）
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    if (!data.username) return res.fail('登录账号为必填', 400);
    if (!req.body.password) return res.fail('初始密码为必填', 400);
    data.password_hash = await bcrypt.hash(req.body.password, 10);

    const [r] = await pool.query('INSERT INTO operators SET ?', data);
    res.success({ id: r.insertId }, '创建成功');
  })
);

// 更新（密码留空则不修改）
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    if (req.body.password) data.password_hash = await bcrypt.hash(req.body.password, 10);
    if (Object.keys(data).length === 0) return res.fail('无可更新字段', 400);

    const [r] = await pool.query('UPDATE operators SET ? WHERE id = ?', [data, req.params.id]);
    if (r.affectedRows === 0) return res.fail('员工不存在', 404);
    res.success({ id: Number(req.params.id) }, '更新成功');
  })
);

// 删除（保护：不能删自己、不能删超级管理员）
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const [[target]] = await pool.query(
      'SELECT id, username, permission_level FROM operators WHERE id = ?',
      [req.params.id]
    );
    if (!target) return res.fail('员工不存在', 404);
    if (target.id === req.operator.id) return res.fail('不能删除当前登录账号', 403);
    if (target.permission_level === 1) return res.fail('超级管理员不可删除', 403);

    await pool.query('DELETE FROM operators WHERE id = ?', [req.params.id]);
    res.success({ id: target.id }, '删除成功');
  })
);

module.exports = router;
