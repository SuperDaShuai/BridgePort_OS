-- 046 HS编码库新增产品简称字段
ALTER TABLE hs_codes ADD COLUMN product_short_name VARCHAR(100) NULL COMMENT '产品简称' AFTER product_name;
