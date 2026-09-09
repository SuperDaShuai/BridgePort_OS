-- ============================================================
-- BridgePort OS · 数据库迁移 003
-- 时间：2026-09-02
-- 触发：产品数据库新增图片上传功能，img_url 需存储 base64 压缩图
-- 内容：products.img_url 从 VARCHAR(500) 改为 TEXT（最大 65KB）
-- 影响：仅 products 表 1 个字段，无数据迁移风险
-- ============================================================

-- varchar(500) 只能存 500 字符，而 400px 宽 JPEG base64 通常有 15000-40000 字符
-- TEXT 最大 65535 字符，完全够用；如需更大可改 MEDIUMTEXT(16MB)
ALTER TABLE products
  MODIFY COLUMN img_url TEXT NULL COMMENT '产品图片(base64 压缩图, 400px 宽)';
