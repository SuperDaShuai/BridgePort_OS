const express = require('express');
const pool = require('../config/db');
const { asyncHandler, parsePagination, pickFields, isScopedOperator, checkOwnership } = require('../utils/helpers');
const { ownerOf } = require('../utils/operation-log');

const router = express.Router();

const ALLOWED = ['name_en', 'short_name', 'country', 'destination_port', 'main_products', 'website_url', 'address_en'];

// 仅超级管理员可用
function requireAdmin(req) {
  if (req.operator.permission_level !== 1) return '仅超级管理员可操作';
  return null;
}

// 业务员列表（供分配接口下拉使用，仅超级管理员可调用）
router.get(
  '/sales-people',
  asyncHandler(async (req, res) => {
    const denied = requireAdmin(req);
    if (denied) return res.fail(denied, 403);
    const [rows] = await pool.query(
      `SELECT id, display_name, username, role, permission_level FROM operators
       WHERE permission_level <= 3 AND status = 1
       ORDER BY permission_level ASC, id ASC`
    );
    res.success(rows);
  })
);

// 同步联系人：先删后插（必须在事务内调用）
async function syncContacts(conn, ownerId, contacts) {
  if (!Array.isArray(contacts)) return;
  await conn.query('DELETE FROM contacts WHERE owner_type = ? AND owner_id = ?', ['CLIENT', ownerId]);
  const rows = contacts
    .filter((c) => c && c.name)
    .map((c) => ['CLIENT', ownerId, c.name, c.position || null, c.phone || null, c.email || null, c.whatsapp || null, c.is_primary ? 1 : 0]);
  if (rows.length) {
    await conn.query(
      'INSERT INTO contacts (owner_type, owner_id, name, position, phone, email, whatsapp, is_primary) VALUES ?',
      [rows]
    );
  }
}

// 列表（关键词搜索 + 分页）
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req);
    const q = (req.query.q || '').trim();
    const conditions = [];
    const params = [];
    if (q) {
      conditions.push('(name_en LIKE ? OR country LIKE ? OR main_products LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    // 业务员只能看到自己添加的客户
    if (isScopedOperator(req)) {
      conditions.push('owner_id = ?');
      params.push(req.operator.id);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM clients ${where}`, params);
    const [rows] = await pool.query(
      `SELECT * FROM clients ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    res.success({ list: rows, total, page, pageSize });
  })
);

// 详情（含联系人）
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [[client]] = await pool.query('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!client) return res.fail('客户不存在', 404);
    const denied = checkOwnership(client, req, '客户');
    if (denied) return res.fail(denied, 404);
    const [contacts] = await pool.query(
      'SELECT id, name, position, phone, email, whatsapp, is_primary FROM contacts WHERE owner_type = ? AND owner_id = ? ORDER BY is_primary DESC, id',
      ['CLIENT', client.id]
    );
    res.success({ ...client, contacts });
  })
);

// 创建（可附带 contacts 数组）
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    if (!data.name_en || !data.country) return res.fail('name_en 与 country 为必填', 400);

    // 负责人自动写入当前登录人
    data.owner_name = ownerOf(req.operator);
    data.owner_id = req.operator.id;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.query('INSERT INTO clients SET ?', data);
      await syncContacts(conn, r.insertId, req.body.contacts);
      await conn.commit();
      res.success({ id: r.insertId }, '创建成功');
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

