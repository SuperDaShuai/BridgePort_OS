const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { asyncHandler } = require('../utils/helpers');

const router = express.Router();

// 登录（公开接口）
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.fail('请输入用户名和密码', 400);

    const [[op]] = await pool.query('SELECT * FROM operators WHERE username = ?', [username]);
    // 统一模糊提示，不暴露账号是否存在
    if (!op || !op.status) return res.fail('用户名或密码错误', 401);
    const ok = await bcrypt.compare(password, op.password_hash);
    if (!ok) return res.fail('用户名或密码错误', 401);

    const payload = {
      id: op.id,
      username: op.username,
      display_name: op.display_name,
      role: op.role,
      permission_level: op.permission_level
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '12h'
    });
    res.success({ token, operator: payload });
  })
);

// 当前登录人信息（需登录）
router.get(
  '/profile',
  auth,
  asyncHandler(async (req, res) => {
    const [[op]] = await pool.query(
      'SELECT id, username, display_name, role, permission_level, status FROM operators WHERE id = ?',
      [req.operator.id]
    );
    if (!op || !op.status) return res.fail('账号不存在或已禁用', 401);
    res.success(op);
  })
);

module.exports = router;
