-- 018: 企业配置新增电子签章图片字段（base64）
ALTER TABLE company_settings
  ADD COLUMN seal_img TEXT NULL DEFAULT NULL AFTER award_clause;
