const express = require('express');
const pool = require('../config/db');
const { asyncHandler, parsePagination, pickFields, isScopedOperator, checkOwnership } = require('../utils/helpers');
const { logOperation, ownerOf } = require('../utils/operation-log');

const router = express.Router();

const ALLOWED = [
  'rfq_number', 'inquiry_date', 'client_id', 'product_id',
  'intended_desc', 'estimated_qty', 'target_price', 'follow_up_stage'
];
const REQUIRED = ['rfq_number', 'inquiry_date', 'client_id'];

// 列表：联查客户名与意向产品型号，支持关键词 + 阶段筛选
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req);
    const q = (req.query.q || '').trim();
    const stage = (req.query.stage || '').trim();
    const conditions = [];
    const params = [];
    if (q) {
      conditions.push('(r.rfq_number LIKE ? OR c.name_en LIKE ? OR r.intended_desc LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (stage) {
      conditions.push('r.follow_up_stage = ?');
      params.push(stage);
    }
    // 业务员只能看到自己创建的询盘
    if (isScopedOperator(req)) {
      conditions.push('r.owner_id = ?');
      params.push(req.operator.id);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM rfqs r LEFT JOIN clients c ON r.client_id = c.id ${where}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT r.*, c.name_en AS client_name, p.model AS product_model
       FROM rfqs r
       LEFT JOIN clients c ON r.client_id = c.id
       LEFT JOIN products p ON r.product_id = p.id
       ${where} ORDER BY r.id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    res.success({ list: rows, total, page, pageSize });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [[rfq]] = await pool.query('SELECT * FROM rfqs WHERE id = ?', [req.params.id]);
    if (!rfq) return res.fail('询盘不存在', 404);
    const denied = checkOwnership(rfq, req, '询盘');
    if (denied) return res.fail(denied, 404);
    res.success(rfq);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    const missing = REQUIRED.filter((k) => !data[k]);
    if (missing.length) return res.fail(`缺少必填字段: ${missing.join(', ')}`, 400);

    // 负责人自动写入当前登录人
    data.owner_name = ownerOf(req.operator);
    data.owner_id = req.operator.id;

    const [r] = await pool.query('INSERT INTO rfqs SET ?', data);
    await logOperation(null, {
      module: 'rfq', action: '新增',
      targetId: r.insertId, targetNo: data.rfq_number, operator: req.operator
    });
    res.success({ id: r.insertId }, '创建成功');
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    if (Object.keys(data).length === 0) return res.fail('无可更新字段', 400);

    const [[before]] = await pool.query('SELECT * FROM rfqs WHERE id = ?', [req.params.id]);
    if (!before) return res.fail('询盘不存在', 404);
    const denied = checkOwnership(before, req, '询盘');
    if (denied) return res.fail(denied, 404);

    const [r] = await pool.query('UPDATE rfqs SET ? WHERE id = ?', [data, req.params.id]);
    if (r.affectedRows === 0) return res.fail('询盘不存在', 404);

    // 取业务编号记录操作日志
    await logOperation(null, {
      module: 'rfq', action: '修改',
      targetId: Number(req.params.id), targetNo: before.rfq_number, operator: req.operator
    });
    res.success({ id: Number(req.params.id) }, '更新成功');
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const [[before]] = await pool.query('SELECT * FROM rfqs WHERE id = ?', [req.params.id]);
    if (!before) return res.fail('询盘不存在', 404);
    const denied = checkOwnership(before, req, '询盘');
    if (denied) return res.fail(denied, 404);

    const [r] = await pool.query('DELETE FROM rfqs WHERE id = ?', [req.params.id]);
    if (r.affectedRows === 0) return res.fail('询盘不存在', 404);
    res.success({ id: Number(req.params.id) }, '删除成功');
  })
);

module.exports = router;
