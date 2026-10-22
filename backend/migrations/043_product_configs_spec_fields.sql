-- 043 · product_configs 表新增 spec_fields 列（详细规范字段定义）
-- spec_fields 独立于 config_fields（模块二核心电气配置），专门用于生产任务单明细行「详细规范」模板
-- 类型固定为文本输入，仅管理字段标签列表

ALTER TABLE product_configs
  ADD COLUMN spec_fields MEDIUMTEXT NULL COMMENT '详细规范字段定义JSON数组（仅label+key，类型固定文本输入）'
  AFTER config_fields;

-- 预置「通用工业秤」的详细规范字段（与原 config_fields 的 label 一致，保持兼容）
UPDATE product_configs
  SET spec_fields = JSON_ARRAY(
    JSON_OBJECT('label', '主板型号', 'key', 'board_model', 'type', 'input'),
    JSON_OBJECT('label', '充电模式', 'key', 'charge_mode', 'type', 'input'),
    JSON_OBJECT('label', '工作电压', 'key', 'work_voltage', 'type', 'input'),
    JSON_OBJECT('label', '电池规格', 'key', 'battery_spec', 'type', 'input'),
    JSON_OBJECT('label', 'PTC保护', 'key', 'ptc_protection', 'type', 'input')
  )
  WHERE product_type = '通用工业秤' AND spec_fields IS NULL;
