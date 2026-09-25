/**
 * BridgePort OS · 数据库一键迁移脚本 (幂等)
 *
 * 用法：在服务器 backend 目录下执行：
 *   node migrate.js              # 执行所有未完成的迁移
 *   node migrate.js --dry-run    # 仅预览，不实际执行
 *   node migrate.js --force      # 强制执行（忽略已执行记录）
 *
 * 特点：
 *   1. 通过 schema_migrations 表记录进度，可断点续传
 *   2. 每个迁移内置前置检查（表/列存在性），即使重复执行也不会报错
 *   3. 覆盖从初始版本到 v21 的全部结构变更
 *   4. 自动处理 010(DROP name_cn) → 011(恢复 name_cn) 的特殊场景
 *
 * 前置条件：.env 文件已配置好数据库连接
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

// ========== 连接数据库 ==========
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'trade_system',
  waitForConnections: true,
  connectionLimit: 1, // 迁移脚本单连接足够
  charset: 'utf8mb4_general_ci',
  multipleStatements: true
});

// ========== 工具函数 ==========
async function tableExists(conn, tableName) {
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
    [tableName]
  );
  return rows[0].cnt > 0;
}

async function columnExists(conn, tableName, columnName) {
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
    [tableName, columnName]
  );
  return rows[0].cnt > 0;
}

async function runSQL(conn, sql, params = []) {
  const [result] = await conn.query(sql, params);
  return result;
}

// ========== 迁移定义 ==========
const migrations = [
  // ===== 001 · 业务重构：新建 4 张表 + 多表 ALTER + 清理旧字段 =====
  {
    id: '001',
    desc: '业务重构：新建 company_settings/order_nodes/contacts/order_receipts 表',
    async check(conn) {
      return await tableExists(conn, 'company_settings');
    },
    async up(conn) {
      if (!(await tableExists(conn, 'company_settings'))) {
        await runSQL(conn, `
          CREATE TABLE company_settings (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name_en VARCHAR(255) NOT NULL,
            name_cn VARCHAR(255),
            address_en TEXT,
            address_cn TEXT,
            tel VARCHAR(50),
            email VARCHAR(100),
            default_usd_rate DECIMAL(10,4) DEFAULT 7.2000,
            default_tax_refund_rate DECIMAL(5,2) DEFAULT 13.00,
            payment_terms_template TEXT,
            arbitration_clause TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='企业配置(单行表)'
        `);
        await runSQL(conn, `INSERT INTO company_settings (name_en, name_cn) VALUES ('', '')`);
      }

      if (await tableExists(conn, 'orders')) {
        if (!(await tableExists(conn, 'order_nodes'))) {
          await runSQL(conn, `
            CREATE TABLE order_nodes (
              id INT PRIMARY KEY AUTO_INCREMENT,
              order_id INT NOT NULL,
              node_code VARCHAR(10) NOT NULL,
              node_group ENUM('BANK','FACTORY','SHIP','TAX','ARCHIVE') NOT NULL,
              node_name VARCHAR(255) NOT NULL,
              responsible_role VARCHAR(100),
              status ENUM('PENDING','PROCESSING','DONE') DEFAULT 'PENDING',
              planned_date DATE,
              actual_date DATE,
              note TEXT,
              sort_order INT DEFAULT 0,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              UNIQUE KEY uk_order_node (order_id, node_code),
              KEY idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单生命周期节点'
          `);
        }
      }

      if (!(await tableExists(conn, 'contacts'))) {
        await runSQL(conn, `
          CREATE TABLE contacts (
            id INT PRIMARY KEY AUTO_INCREMENT,
            owner_type ENUM('CLIENT','SUPPLIER') NOT NULL,
            owner_id INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            position VARCHAR(100),
            phone VARCHAR(50),
            email VARCHAR(100),
            whatsapp VARCHAR(50),
            is_primary TINYINT(1) DEFAULT 0,
            KEY idx_owner (owner_type, owner_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户/供应商联系人'
        `);
      }

      if (await tableExists(conn, 'bank_accounts')) {
        if (!(await tableExists(conn, 'order_receipts'))) {
          await runSQL(conn, `
            CREATE TABLE order_receipts (
              id INT PRIMARY KEY AUTO_INCREMENT,
              order_id INT NOT NULL,
              stage ENUM('DEPOSIT','BALANCE','OTHER') DEFAULT 'OTHER',
              amount_usd DECIMAL(12,2) NOT NULL,
              exchange_rate DECIMAL(10,4),
              receipt_date DATE,
              bank_account_id INT,
              note VARCHAR(255),
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              KEY idx_order (order_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单收款流水'
          `);
        }
      }

      if (await tableExists(conn, 'order_items')) {
        const oiAlters = [
          ['name_en', 'ALTER TABLE order_items ADD COLUMN name_en VARCHAR(255) AFTER model'],
          ['name_cn', 'ALTER TABLE order_items ADD COLUMN name_cn VARCHAR(255) AFTER name_en'],
          ['hs_code', "ALTER TABLE order_items ADD COLUMN hs_code VARCHAR(50) COMMENT '商品编码' AFTER name_cn"],
          ['unit', 'ALTER TABLE order_items ADD COLUMN unit VARCHAR(20) AFTER qty'],
          ['nw_per_ctn', "ALTER TABLE order_items ADD COLUMN nw_per_ctn DECIMAL(10,2) COMMENT '箱净重kg'"],
          ['gw_per_ctn', "ALTER TABLE order_items ADD COLUMN gw_per_ctn DECIMAL(10,2) COMMENT '箱毛重kg'"],
          ['cbm_per_ctn', "ALTER TABLE order_items ADD COLUMN cbm_per_ctn DECIMAL(10,4) COMMENT '箱体积cbm'"]
        ];
        for (const [col, sql] of oiAlters) {
          if (!(await columnExists(conn, 'order_items', col))) await runSQL(conn, sql);
        }
      }

      if (await tableExists(conn, 'quotations')) {
        if (!(await columnExists(conn, 'quotations', 'rfq_id'))) {
          await runSQL(conn, `ALTER TABLE quotations ADD COLUMN rfq_id INT NULL, ADD KEY idx_rfq (rfq_id)`);
        }
      }
      if (await tableExists(conn, 'orders')) {
        if (!(await columnExists(conn, 'orders', 'quotation_id'))) {
          await runSQL(conn, `ALTER TABLE orders ADD COLUMN quotation_id INT NULL, ADD KEY idx_quotation (quotation_id)`);
        }
      }
      if (await tableExists(conn, 'samples_tracking')) {
        if (!(await columnExists(conn, 'samples_tracking', 'rfq_id'))) {
          await runSQL(conn, `ALTER TABLE samples_tracking ADD COLUMN rfq_id INT NULL, ADD KEY idx_rfq (rfq_id)`);
        }
      }

      if (await tableExists(conn, 'shipping_orders')) {
        if (!(await columnExists(conn, 'shipping_orders', 'etd_date'))) {
          await runSQL(conn, `ALTER TABLE shipping_orders ADD COLUMN etd_date DATE, ADD COLUMN eta_date DATE`);
        }
      }

      if (await tableExists(conn, 'audit_logs')) {
        if (!(await columnExists(conn, 'audit_logs', 'operator_id'))) {
          await runSQL(conn, `ALTER TABLE audit_logs ADD COLUMN operator_id INT NULL AFTER operator_name`);
        }
      }

      if (await tableExists(conn, 'purchase_contracts')) {
        try {
          await runSQL(conn, `ALTER TABLE purchase_contracts MODIFY COLUMN delivery_deadline DATE NULL`);
        } catch (e) { /* 已是 DATE 类型 */ }
      }

      for (const t of ['orders', 'products', 'clients', 'suppliers']) {
        if (await tableExists(conn, t)) {
          if (!(await columnExists(conn, t, 'updated_at'))) {
            await runSQL(conn, `ALTER TABLE ${t} ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
          }
        }
      }

      if (await tableExists(conn, 'clients')) {
        for (const col of ['contact_name', 'phone', 'email']) {
          if (await columnExists(conn, 'clients', col)) {
            try { await runSQL(conn, `ALTER TABLE clients DROP COLUMN ${col}`); } catch (e) {}
          }
        }
      }
      if (await tableExists(conn, 'suppliers')) {
        if (await columnExists(conn, 'suppliers', 'contact_count')) {
          try { await runSQL(conn, `ALTER TABLE suppliers DROP COLUMN contact_count`); } catch (e) {}
        }
      }
    }
  },

  // ===== 002 · operators 权限字段 + 默认管理员 =====
  {
    id: '002',
    desc: '员工权限体系：加 permission_level 等字段，种入默认管理员',
    async check(conn) {
      if (!(await tableExists(conn, 'operators'))) return true;
      return await columnExists(conn, 'operators', 'permission_level');
    },
    async up(conn) {
      const cols = [
        ['display_name', 'ALTER TABLE operators ADD COLUMN display_name VARCHAR(100) DEFAULT NULL AFTER username'],
        ['phone', 'ALTER TABLE operators ADD COLUMN phone VARCHAR(50) DEFAULT NULL AFTER role'],
        ['email', 'ALTER TABLE operators ADD COLUMN email VARCHAR(100) DEFAULT NULL AFTER phone'],
        ['permission_level', "ALTER TABLE operators ADD COLUMN permission_level TINYINT NOT NULL DEFAULT 3 COMMENT '权限等级 1=超级管理员 2=业务主管 3=业务员 4=财务跟单' AFTER email"],
        ['status', "ALTER TABLE operators ADD COLUMN status TINYINT NOT NULL DEFAULT 1 COMMENT '1=启用 0=禁用' AFTER permission_level"]
      ];
      for (const [col, sql] of cols) {
        if (!(await columnExists(conn, 'operators', col))) await runSQL(conn, sql);
      }
      const [exists] = await conn.query('SELECT id FROM operators WHERE username = ?', ['admin']);
      if (exists.length === 0) {
        await runSQL(conn, `
          INSERT INTO operators (username, display_name, role, permission_level, password_hash, status)
          VALUES ('admin', '系统管理员', '超级管理员', 1, '$2b$10$8p4OTrJUMIFJFoZDo4ja1ecCL6VeIQknWqvU//8G/WYCg.B27UUxK', 1)
        `);
      }
    }
  },

  // ===== 003 · products.img_url 扩容 TEXT =====
  {
    id: '003',
    desc: 'products.img_url 从 VARCHAR(500) 改为 TEXT',
    async check(conn) {
      if (!(await tableExists(conn, 'products'))) return true;
      const [cols] = await conn.query(
        "SELECT DATA_TYPE FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='products' AND column_name='img_url'"
      );
      return cols.length > 0 && cols[0].DATA_TYPE !== 'varchar';
    },
    async up(conn) {
      await runSQL(conn, `ALTER TABLE products MODIFY COLUMN img_url TEXT NULL COMMENT '产品图片(base64压缩图)'`);
    }
  },

  // ===== 004 · quotation_items 扩展 + img_url TEXT =====
  {
    id: '004',
    desc: 'quotation_items.img_url→TEXT + 14 个快照字段',
    async check(conn) {
      if (!(await tableExists(conn, 'quotation_items'))) return true;
      return await columnExists(conn, 'quotation_items', 'name_en');
    },
    async up(conn) {
      try { await runSQL(conn, `ALTER TABLE quotation_items MODIFY COLUMN img_url TEXT NULL`); } catch (e) {}
      const cols = [
        ['name_en', 'VARCHAR(255) NULL', 'AFTER model'],
        ['name_cn', 'VARCHAR(255) NULL', 'AFTER name_en'],
        ['hs_code', "VARCHAR(50) NULL COMMENT 'HS编码快照'", 'AFTER name_cn'],
        ['unit', "VARCHAR(20) NULL DEFAULT '台' COMMENT '单位'", 'AFTER hs_code'],
        ['pcs_per_ctn', "INT NULL DEFAULT 1 COMMENT '装箱数快照'", 'AFTER unit'],
        ['ctn_length', "DECIMAL(8,2) NULL DEFAULT 0.00 COMMENT '外箱长cm'", 'AFTER pcs_per_ctn'],
        ['ctn_width', "DECIMAL(8,2) NULL DEFAULT 0.00 COMMENT '外箱宽cm'", 'AFTER ctn_length'],
        ['ctn_height', "DECIMAL(8,2) NULL DEFAULT 0.00 COMMENT '外箱高cm'", 'AFTER ctn_width'],
        ['nw_per_ctn', "DECIMAL(10,2) NULL DEFAULT 0.00 COMMENT '单箱净重kg'", 'AFTER ctn_height'],
        ['gw_per_ctn', "DECIMAL(10,2) NULL DEFAULT 0.00 COMMENT '单箱毛重kg'", 'AFTER nw_per_ctn'],
        ['cbm_per_ctn', "DECIMAL(10,4) NULL DEFAULT 0.0000 COMMENT '单箱体积cbm'", 'AFTER gw_per_ctn'],
        ['est_qty_20gp', "INT NULL DEFAULT 0 COMMENT '20GP整柜装箱量'", 'AFTER cbm_per_ctn'],
        ['est_qty_40gp', "INT NULL DEFAULT 0 COMMENT '40GP整柜装箱量'", 'AFTER est_qty_20gp'],
        ['est_qty_40hq', "INT NULL DEFAULT 0 COMMENT '40HQ整柜装箱量'", 'AFTER est_qty_40gp']
      ];
      for (const [col, def, pos] of cols) {
        if (!(await columnExists(conn, 'quotation_items', col))) {
          await runSQL(conn, `ALTER TABLE quotation_items ADD COLUMN ${col} ${def} ${pos}`);
        }
      }
    }
  },

  // ===== 005 · order_items.img_url TEXT =====
  {
    id: '005',
    desc: 'order_items.img_url 改为 TEXT',
    async check(conn) {
      if (!(await tableExists(conn, 'order_items'))) return true;
      const [cols] = await conn.query(
        "SELECT DATA_TYPE FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='order_items' AND column_name='img_url'"
      );
      return cols.length > 0 && cols[0].DATA_TYPE !== 'varchar';
    },
    async up(conn) {
      await runSQL(conn, `ALTER TABLE order_items MODIFY COLUMN img_url TEXT NULL COMMENT '产品图片快照(base64)'`);
    }
  },

  // ===== 006 · sample_items 表 =====
  {
    id: '006',
    desc: '新建 sample_items 表',
    async check(conn) {
      return await tableExists(conn, 'sample_items');
    },
    async up(conn) {
      await runSQL(conn, `
        CREATE TABLE IF NOT EXISTS sample_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          sample_id INT NOT NULL,
          product_id INT NULL,
          model VARCHAR(100) NOT NULL,
          name_en VARCHAR(255) NULL,
          name_cn VARCHAR(255) NULL,
          hs_code VARCHAR(50) NULL,
          img_url TEXT NULL,
          spec TEXT NULL,
          qty INT NOT NULL DEFAULT 1,
          unit VARCHAR(20) NULL DEFAULT 'PCS',
          model_custom VARCHAR(100) NULL,
          notes TEXT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          KEY idx_sample_items_sample (sample_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='样品单商品明细'
      `);
    }
  },

  // ===== 007 · quotations.supplier_id =====
  {
    id: '007',
    desc: 'quotations 表新增 supplier_id',
    async check(conn) {
      if (!(await tableExists(conn, 'quotations'))) return true;
      return await columnExists(conn, 'quotations', 'supplier_id');
    },
    async up(conn) {
      await runSQL(conn, `ALTER TABLE quotations ADD COLUMN supplier_id INT NULL COMMENT '采购供应商ID' AFTER client_id, ADD INDEX idx_quotations_supplier (supplier_id)`);
    }
  },

  // ===== 008 · orders 5 个 JSON 列 =====
  {
    id: '008',
    desc: 'orders 表新增 5 个单据 JSON 列',
    async check(conn) {
      if (!(await tableExists(conn, 'orders'))) return true;
      return await columnExists(conn, 'orders', 'purchase_contract');
    },
    async up(conn) {
      const cols = [
        ['purchase_contract', "ALTER TABLE orders ADD COLUMN purchase_contract JSON NULL COMMENT '购销合同数据' AFTER customs_responsibility"],
        ['production_order', "ALTER TABLE orders ADD COLUMN production_order JSON NULL COMMENT '生产任务单数据' AFTER purchase_contract"],
        ['booking_data', "ALTER TABLE orders ADD COLUMN booking_data JSON NULL COMMENT '订舱委托书数据' AFTER production_order"],
        ['customs_data', "ALTER TABLE orders ADD COLUMN customs_data JSON NULL COMMENT '清关外销单据数据' AFTER booking_data"],
        ['decl_data', "ALTER TABLE orders ADD COLUMN decl_data JSON NULL COMMENT '出口报关草单数据' AFTER customs_data"]
      ];
      for (const [col, sql] of cols) {
        if (!(await columnExists(conn, 'orders', col))) await runSQL(conn, sql);
      }
    }
  },

  // ===== 009 · order_items.cost_cny + company_settings 银行信息 =====
  {
    id: '009',
    desc: 'order_items 加 cost_cny；company_settings 加 bank_name/bank_account',
    async check(conn) {
      const a = await tableExists(conn, 'order_items') && await columnExists(conn, 'order_items', 'cost_cny');
      const b = await tableExists(conn, 'company_settings') && await columnExists(conn, 'company_settings', 'bank_name');
      return a && b;
    },
    async up(conn) {
      if (await tableExists(conn, 'order_items') && !(await columnExists(conn, 'order_items', 'cost_cny'))) {
        await runSQL(conn, "ALTER TABLE order_items ADD COLUMN cost_cny DECIMAL(10,2) NULL COMMENT '含税采购单价(元)' AFTER price");
      }
      if (await tableExists(conn, 'company_settings')) {
        if (!(await columnExists(conn, 'company_settings', 'bank_name'))) {
          await runSQL(conn, "ALTER TABLE company_settings ADD COLUMN bank_name VARCHAR(255) NULL COMMENT '开户银行' AFTER email");
        }
        if (!(await columnExists(conn, 'company_settings', 'bank_account'))) {
          await runSQL(conn, "ALTER TABLE company_settings ADD COLUMN bank_account VARCHAR(100) NULL COMMENT '银行账号' AFTER bank_name");
        }
      }
    }
  },

  // ===== 010 · DROP name_cn（已被 011 取代，空操作） =====
  {
    id: '010',
    desc: '（已废弃，由 011 统一处理）',
    async check(conn) { return true; },
    async up(conn) { /* 空操作 */ }
  },

  // ===== 011 · 恢复 products.name_cn =====
  {
    id: '011',
    desc: 'products 表恢复 name_cn 字段',
    async check(conn) {
      if (!(await tableExists(conn, 'products'))) return true;
      return await columnExists(conn, 'products', 'name_cn');
    },
    async up(conn) {
      if (!(await columnExists(conn, 'products', 'name_cn'))) {
        await runSQL(conn, "ALTER TABLE products ADD COLUMN name_cn VARCHAR(255) NULL AFTER name_en");
      }
    }
  },

  // ===== 012 · company_settings.tax_number =====
  {
    id: '012',
    desc: 'company_settings 新增纳税识别号 tax_number',
    async check(conn) {
      if (!(await tableExists(conn, 'company_settings'))) return true;
      return await columnExists(conn, 'company_settings', 'tax_number');
    },
    async up(conn) {
      if (!(await columnExists(conn, 'company_settings', 'tax_number'))) {
        await runSQL(conn, "ALTER TABLE company_settings ADD COLUMN tax_number VARCHAR(50) NULL COMMENT '纳税识别号' AFTER email");
      }
    }
  },

  // ===== 013 · hs_codes 表 =====
  {
    id: '013',
    desc: '新建 HS 编码库表 hs_codes',
    async check(conn) {
      return await tableExists(conn, 'hs_codes');
    },
    async up(conn) {
      await runSQL(conn, `
        CREATE TABLE IF NOT EXISTS hs_codes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          hs_code VARCHAR(20) NOT NULL,
          product_name VARCHAR(255) NOT NULL,
          declaration_elements TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_hs_code (hs_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='HS编码库'
      `);
    }
  },

  // ===== 014 · bank_accounts 字段改 NULL =====
  {
    id: '014',
    desc: 'bank_accounts 字段改允许 NULL',
    async check(conn) {
      if (!(await tableExists(conn, 'bank_accounts'))) return true;
      const [cols] = await conn.query(
        "SELECT IS_NULLABLE FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='bank_accounts' AND column_name='bank_name'"
      );
      // bank_accounts 已简化为 route_type/routing_note 两列时，bank_name 列不存在 → 视为已完成
      return cols.length === 0 || cols[0].IS_NULLABLE === 'YES';
    },
    async up(conn) {
      try { await runSQL(conn, `ALTER TABLE bank_accounts MODIFY COLUMN bank_name VARCHAR(255) NULL`); } catch (e) {}
      try { await runSQL(conn, `ALTER TABLE bank_accounts MODIFY COLUMN account_number VARCHAR(100) NULL`); } catch (e) {}
      try { await runSQL(conn, `ALTER TABLE bank_accounts MODIFY COLUMN swift_code VARCHAR(100) NULL`); } catch (e) {}
    }
  },

  // ===== 015 · payment_terms_dict =====
  {
    id: '015',
    desc: '新建付款方式字典表 payment_terms_dict + 种子数据',
    async check(conn) {
      return await tableExists(conn, 'payment_terms_dict');
    },
    async up(conn) {
      await runSQL(conn, `
        CREATE TABLE IF NOT EXISTS payment_terms_dict (
          id INT AUTO_INCREMENT PRIMARY KEY,
          term_text VARCHAR(500) NOT NULL,
          is_default TINYINT(1) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='付款方式字典'
      `);
      const [existing] = await conn.query('SELECT COUNT(*) AS cnt FROM payment_terms_dict');
      if (existing[0].cnt === 0) {
        const [settings] = await conn.query('SELECT payment_terms_template FROM company_settings WHERE id=1');
        const template = settings.length > 0 && settings[0].payment_terms_template
          ? settings[0].payment_terms_template
          : '30% T/T Deposit, 70% Against B/L Copy';
        await runSQL(conn, 'INSERT INTO payment_terms_dict (term_text, is_default) VALUES (?, 1)', [template]);
      }
    }
  },

  // ===== 016 · company_settings.award_clause =====
  {
    id: '016',
    desc: 'company_settings 新增冲裁条款 award_clause',
    async check(conn) {
      if (!(await tableExists(conn, 'company_settings'))) return true;
      return await columnExists(conn, 'company_settings', 'award_clause');
    },
    async up(conn) {
      if (!(await columnExists(conn, 'company_settings', 'award_clause'))) {
        await runSQL(conn, `ALTER TABLE company_settings ADD COLUMN award_clause TEXT NULL DEFAULT NULL AFTER arbitration_clause`);
      }
    }
  },

  // ===== 017 · products.our_model =====
  {
    id: '017',
    desc: 'products 表新增我司型号 our_model',
    async check(conn) {
      if (!(await tableExists(conn, 'products'))) return true;
      return await columnExists(conn, 'products', 'our_model');
    },
    async up(conn) {
      if (!(await columnExists(conn, 'products', 'our_model'))) {
        await runSQL(conn, `ALTER TABLE products ADD COLUMN our_model VARCHAR(255) NULL DEFAULT NULL AFTER model`);
      }
    }
  },

  // ===== 018 · company_settings.seal_img =====
  {
    id: '018',
    desc: 'company_settings 新增电子签章 seal_img (MEDIUMTEXT)',
    async check(conn) {
      if (!(await tableExists(conn, 'company_settings'))) return true;
      return await columnExists(conn, 'company_settings', 'seal_img');
    },
    async up(conn) {
      if (!(await columnExists(conn, 'company_settings', 'seal_img'))) {
        await runSQL(conn, `ALTER TABLE company_settings ADD COLUMN seal_img MEDIUMTEXT NULL DEFAULT NULL AFTER award_clause`);
      }
    }
  },

  // ===== 019 · 图片字段全面升级 MEDIUMTEXT =====
  {
    id: '019',
    desc: '升级图片字段为 MEDIUMTEXT（products/quotation_items/order_items/sample_items 的 img_url）',
    async check(conn) {
      if (!(await tableExists(conn, 'products'))) return true;
      const [cols] = await conn.query(
        "SELECT DATA_TYPE FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='products' AND column_name='img_url'"
      );
      return cols.length > 0 && cols[0].DATA_TYPE === 'mediumtext';
    },
    async up(conn) {
      const tables = ['products', 'quotation_items', 'order_items', 'sample_items'];
      for (const t of tables) {
        if (await tableExists(conn, t)) {
          try {
            await runSQL(conn, `ALTER TABLE ${t} MODIFY COLUMN img_url MEDIUMTEXT NULL COMMENT '产品图片(base64)'`);
            console.log(`    ✓ ${t}.img_url → MEDIUMTEXT`);
          } catch (e) { /* 列不存在，忽略 */ }
        }
      }
    }
  },

  // ===== 020 · company_settings.seal_img 确保 MEDIUMTEXT =====
  {
    id: '020',
    desc: '确保 company_settings.seal_img 为 MEDIUMTEXT',
    async check(conn) {
      if (!(await tableExists(conn, 'company_settings'))) return true;
      const [cols] = await conn.query(
        "SELECT DATA_TYPE FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='company_settings' AND column_name='seal_img'"
      );
      return cols.length > 0 && cols[0].DATA_TYPE === 'mediumtext';
    },
    async up(conn) {
      try {
        await runSQL(conn, `ALTER TABLE company_settings MODIFY COLUMN seal_img MEDIUMTEXT NULL DEFAULT NULL COMMENT '电子签章(base64)'`);
      } catch (e) { /* 忽略 */ }
    }
  },

  // ===== 021 · orders.alipay_qrcode 支付宝收款二维码 =====
  {
    id: '021',
    desc: 'orders 新增支付宝收款二维码 alipay_qrcode (MEDIUMTEXT)',
    async check(conn) {
      if (!(await tableExists(conn, 'orders'))) return true;
      return await columnExists(conn, 'orders', 'alipay_qrcode');
    },
    async up(conn) {
      if (!(await columnExists(conn, 'orders', 'alipay_qrcode'))) {
        await runSQL(conn, `ALTER TABLE orders ADD COLUMN alipay_qrcode MEDIUMTEXT NULL DEFAULT NULL COMMENT '支付宝收款二维码(base64)' AFTER bank_account_id`);
      }
    }
  },

  // ===== 022 · orders.show_hs_code PI显示HS编码开关 =====
  {
    id: '022',
    desc: 'orders 新增 PI 显示HS编码开关 show_hs_code (TINYINT)',
    async check(conn) {
      if (!(await tableExists(conn, 'orders'))) return true;
      return await columnExists(conn, 'orders', 'show_hs_code');
    },
    async up(conn) {
      if (!(await columnExists(conn, 'orders', 'show_hs_code'))) {
        await runSQL(conn, `ALTER TABLE orders ADD COLUMN show_hs_code TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'PI是否显示HS编码行 0=隐藏 1=显示' AFTER show_stamp`);
      }
    }
  },

  // ===== 023 · 产品数据库扩展字段 =====
  {
    id: '023',
    desc: 'products 新增 spec_cn(中文规格描述) / remark(备注) / unit_weight_kg(单个重量) / delivery_period(交货期)',
    async check(conn) {
      if (!(await tableExists(conn, 'products'))) return true;
      return await columnExists(conn, 'products', 'spec_cn');
    },
    async up(conn) {
      const cols = [
        ['spec_cn', "ALTER TABLE products ADD COLUMN spec_cn TEXT NULL DEFAULT NULL COMMENT '中文规格描述' AFTER spec"],
        ['remark', "ALTER TABLE products ADD COLUMN remark TEXT NULL DEFAULT NULL COMMENT '备注' AFTER spec_cn"],
        ['unit_weight_kg', "ALTER TABLE products ADD COLUMN unit_weight_kg DECIMAL(10,3) NULL DEFAULT NULL COMMENT '单个重量(kg)' AFTER gross_weight_kg"],
        ['delivery_period', "ALTER TABLE products ADD COLUMN delivery_period VARCHAR(100) NULL DEFAULT NULL COMMENT '交货期' AFTER remark"]
      ];
      for (const [col, sql] of cols) {
        if (!(await columnExists(conn, 'products', col))) {
          await runSQL(conn, sql);
        }
      }
    }
  },

  // ===== 024 · 操作跟踪：operation_logs 表 + 四张业务表加负责人 =====
  {
    id: '024',
    desc: '新建 operation_logs 操作日志表；rfqs/quotations/samples_tracking/orders 新增 owner_name 负责人字段',
    async check(conn) {
      const hasLogTable = await tableExists(conn, 'operation_logs');
      const ownerChecks = [];
      for (const t of ['rfqs', 'quotations', 'samples_tracking', 'orders']) {
        if (await tableExists(conn, t)) {
          ownerChecks.push(await columnExists(conn, t, 'owner_name'));
        }
      }
      return hasLogTable && ownerChecks.length === 4 && ownerChecks.every(Boolean);
    },
    async up(conn) {
      if (!(await tableExists(conn, 'operation_logs'))) {
        await runSQL(conn, `
          CREATE TABLE operation_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            operator_id INT NULL COMMENT '操作员ID',
            operator_name VARCHAR(100) NOT NULL COMMENT '操作员账号',
            operator_display VARCHAR(100) NULL COMMENT '操作员显示名',
            module VARCHAR(50) NOT NULL COMMENT '模块: rfq/quotation/sample/order',
            action VARCHAR(20) NOT NULL COMMENT '动作: 新增/修改',
            target_no VARCHAR(100) NULL COMMENT '业务编号(询盘号/报价单号/样品单号/PI号)',
            target_id INT NULL COMMENT '业务记录主键ID',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_module (module),
            KEY idx_operator (operator_id),
            KEY idx_created_at (created_at)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志'
        `);
      }
      const ownerTargets = [
        ['rfqs', "ALTER TABLE rfqs ADD COLUMN owner_name VARCHAR(100) NULL DEFAULT NULL COMMENT '负责人(创建人)'"],
        ['quotations', "ALTER TABLE quotations ADD COLUMN owner_name VARCHAR(100) NULL DEFAULT NULL COMMENT '负责人(创建人)'"],
        ['samples_tracking', "ALTER TABLE samples_tracking ADD COLUMN owner_name VARCHAR(100) NULL DEFAULT NULL COMMENT '负责人(创建人)'"],
        ['orders', "ALTER TABLE orders ADD COLUMN owner_name VARCHAR(100) NULL DEFAULT NULL COMMENT '负责人(创建人)'"]
      ];
      for (const [t, sql] of ownerTargets) {
        if (await tableExists(conn, t) && !(await columnExists(conn, t, 'owner_name'))) {
          await runSQL(conn, sql);
        }
      }
    }
  },

  // ===== 025 · 业务员数据隔离：五张业务表加 owner_id + clients 补 owner_name =====
  {
    id: '025',
    desc: 'rfqs/quotations/samples_tracking/orders/clients 新增 owner_id（业务员数据归属过滤）+ clients 补 owner_name',
    async check(conn) {
      const targets = ['rfqs', 'quotations', 'samples_tracking', 'orders', 'clients'];
      const results = [];
      for (const t of targets) {
        if (await tableExists(conn, t)) {
          results.push(await columnExists(conn, t, 'owner_id'));
        }
      }
      // clients 需同时具备 owner_id 与 owner_name
      if (results.length === 5 && results.every(Boolean) && (await tableExists(conn, 'clients'))) {
        results.push(await columnExists(conn, 'clients', 'owner_name'));
      }
      return results.length === 6 && results.every(Boolean);
    },
    async up(conn) {
      const targets = [
        ['rfqs', "ALTER TABLE rfqs ADD COLUMN owner_id INT NULL DEFAULT NULL COMMENT '创建操作员ID'"],
        ['quotations', "ALTER TABLE quotations ADD COLUMN owner_id INT NULL DEFAULT NULL COMMENT '创建操作员ID'"],
        ['samples_tracking', "ALTER TABLE samples_tracking ADD COLUMN owner_id INT NULL DEFAULT NULL COMMENT '创建操作员ID'"],
        ['orders', "ALTER TABLE orders ADD COLUMN owner_id INT NULL DEFAULT NULL COMMENT '创建操作员ID'"],
        ['clients', "ALTER TABLE clients ADD COLUMN owner_id INT NULL DEFAULT NULL COMMENT '创建操作员ID'"]
      ];
      for (const [t, sql] of targets) {
        if (await tableExists(conn, t) && !(await columnExists(conn, t, 'owner_id'))) {
          await runSQL(conn, sql);
        }
      }
      if (await tableExists(conn, 'clients') && !(await columnExists(conn, 'clients', 'owner_name'))) {
        await runSQL(conn, "ALTER TABLE clients ADD COLUMN owner_name VARCHAR(100) NULL DEFAULT NULL COMMENT '负责人(创建人)'");
      }
    }
  },

  // ===== 026 · 订单明细行存储人民币基准价（消除单价币种切换精度漂移） =====
  {
    id: '026',
    desc: 'order_items 新增 price_rmb（人民币基准单价，外销价快照）',
    async check(conn) {
      return (await tableExists(conn, 'order_items')) && (await columnExists(conn, 'order_items', 'price_rmb'));
    },
    async up(conn) {
      if (await tableExists(conn, 'order_items') && !(await columnExists(conn, 'order_items', 'price_rmb'))) {
        await runSQL(conn, "ALTER TABLE order_items ADD COLUMN price_rmb DECIMAL(12,2) NULL DEFAULT NULL COMMENT '人民币基准单价(外销价)'");
      }
    }
  },

  // ===== 027 · 样品单关联订单化字段（签约/交货/币种/收款/付款/包装/特殊要求/显示开关） =====
  {
    id: '027',
    desc: 'samples_tracking 新增 signing_date/delivery_date/trade_terms/currency/bank_account_id/alipay_qrcode/payment_terms/packing_desc/special_req/show_special_req/show_stamp/show_hs_code',
    async check(conn) {
      if (!(await tableExists(conn, 'samples_tracking'))) return false;
      const cols = ['signing_date', 'delivery_date', 'trade_terms', 'currency', 'bank_account_id', 'alipay_qrcode',
                    'payment_terms', 'packing_desc', 'special_req', 'show_special_req', 'show_stamp', 'show_hs_code'];
      for (const c of cols) {
        if (!(await columnExists(conn, 'samples_tracking', c))) return false;
      }
      return true;
    },
    async up(conn) {
      const colDefs = [
        ['signing_date', "ALTER TABLE samples_tracking ADD COLUMN signing_date DATE NULL DEFAULT NULL COMMENT '签约日期'"],
        ['delivery_date', "ALTER TABLE samples_tracking ADD COLUMN delivery_date DATE NULL DEFAULT NULL COMMENT '交货日期'"],
        ['trade_terms', "ALTER TABLE samples_tracking ADD COLUMN trade_terms VARCHAR(50) NULL DEFAULT NULL COMMENT '贸易条款'"],
        ['currency', "ALTER TABLE samples_tracking ADD COLUMN currency VARCHAR(10) NULL DEFAULT 'RMB' COMMENT '结算币种(RMB/USD)'"],
        ['bank_account_id', "ALTER TABLE samples_tracking ADD COLUMN bank_account_id INT NULL DEFAULT NULL COMMENT '收款银行账户ID'"],
        ['alipay_qrcode', "ALTER TABLE samples_tracking ADD COLUMN alipay_qrcode MEDIUMTEXT NULL DEFAULT NULL COMMENT '支付宝收款码(base64)'"],
        ['payment_terms', "ALTER TABLE samples_tracking ADD COLUMN payment_terms VARCHAR(200) NULL DEFAULT NULL COMMENT '付款方式'"],
        ['packing_desc', "ALTER TABLE samples_tracking ADD COLUMN packing_desc VARCHAR(500) NULL DEFAULT NULL COMMENT '包装说明'"],
        ['special_req', "ALTER TABLE samples_tracking ADD COLUMN special_req TEXT NULL COMMENT '特殊要求'"],
        ['show_special_req', "ALTER TABLE samples_tracking ADD COLUMN show_special_req TINYINT(1) NOT NULL DEFAULT 1 COMMENT '显示特殊要求'"],
        ['show_stamp', "ALTER TABLE samples_tracking ADD COLUMN show_stamp TINYINT(1) NOT NULL DEFAULT 1 COMMENT '显示电子签章'"],
        ['show_hs_code', "ALTER TABLE samples_tracking ADD COLUMN show_hs_code TINYINT(1) NOT NULL DEFAULT 0 COMMENT '显示HS编码'"]
      ];
      for (const [name, sql] of colDefs) {
        if (!(await columnExists(conn, 'samples_tracking', name))) await runSQL(conn, sql);
      }
    }
  },

  // ===== 028 · 样品明细行对齐订单明细（价格与包装计算字段） =====
  {
    id: '028',
    desc: 'sample_items 新增 price/price_rmb/cost_cny/subtotal_amount/nw_per_ctn/gw_per_ctn/cbm_per_ctn',
    async check(conn) {
      if (!(await tableExists(conn, 'sample_items'))) return false;
      const cols = ['price', 'price_rmb', 'cost_cny', 'subtotal_amount', 'nw_per_ctn', 'gw_per_ctn', 'cbm_per_ctn'];
      for (const c of cols) {
        if (!(await columnExists(conn, 'sample_items', c))) return false;
      }
      return true;
    },
    async up(conn) {
      const colDefs = [
        ['price', "ALTER TABLE sample_items ADD COLUMN price DECIMAL(12,2) NULL DEFAULT NULL COMMENT '外销单价(当前币种)'"],
        ['price_rmb', "ALTER TABLE sample_items ADD COLUMN price_rmb DECIMAL(12,2) NULL DEFAULT NULL COMMENT '人民币基准单价'"],
        ['cost_cny', "ALTER TABLE sample_items ADD COLUMN cost_cny DECIMAL(12,2) NULL DEFAULT NULL COMMENT '人民币采购成本'"],
        ['subtotal_amount', "ALTER TABLE sample_items ADD COLUMN subtotal_amount DECIMAL(12,2) NULL DEFAULT NULL COMMENT '小计金额'"],
        ['nw_per_ctn', "ALTER TABLE sample_items ADD COLUMN nw_per_ctn DECIMAL(10,2) NULL DEFAULT NULL COMMENT '单箱净重(kg)'"],
        ['gw_per_ctn', "ALTER TABLE sample_items ADD COLUMN gw_per_ctn DECIMAL(10,2) NULL DEFAULT NULL COMMENT '单箱毛重(kg)'"],
        ['cbm_per_ctn', "ALTER TABLE sample_items ADD COLUMN cbm_per_ctn DECIMAL(10,4) NULL DEFAULT NULL COMMENT '单箱体积(m³)'"]
      ];
      for (const [name, sql] of colDefs) {
        if (!(await columnExists(conn, 'sample_items', name))) await runSQL(conn, sql);
      }
    }
  },

  // ===== 029 · 产品数据库价格扩精度：DECIMAL(10,2) → DECIMAL(12,6) =====
  {
    id: '029',
    desc: 'products.purchase_cost_rmb / export_price_usd 扩为 DECIMAL(12,6) 支持多位小数',
    async check(conn) {
      // 检查 purchase_cost_rmb 是否已达到 DECIMAL(12,6)
      const [rows] = await conn.query(
        `SELECT column_name, numeric_precision, numeric_scale
         FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'products'
           AND column_name IN ('purchase_cost_rmb', 'export_price_usd')`
      );
      if (rows.length < 2) return false;
      // 两个列都要 scale >= 6 才算已迁移
      return rows.every(r => Number(r.numeric_scale) >= 6);
    },
    async up(conn) {
      await runSQL(conn,
        `ALTER TABLE products
         MODIFY COLUMN purchase_cost_rmb DECIMAL(12,6) NOT NULL COMMENT '采购价(人民币)',
         MODIFY COLUMN export_price_usd   DECIMAL(12,6) NULL     DEFAULT 0 COMMENT '外销价(人民币)'`);
    }
  },

  // ===== 030 · 产品价格精度精细化：采购价 4 位 / 外销价 2 位 =====
  {
    id: '030',
    desc: 'products.purchase_cost_rmb 扩为 DECIMAL(12,4)；export_price_usd 回落为 DECIMAL(12,2)',
    async check(conn) {
      const [rows] = await conn.query(
        `SELECT column_name, numeric_scale
         FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'products'
           AND column_name IN ('purchase_cost_rmb', 'export_price_usd')`
      );
      if (rows.length < 2) return false;
      const map = {};
      rows.forEach(r => { map[r.column_name] = Number(r.numeric_scale); });
      // 采购价 scale=4 且 外销价 scale=2 才算已迁移
      return map.purchase_cost_rmb === 4 && map.export_price_usd === 2;
    },
    async up(conn) {
      await runSQL(conn,
        `ALTER TABLE products
         MODIFY COLUMN purchase_cost_rmb DECIMAL(12,4) NOT NULL COMMENT '采购价(人民币)',
         MODIFY COLUMN export_price_usd   DECIMAL(12,2) NULL     DEFAULT 0.00 COMMENT '外销价(人民币)'`);
    }
  },

  // ===== 031 · 产品多图表 product_photos =====
  {
    id: '031',
    desc: '新建 product_photos 表，支持每个产品上传多张额外图片',
    async check(conn) {
      return await tableExists(conn, 'product_photos');
    },
    async up(conn) {
      await runSQL(conn, `
        CREATE TABLE IF NOT EXISTS product_photos (
          id INT AUTO_INCREMENT PRIMARY KEY,
          product_id INT NOT NULL COMMENT '关联产品ID',
          photo_url MEDIUMTEXT NOT NULL COMMENT '图片(base64)',
          caption VARCHAR(100) NULL DEFAULT NULL COMMENT '图片说明(选填)',
          sort_order INT NOT NULL DEFAULT 0 COMMENT '排序（同产品内）',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_product (product_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品多图'
      `);
    }
  },

  // ===== 032 · samples_tracking 新增 remarks 备注字段 =====
  {
    id: '032',
    desc: 'samples_tracking 表新增 remarks TEXT 字段（多行内部备注，不进 PI）',
    async check(conn) {
      return await columnExists(conn, 'samples_tracking', 'remarks');
    },
    async up(conn) {
      await runSQL(conn, `ALTER TABLE samples_tracking ADD COLUMN remarks TEXT NULL COMMENT '内部备注（多行）' AFTER special_req`);
    }
  },
  // ===== 033 · samples_tracking 新增购销合同/生产任务单字段 =====
  {
    id: '033',
    desc: 'samples_tracking 表新增 purchase_contract / production_order 字段（MEDIUMTEXT，JSON 存储，支持样品单生成购销合同与生产任务单）',
    async check(conn) {
      const ok1 = await columnExists(conn, 'samples_tracking', 'purchase_contract');
      const ok2 = await columnExists(conn, 'samples_tracking', 'production_order');
      return ok1 && ok2;
    },
    async up(conn) {
      await runSQL(conn, `ALTER TABLE samples_tracking
        ADD COLUMN purchase_contract MEDIUMTEXT NULL COMMENT '购销合同数据(JSON)' AFTER remarks,
        ADD COLUMN production_order  MEDIUMTEXT NULL COMMENT '生产任务单数据(JSON)' AFTER purchase_contract`);
    }
  },
  // ===== 034 · samples_tracking 新增 supplier_id（供应商下拉关联）=====
  {
    id: '034',
    desc: 'samples_tracking 新增 supplier_id 供应商字段（生产任务单供应商下拉关联）',
    async check(conn) {
      return await columnExists(conn, 'samples_tracking', 'supplier_id');
    },
    async up(conn) {
      await runSQL(conn, `ALTER TABLE samples_tracking
        ADD COLUMN supplier_id INT NULL DEFAULT NULL COMMENT '供应商ID' AFTER client_id`);
    }
  }
];

// ========== 主流程 ==========
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  console.log('========================================');
  console.log('  BridgePort OS · 数据库迁移脚本');
  console.log(`  模式: ${dryRun ? '预览模式（不执行）' : force ? '强制模式' : '正常模式'}`);
  console.log(`  数据库: ${process.env.DB_NAME || 'trade_system'}@${process.env.DB_HOST || 'localhost'}`);
  console.log('========================================\n');

  const conn = await pool.getConnection();

  try {
    await runSQL(conn, `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(10) PRIMARY KEY,
        description VARCHAR(255),
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const [executed] = await conn.query('SELECT id FROM schema_migrations');
    const executedIds = new Set(executed.map(r => r.id));

    let executedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const m of migrations) {
      if (!force && executedIds.has(m.id)) {
        console.log(`⏭  [${m.id}] 已执行过，跳过 — ${m.desc}`);
        skippedCount++;
        continue;
      }

      let alreadyDone = false;
      try {
        alreadyDone = await m.check(conn);
      } catch (e) {
        console.log(`⚠️  [${m.id}] 检查时出错: ${e.message}（将尝试执行）`);
      }

      if (alreadyDone && !force) {
        console.log(`⏭  [${m.id}] 数据库结构已满足（无执行记录，补充标记）— ${m.desc}`);
        if (!dryRun) {
          await runSQL(conn, 'INSERT IGNORE INTO schema_migrations (id, description) VALUES (?, ?)', [m.id, m.desc]);
        }
        skippedCount++;
        continue;
      }

      if (dryRun) {
        console.log(`📋 [${m.id}] 将执行 — ${m.desc}`);
        executedCount++;
        continue;
      }

      try {
        console.log(`▶  [${m.id}] 执行中 — ${m.desc}`);
        await m.up(conn);
        await runSQL(conn, 'INSERT IGNORE INTO schema_migrations (id, description) VALUES (?, ?)', [m.id, m.desc]);
        console.log(`   ✓ 完成`);
        executedCount++;
      } catch (e) {
        console.log(`   ✗ 失败: ${e.message}`);
        errorCount++;
      }
    }

    console.log('\n========================================');
    console.log(`  跳过: ${skippedCount}  |  执行: ${executedCount}  |  失败: ${errorCount}`);
    if (dryRun) console.log('  （预览模式，未实际执行）');
    console.log('========================================');

    if (errorCount > 0) process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('\n❌ 迁移脚本异常退出:', err);
  process.exit(1);
});
