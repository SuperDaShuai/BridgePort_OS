-- ============================================================
-- 迁移 005 — 订单明细 img_url 扩容为 TEXT
-- 触发原因：order_items.img_url 原为 varchar(500)，存不下 base64 图片
-- 变更内容：MODIFY COLUMN img_url TEXT NULL
-- 影响范围：仅扩宽字段，对已有数据无破坏性
-- ============================================================

ALTER TABLE order_items MODIFY COLUMN img_url TEXT NULL COMMENT '产品图片快照(base64)';
