-- 013 基础母库新增 HS 编码库表
-- 字段：HS编码（唯一）、HS产品名称、申报要素（多行文本）
CREATE TABLE IF NOT EXISTS hs_codes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  hs_code     VARCHAR(20)  NOT NULL COMMENT 'HS编码',
  product_name VARCHAR(255) NOT NULL COMMENT 'HS产品名称',
  declaration_elements TEXT NULL COMMENT '申报要素（多行文本）',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_hs_code (hs_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='HS编码库';
