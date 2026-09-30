-- 037: 企业配置新增合同专用章图片字段（购销合同 PDF 顶部展示）
-- 与 seal_img（电子签章）独立，seal_img 用于外销 PI 等单据
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS contract_seal_img MEDIUMTEXT NULL COMMENT '合同专用章图片（base64），用于购销合同顶部展示';
