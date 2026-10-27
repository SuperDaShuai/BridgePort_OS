-- 048 移除 hs_codes 表的 hs_code 唯一索引（业务允许同一 HS 编码存在多条记录，配合不同产品名称/申报要素）
ALTER TABLE hs_codes DROP INDEX uk_hs_code;
