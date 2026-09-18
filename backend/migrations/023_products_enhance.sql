-- 023 产品数据库扩展字段
-- 新增：中文规格描述(spec_cn)、备注(remark)、单个重量(unit_weight_kg)、交货期(delivery_period)

ALTER TABLE products
  ADD COLUMN spec_cn TEXT NULL DEFAULT NULL COMMENT '中文规格描述' AFTER spec,
  ADD COLUMN remark TEXT NULL DEFAULT NULL COMMENT '备注' AFTER spec_cn,
  ADD COLUMN unit_weight_kg DECIMAL(10,3) NULL DEFAULT NULL COMMENT '单个重量(kg)' AFTER gross_weight_kg,
  ADD COLUMN delivery_period VARCHAR(100) NULL DEFAULT NULL COMMENT '交货期' AFTER remark;
