-- 031_product_photos.sql
-- 产品多图表：每个产品可上传多张额外图片，供管理员维护、全员查看
-- 产品主图仍存 products.img_url（MEDIUMTEXT），多图额外独立存储
CREATE TABLE IF NOT EXISTS product_photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL COMMENT '关联产品ID',
  photo_url MEDIUMTEXT NOT NULL COMMENT '图片(base64)',
  caption VARCHAR(100) NULL DEFAULT NULL COMMENT '图片说明(选填)',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序（同产品内）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品多图';
