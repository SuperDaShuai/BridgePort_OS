-- ============================================================
-- BridgePort OS · 业务重构迁移 001
-- 依据：纯前端参考版（localStorage 版）设计评审结论
-- 内容：
--   新增 4 表：company_settings / order_nodes / contacts / order_receipts
--   改造：order_items 产品快照、商机漏斗外键(RFQ→报价→订单)、
--         shipping_orders 增 ETD/ETA、audit_logs 关联操作员、
--         purchase_contracts 交期转 DATE、核心表补 updated_at、
--         clients 扁平联系人字段移交 contacts 表、suppliers 去除冗余计数字段
-- 注意：本脚本设计为一次性执行（MySQL 不支持 ADD COLUMN IF NOT EXISTS）
-- ============================================================

-- ------------------------------------------------------------
-- 1. 企业配置与系统参数（设置中心：企业抬头 / 财务参数 / 条款模板）
-- ------------------------------------------------------------
CREATE TABLE company_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name_en VARCHAR(255) NOT NULL,
  name_cn VARCHAR(255),
  address_en TEXT,
  address_cn TEXT,
  tel VARCHAR(50),
  email VARCHAR(100),
  default_usd_rate DECIMAL(10,4) DEFAULT 7.2000 COMMENT '默认美元结汇汇率',
  default_tax_refund_rate DECIMAL(5,2) DEFAULT 13.00 COMMENT '标准出口退税率%',
  payment_terms_template TEXT COMMENT '付款条款模板',
  arbitration_clause TEXT COMMENT '国际仲裁条款模板',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业配置(单行表)';

INSERT INTO company_settings (name_en, name_cn) VALUES ('', '');

-- ------------------------------------------------------------
-- 2. 订单生命周期节点（订单工作台核心，每单 14 节点）
--    对应参考版 DEFAULT_NODES：BANK 银行收款 / FACTORY 工厂采购 /
--    SHIP 海运订舱 / TAX 国税退税 / ARCHIVE 项目归档
-- ------------------------------------------------------------
CREATE TABLE order_nodes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  node_code VARCHAR(10) NOT NULL COMMENT '节点编码 N01~N14',
  node_group ENUM('BANK','FACTORY','SHIP','TAX','ARCHIVE') NOT NULL,
  node_name VARCHAR(255) NOT NULL,
  responsible_role VARCHAR(100) COMMENT '责任角色',
  status ENUM('PENDING','PROCESSING','DONE') DEFAULT 'PENDING',
  planned_date DATE COMMENT '计划日期',
  actual_date DATE COMMENT '实际完成日期',
  note TEXT,
  sort_order INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_order_node (order_id, node_code),
  KEY idx_status (status),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单生命周期节点';

-- 存量订单补种 14 个默认节点（当前库为空则为空操作，保留作参考）
INSERT INTO order_nodes (order_id, node_code, node_group, node_name, responsible_role, sort_order)
SELECT o.id, t.node_code, t.node_group, t.node_name, t.node_role, t.sort_order
FROM orders o
CROSS JOIN (
  SELECT 'N01' node_code,'BANK'    node_group,'外商定金水单到账 (USD)'            node_name,'财务/外商' node_role, 1  sort_order
  UNION ALL SELECT 'N02','FACTORY','向工厂支付定金 (RMB)',                         '财务/工厂', 2
  UNION ALL SELECT 'N03','FACTORY','工序中期质检与技术图纸锁定',                   '驻场QC',    3
  UNION ALL SELECT 'N04','SHIP',   '订舱与 3D 装箱配载确认',                       '单证/货代', 4
  UNION ALL SELECT 'N05','FACTORY','成品完工与出厂质量报告',                       'QC/业务',   5
  UNION ALL SELECT 'N06','BANK',   '【风控核心】外商尾款结清到账',                 '财务/外商', 6
  UNION ALL SELECT 'N07','SHIP',   '集装箱装柜与封签存证',                         '仓储/QC',   7
  UNION ALL SELECT 'N08','SHIP',   '海关申报放行与大船离港 (ETD)',                 '报关行',    8
  UNION ALL SELECT 'N09','FACTORY','向工厂结清采购尾款',                           '财务/工厂', 9
  UNION ALL SELECT 'N10','TAX',    '取得工厂 13% 进项增值税专票并认证',            '工厂/财务', 10
  UNION ALL SELECT 'N11','SHIP',   '正本提单寄送或向船东申请电放',                 '单证/船司', 11
  UNION ALL SELECT 'N12','TAX',    '电子口岸结关数据下载与退税申报',               '财务/税局', 12
  UNION ALL SELECT 'N13','TAX',    '国税局出口退税款核准到账',                     '财务/国税', 13
  UNION ALL SELECT 'N14','ARCHIVE','收汇/税票/杂费核销与净利润结案',               '管理层',    14
) t
WHERE NOT EXISTS (SELECT 1 FROM order_nodes n WHERE n.order_id = o.id);

