-- ============================================================
-- 024 · 操作跟踪
-- 1. 新建 operation_logs 操作日志表：记录谁(操作员)在什么时间
--    对哪个模块的哪条单据(业务编号)做了新增或修改
-- 2. rfqs / quotations / samples_tracking / orders 四张业务表
--    新增 owner_name 负责人字段（创建人自动写入）
-- 注意：全部为新增操作，不影响既有数据
-- ============================================================

CREATE TABLE IF NOT EXISTS operation_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  operator_id INT NULL COMMENT '操作员ID',
  operator_name VARCHAR(100) NOT NULL COMMENT '操作员账号',
  operator_display VARCHAR(100) NULL COMMENT '操作员显示名',
  module VARCHAR(50) NOT NULL COMMENT '模块: rfq/quotation/sample/order',
  action VARCHAR(20) NOT NULL COMMENT '动作: 新增/修改',
  target_no VARCHAR(100) NULL COMMENT '业务编号(询盘号/报价单号/样品单号/PI号)',
  target_id INT NULL COMMENT '业务记录主键ID',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_module (module),
  KEY idx_operator (operator_id),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志';

ALTER TABLE rfqs ADD COLUMN owner_name VARCHAR(100) NULL DEFAULT NULL COMMENT '负责人(创建人)';
ALTER TABLE quotations ADD COLUMN owner_name VARCHAR(100) NULL DEFAULT NULL COMMENT '负责人(创建人)';
ALTER TABLE samples_tracking ADD COLUMN owner_name VARCHAR(100) NULL DEFAULT NULL COMMENT '负责人(创建人)';
ALTER TABLE orders ADD COLUMN owner_name VARCHAR(100) NULL DEFAULT NULL COMMENT '负责人(创建人)';
