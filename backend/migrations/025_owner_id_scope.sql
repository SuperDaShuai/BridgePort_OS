-- ============================================================
-- 025 · 业务员数据隔离
-- rfqs / quotations / samples_tracking / orders / clients 五表
-- 新增 owner_id（创建操作员ID），用于权限等级 3 的数据归属过滤
-- 注意：历史数据 owner_id 为 NULL，仅超级管理员/主管可见，不影响现有使用
-- ============================================================

ALTER TABLE rfqs ADD COLUMN owner_id INT NULL DEFAULT NULL COMMENT '创建操作员ID';
ALTER TABLE quotations ADD COLUMN owner_id INT NULL DEFAULT NULL COMMENT '创建操作员ID';
ALTER TABLE samples_tracking ADD COLUMN owner_id INT NULL DEFAULT NULL COMMENT '创建操作员ID';
ALTER TABLE orders ADD COLUMN owner_id INT NULL DEFAULT NULL COMMENT '创建操作员ID';
ALTER TABLE clients ADD COLUMN owner_id INT NULL DEFAULT NULL COMMENT '创建操作员ID';

-- clients 同步补 owner_name（024 仅覆盖四业务表，未含 clients；客户管理新增时写入创建人）
ALTER TABLE clients ADD COLUMN owner_name VARCHAR(100) NULL DEFAULT NULL COMMENT '负责人(创建人)';
