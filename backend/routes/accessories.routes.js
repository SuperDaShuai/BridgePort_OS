// accessories.routes.js — 配件管理（分类 + 配件）
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { asyncHandler, pickFields } = require('../utils/helpers');
const { logOperation } = require('../utils/operation-log');

// ========== 配件分类 ==========

// 列表
router.get('/categories', asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM accessory_categories ORDER BY sort_order ASC, id ASC'
  );
  res.json({ code: 200, data: rows });
}));

// 新增
router.post('/categories', asyncHandler(async (req, res) => {
  const allowed = ['name', 'description', 'sort_order'];
  const data = pickFields(req.body, allowed);
  if (!data.name || !data.name.trim()) {
    return res.json({ code: 400, msg: '分类名称不能为空' });
  }
  data.name = data.name.trim();
  const [dup] = await pool.query(
    'SELECT id FROM accessory_categories WHERE name = ?',
    [data.name]
  );
  if (dup.length) return res.json({ code: 400, msg: '分类名称已存在' });

  const [r] = await pool.query(
    'INSERT INTO accessory_categories SET ?',
    data
  );
  try { await logOperation(pool, { module: '配件分类', action: '新增', targetId: r.insertId, operator: req.operator }); } catch (e) {}
  res.json({ code: 200, data: { id: r.insertId, ...data }, msg: '已添加' });
}));

// 更新
router.put('/categories/:id', asyncHandler(async (req, res) => {
  const allowed = ['name', 'description', 'sort_order'];
  const data = pickFields(req.body, allowed);
  const id = Number(req.params.id);
  if (data.name) {
    const [dup] = await pool.query(
      'SELECT id FROM accessory_categories WHERE name = ? AND id != ?',
      [data.name.trim(), id]
    );
    if (dup.length) return res.json({ code: 400, msg: '分类名称已存在' });
    data.name = data.name.trim();
  }
  await pool.query('UPDATE accessory_categories SET ? WHERE id = ?', [data, id]);
  try { await logOperation(pool, { module: '配件分类', action: '更新', targetId: id, operator: req.operator }); } catch (e) {}
  res.json({ code: 200, msg: '已更新' });
}));

// 删除（如果有配件会把那些配件 category_id 置 NULL）
router.delete('/categories/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await pool.query('UPDATE accessories SET category_id = NULL WHERE category_id = ?', [id]);
  await pool.query('DELETE FROM accessory_categories WHERE id = ?', [id]);
  try { await logOperation(pool, { module: '配件分类', action: '删除', targetId: id, operator: req.operator }); } catch (e) {}
  res.json({ code: 200, msg: '已删除' });
}));

// ========== 配件 ==========

// 列表（可按分类过滤）
router.get('/', asyncHandler(async (req, res) => {
  const { category_id, keyword } = req.query;
  const wheres = [];
  const params = [];
  if (category_id) {
    wheres.push('a.category_id = ?');
    params.push(Number(category_id));
  }
  if (keyword && keyword.trim()) {
    wheres.push('(a.name LIKE ? OR a.specs LIKE ? OR a.remark LIKE ?)');
    const k = `%${keyword.trim()}%`;
    params.push(k, k, k);
  }
  const whereSQL = wheres.length ? 'WHERE ' + wheres.join(' AND ') : '';

  const [rows] = await pool.query(
    `SELECT a.*, c.name AS category_name
     FROM accessories a
     LEFT JOIN accessory_categories c ON a.category_id = c.id
     ${whereSQL}
     ORDER BY a.category_id ASC, a.sort_order ASC, a.id ASC`,
    params
  );
  res.json({ code: 200, data: rows });
}));

// 新增
router.post('/', asyncHandler(async (req, res) => {
  const allowed = ['category_id', 'name', 'image_url', 'specs', 'remark', 'sort_order'];
  const data = pickFields(req.body, allowed);
  if (!data.name || !data.name.trim()) {
    return res.json({ code: 400, msg: '配件名称不能为空' });
  }
  data.name = data.name.trim();
  const [r] = await pool.query('INSERT INTO accessories SET ?', data);
  try { await logOperation(pool, { module: '配件', action: '新增', targetId: r.insertId, operator: req.operator }); } catch (e) {}
  res.json({ code: 200, data: { id: r.insertId, ...data }, msg: '已添加' });
}));

// 更新
router.put('/:id', asyncHandler(async (req, res) => {
  const allowed = ['category_id', 'name', 'image_url', 'specs', 'remark', 'sort_order'];
  const data = pickFields(req.body, allowed);
  if (data.name) data.name = data.name.trim();
  const id = Number(req.params.id);
  await pool.query('UPDATE accessories SET ? WHERE id = ?', [data, id]);
  try { await logOperation(pool, { module: '配件', action: '更新', targetId: id, operator: req.operator }); } catch (e) {}
  res.json({ code: 200, msg: '已更新' });
}));

// 删除
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await pool.query('DELETE FROM accessories WHERE id = ?', [id]);
  try { await logOperation(pool, { module: '配件', action: '删除', targetId: id, operator: req.operator }); } catch (e) {}
  res.json({ code: 200, msg: '已删除' });
}));

module.exports = router;
