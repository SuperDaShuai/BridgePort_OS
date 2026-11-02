-- 让 products 精确关联 hs_codes 表的某一条（同 hs_code 允许多条时按外键匹配）
ALTER TABLE products ADD COLUMN hs_code_id INT NULL COMMENT '精确关联 hs_codes.id';
