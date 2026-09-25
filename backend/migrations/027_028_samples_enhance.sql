-- 027_samples_enhance.sql
-- 样品单关联订单化字段：签约/交货/币种/收款/付款/包装/特殊要求/显示开关
ALTER TABLE samples_tracking
  ADD COLUMN signing_date DATE NULL DEFAULT NULL COMMENT '签约日期',
  ADD COLUMN delivery_date DATE NULL DEFAULT NULL COMMENT '交货日期',
  ADD COLUMN trade_terms VARCHAR(50) NULL DEFAULT NULL COMMENT '贸易条款',
  ADD COLUMN currency VARCHAR(10) NULL DEFAULT 'RMB' COMMENT '结算币种(RMB/USD)',
  ADD COLUMN bank_account_id INT NULL DEFAULT NULL COMMENT '收款银行账户ID',
  ADD COLUMN alipay_qrcode MEDIUMTEXT NULL DEFAULT NULL COMMENT '支付宝收款码(base64)',
  ADD COLUMN payment_terms VARCHAR(200) NULL DEFAULT NULL COMMENT '付款方式',
  ADD COLUMN packing_desc VARCHAR(500) NULL DEFAULT NULL COMMENT '包装说明',
  ADD COLUMN special_req TEXT NULL COMMENT '特殊要求',
  ADD COLUMN show_special_req TINYINT(1) NOT NULL DEFAULT 1 COMMENT '显示特殊要求',
  ADD COLUMN show_stamp TINYINT(1) NOT NULL DEFAULT 1 COMMENT '显示电子签章',
  ADD COLUMN show_hs_code TINYINT(1) NOT NULL DEFAULT 0 COMMENT '显示HS编码';

-- 028_sample_items_enhance.sql
-- 样品明细对齐订单明细（保留样品特有的 model_custom/notes，新增价格与包装计算字段）
ALTER TABLE sample_items
  ADD COLUMN price DECIMAL(12,2) NULL DEFAULT NULL COMMENT '外销单价(当前币种)',
  ADD COLUMN price_rmb DECIMAL(12,2) NULL DEFAULT NULL COMMENT '人民币基准单价',
  ADD COLUMN cost_cny DECIMAL(12,2) NULL DEFAULT NULL COMMENT '人民币采购成本',
  ADD COLUMN subtotal_amount DECIMAL(12,2) NULL DEFAULT NULL COMMENT '小计金额',
  ADD COLUMN nw_per_ctn DECIMAL(10,2) NULL DEFAULT NULL COMMENT '单箱净重(kg)',
  ADD COLUMN gw_per_ctn DECIMAL(10,2) NULL DEFAULT NULL COMMENT '单箱毛重(kg)',
  ADD COLUMN cbm_per_ctn DECIMAL(10,4) NULL DEFAULT NULL COMMENT '单箱体积(m³)';