// 更新（可整体替换 contacts）
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    const hasContacts = Array.isArray(req.body.contacts);
    if (Object.keys(data).length === 0 && !hasContacts) return res.fail('无可更新字段', 400);

    // 归属校验：业务员只能修改自己的客户
    const [[before]] = await pool.query('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!before) return res.fail('客户不存在', 404);
    const denied = checkOwnership(before, req, '客户');
    if (denied) return res.fail(denied, 404);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.query('UPDATE clients SET ? WHERE id = ?', [data, req.params.id]);
      if (r.affectedRows === 0) { await conn.rollback(); return res.fail('客户不存在', 404); }
      if (hasContacts) await syncContacts(conn, Number(req.params.id), req.body.contacts);
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

// 分配客户给业务员（超级管理员），级联变更关联订单/样品单/报价单/询价单负责人
router.put(
  '/:id/assign',
  asyncHandler(async (req, res) => {
    const denied = requireAdmin(req);
    if (denied) return res.fail(denied, 403);

    const targetId = Number(req.body.owner_id);
    if (!targetId) return res.fail('请选择目标业务员', 400);

    const [[target]] = await pool.query('SELECT id, display_name, username, permission_level FROM operators WHERE id = ?', [targetId]);
    if (!target) return res.fail('目标业务员不存在', 404);
    const targetName = target.display_name || target.username;

    const [[before]] = await pool.query('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!before) return res.fail('客户不存在', 404);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // 1. 更新客户负责人
      await conn.query('UPDATE clients SET owner_id = ?, owner_name = ? WHERE id = ?', [targetId, targetName, req.params.id]);
      // 2. 级联更新所有关联单据（仅更新负责人是该客户旧负责人的单据，避免覆盖已分配的）
      const oldOwnerId = before.owner_id;
      if (oldOwnerId) {
        const tables = [
          ['orders', 'client_id'],
          ['samples_tracking', 'client_id'],
          ['quotations', 'client_id'],
          ['rfqs', 'client_id']
        ];
        for (const [table, fk] of tables) {
          await conn.query(
            `UPDATE ${table} SET owner_id = ?, owner_name = ? WHERE ${fk} = ? AND owner_id = ?`,
            [targetId, targetName, req.params.id, oldOwnerId]
          );
        }
      }
      await conn.commit();
      res.success({ id: Number(req.params.id), owner_id: targetId, owner_name: targetName }, '分配成功');
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

// 批量分配客户给业务员（超级管理员）
router.put(
  '/batch-assign',
  asyncHandler(async (req, res) => {
    const denied = requireAdmin(req);
    if (denied) return res.fail(denied, 403);

    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number) : [];
    const targetId = Number(req.body.owner_id);
    if (!ids.length) return res.fail('请选择要分配的客户', 400);
    if (!targetId) return res.fail('请选择目标业务员', 400);

    const [[target]] = await pool.query('SELECT id, display_name, username FROM operators WHERE id = ?', [targetId]);
    if (!target) return res.fail('目标业务员不存在', 404);
    const targetName = target.display_name || target.username;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // 查询这些客户的旧负责人，用于级联更新时的条件限定
      const [clients] = await conn.query(`SELECT id, owner_id FROM clients WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
      await conn.query(`UPDATE clients SET owner_id = ?, owner_name = ? WHERE id IN (${ids.map(() => '?').join(',')})`, [targetId, targetName, ...ids]);
      // 按客户逐个级联更新单据（限制 owner_id = 旧负责人）
      const tables = [
        ['orders', 'client_id'],
        ['samples_tracking', 'client_id'],
        ['quotations', 'client_id'],
        ['rfqs', 'client_id']
      ];
      for (const cl of clients) {
        if (!cl.owner_id) continue;
        for (const [table, fk] of tables) {
          await conn.query(
            `UPDATE ${table} SET owner_id = ?, owner_name = ? WHERE ${fk} = ? AND owner_id = ?`,
            [targetId, targetName, cl.id, cl.owner_id]
          );
        }
      }
      await conn.commit();
      res.success({ updated_clients: ids.length }, '批量分配成功');
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

// 删除（contacts 无外键约束，需一并清理）
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    // 归属校验：业务员只能删除自己的客户
    const [[before]] = await pool.query('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!before) return res.fail('客户不存在', 404);
    const denied = checkOwnership(before, req, '客户');
    if (denied) return res.fail(denied, 404);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM contacts WHERE owner_type = ? AND owner_id = ?', ['CLIENT', req.params.id]);
      const [r] = await conn.query('DELETE FROM clients WHERE id = ?', [req.params.id]);
      if (r.affectedRows === 0) { await conn.rollback(); return res.fail('客户不存在', 404); }
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
