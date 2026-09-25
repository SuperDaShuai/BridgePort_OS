-- 032_samples_remarks.sql
-- 样品单主表新增 remarks 备注字段（业务员内部记录用，不进 PI）
ALTER TABLE samples_tracking ADD COLUMN remarks TEXT NULL COMMENT '内部备注（多行）' AFTER special_req;
