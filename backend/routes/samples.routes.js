const express = require('express');
const pool = require('../config/db');
const { asyncHandler, parsePagination, pickFields } = require('../utils/helpers');

const router = express.Router();

// 样品单主表允许写入的字段（已移除单产品字段 product_id/model_custom/qty/spec_desc）
const ALLOWED = [
  'sample_number', 'client_id', 'rfq_id',
  'courier_name', 'tracking_number', 'sent_date',
  'sample_fee', 'freight_cost', 'feedback_status', 'client_feedback_note'
];
const REQUIRED = ['sample_number', 'client_id'];

// 明细行允许写入的字段
const ITEM_FIELDS = [
  'product_id', 'model', 'name_en', 'hs_code',
  'img_url', 'spec', 'qty', 'unit', 'model_custom', 'notes'
];

// 明细行清洗：必须有型号
function normalizeItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter((it) => it && it.model)
    .map((it) => ITEM_FIELDS.map((f) => (it[f] === undefined || it[f] === '' ? null : it[f])));
}

// date 字段空字符串 → null
const DATE_FIELDS = ['sent_date'];
function sanitizeDates(data) {
  for (const f of DATE_FIELDS) {
    if (f in data && (data[f] === '' || data[f] === undefined)) {
      data[f] = null;
    }
  }
  return data;
}

// 生成下一个样品单号（格式 SMP-YYYY-NNN，年内递增）
router.get(
  '/next-number',
  asyncHandler(async (req, res) => {
    const year = new Date().getFullYear();
    const prefix = 'SMP-' + year;
    const [[row]] = await pool.query(
      `SELECT sample_number FROM samples_tracking
       WHERE sample_number LIKE ?
       ORDER BY sample_number DESC LIMIT 1`,
      [prefix + '-%']
    );
    let seq = 1;
    if (row) {
      const m = row.sample_number.match(/-(\d{3})$/);
      if (m) seq = parseInt(m[1], 10) + 1;
    }
    res.success(prefix + '-' + String(seq).padStart(3, '0'));
  })
);

// 列表：联查客户 + 明细品类数 + 总数量
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req);
    const q = (req.query.q || '').trim();
    const status = (req.query.status || '').trim();
    const conditions = [];
    const params = [];
    if (q) {
      conditions.push(
        '(s.sample_number LIKE ? OR c.name_en LIKE ? OR s.tracking_number LIKE ?)'
      );
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (status) {
      conditions.push('s.feedback_status = ?');
      params.push(status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM samples_tracking s LEFT JOIN clients c ON s.client_id = c.id ${where}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT s.*, c.name_en AS client_name,
              (SELECT COUNT(*) FROM sample_items si WHERE si.sample_id = s.id) AS item_count,
              (SELECT COALESCE(SUM(si.qty), 0) FROM sample_items si WHERE si.sample_id = s.id) AS total_qty,
              (SELECT GROUP_CONCAT(si.model SEPARATOR ', ') FROM sample_items si WHERE si.sample_id = s.id LIMIT 3) AS product_models
       FROM samples_tracking s
       LEFT JOIN clients c ON s.client_id = c.id
       ${where} ORDER BY s.id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    res.success({ list: rows, total, page, pageSize });
  })
);

// 详情：主表 + 明细行
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [[sample]] = await pool.query('SELECT * FROM samples_tracking WHERE id = ?', [req.params.id]);
    if (!sample) return res.fail('样品单不存在', 404);
    const [items] = await pool.query(
      'SELECT * FROM sample_items WHERE sample_id = ? ORDER BY id ASC',
      [sample.id]
    );
    res.success({ ...sample, items });
  })
);

// 创建：主表 + 明细整体在事务内写入
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    sanitizeDates(data);

    // 样品单号自动生成 + 唯一性校验
    const year = new Date().getFullYear();
    const prefix = 'SMP-' + year;
    if (!data.sample_number) {
      const [[row]] = await pool.query(
        `SELECT sample_number FROM samples_tracking
         WHERE sample_number LIKE ? ORDER BY sample_number DESC LIMIT 1`,
        [prefix + '-%']
      );
      let seq = 1;
      if (row) {
        const m = row.sample_number.match(/-(\d{3})$/);
        if (m) seq = parseInt(m[1], 10) + 1;
      }
      data.sample_number = prefix + '-' + String(seq).padStart(3, '0');
    } else {
      const [[dup]] = await pool.query(
        'SELECT id FROM samples_tracking WHERE sample_number = ?',
        [data.sample_number]
      );
      if (dup) {
        const [[row]] = await pool.query(
          `SELECT sample_number FROM samples_tracking
           WHERE sample_number LIKE ? ORDER BY sample_number DESC LIMIT 1`,
          [prefix + '-%']
        );
        let seq = (row ? parseInt(row.sample_number.match(/-(\d{3})$/)[1], 10) : 0) + 1;
        data.sample_number = prefix + '-' + String(seq).padStart(3, '0');
      }
    }

    const missing = REQUIRED.filter((k) => !data[k]);
    if (missing.length) return res.fail(`缺少必填字段: ${missing.join(', ')}`, 400);

    const items = normalizeItems(req.body.items);
    if (items.length === 0) return res.fail('请至少添加一行样品明细', 400);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.query('INSERT INTO samples_tracking SET ?', data);
      await conn.query(
        `INSERT INTO sample_items (sample_id, ${ITEM_FIELDS.join(', ')}) VALUES ?`,
        [items.map((row) => [r.insertId, ...row])]
      );
      await conn.commit();
      res.success({ id: r.insertId, item_count: items.length, sample_number: data.sample_number }, '创建成功');
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

// 更新：主表更新，items 若传入则整体替换
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    sanitizeDates(data);
    const hasItems = Array.isArray(req.body.items);
    if (Object.keys(data).length === 0 && !hasItems) return res.fail('无可更新字段', 400);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.query('UPDATE samples_tracking SET ? WHERE id = ?', [data, req.params.id]);
      if (r.affectedRows === 0) {
        await conn.rollback();
        return res.fail('样品单不存在', 404);
      }
      if (hasItems) {
        await conn.query('DELETE FROM sample_items WHERE sample_id = ?', [req.params.id]);
        const items = normalizeItems(req.body.items);
        if (items.length) {
          await conn.query(
            `INSERT INTO sample_items (sample_id, ${ITEM_FIELDS.join(', ')}) VALUES ?`,
            [items.map((row) => [Number(req.params.id), ...row])]
          );
        }
      }
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

// 删除：事务内先删明细，再删主表
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const sampleId = Number(req.params.id);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM sample_items WHERE sample_id = ?', [sampleId]);
      const [r] = await conn.query('DELETE FROM samples_tracking WHERE id = ?', [sampleId]);
      if (r.affectedRows === 0) {
        await conn.rollback();
        return res.fail('样品单不存在', 404);
      }
      await conn.commit();
      res.success({ id: sampleId }, '删除成功');
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

module.exports = router;