-- ------------------------------------------------------------
-- 3. 联系人表（客户 + 供应商共用，一对多）
-- ------------------------------------------------------------
CREATE TABLE contacts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  owner_type ENUM('CLIENT','SUPPLIER') NOT NULL,
  owner_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  position VARCHAR(100) COMMENT '职位',
  phone VARCHAR(50),
  email VARCHAR(100),
  whatsapp VARCHAR(50),
  is_primary TINYINT(1) DEFAULT 0,
  KEY idx_owner (owner_type, owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户/供应商联系人';

-- 迁移 clients 现有扁平联系人（空库为空操作，保留作参考）
INSERT INTO contacts (owner_type, owner_id, name, phone, email, is_primary)
SELECT 'CLIENT', id, contact_name, phone, email, 1
FROM clients
WHERE contact_name IS NOT NULL AND contact_name <> '';

-- ------------------------------------------------------------
-- 4. 订单收款记录（定金/尾款多笔，支撑 N01/N06 风控节点）
-- ------------------------------------------------------------
CREATE TABLE order_receipts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  stage ENUM('DEPOSIT','BALANCE','OTHER') DEFAULT 'OTHER' COMMENT '款项阶段',
  amount_usd DECIMAL(12,2) NOT NULL,
  exchange_rate DECIMAL(10,4) COMMENT '入账时汇率',
  receipt_date DATE,
  bank_account_id INT,
  note VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_order (order_id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单收款流水';

-- ------------------------------------------------------------
-- 5. order_items 补产品快照（防产品档案变更污染历史单据/报关单）
-- ------------------------------------------------------------
ALTER TABLE order_items
  ADD COLUMN name_en VARCHAR(255) AFTER model,
  ADD COLUMN name_cn VARCHAR(255) AFTER name_en,
  ADD COLUMN hs_code VARCHAR(50)  COMMENT '商品编码(报关必填)' AFTER name_cn,
  ADD COLUMN unit VARCHAR(20) AFTER qty,
  ADD COLUMN nw_per_ctn DECIMAL(10,2) COMMENT '箱净重kg',
  ADD COLUMN gw_per_ctn DECIMAL(10,2) COMMENT '箱毛重kg',
  ADD COLUMN cbm_per_ctn DECIMAL(10,4) COMMENT '箱体积cbm';

-- 存量明细从产品库回填快照（空库为空操作）
UPDATE order_items oi JOIN products p ON oi.product_id = p.id
SET oi.name_en = p.name_en, oi.name_cn = p.name_cn, oi.hs_code = p.hs_code,
    oi.nw_per_ctn = p.net_weight_kg, oi.gw_per_ctn = p.gross_weight_kg, oi.cbm_per_ctn = p.ctn_cbm
WHERE oi.name_en IS NULL;

-- ------------------------------------------------------------
-- 6. 商机漏斗转化链路：RFQ → 报价 → 订单 / RFQ → 样品
-- ------------------------------------------------------------
ALTER TABLE quotations
  ADD COLUMN rfq_id INT NULL COMMENT '来源询盘',
  ADD KEY idx_rfq (rfq_id),
  ADD CONSTRAINT fk_quotation_rfq FOREIGN KEY (rfq_id) REFERENCES rfqs(id);

ALTER TABLE orders
  ADD COLUMN quotation_id INT NULL COMMENT '来源报价单',
  ADD KEY idx_quotation (quotation_id),
  ADD CONSTRAINT fk_order_quotation FOREIGN KEY (quotation_id) REFERENCES quotations(id);

ALTER TABLE samples_tracking
  ADD COLUMN rfq_id INT NULL COMMENT '来源询盘',
  ADD KEY idx_rfq (rfq_id),
  ADD CONSTRAINT fk_sample_rfq FOREIGN KEY (rfq_id) REFERENCES rfqs(id);

-- ------------------------------------------------------------
-- 7. 订舱托书补关键船期（对应节点 N08 大船离港 ETD）
-- ------------------------------------------------------------
ALTER TABLE shipping_orders
  ADD COLUMN etd_date DATE COMMENT '预计离港',
  ADD COLUMN eta_date DATE COMMENT '预计到港';

-- ------------------------------------------------------------
-- 8. 操作日志关联操作员（原 operator_name 纯文本无法关联）
-- ------------------------------------------------------------
ALTER TABLE audit_logs
  ADD COLUMN operator_id INT NULL AFTER operator_name,
  ADD CONSTRAINT fk_audit_operator FOREIGN KEY (operator_id) REFERENCES operators(id);

-- ------------------------------------------------------------
-- 9. 购销合同交期转日期类型（与生产任务单一致，可比较排序）
-- ------------------------------------------------------------
ALTER TABLE purchase_contracts
  MODIFY COLUMN delivery_deadline DATE NULL COMMENT '交货期限';

-- ------------------------------------------------------------
-- 10. 核心主数据补 updated_at（并发编辑保护）
-- ------------------------------------------------------------
ALTER TABLE orders    ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
ALTER TABLE products  ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
ALTER TABLE clients   ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
ALTER TABLE suppliers ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- ------------------------------------------------------------
-- 11. 移除已被取代的旧字段
-- ------------------------------------------------------------
ALTER TABLE clients DROP COLUMN contact_name, DROP COLUMN phone, DROP COLUMN email;
ALTER TABLE suppliers DROP COLUMN contact_count;
