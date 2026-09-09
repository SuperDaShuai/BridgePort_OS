-- 006 样品管理多商品明细表
-- 将 samples_tracking 从单产品模式升级为多产品明细模式（仿照 orders / order_items）

CREATE TABLE IF NOT EXISTS sample_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  sample_id    INT NOT NULL COMMENT '样品单ID',
  product_id   INT NULL COMMENT '关联产品库ID（可空=定制打样）',
  model        VARCHAR(100) NOT NULL COMMENT '产品型号',
  name_en      VARCHAR(255) NULL COMMENT '英文品名',
  name_cn      VARCHAR(255) NULL COMMENT '中文品名',
  hs_code      VARCHAR(50)  NULL COMMENT 'HS编码',
  img_url      TEXT NULL COMMENT '产品图片（base64）',
  spec         TEXT NULL COMMENT '规格描述',
  qty          INT NOT NULL DEFAULT 1 COMMENT '样品数量',
  unit         VARCHAR(20) NULL DEFAULT 'PCS' COMMENT '单位',
  model_custom VARCHAR(100) NULL COMMENT '定制型号（打样专用）',
  notes        TEXT NULL COMMENT '本行备注（定制要求等）',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sample_items_sample FOREIGN KEY (sample_id) REFERENCES samples_tracking(id) ON DELETE CASCADE,
  INDEX idx_sample_items_sample (sample_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='样品单商品明细';
