-- 022: PI 支持用户选择是否显示 HS 编码行（默认不显示，与既有 show_special_req/show_stamp 开关同模式）
ALTER TABLE orders ADD COLUMN show_hs_code TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'PI是否显示HS编码行 0=隐藏 1=显示' AFTER show_stamp;
