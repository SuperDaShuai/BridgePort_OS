const express = require('express');
const pool = require('../config/db');
const { asyncHandler, parsePagination, pickFields } = require('../utils/helpers');

const router = express.Router();

const ALLOWED = ['name', 'city', 'main_category', 'factory_address', 'bank_name', 'account_number'];

// 同步联系人：先删后插（必须在事务内调用）
async function syncContacts(conn, ownerId, contacts) {
  if (!Array.isArray(contacts)) return;
  await conn.query('DELETE FROM contacts WHERE owner_type = ? AND owner_id = ?', ['SUPPLIER', ownerId]);
  const rows = contacts
    .filter((c) => c && c.name)
    .map((c) => ['SUPPLIER', ownerId, c.name, c.position || null, c.phone || null, c.email || null, c.whatsapp || null, c.is_primary ? 1 : 0]);
  if (rows.length) {
    await conn.query(
      'INSERT INTO contacts (owner_type, owner_id, name, position, phone, email, whatsapp, is_primary) VALUES ?',
      [rows]
    );
  }
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req);
    const q = (req.query.q || '').trim();
    const where = q ? 'WHERE name LIKE ? OR city LIKE ? OR main_category LIKE ?' : '';
    const params = q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [];

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM suppliers ${where}`, params);
    const [rows] = await pool.query(
      `SELECT * FROM suppliers ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    res.success({ list: rows, total, page, pageSize });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [[supplier]] = await pool.query('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
    if (!supplier) return res.fail('供应商不存在', 404);
    const [contacts] = await pool.query(
      'SELECT id, name, position, phone, email, whatsapp, is_primary FROM contacts WHERE owner_type = ? AND owner_id = ? ORDER BY is_primary DESC, id',
      ['SUPPLIER', supplier.id]
    );
    res.success({ ...supplier, contacts });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    if (!data.name) return res.fail('name 为必填', 400);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.query('INSERT INTO suppliers SET ?', data);
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

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    const hasContacts = Array.isArray(req.body.contacts);
    if (Object.keys(data).length === 0 && !hasContacts) return res.fail('无可更新字段', 400);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.query('UPDATE suppliers SET ? WHERE id = ?', [data, req.params.id]);
      if (r.affectedRows === 0) { await conn.rollback(); return res.fail('供应商不存在', 404); }
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

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM contacts WHERE owner_type = ? AND owner_id = ?', ['SUPPLIER', req.params.id]);
      const [r] = await conn.query('DELETE FROM suppliers WHERE id = ?', [req.params.id]);
      if (r.affectedRows === 0) { await conn.rollback(); return res.fail('供应商不存在', 404); }
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
