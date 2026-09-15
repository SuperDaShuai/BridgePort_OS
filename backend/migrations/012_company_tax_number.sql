-- 012 企业配置新增纳税识别号字段（企业抬头与联系方式区块）
ALTER TABLE company_settings ADD COLUMN tax_number VARCHAR(50) NULL COMMENT '纳税识别号' AFTER email;
