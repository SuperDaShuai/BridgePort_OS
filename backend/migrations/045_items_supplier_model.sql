-- 045: order_items / sample_items 新增 supplier_model（供应商型号）列
-- 前端购销合同/生产任务单编辑弹窗里"产品型号"字段绑的是 supplier_model，
-- 此前该字段未持久化（ITEM_FIELDS 未包含且 DB 无此列），保存后读回变空。

ALTER TABLE order_items
  ADD COLUMN supplier_model VARCHAR(100) NULL AFTER model;

ALTER TABLE sample_items
  ADD COLUMN supplier_model VARCHAR(100) NULL AFTER model;
