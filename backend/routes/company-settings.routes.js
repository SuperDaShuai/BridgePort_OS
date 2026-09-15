const express = require('express');
const pool = require('../config/db');
const { asyncHandler, pickFields } = require('../utils/helpers');

const router = express.Router();

// 企业配置为单行表（company_settings.id=1），仅管理员可读写（页面由路由 meta.permission 控制）
const ALLOWED = [
  'name_en', 'name_cn', 'address_en', 'address_cn', 'tel', 'email', 'tax_number',
  'bank_name', 'bank_account',
  'default_usd_rate', 'default_tax_refund_rate',
  'payment_terms_template', 'arbitration_clause', 'award_clause', 'seal_img'
];

// 确保存在唯一默认行，返回其 id
async function ensureRow() {
  const [rows] = await pool.query('SELECT id FROM company_settings ORDER BY id LIMIT 1');
  if (rows.length) return rows[0].id;
  const [r] = await pool.query(
    "INSERT INTO company_settings (name_en, name_cn) VALUES ('', '')"
  );
  return r.insertId;
}

// 获取企业配置
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const id = await ensureRow();
    const [[row]] = await pool.query('SELECT * FROM company_settings WHERE id = ?', [id]);
    res.success(row);
  })
);

// 保存企业配置（企业抬头 / 财务参数 / 条款模板整体提交）
router.put(
  '/',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    if (Object.keys(data).length === 0) return res.fail('无可更新字段', 400);

    const id = await ensureRow();
    await pool.query('UPDATE company_settings SET ? WHERE id = ?', [data, id]);
    const [[row]] = await pool.query('SELECT * FROM company_settings WHERE id = ?', [id]);
    res.success(row, '保存成功');
  })
);

module.exports = router;
