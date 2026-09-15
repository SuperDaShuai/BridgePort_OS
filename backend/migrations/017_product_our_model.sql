-- 017: 产品表新增"我司型号"字段
ALTER TABLE products
  ADD COLUMN our_model VARCHAR(255) NULL DEFAULT NULL AFTER model;
