-- 034_samples_supplier_product_model.sql
-- 样品单增加供应商字段（生产任务单供应商下拉关联）；产品已有 our_model 作为供应商型号，无需新增
ALTER TABLE samples_tracking
  ADD COLUMN supplier_id INT NULL DEFAULT NULL COMMENT '供应商ID' AFTER client_id;
