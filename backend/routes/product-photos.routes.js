const express = require('express');
const pool = require('../config/db');
const { asyncHandler } = require('../utils/helpers');

const router = express.Router({ mergeParams: true });

// 权限判断：管理员(1)、主管(2) 可维护；业务员(3)、财务跟单(4) 只读
function canMaintain(req) {
  const lvl = req.operator && req.operator.permission_level;
  return Number(lvl) <= 2;
}

// 查询某产品的多图列表（全员可查）
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [[product]] = await pool.query('SELECT id FROM products WHERE id = ?', [req.params.productId]);
    if (!product) return res.fail('产品不存在', 404);

    const [photos] = await pool.query(
      'SELECT id, photo_url, caption, sort_order, created_at FROM product_photos WHERE product_id = ? ORDER BY sort_order ASC, id ASC',
      [req.params.productId]
    );
    res.success({ list: photos });
  })
);

// 上传一张多图（仅管理员）
router.post(
  '/',
  asyncHandler(async (req, res) => {
    if (!canMaintain(req)) return res.fail('无权限上传多图', 403);

    const photoUrl = (req.body && req.body.photo_url) || '';
    const caption = (req.body && req.body.caption) || null;
    if (!photoUrl) return res.fail('图片内容不能为空', 400);
    if (photoUrl.length > 15 * 1024 * 1024) return res.fail('图片过大（上限 15MB）', 400);

    // 取当前最大 sort_order + 1
    const [[maxRow]] = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) AS mx FROM product_photos WHERE product_id = ?',
      [req.params.productId]
    );
    const sortOrder = Number(maxRow.mx) + 1;

    const [r] = await pool.query(
      'INSERT INTO product_photos (product_id, photo_url, caption, sort_order) VALUES (?, ?, ?, ?)',
      [req.params.productId, photoUrl, caption, sortOrder]
    );
    res.success({ id: r.insertId }, '上传成功');
  })
);

// 删除一张多图（仅管理员）
router.delete(
  '/:photoId',
  asyncHandler(async (req, res) => {
    if (!canMaintain(req)) return res.fail('无权限删除多图', 403);

    const [r] = await pool.query(
      'DELETE FROM product_photos WHERE id = ? AND product_id = ?',
      [req.params.photoId, req.params.productId]
    );
    if (r.affectedRows === 0) return res.fail('图片不存在', 404);
    res.success({ id: Number(req.params.photoId) }, '已删除');
  })
);

// 批量更新排序（仅管理员）
router.put(
  '/sort',
  asyncHandler(async (req, res) => {
    if (!canMaintain(req)) return res.fail('无权限', 403);
    const list = Array.isArray(req.body) ? req.body : [];
    for (const item of list) {
      if (item.id && item.sort_order !== undefined) {
        await pool.query(
          'UPDATE product_photos SET sort_order = ? WHERE id = ? AND product_id = ?',
          [Number(item.sort_order), item.id, req.params.productId]
        );
      }
    }
    res.success({ updated: list.length }, '排序已更新');
  })
);

module.exports = router;
