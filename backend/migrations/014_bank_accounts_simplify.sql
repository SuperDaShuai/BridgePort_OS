-- 014 收款路线库精简：bank_name/account_number/swift_code 改为允许 NULL
-- 业务改为只使用 route_type + routing_note，这三列不再写入但保留兼容存量数据
ALTER TABLE bank_accounts MODIFY COLUMN bank_name VARCHAR(255) NULL;
ALTER TABLE bank_accounts MODIFY COLUMN account_number VARCHAR(100) NULL;
ALTER TABLE bank_accounts MODIFY COLUMN swift_code VARCHAR(100) NULL;
