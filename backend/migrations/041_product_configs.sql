-- 041 · 产品配置管理表
-- 用于生产任务单编辑弹窗「模块二：核心电气配置」的动态字段定义
-- 不同产品类型（如通用工业秤、人体秤、厨房秤等）可定义不同的配置字段

CREATE TABLE IF NOT EXISTS product_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_type VARCHAR(100) NOT NULL COMMENT '产品类型名称（如：通用工业秤、人体秤）',
  config_fields MEDIUMTEXT NOT NULL COMMENT '配置字段定义JSON数组',
  remark VARCHAR(255) NULL COMMENT '备注',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_product_type (product_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='产品配置管理';

-- 预置默认产品类型「通用工业秤」，包含当前硬编码的 5 个字段
INSERT INTO product_configs (product_type, config_fields, remark)
SELECT '通用工业秤',
  JSON_ARRAY(
    JSON_OBJECT('label', '主板型号', 'key', 'board_model', 'type', 'input', 'placeholder', '如：埃及主板'),
    JSON_OBJECT('label', '充电模式', 'key', 'charge_mode', 'type', 'select', 'allowCreate', true, 'options', JSON_ARRAY('PTC充电', '硅整流', '开关电源', '双源充电')),
    JSON_OBJECT('label', '工作电压', 'key', 'work_voltage', 'type', 'select', 'allowCreate', true, 'options', JSON_ARRAY('220V', '110V', '380V', '36V', '24V', '12V')),
    JSON_OBJECT('label', '电池规格', 'key', 'battery_spec', 'type', 'select', 'allowCreate', true, 'options', JSON_ARRAY('4V4AH', '6V4AH', '4V2.5AH', '6V2.5AH')),
    JSON_OBJECT('label', 'PTC保护', 'key', 'ptc_protection', 'type', 'select', 'allowCreate', true, 'options', JSON_ARRAY('有', '无'))
  ),
  '默认产品类型，迁移自原硬编码字段'
WHERE NOT EXISTS (SELECT 1 FROM product_configs WHERE product_type = '通用工业秤');
