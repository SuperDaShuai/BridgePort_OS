-- 038: clients 表新增客户简称字段
-- 用于采购订货单等单据的客户名称，为空时回退使用 name_en
ALTER TABLE clients ADD COLUMN short_name VARCHAR(100) NULL DEFAULT NULL COMMENT '客户简称，用于采购订货单等单据' AFTER name_en;
