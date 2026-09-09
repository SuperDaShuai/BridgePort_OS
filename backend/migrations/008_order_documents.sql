-- 008 订单单据数据字段（购销合同/生产任务单/订舱委托书/报关要素/清关资料）
ALTER TABLE orders
  ADD COLUMN purchase_contract JSON NULL COMMENT '购销合同数据' AFTER customs_responsibility,
  ADD COLUMN production_order JSON NULL COMMENT '生产任务单数据' AFTER purchase_contract,
  ADD COLUMN booking_data JSON NULL COMMENT '订舱委托书数据' AFTER production_order,
  ADD COLUMN customs_data JSON NULL COMMENT '清关外销单据数据(Invoice/Contract/PL)' AFTER booking_data,
  ADD COLUMN decl_data JSON NULL COMMENT '出口报关草单数据' AFTER customs_data;
