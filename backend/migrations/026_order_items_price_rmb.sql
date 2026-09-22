-- 026_order_items_price_rmb.sql
-- 订单明细行存储人民币基准价，消除单价币种切换时的精度漂移
ALTER TABLE order_items ADD COLUMN price_rmb DECIMAL(12,2) NULL DEFAULT NULL COMMENT '人民币基准单价(外销价)';
