-- 021: 外销订单支持支付宝收款模式
-- 收款二维码以压缩 base64 存储；与 bank_account_id 互斥（选支付宝时银行账户置空，反之亦然）
ALTER TABLE orders ADD COLUMN alipay_qrcode MEDIUMTEXT NULL DEFAULT NULL COMMENT '支付宝收款二维码(base64)' AFTER bank_account_id;
