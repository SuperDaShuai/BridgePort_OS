-- 011 产品数据库新增「中文品名」字段（010 曾移除 name_cn，按新需求恢复为独立字段）
ALTER TABLE products ADD COLUMN name_cn VARCHAR(255) NULL AFTER name_en;
