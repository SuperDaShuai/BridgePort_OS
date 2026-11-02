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

// ===== 个人中心自助接口（仅需登录，不受管理员闸门限制）=====
// 本人账户信息
router.get(
  '/me',
  auth,
  asyncHandler(async (req, res) => {
    const [[me]] = await pool.query(
      `SELECT id, username, display_name, role, phone, email, permission_level, status, created_at
       FROM operators WHERE id = ?`,
      [req.operator.id]
    );
    if (!me) return res.fail('账户不存在', 404);
    res.success(me);
  })
);

// 修改本人密码：验证旧密码后立即生效，并写入修改记录（超级管理员可在员工管理中查看）
router.post(
  '/me/password',
  auth,
  asyncHandler(async (req, res) => {
    const { old_password, new_password } = req.body || {};
    if (!old_password || !new_password) return res.fail('请填写旧密码和新密码', 400);
    if (String(new_password).length < 6) return res.fail('新密码长度不能少于 6 位', 400);
    if (old_password === new_password) return res.fail('新密码不能与旧密码相同', 400);

    const [[me]] = await pool.query('SELECT password_hash FROM operators WHERE id = ?', [req.operator.id]);
    if (!me) return res.fail('账户不存在', 404);
    const ok = await bcrypt.compare(old_password, me.password_hash);
    if (!ok) return res.fail('旧密码不正确', 400);

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE operators SET password_hash = ? WHERE id = ?', [hash, req.operator.id]);
    // 修改记录（action=密码修改，修改人=本人）
    await pool.query(
      `INSERT INTO password_change_requests (operator_id, action, status, handled_by, handled_at)
       VALUES (?, '密码修改', '已通过', ?, NOW())`,
      [req.operator.id, req.operator.id]
    );
    res.success(null, '密码已修改，下次登录请使用新密码');
  })
);

// 修改本人登录账号：唯一性校验后立即生效，并写入修改记录
router.put(
  '/me/username',
  auth,
  asyncHandler(async (req, res) => {
    const { new_username } = req.body || {};
    const uname = String(new_username || '').trim();
    if (!uname) return res.fail('请输入新登录账号', 400);
    if (uname.length < 2 || uname.length > 50) return res.fail('登录账号长度需在 2-50 位之间', 400);

    const [[me]] = await pool.query('SELECT username FROM operators WHERE id = ?', [req.operator.id]);
    if (!me) return res.fail('账户不存在', 404);
    if (uname === me.username) return res.fail('新登录账号与当前账号相同', 400);

    const [[dup]] = await pool.query('SELECT id FROM operators WHERE username = ? AND id != ?', [uname, req.operator.id]);
    if (dup) return res.fail('该登录账号已被占用', 400);

    await pool.query('UPDATE operators SET username = ? WHERE id = ?', [uname, req.operator.id]);
    // 修改记录（detail 存账号前后对照）
    await pool.query(
      `INSERT INTO password_change_requests (operator_id, action, detail, status, handled_by, handled_at)
       VALUES (?, '登录账号修改', ?, '已通过', ?, NOW())`,
      [req.operator.id, `${me.username} → ${uname}`, req.operator.id]
    );
    res.success({ username: uname }, '登录账号已修改，下次登录请使用新账号');
  })
);

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

// ===== 账户修改记录（仅超级管理员，只读查看）=====
// 员工在个人中心直接修改密码/登录账号即时生效，每次修改在此留痕
router.get(
  '/change-logs',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT r.id, r.operator_id, r.action, r.detail, r.status, r.remark, r.requested_at, r.handled_at,
              o.username, o.display_name, o.role,
              h.display_name AS handled_by_name
       FROM password_change_requests r
       LEFT JOIN operators o ON r.operator_id = o.id
       LEFT JOIN operators h ON r.handled_by = h.id
       ORDER BY r.id DESC
       LIMIT 200`
    );
    res.success(rows);
  })
);

module.exports = router;
