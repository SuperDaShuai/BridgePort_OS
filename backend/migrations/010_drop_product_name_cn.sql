-- 010 产品型号即中文品名：移除产品及明细表的 name_cn 字段
ALTER TABLE products DROP COLUMN name_cn;
ALTER TABLE order_items DROP COLUMN name_cn;
ALTER TABLE quotation_items DROP COLUMN name_cn;
ALTER TABLE sample_items DROP COLUMN name_cn;
