const express = require('express');
const pool = require('../config/db');
const { asyncHandler, parsePagination, pickFields } = require('../utils/helpers');

const router = express.Router();

// config_fields 是 JSON 字段，需序列化/反序列化；spec_fields 是纯文本模板字符串
function serializeConfigFields(data) {
  if (data.config_fields !== undefined && data.config_fields !== null && typeof data.config_fields !== 'string') {
    data.config_fields = JSON.stringify(data.config_fields);
  }
  // spec_fields 为纯文本字符串，不需 JSON 序列化
  return data;
}

function parseConfigFields(row) {
  if (!row) return row;
  const result = { ...row };
  if (typeof result.config_fields === 'string') {
    try {
      result.config_fields = JSON.parse(result.config_fields);
    } catch {
      result.config_fields = [];
    }
  }
  if (!Array.isArray(result.config_fields)) result.config_fields = [];
  // spec_fields: 兼容旧 JSON 数组格式 → 转为纯文本模板；新格式为纯文本字符串直接使用
  if (result.spec_fields == null) {
    result.spec_fields = '';
  } else if (typeof result.spec_fields === 'string') {
    const trimmed = result.spec_fields.trim();
    if (trimmed.startsWith('[')) {
      // 旧格式: JSON 数组 → 转为模板文本
      try {
        const arr = JSON.parse(trimmed);
        if (Array.isArray(arr)) {
          result.spec_fields = arr.map((f, i) => `${i + 1}. ${f.label || ''}:`).join('\n');
        } else {
          result.spec_fields = '';
        }
      } catch {
        result.spec_fields = '';
      }
    }
    // 新格式: 纯文本字符串，保持不变
  } else {
    result.spec_fields = '';
  }
  return result;
}

// 列表
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req);
    const q = (req.query.q || '').trim();
    const where = q ? 'WHERE product_type LIKE ? OR remark LIKE ?' : '';
    const params = q ? [`%${q}%`, `%${q}%`] : [];

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM product_configs ${where}`, params);
    const [rows] = await pool.query(
      `SELECT * FROM product_configs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    res.success({
      list: rows.map(parseConfigFields),
      total,
      page,
      pageSize
    });
  })
);

// 详情
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [[row]] = await pool.query('SELECT * FROM product_configs WHERE id = ?', [req.params.id]);
    if (!row) return res.fail('产品配置不存在', 404);
    res.success(parseConfigFields(row));
  })
);

// 创建
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ['product_type', 'config_fields', 'spec_fields', 'remark']);
    if (!data.product_type) return res.fail('product_type 为必填', 400);
    if (!Array.isArray(data.config_fields) || data.config_fields.length === 0) {
      return res.fail('config_fields 至少需要 1 个字段定义', 400);
    }
    // spec_fields 可选，默认空字符串
    if (typeof data.spec_fields !== 'string') data.spec_fields = '';
    serializeConfigFields(data);

    // 唯一性校验
    const [[dup]] = await pool.query('SELECT id FROM product_configs WHERE product_type = ?', [data.product_type]);
    if (dup) return res.fail('产品类型已存在', 400);

    const [result] = await pool.query(
      'INSERT INTO product_configs (product_type, config_fields, spec_fields, remark) VALUES (?, ?, ?, ?)',
      [data.product_type, data.config_fields, data.spec_fields, data.remark || null]
    );
    const [[row]] = await pool.query('SELECT * FROM product_configs WHERE id = ?', [result.insertId]);
    res.success(parseConfigFields(row));
  })
);

// 更新
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ['product_type', 'config_fields', 'spec_fields', 'remark']);
    if (data.product_type !== undefined && !data.product_type) {
      return res.fail('product_type 不能为空', 400);
    }
    if (data.config_fields !== undefined) {
      if (!Array.isArray(data.config_fields) || data.config_fields.length === 0) {
        return res.fail('config_fields 至少需要 1 个字段定义', 400);
      }
    }
    if (data.spec_fields !== undefined && typeof data.spec_fields !== 'string') {
      data.spec_fields = '';
    }
    serializeConfigFields(data);

    // 唯一性校验（排除自己）
    if (data.product_type) {
      const [[dup]] = await pool.query(
        'SELECT id FROM product_configs WHERE product_type = ? AND id != ?',
        [data.product_type, req.params.id]
      );
      if (dup) return res.fail('产品类型已存在', 400);
    }

    const fields = [];
    const values = [];
    for (const [k, v] of Object.entries(data)) {
      fields.push(`${k} = ?`);
      values.push(v);
    }
    if (fields.length === 0) return res.success(null);
    values.push(req.params.id);
    await pool.query(`UPDATE product_configs SET ${fields.join(', ')} WHERE id = ?`, values);

    const [[row]] = await pool.query('SELECT * FROM product_configs WHERE id = ?', [req.params.id]);
    if (!row) return res.fail('产品配置不存在', 404);
    res.success(parseConfigFields(row));
  })
);

// 删除
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const [result] = await pool.query('DELETE FROM product_configs WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.fail('产品配置不存在', 404);
    res.success(null);
  })
);

module.exports = router;
