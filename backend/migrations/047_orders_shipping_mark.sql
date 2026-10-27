-- 047 orders 表新增 shipping_mark（唛头）字段
ALTER TABLE orders ADD COLUMN shipping_mark TEXT NULL COMMENT 'Shipping Mark 唛头（多行文本）' AFTER special_req;
