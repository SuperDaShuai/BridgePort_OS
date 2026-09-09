-- 007 报价单表新增采购供应商字段
ALTER TABLE quotations
  ADD COLUMN supplier_id INT NULL COMMENT '采购供应商ID' AFTER client_id,
  ADD INDEX idx_quotations_supplier (supplier_id),
  ADD CONSTRAINT fk_quotations_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
