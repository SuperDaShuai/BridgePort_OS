-- 009 购销合同精细化：采购含税单价 + 企业银行信息
ALTER TABLE order_items
  ADD COLUMN cost_cny DECIMAL(10,2) NULL COMMENT '含税采购单价(元)' AFTER price;

ALTER TABLE company_settings
  ADD COLUMN bank_name VARCHAR(255) NULL COMMENT '开户银行' AFTER email,
  ADD COLUMN bank_account VARCHAR(100) NULL COMMENT '银行账号' AFTER bank_name;
