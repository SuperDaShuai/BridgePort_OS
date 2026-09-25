-- 030_products_price_precision_refine.sql
-- 精细化产品价格字段位数：
--   采购价：DECIMAL(12,6) → DECIMAL(12,4)  支持 4 位小数
--   外销价：DECIMAL(12,6) → DECIMAL(12,2)  恢复 2 位小数（外销价按分计价足够）
ALTER TABLE products
  MODIFY COLUMN purchase_cost_rmb DECIMAL(12,4) NOT NULL COMMENT '采购价(人民币)',
  MODIFY COLUMN export_price_usd   DECIMAL(12,2) NULL     DEFAULT 0.00 COMMENT '外销价(人民币)';
