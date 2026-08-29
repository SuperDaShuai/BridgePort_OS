const express = require('express');
const pool = require('../config/db');
const { asyncHandler, parsePagination, pickFields } = require('../utils/helpers');

const router = express.Router();

const ALLOWED = [
  'model', 'hs_code', 'supplier_id', 'name_en', 'name_cn', 'spec',
  'prod_length', 'prod_width', 'prod_height',
  'box_length', 'box_width', 'box_height',
  'ctn_length', 'ctn_width', 'ctn_height',
  'pcs_per_ctn', 'ctn_cbm', 'est_qty_20gp', 'est_qty_40gp', 'est_qty_40hq',
  'net_weight_kg', 'gross_weight_kg', 'purchase_cost_rmb', 'export_price_usd', 'img_url'
];
const REQUIRED = ['model', 'hs_code', 'name_en', 'name_cn', 'purchase_cost_rmb'];

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req);
    const q = (req.query.q || '').trim();
    const supplierId = parseInt(req.query.supplierId) || null;
    const conditions = [];
    const params = [];
    if (q) {
      conditions.push('(p.model LIKE ? OR p.name_en LIKE ? OR p.name_cn LIKE ? OR p.hs_code LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (supplierId) {
      conditions.push('p.supplier_id = ?');
      params.push(supplierId);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM products p ${where}`, params);
    const [rows] = await pool.query(
      `SELECT p.*, s.name AS supplier_name
       FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id
       ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    res.success({ list: rows, total, page, pageSize });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [[product]] = await pool.query(
      'SELECT p.*, s.name AS supplier_name FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.id = ?',
      [req.params.id]
    );
    if (!product) return res.fail('产品不存在', 404);
    res.success(product);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    const missing = REQUIRED.filter((k) => data[k] === undefined || data[k] === '');
    if (missing.length) return res.fail(`缺少必填字段: ${missing.join(', ')}`, 400);

    const [r] = await pool.query('INSERT INTO products SET ?', data);
    res.success({ id: r.insertId }, '创建成功');
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    if (Object.keys(data).length === 0) return res.fail('无可更新字段', 400);

    const [r] = await pool.query('UPDATE products SET ? WHERE id = ?', [data, req.params.id]);
    if (r.affectedRows === 0) return res.fail('产品不存在', 404);
    res.success({ id: Number(req.params.id) }, '更新成功');
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const [r] = await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    if (r.affectedRows === 0) return res.fail('产品不存在', 404);
    res.success({ id: Number(req.params.id) }, '删除成功');
  })
);

module.exports = router;
