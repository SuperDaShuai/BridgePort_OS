const express = require('express');
const pool = require('../config/db');
const { asyncHandler, parsePagination } = require('../utils/helpers');

const router = express.Router();

const MODULES = ['rfq', 'quotation', 'sample', 'order'];
const MODULE_LABELS = { rfq: '商机管理', quotation: '商务报价单', sample: '样品管理', order: '外销订单' };

// 操作日志列表：支持模块 / 动作 / 关键词(操作员或业务编号)筛选，按时间倒序
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req);
    const q = (req.query.q || '').trim();
    const module = (req.query.module || '').trim();
    const action = (req.query.action || '').trim();

    const conditions = [];
    const params = [];
    if (module && MODULES.includes(module)) {
      conditions.push('module = ?');
      params.push(module);
    }
    if (action) {
      conditions.push('action = ?');
      params.push(action);
    }
    if (q) {
      conditions.push('(operator_name LIKE ? OR operator_display LIKE ? OR target_no LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM operation_logs ${where}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT * FROM operation_logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    // 附模块中文名，便于前端直接展示
    const list = rows.map((r) => ({ ...r, module_label: MODULE_LABELS[r.module] || r.module }));
    res.success({ list, total, page, pageSize });
  })
);

module.exports = router;
