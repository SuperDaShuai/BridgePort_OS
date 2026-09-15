const express = require('express');
const pool = require('../config/db');
const { asyncHandler, pickFields } = require('../utils/helpers');

const router = express.Router();

const ALLOWED = ['term_text', 'is_default'];

// 设某条为默认：清空其他默认标记，并把文本同步到 company_settings.payment_terms_template
async function setDefault(conn, id) {
  await conn.query('UPDATE payment_terms_dict SET is_default = 0');
  await conn.query('UPDATE payment_terms_dict SET is_default = 1 WHERE id = ?', [id]);
  const [[row]] = await conn.query('SELECT term_text FROM payment_terms_dict WHERE id = ?', [id]);
  if (row) {
    await conn.query('UPDATE company_settings SET payment_terms_template = ?', [row.term_text]);
  }
}

// 列表：默认项排最前
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      'SELECT * FROM payment_terms_dict ORDER BY is_default DESC, id DESC'
    );
    res.success({ list: rows, total: rows.length });
  })
);

// 新增
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    if (!data.term_text || !String(data.term_text).trim()) {
      return res.fail('付款方式内容为必填', 400);
    }
    data.term_text = String(data.term_text).trim();
    data.is_default = data.is_default ? 1 : 0;

    const conn = await pool.getConnection();
    try {
      const [r] = await conn.query('INSERT INTO payment_terms_dict SET ?', data);
      if (data.is_default) await setDefault(conn, r.insertId);
      res.success({ id: r.insertId }, '创建成功');
    } finally {
      conn.release();
    }
  })
);

// 更新
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    if (Object.keys(data).length === 0) return res.fail('无可更新字段', 400);
    if (data.term_text !== undefined) {
      if (!String(data.term_text).trim()) return res.fail('付款方式内容不能为空', 400);
      data.term_text = String(data.term_text).trim();
    }
    if (data.is_default !== undefined) data.is_default = data.is_default ? 1 : 0;

    const conn = await pool.getConnection();
    try {
      const [[exists]] = await conn.query('SELECT id FROM payment_terms_dict WHERE id = ?', [req.params.id]);
      if (!exists) return res.fail('付款方式不存在', 404);

      const [r] = await conn.query('UPDATE payment_terms_dict SET ? WHERE id = ?', [data, req.params.id]);
      if (r.affectedRows === 0) return res.fail('付款方式不存在', 404);
      // 默认项内容被编辑时，同步企业配置模板
      if (data.is_default) {
        await setDefault(conn, req.params.id);
      } else if (data.term_text !== undefined) {
        const [[cur]] = await conn.query('SELECT is_default FROM payment_terms_dict WHERE id = ?', [req.params.id]);
        if (cur && cur.is_default) {
          await conn.query('UPDATE company_settings SET payment_terms_template = ?', [data.term_text]);
        }
      }
      res.success({ id: Number(req.params.id) }, '更新成功');
    } finally {
      conn.release();
    }
  })
);

// 单独设为默认
router.patch(
  '/:id/default',
  asyncHandler(async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const [[exists]] = await conn.query('SELECT id FROM payment_terms_dict WHERE id = ?', [req.params.id]);
      if (!exists) return res.fail('付款方式不存在', 404);
      await setDefault(conn, req.params.id);
      res.success({ id: Number(req.params.id) }, '已设为默认');
    } finally {
      conn.release();
    }
  })
);

// 删除（若删的是默认项，自动把剩余的第一条设为默认）
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const [[cur]] = await conn.query('SELECT is_default FROM payment_terms_dict WHERE id = ?', [req.params.id]);
      if (!cur) return res.fail('付款方式不存在', 404);

      const [r] = await conn.query('DELETE FROM payment_terms_dict WHERE id = ?', [req.params.id]);
      if (r.affectedRows === 0) return res.fail('付款方式不存在', 404);

      if (cur.is_default) {
        const [[next]] = await conn.query('SELECT id, term_text FROM payment_terms_dict ORDER BY id DESC LIMIT 1');
        if (next) {
          await conn.query('UPDATE payment_terms_dict SET is_default = 1 WHERE id = ?', [next.id]);
          await conn.query('UPDATE company_settings SET payment_terms_template = ?', [next.term_text]);
        } else {
          await conn.query("UPDATE company_settings SET payment_terms_template = ''");
        }
      }
      res.success({ id: Number(req.params.id) }, '删除成功');
    } finally {
      conn.release();
    }
  })
);

module.exports = router;
