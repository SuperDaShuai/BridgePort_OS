-- 054 回填 products.hs_code_id
-- 背景：050 只给 products 加了 hs_code_id 列，未回填历史数据，导致老产品该列全为 NULL，
--       前端把它设为必填后，历史产品打开编辑时全部显示"未选 HS 编码"。
-- 处理：按 products.hs_code 字符串反向匹配 hs_codes.id，取匹配到的那条（同编码多条时取最小 id）。
UPDATE products p
JOIN (
  SELECT hs_code, MIN(id) AS id
  FROM hs_codes
  WHERE hs_code IS NOT NULL AND hs_code != ''
  GROUP BY hs_code
) h ON h.hs_code = p.hs_code
SET p.hs_code_id = h.id
WHERE p.hs_code_id IS NULL
  AND p.hs_code IS NOT NULL
  AND p.hs_code != '';
