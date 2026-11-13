-- 058 orders.delivery_date 由 DATE 改为 VARCHAR：既支持选择日期，也支持 "收到定金后30天" 这类文字说明
-- DATE -> VARCHAR 为隐式转换，历史数据自动变为 'YYYY-MM-DD' 字符串，不会丢失
ALTER TABLE orders
  MODIFY COLUMN delivery_date VARCHAR(100) NULL DEFAULT NULL COMMENT '交货日期（日期或文字说明）';
