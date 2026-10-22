-- 044_supplier_bank_accounts.sql
-- 供应商收款资料：多币种收款路线库（每条路线 = 路线类型 + 路由备注）
CREATE TABLE IF NOT EXISTS supplier_bank_accounts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  supplier_id INT NOT NULL,
  route_type VARCHAR(100) NOT NULL COMMENT '路线类型（如 USD 美元路线 / RMB 人民币路线）',
  routing_note TEXT COMMENT '路由备注（收款人、开户行、账号、中转行等）',
  KEY idx_supplier (supplier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='供应商收款路线库';
