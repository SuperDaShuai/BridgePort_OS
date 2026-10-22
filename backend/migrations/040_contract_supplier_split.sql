-- 040: 购销合同/生产任务单按供应商拆分
-- 拆分结构（sub_contracts / sub_orders 数组）存入 JSON 顶层，无需建表或加字段
-- 涉及字段：orders.purchase_contract / orders.production_order
--        samples_tracking.purchase_contract / samples_tracking.production_order
-- 此迁移为占位记录，便于 schema_migrations 表追踪执行状态
SELECT 1;
