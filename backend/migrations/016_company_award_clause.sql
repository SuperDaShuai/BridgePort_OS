-- 016: 企业配置新增冲裁条款字段（用于 PI 模板，位于 BENEFICIARY BANK DETAILS 与 ARBITRATION CLAUSE 之间）
ALTER TABLE company_settings
  ADD COLUMN award_clause TEXT NULL DEFAULT NULL AFTER arbitration_clause;
