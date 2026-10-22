-- 042: products 表新增 product_type 字段（关联产品配置管理的产品类型名称）
ALTER TABLE products ADD COLUMN product_type VARCHAR(100) NULL COMMENT '产品类型（关联 product_configs.product_type）' AFTER our_model;
