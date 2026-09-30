-- 036_suppliers_credit_code.sql
-- 供应商表新增统一社会信用代码字段
ALTER TABLE suppliers ADD COLUMN credit_code VARCHAR(50) NULL DEFAULT NULL COMMENT '统一社会信用代码' AFTER name;
