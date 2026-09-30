-- 035_samples_address.sql
-- 样品单主表新增 address 地址字段（编辑弹窗独占一行多行文本框）
ALTER TABLE samples_tracking ADD COLUMN address TEXT NULL COMMENT '客户地址（多行）' AFTER supplier_id;
