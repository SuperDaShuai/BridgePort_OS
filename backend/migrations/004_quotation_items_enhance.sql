-- ============================================================
-- 迁移 004 — 报价产品明细扩展 + 报价单号唯一约束
-- 触发原因：报价单新增/编辑功能需要完整快照产品属性用于 PI 预览和整柜估算展示
-- 变更内容：
--   1) quotation_items.img_url 改为 TEXT（存 base64 图片，与 products 表保持一致）
--   2) quotation_items 新增 14 个产品快照字段（name_en, name_cn, hs_code, unit,
--      pcs_per_ctn, ctn_length, ctn_width, ctn_height, nw_per_ctn, gw_per_ctn,
--      cbm_per_ctn, est_qty_20gp, est_qty_40gp, est_qty_40hq）
--   3) quotations.quotation_number 加 UNIQUE 索引（业务约束：报价单号不可重复）
-- 影响范围：仅新增字段/扩宽字段，对已有数据无破坏性
-- ============================================================

-- quotation_items.img_url 由 varchar(500) 改为 TEXT（存 base64 图片）
ALTER TABLE quotation_items MODIFY COLUMN img_url TEXT NULL;

-- 报价产品明细：扩展产品快照字段
ALTER TABLE quotation_items
  ADD COLUMN name_en     VARCHAR(255)  NULL COMMENT '英文品名快照'                    AFTER model,
  ADD COLUMN name_cn     VARCHAR(255)  NULL COMMENT '中文品名快照'                    AFTER name_en,
  ADD COLUMN hs_code     VARCHAR(50)   NULL COMMENT 'HS编码快照'                      AFTER name_cn,
  ADD COLUMN unit        VARCHAR(20)   NULL DEFAULT '台' COMMENT '单位'                AFTER hs_code,
  ADD COLUMN pcs_per_ctn INT           NULL DEFAULT 1  COMMENT '装箱数快照'              AFTER unit,
  ADD COLUMN ctn_length  DECIMAL(8,2)  NULL DEFAULT 0.00 COMMENT '外箱尺寸长(cm)'     AFTER pcs_per_ctn,
  ADD COLUMN ctn_width   DECIMAL(8,2)  NULL DEFAULT 0.00 COMMENT '外箱尺寸宽(cm)'     AFTER ctn_length,
  ADD COLUMN ctn_height  DECIMAL(8,2)  NULL DEFAULT 0.00 COMMENT '外箱尺寸高(cm)'     AFTER ctn_width,
  ADD COLUMN nw_per_ctn  DECIMAL(10,2) NULL DEFAULT 0.00 COMMENT '单箱净重(kg)'       AFTER ctn_height,
  ADD COLUMN gw_per_ctn  DECIMAL(10,2) NULL DEFAULT 0.00 COMMENT '单箱毛重(kg)'       AFTER nw_per_ctn,
  ADD COLUMN cbm_per_ctn DECIMAL(10,4) NULL DEFAULT 0.0000 COMMENT '单箱体积(cbm)'   AFTER gw_per_ctn,
  ADD COLUMN est_qty_20gp INT          NULL DEFAULT 0  COMMENT '20GP整柜装箱量快照'    AFTER cbm_per_ctn,
  ADD COLUMN est_qty_40gp INT          NULL DEFAULT 0  COMMENT '40GP整柜装箱量快照'    AFTER est_qty_20gp,
  ADD COLUMN est_qty_40hq INT          NULL DEFAULT 0  COMMENT '40HQ整柜装箱量快照'    AFTER est_qty_40gp;

-- 报价单号唯一约束（允许先加索引再加约束，避免唯一值冲突报错）
-- 先检查是否已存在唯一索引，避免重复执行报错
-- ALTER TABLE quotations ADD UNIQUE INDEX uk_quotation_number (quotation_number);
-- 注：若线上已存在重复 quotation_number，需要先手动清洗数据再加约束

-- 当前步骤仅新增字段，唯一索引在确认线上数据无重复后再单独执行
