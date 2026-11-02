-- 049: hs_codes 增加 unit 字段
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hs_codes' AND COLUMN_NAME = 'unit'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE hs_codes ADD COLUMN unit VARCHAR(20) DEFAULT '''' COMMENT ''计量单位（台/套/千克/个等）'' AFTER declaration_elements',
  'SELECT ''049: unit already exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
