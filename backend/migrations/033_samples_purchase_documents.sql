-- 033_samples_purchase_documents.sql
-- 样品单主表新增购销合同/生产任务单字段（JSON 存储，MEDIUMTEXT 防超限）
-- 样品单默认按「客户自行报关」逻辑仅生成购销合同 + 生产任务单，不生成订舱/清关/报关单据
ALTER TABLE samples_tracking
  ADD COLUMN purchase_contract MEDIUMTEXT NULL COMMENT '购销合同数据(JSON)' AFTER remarks,
  ADD COLUMN production_order  MEDIUMTEXT NULL COMMENT '生产任务单数据(JSON)' AFTER purchase_contract;
