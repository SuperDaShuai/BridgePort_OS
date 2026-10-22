# AGENTS.md — BridgePort OS（麦顿OS）项目指南

供无历史记录的 AI agent 快速了解本项目。修改代码前请先阅读本文件。

## 项目简介

外贸全生命周期管理系统（麦顿OS，原 BridgePort OS）：覆盖询价 → 报价 → 外销订单/样品单 → 购销合同/生产任务单 → 订舱/报关/清关 → 财务台账的完整业务流。

## 技术栈

- **前端**：Vue 3 + Element Plus + Vite + vue-router + pinia + axios，目录 `frontend/`
- **后端**：Node.js + Express + mysql2（promise 连接池），目录 `backend/`
- **数据库**：MySQL `trade_system`，连接配置在 `backend/config/db.js`，凭据走 `.env`
- **Excel 生成**：ExcelJS 加载真实模板 `backend/templates/采购订货单_模板.xlsx` 填值（禁止 HTML 包 .xls）

## 目录结构

```
backend/
  app.js                  # 入口：cors / json(10MB) / urlencoded / 统一响应 / 路由挂载
  config/db.js            # mysql2 连接池
  migrate.js              # 迁移执行器（幂等，schema_migrations 记录，支持 --dry-run / --force）
  routes/                 # 业务路由（见下表）
  utils/documents.js      # 单据默认生成：购销合同/生产任务单（含按供应商拆分 sub_contracts/sub_orders）
  utils/helpers.js        # asyncHandler / parsePagination(默认20,上限200) / pickFields / Excel 图片嵌入等
  utils/operation-log.js  # 操作日志
  migrations/             # SQL 迁移（编号递增，只做非破坏性操作）
  templates/              # Excel 模板

frontend/src/
  api/                    # axios 封装（baseURL=/api，响应拦截器直接返回 data）
  layout/                 # 布局与侧边菜单（SideMenu.vue 控制菜单显隐权限）
  router/index.js         # 路由 + meta.permission_level 权限
  views/
    dashboard/ workbench/ analytics/   # 工作台与分析
    rfq/ quotations/                   # 询价单 / 报价单
    orders/ samples/                   # 外销订单 / 样品单
    purchase/contracts.vue             # 购销合同（树形：大合同 + 子合同）
    purchase/production-orders.vue     # 生产任务单/采购订货单（树形，编辑弹窗含产品配置动态字段）
    shipping/ customs/                 # 订舱委托书 / 报关要素 / 清关资料
    finance/ qc/ loadmaster/           # 财务台账 / 质检 / 装柜
    master/                            # 基础母库：客户/供应商/产品/HS编码/产品配置管理
    system/                            # 操作员 / 企业配置
```

## 后端路由一览（挂载于 /api）

| 文件 | 职责 |
|------|------|
| auth.routes.js | 登录（免鉴权） |
| operators.routes.js | 操作员/权限 |
| clients.routes.js / suppliers.routes.js | 客户 / 供应商 |
| products.routes.js / product-configs.routes.js / product-photos.routes.js | 产品库 / 产品配置管理（产品类型→动态字段定义） / 产品图片 |
| hs-codes.routes.js / bank-accounts.routes.js / payment-terms.routes.js / company-settings.routes.js | 基础字典与企业配置 |
| rfqs.routes.js / quotations.routes.js | 询价 / 报价 |
| orders.routes.js / samples.routes.js | 外销订单 / 样品单（含购销合同、生产任务单、Excel 下载） |
| operation-logs.routes.js | 操作日志 |

## 关键业务规则（务必遵守）

1. **统一响应格式**：`{ code: 200, data, msg }` / `{ code: 错误码, data, msg }`
2. **鉴权**：除 `GET /api/health` 和 `POST /api/auth/login` 外全部走 JWT
3. **编号规则**（全局递增，无横杠，带两位年份后缀）：
   - PI：`MT26001`（orders/quotations 生成，前缀 MT）
   - 样品单：`SMP26001`
   - 报价单：`QT26001`；订舱托书：`{PI}SHP`
   - 购销合同：`{PI}CG`，子合同 `{PI}CG1/-CG2`（按供应商拆分）
   - 生产任务单：`{PI}PO`；采购订货单：`{PI}POD`
   - 序号查询：`CAST(RIGHT(no, LENGTH(no)-prefixLen) AS UNSIGNED) DESC`
4. **按供应商拆分**：多供应商订单在 `purchase_contract`/`production_order` JSON 里存 `sub_contracts`/`sub_orders` 数组（字段为 **product_ids** 不是 item_ids），前端树形表格展示，按 `product_id`/`supplier_id` 过滤明细
5. **JSON 大字段**：`purchase_contract`/`production_order` 等存 MEDIUMTEXT；图片存压缩 base64 data URL
6. **产品配置管理**：`product_configs` 表定义产品类型及动态字段；生产任务单编辑弹窗「模块二」按选中类型动态渲染并分组显示；产品明细「详细规范」按产品 `product_type` 自动生成模板（`1. 主板:\n2. 显示器:`）；装箱量取产品库 `pcs_per_ctn`，显示为 `N件/箱`
7. **迁移**：新增表结构变更 → `backend/migrations/0XX_描述.sql` + 注册进 `migrate.js`，只做 ADD COLUMN / CREATE TABLE IF NOT EXISTS 等非破坏性操作
8. **权限**：业务员 permission_level=3 只能看自己 owner_id 的数据；菜单显隐在 SideMenu.vue 的 canSee 单独控制（与路由 meta 必须同步）
9. **前端弹窗**：所有 el-dialog 必须 `:close-on-click-modal="false"`
10. **分页**：后端 parsePagination 默认 20、上限 200；前端需要全量数据时分页循环拉取（见 production-orders.vue 的 fetchAllProductsMap）

## 常用命令

```bash
# 后端（Windows 下 node --watch 可能不监听路由文件，需手动重启）
cd backend && node --watch app.js

# 数据库迁移（新环境/结构变更后必须执行）
cd backend && node migrate.js

# 前端开发 / 构建
cd frontend && npm run dev / npm run build
```

## 经验教训（摘自历史踩坑）

- Express JSON body 默认 100KB 过小 → 已设 10MB（base64 图片场景）
- TEXT(64KB) 存不下 base64 → 一律 MEDIUMTEXT
- ExcelJS 无 insertColumn；insertRow 不移动 _merges，照片区需按占位文字动态定位并先 unmerge 再 merge
- 创建订单时 items 还没入库没有 id → 子合同关联必须用 product_id
- el-select + allow-create 体验差（需回车确认）→ 自由输入用 el-autocomplete
- 前端 axios 实例 baseURL 已是 /api，请求路径不要再带 /api 前缀
