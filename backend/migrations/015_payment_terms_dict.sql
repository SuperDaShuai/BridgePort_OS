-- 015 付款方式字典：企业可自行录入/维护多种付款方式，替代原单行默认模板
CREATE TABLE IF NOT EXISTS payment_terms_dict (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  term_text   VARCHAR(500) NOT NULL COMMENT '付款方式文本',
  is_default  TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否默认（仅一条）',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='付款方式字典';

-- 种子：把企业配置里原有的默认付款方式模板迁移为字典默认项；无则放一条通用默认
INSERT INTO payment_terms_dict (term_text, is_default)
SELECT COALESCE(MAX(NULLIF(payment_terms_template, '')), '30% T/T Deposit, 70% Against B/L Copy'), 1
FROM company_settings
WHERE NOT EXISTS (SELECT 1 FROM payment_terms_dict);
