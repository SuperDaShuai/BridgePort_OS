-- 051: 配件管理模块
-- 配件分类（插头、秤盘、电池、充电器...）
CREATE TABLE IF NOT EXISTS accessory_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT '分类名称，如：插头、秤盘',
  description VARCHAR(255) NULL COMMENT '分类描述',
  sort_order INT DEFAULT 0 COMMENT '排序，数字越小越靠前',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='配件分类';

-- 配件表
CREATE TABLE IF NOT EXISTS accessories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NULL COMMENT '所属分类ID',
  name VARCHAR(200) NOT NULL COMMENT '配件名称',
  image_url MEDIUMTEXT NULL COMMENT '配件图片（base64 data URL）',
  specs TEXT NULL COMMENT '基本参数（多行文本）',
  remark VARCHAR(500) NULL COMMENT '备注',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_category (category_id),
  CONSTRAINT fk_acc_cat FOREIGN KEY (category_id) REFERENCES accessory_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='配件';

-- 预置几个常用分类
INSERT INTO accessory_categories (name, sort_order, description) VALUES
  ('插头', 1, '各种电源插头'),
  ('秤盘', 2, '秤盘、托盘等'),
  ('电池', 3, '充电电池、干电池'),
  ('充电器', 4, '充电器、适配器'),
  ('配件', 5, '其他配件')
ON DUPLICATE KEY UPDATE name = VALUES(name);
