-- 029_products_price_precision.sql
-- 产品数据库采购价、外销价扩精度：DECIMAL(10,2) → DECIMAL(12,6)
-- 原 10,2 只能存 2 位小数，精细采购价会被截断
ALTER TABLE products
  MODIFY COLUMN purchase_cost_rmb DECIMAL(12,6) NOT NULL COMMENT '采购价(人民币)',
  MODIFY COLUMN export_price_usd   DECIMAL(12,6) NULL     DEFAULT 0 COMMENT '外销价(人民币)';
