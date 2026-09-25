<template>
  <el-card shadow="never" class="page-card">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title">采购管理 - 采购订货单 (POD)</h2>
    </div>

    <!-- 列表 -->
    <el-table v-loading="loading" :data="list" stripe>
      <el-table-column label="采购订货单编号" width="180">
        <template #default="{ row }">
          <strong>{{ poNumber(row) }}</strong>
        </template>
      </el-table-column>
      <el-table-column label="关联数据" width="170">
        <template #default="{ row }">
          <strong style="color: #2563eb;">{{ row.ref_number || '—' }}</strong>
          <div v-if="row.ref_type === 'sample'" class="ref-type-tag">样品单</div>
        </template>
      </el-table-column>
      <el-table-column label="客户名称" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.client_name || '—' }}
        </template>
      </el-table-column>
      <el-table-column label="供应商" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <strong>{{ supplierName(row) || '—' }}</strong>
        </template>
      </el-table-column>
      <el-table-column label="排产数量 / 品类" width="170" align="right">
        <template #default="{ row }">
          <strong>{{ row.total_qty || 0 }}</strong> PCS
          <span class="sub-text">/ {{ row.product_kind_count || 0 }} 品类</span>
        </template>
      </el-table-column>
      <el-table-column label="交货期" width="130">
        <template #default="{ row }">
          {{ row.delivery_date || '尽快' }}
        </template>
      </el-table-column>
      <el-table-column label="订货单预览与导出" width="190" align="center">
        <template #default="{ row }">
          <el-button type="warning" size="small" @click="openPreview(row)">📋 预览采购订货单</el-button>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" align="center" fixed="right">
        <template #default="{ row }">
          <el-button v-if="canMaintain" link type="primary" @click="openEdit(row)">编辑</el-button>
        </template>
      </el-table-column>
      <template #empty>暂无订单数据，请先在外销订单中创建订单</template>
    </el-table>

    <!-- ========== 预览弹窗 ========== -->
    <el-dialog
      v-model="previewVisible" :close-on-click-modal="false"
      :title="`采购订货单 - ${currentOrder?.ref_number || currentOrder?.pi_number || ''}`"
      width="1100px"
      destroy-on-close
      top="3vh"
      class="doc-dialog"
    >
      <div class="doc-toolbar no-print">
        <el-button type="success" :icon="Download" :loading="downloading" @click="onExportExcel">下载 Excel (.xlsx 模板版)</el-button>
        <el-button type="warning" :icon="Printer" @click="onPrint">打印 / 另存为 PDF</el-button>
      </div>

      <div class="doc-page" v-html="previewHtml"></div>

      <template #footer>
        <el-button @click="previewVisible = false">关 闭</el-button>
      </template>
    </el-dialog>

    <!-- ========== 编辑弹窗（4 分区：基础参数 / 核心电气配置 / 其他要求 / 明细行扩展） ========== -->
    <el-dialog
      v-model="editVisible" :close-on-click-modal="false"
      title="编辑采购订货单"
      width="1080px"
      destroy-on-close
      top="3vh"
    >
      <el-form ref="editFormRef" :model="editForm" label-position="top">
        <!-- 分区 1：基础参数 -->
        <el-divider content-position="left">一、基础参数（可关联订单自动填充）</el-divider>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="采购订货单编号 *" required>
              <el-input v-model="editForm.po_number" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="供应商 *" required>
              <el-select v-model="editForm.supplier_id" filterable clearable placeholder="选择供应商" style="width: 100%">
                <el-option v-for="s in supplierOptions" :key="s.id" :label="s.name" :value="s.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="交货日期 *" required>
              <el-date-picker
                v-model="editForm.delivery_date"
                type="date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 分区 2：核心电气配置 -->
        <el-divider content-position="left">二、核心电气、传感器与部件配置</el-divider>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="主板型号">
              <el-input v-model="editForm.board_model" placeholder="如：埃及主板" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="充电模式（含 PTC 设计）">
              <el-select v-model="editForm.charge_mode" filterable allow-create default-first-option clearable placeholder="选择或输入充电模式" style="width: 100%">
                <el-option v-for="o in CHARGE_MODE_OPTIONS" :key="o" :label="o" :value="o" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="工作电压">
              <el-select v-model="editForm.work_voltage" filterable allow-create default-first-option clearable placeholder="选择或输入工作电压" style="width: 100%">
                <el-option v-for="o in VOLTAGE_OPTIONS" :key="o" :label="o" :value="o" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="电池规格">
              <el-select v-model="editForm.battery_spec" filterable allow-create default-first-option clearable placeholder="选择或输入电池规格" style="width: 100%">
                <el-option v-for="o in BATTERY_OPTIONS" :key="o" :label="o" :value="o" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="PTC保护">
              <el-select v-model="editForm.ptc_protection" filterable allow-create default-first-option clearable placeholder="选择或输入 PTC 保护" style="width: 100%">
                <el-option v-for="o in PTC_OPTIONS" :key="o" :label="o" :value="o" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 分区 3：其他要求 -->
        <el-divider content-position="left">三、其他要求（面贴 / 铭牌 / 电源线 / 包装 / LOGO / 装配工艺）</el-divider>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="面贴要求">
              <el-input v-model="editForm.face_sticker_req" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="铭牌/铅封/说明书">
              <el-input v-model="editForm.nameplate_seal_req" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="电源线及插头型号">
              <el-input v-model="editForm.power_cord_spec" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="包装说明">
              <el-input v-model="editForm.packing_desc" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户商标(LOGO)要求">
              <el-input v-model="editForm.client_logo_req" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="装配生产工艺要求">
              <el-input v-model="editForm.tech_req" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="包装唛头要求">
              <el-input v-model="editForm.mark_req" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 分区 4：明细行扩展字段 -->
        <el-divider content-position="left">四、产品明细扩展字段（外壳颜色 / 显示屏规格 / 传感器 / 支架 / 秤盘规格 / 备注）</el-divider>
        <el-table :data="editingItems" border size="small" style="width: 100%">
          <el-table-column label="序号" width="50" align="center" type="index" />
          <el-table-column label="产品型号（供应商）" width="140">
            <template #default="{ row }">
              <strong>{{ row.supplier_model || row.model || '—' }}</strong>
              <div v-if="row.supplier_model && row.model" style="font-size:10px; color:#94a3b8; margin-top:2px;">自编号: {{ row.model }}</div>
            </template>
          </el-table-column>
          <el-table-column label="数量" width="80" align="right" prop="qty" />
          <el-table-column label="外壳颜色" width="100">
            <template #default="{ row }">
              <el-input v-model="row.shell_color" size="small" placeholder="如:曜石黑" />
            </template>
          </el-table-column>
          <el-table-column label="显示屏规格" width="120">
            <template #default="{ row }">
              <el-input v-model="row.screen_spec" size="small" placeholder="如:双显LCD" />
            </template>
          </el-table-column>
          <el-table-column label="传感器" width="120">
            <template #default="{ row }">
              <el-input v-model="row.sensor" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="支架" width="100">
            <template #default="{ row }">
              <el-input v-model="row.bracket" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="秤盘规格" width="110">
            <template #default="{ row }">
              <el-input v-model="row.pan_spec" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="备注 / 特殊要求" min-width="160">
            <template #default="{ row }">
              <el-input v-model="row.remark" size="small" />
            </template>
          </el-table-column>
        </el-table>

        <!-- 分区 5：质量要求与补充说明（6 项可编辑） -->
        <el-divider content-position="left">五、质量要求与补充说明</el-divider>
        <div v-for="(item, idx) in editQualityNotes" :key="idx" class="quality-note-row">
          <el-input
            v-model="item.title"
            size="small"
            style="width: 220px; flex-shrink: 0;"
            :placeholder="`标题 ${idx + 1}`"
          />
          <el-input
            v-model="item.content"
            type="textarea"
            :rows="2"
            style="flex: 1;"
            :placeholder="`第 ${idx + 1} 项内容`"
          />
        </div>
      </el-form>

      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="warning" :loading="saving" @click="onSave">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Printer, Download } from '@element-plus/icons-vue'
import { listOrders, getOrder, updateOrder } from '@/api/orders'
import { listSamples, getSample, updateSample } from '@/api/samples'
import { listSuppliers } from '@/api/suppliers'
import { listProducts } from '@/api/products'
import { getCompanySettings } from '@/api/companySettings'
import { formatMoney, getOrderTotals, printDocument } from '@/utils/docUtils'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
// 任务单维护权限：跟单(5)可编辑，业务员(3)只读
const canMaintain = userStore.permissionLevel <= 5
const downloading = ref(false)

// 4 个下拉选项常量（来自上传的 Excel 模板数据验证）
const VOLTAGE_OPTIONS = [
  '交流 220伏 (50/60赫兹)',
  '交流 110伏 (60赫兹)',
  '宽电压 交流 100-240伏',
  '直流 6伏 (适配器供电)',
  '直流 5伏 (Type-C充电)',
  '交流 127伏 (60赫兹)'
]
const CHARGE_MODE_OPTIONS = [
  '内置变压器 + 宽电压设计',
  '外置专用电源适配器充电',
  'Type-C 智能快充方案',
  '干电池供电 (5号/7号)'
]
const BATTERY_OPTIONS = [
  '4伏 / 4.0安时 蓄电池',
  '6伏 / 4.0安时 蓄电池',
  '3.7伏 锂电池系统',
  '7.4伏 动力锂电池组',
  '不配电池 (客户自配)'
]
const PTC_OPTIONS = [
  '是 (必须带PTC保护板)',
  '否 (不带PTC保护)'
]

// 默认文本（从模板示例值带出，用户可改）
const POWER_CORD_DEFAULT = '国标两扁插 / 欧规两圆插，全长 1.5 米，纯铜线芯 2×0.75平方毫米，耐压 250伏，带3C/安全认证标识'
const PACKING_DEFAULT = '五层加厚定制彩盒 + 珍珠棉内衬 (5台/箱)，印刷客户指定LOGO与箱唛'
const LOGO_REQ_DEFAULT = '按客户指定LOGO丝印(外壳/面贴/包装箱)'

// 第四部分 6 条质量规范固定文本（来自 Excel 模板 A31-A36）
// 质量要求默认值（未保存时用于初始化）
function defaultQualityNotes() {
  return [
    { title: '1. 客户商标规范：', content: '面贴、外壳铭牌及彩盒/外箱所印客户LOGO必须严格按照确认矢量图档执行，确保字迹清晰、色号准确、无重影毛刺；' },
    { title: '2. 电压与电气规范：', content: '工作电压、充电模式、电池规格、PTC保护等核心电气参数必须严格按本订单货单第二区块配置执行，出厂前每台需进行 100% 满负荷老化与连续通电测试 ≥ 24 小时；' },
    { title: '3. 结构与密封要求：', content: '整机结构密封严格，主板做加厚防潮三防漆喷涂，按键手感灵敏，传感器经四角偏差及线性度校准；' },
    { title: '4. 电池安全规范：', content: '必须使用带PTC保护板电池，出厂前每台需进行 100% 满负荷老化与连续通电测试 ≥ 24 小时；' },
    { title: '5. 随箱配件清单：', content: '每台包含主秤 1 台、不锈钢秤盘 1 块、标配电源线 1 条、中文说明书 1 份、合格证/保修卡 1 份、高透防尘罩 1 个；' },
    { title: '6. 包装与唛头标识：', content: '外箱清晰印制客户LOGO、产品型号、额定电压、净重/毛重、箱规尺寸及生产批次号，严禁混装。' }
  ]
}

const loading = ref(false)
const saving = ref(false)
const list = ref([])
const supplierOptions = ref([])
const companySettings = ref({})

// 预览
const previewVisible = ref(false)
const previewHtml = ref('')
const currentOrder = ref(null)

// 编辑
const editVisible = ref(false)
const editFormRef = ref()
const editForm = ref({})
const editingOrderId = ref(null)
const editingRefType = ref('order')
const editingItems = ref([])
const editQualityNotes = ref(defaultQualityNotes())

/* ========== 工具：JSON 字段兼容解析（对象/字符串/null） ========== */
function parseDoc(val) {
  if (!val) return {}
  if (typeof val === 'string') {
    try { return JSON.parse(val) || {} } catch { return {} }
  }
  return val
}

/* ========== 列表派生字段 ========== */
function poNumber(row) {
  const po = parseDoc(row.production_order)
  const refNo = row.ref_number || row.pi_number || row.sample_number || ''
  return po.po_number || po.po_no || (refNo ? refNo + '-POD' : '—')
}
function supplierName(row) {
  if (row.supplier_name) return row.supplier_name
  const s = supplierOptions.value.find(x => x.id === row.supplier_id)
  return s ? s.name : ''
}

/* ========== 数据加载（合并外销订单 + 样品单） ========== */
async function loadList() {
  loading.value = true
  try {
    // 1. 外销订单：客户自行报关 + 我司代办报关（都生成生产任务单）
    const d = await listOrders({ page: 1, pageSize: 500 })
    const orderList = (d.list || [])
      .filter((o) => o.customs_responsibility !== '请选择')
      .map((o) => ({ ...o, ref_type: 'order', ref_number: o.pi_number }))
    // 2. 样品单：全部（默认按客户自行报关逻辑生成生产任务单）
    const ds = await listSamples({ page: 1, pageSize: 500 })
    const sampleList = (ds.list || []).map((s) => ({ ...s, ref_type: 'sample', ref_number: s.sample_number }))
    // 3. 合并：按创建时间倒序
    list.value = [...orderList, ...sampleList].sort((a, b) => {
      const ta = new Date(a.created_at || a.signing_date || 0).getTime()
      const tb = new Date(b.created_at || b.signing_date || 0).getTime()
      return tb - ta
    })
  } catch { /* 拦截器 */ }
  finally { loading.value = false }
}

async function loadOptions() {
  try {
    const [s, co] = await Promise.all([
      listSuppliers({ page: 1, pageSize: 500 }),
      getCompanySettings()
    ])
    supplierOptions.value = s.list
    companySettings.value = co || {}
  } catch { /* 拦截器 */ }
}

/* ========== 预览：生成采购订货单 HTML（复刻上传的 Excel 模板） ========== */
async function openPreview(row) {
  try {
    const detail = row.ref_type === 'sample'
      ? await getSample(row.id)
      : await getOrder(row.id)
    currentOrder.value = { ...detail, ref_number: row.ref_number, ref_type: row.ref_type }
    // 拉产品库建映射，取供应商型号（与编辑弹窗一致，映射失败时回退自编号）
    let productMap = {}
    try {
      const pd = await listProducts({ page: 1, pageSize: 500 })
      productMap = Object.fromEntries((pd.list || []).map(p => [p.id, p]))
    } catch { /* 回退自编号 */ }
    const company = companySettings.value || {}
    const supplier = supplierOptions.value.find(s => s.id === detail.supplier_id) || {}
    previewHtml.value = buildPurchaseOrderHtml(currentOrder.value, company, supplier, productMap)
    previewVisible.value = true
  } catch { /* 拦截器 */ }
}

function buildPurchaseOrderHtml(order, company, supplier, productMap = {}) {
  const po = parseDoc(order.production_order)
  const items = order.items || []
  const today = new Date()
  const orderDate = today.toISOString().slice(0, 10)
  const exts = po.item_extensions || []
  const totalQty = items.reduce((s, it) => s + (Number(it.qty) || 0), 0)

  // 通用样式
  const BORDER = '1px solid #0f172a'
  const HEAD_BG = 'background:#f1f5f9;'
  const cellStyle = `border:${BORDER}; padding:6px 8px; font-size:11px; vertical-align:middle;`
  const headStyle = `border:${BORDER}; padding:6px 8px; font-size:11px; font-weight:bold; text-align:center; ${HEAD_BG}`

  // ===== 一、产品明细清单 =====
  const detailRows = items.map((it, idx) => {
    const ext = exts[idx] || {}
    const prod = it.product_id ? productMap[it.product_id] : null
    const model = (prod && prod.our_model) || it.model || ''
    return `<tr>
      <td style="${cellStyle} text-align:center;">${idx + 1}</td>
      <td style="${cellStyle}"><strong>${model}</strong></td>
      <td style="${cellStyle} text-align:right;">${it.qty || 0}</td>
      <td style="${cellStyle}">${ext.shell_color || ''}</td>
      <td style="${cellStyle}">${ext.screen_spec || ''}</td>
      <td style="${cellStyle}">${ext.sensor || ''}</td>
      <td style="${cellStyle}">${ext.bracket || ''}</td>
      <td style="${cellStyle}">${ext.pan_spec || ''}</td>
      <td style="${cellStyle}">${ext.remark || ''}</td>
    </tr>`
  }).join('')

  // ===== 二、核心电气配置 =====
  const configGrid = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0; font-size:11px;">
      <div style="border:${BORDER}; border-right:none; padding:6px 10px; background:#f8fafc;"><strong>主板型号：</strong>${po.board_model || ''}</div>
      <div style="border:${BORDER}; padding:6px 10px; background:#f8fafc;"><strong>充电模式：</strong>${po.charge_mode || ''}</div>
      <div style="border:${BORDER}; border-right:none; border-top:none; padding:6px 10px; background:#f8fafc;"><strong>工作电压：</strong>${po.work_voltage || ''}</div>
      <div style="border:${BORDER}; border-top:none; padding:6px 10px; background:#f8fafc;"><strong>电池规格：</strong>${po.battery_spec || ''}</div>
      <div style="border:${BORDER}; border-right:none; border-top:none; padding:6px 10px; background:#f8fafc;"><strong>PTC保护：</strong>${po.ptc_protection || ''}</div>
      <div style="border:${BORDER}; border-top:none; padding:6px 10px; background:#f8fafc;"><strong>客户商标(LOGO)：</strong>${po.client_logo_req || ''}</div>
      <div style="border:${BORDER}; border-right:none; border-top:none; padding:6px 10px; background:#f8fafc;"><strong>面贴要求：</strong>${po.face_sticker_req || ''}</div>
      <div style="border:${BORDER}; border-top:none; padding:6px 10px; background:#f8fafc;"><strong>铭牌/铅封/说明书：</strong>${po.nameplate_seal_req || ''}</div>
    </div>
    <div style="border:${BORDER}; border-top:none; padding:6px 10px; font-size:11px; background:#f8fafc;"><strong>包装说明：</strong>${po.packing_desc || ''}</div>
    <div style="border:${BORDER}; border-top:none; padding:6px 10px; font-size:11px; background:#f8fafc;"><strong>装配生产工艺要求：</strong>${po.tech_req || ''}</div>
    <div style="border:${BORDER}; border-top:none; padding:6px 10px; font-size:11px; background:#f8fafc;"><strong>包装唛头要求：</strong>${po.mark_req || ''}</div>
  `

  // ===== 三、电源线规格 =====
  const cordSection = `
    <div style="border:${BORDER}; border-top:none; padding:6px 10px; font-size:11px; background:#f8fafc;"><strong>电源线及插头型号：</strong>${po.power_cord_spec || ''}</div>
    <div style="border:${BORDER}; border-top:none; padding:20px 10px; font-size:11px; color:#64748b; text-align:center; font-style:italic;">【 请在此处粘贴电源线 / 插头实物照片 】</div>
  `

  // ===== 四、质量要求（已保存则用保存值，否则用默认） =====
  const qualityNotes = Array.isArray(po.quality_notes) && po.quality_notes.length
    ? po.quality_notes
    : defaultQualityNotes()
  const qualityRows = qualityNotes.map(q => `
    <div style="border:${BORDER}; border-top:none; padding:6px 10px; font-size:11px;">
      <strong>${q.title}</strong>${q.content}
    </div>
  `).join('')

  return `
    <div style="text-align:center; font-size:18pt; font-weight:900; letter-spacing:8px; padding:14px 0; border-top:2px solid #0f172a; border-bottom:2px solid #0f172a; color:#0f172a;">采 购 订 货 单</div>

    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0; font-size:11px; border-bottom:${BORDER};">
      <div style="padding:8px 10px;"><strong>客户名称：</strong>${order.client_name || ''}</div>
      <div style="padding:8px 10px;"><strong>订单编号：</strong>${po.po_number || ((order.ref_number || order.pi_number || '') + '-POD')}</div>
      <div style="padding:8px 10px;"><strong>制 单 人：</strong>${userStore.displayName}</div>
      <div style="padding:8px 10px;"><strong>下单日期：</strong>${orderDate}</div>
      <div style="padding:8px 10px;"><strong>交货日期：</strong>${(order.delivery_date || '').slice(0, 10) || ''}</div>
      <div style="padding:8px 10px;"><strong>承接工厂：</strong>${supplier.name || order.supplier_name || ''}</div>
    </div>

    <div style="margin-top:10px; border:${BORDER};">
      <div style="${HEAD_BG} padding:6px 10px; font-weight:bold; font-size:11px; border-bottom:${BORDER};">一、 产品明细清单</div>
      <table style="border-collapse:collapse; width:100%; margin:0;">
        <thead><tr>
          <th style="${headStyle} width:40px;">序号</th>
          <th style="${headStyle} width:110px;">产品型号</th>
          <th style="${headStyle} width:70px;">数量(台)</th>
          <th style="${headStyle}">外壳颜色</th>
          <th style="${headStyle}">显示屏规格</th>
          <th style="${headStyle}">传感器</th>
          <th style="${headStyle}">支架</th>
          <th style="${headStyle}">秤盘规格</th>
          <th style="${headStyle}">备注/特殊要求</th>
        </tr></thead>
        <tbody>${detailRows || `<tr><td colspan="9" style="${cellStyle} text-align:center; color:#94a3b8;">暂无明细</td></tr>`}</tbody>
        <tfoot><tr>
          <td style="${cellStyle} text-align:right;" colspan="2"><strong>合计总数量：</strong></td>
          <td style="${cellStyle} text-align:right;"><strong>${totalQty}</strong></td>
          <td style="${cellStyle}" colspan="6"><em>总计台数请核对装箱数与整批出货体积</em></td>
        </tr></tfoot>
      </table>
    </div>

    <div style="margin-top:8px; border:${BORDER}; border-top:none;">
      <div style="${HEAD_BG} padding:6px 10px; font-weight:bold; font-size:11px; border-bottom:${BORDER};">二、 核心电气、传感器与部件配置</div>
      ${configGrid}
    </div>

    <div style="margin-top:8px; border:${BORDER}; border-top:none;">
      <div style="${HEAD_BG} padding:6px 10px; font-weight:bold; font-size:11px; border-bottom:${BORDER};">三、 电源线规格与实物图片 / 客户商标图样确认</div>
      ${cordSection}
    </div>

    <div style="margin-top:8px; border:${BORDER}; border-top:none;">
      <div style="${HEAD_BG} padding:6px 10px; font-weight:bold; font-size:11px; border-bottom:${BORDER};">四、 质量要求与补充说明</div>
      ${qualityRows}
    </div>
  `
}

function onPrint() {
  printDocument(previewHtml.value, '采购订货单 - ' + (currentOrder.value?.ref_number || currentOrder.value?.pi_number || ''))
}

// 下载 Excel：调用后端接口，基于上传的 .xlsx 模板填值，100% 保留模板样式
async function onExportExcel() {
  if (!currentOrder.value?.id) {
    ElMessage.warning('请先选择订单')
    return
  }
  downloading.value = true
  try {
    const token = localStorage.getItem('bp_token') || ''
    // 根据来源类型选择 API：样品单走 samples 接口，订单走 orders 接口
    const apiBase = currentOrder.value.ref_type === 'sample' ? 'samples' : 'orders'
    const res = await fetch(`/api/${apiBase}/${currentOrder.value.id}/purchase-order-xlsx`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      ElMessage.error('下载失败：' + (errText || res.status))
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `PurchaseOrder_${currentOrder.value.ref_number || currentOrder.value.pi_number || 'export'}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    ElMessage.success('采购订货单 .xlsx 已下载')
  } catch (e) {
    ElMessage.error('下载失败：' + (e.message || '网络异常'))
  } finally {
    downloading.value = false
  }
}

/* ========== 编辑（组装 production_order JSON 扩展结构） ========== */
async function openEdit(row) {
  try {
    const detail = row.ref_type === 'sample'
      ? await getSample(row.id)
      : await getOrder(row.id)
    editingOrderId.value = row.id
    editingRefType.value = row.ref_type
    const po = parseDoc(detail.production_order)
    const supplier = supplierOptions.value.find(s => s.id === detail.supplier_id)
    const refNo = row.ref_number || detail.pi_number || detail.sample_number || ''

    // 明细行扩展字段：按 index 与 item_extensions 对齐；产品型号优先用产品库的供应商型号(our_model)
    const exts = po.item_extensions || []
    // 拉产品库建映射，取供应商型号
    let productMap = {}
    try {
      const pd = await listProducts({ page: 1, pageSize: 500 })
      productMap = Object.fromEntries((pd.list || []).map(p => [p.id, p]))
    } catch { /* 产品映射失败时回退自编号 */ }
    editingItems.value = (detail.items || []).map((it, idx) => {
      const ext = exts[idx] || {}
      const prod = it.product_id ? productMap[it.product_id] : null
      return {
        idx,
        product_id: it.product_id,
        model: it.model,
        supplier_model: prod ? (prod.our_model || '') : '',
        qty: it.qty,
        shell_color: ext.shell_color || '',
        screen_spec: ext.screen_spec || '',
        sensor: ext.sensor || '',
        bracket: ext.bracket || '',
        pan_spec: ext.pan_spec || '',
        remark: ext.remark || ''
      }
    })

    editForm.value = {
      po_number: po.po_number || po.po_no || (refNo + '-POD'),
      supplier_id: detail.supplier_id || null,
      delivery_date: (detail.delivery_date || '').slice(0, 10),
      board_model: po.board_model || '',
      work_voltage: po.work_voltage || '',
      charge_mode: po.charge_mode || '',
      battery_spec: po.battery_spec || '',
      ptc_protection: po.ptc_protection || '',
      face_sticker_req: po.face_sticker_req || '',
      nameplate_seal_req: po.nameplate_seal_req || '',
      power_cord_spec: po.power_cord_spec || POWER_CORD_DEFAULT,
      packing_desc: po.packing_desc || detail.packing_desc || PACKING_DEFAULT,
      client_logo_req: po.client_logo_req || LOGO_REQ_DEFAULT,
      tech_req: po.tech_req || '',
      mark_req: po.mark_req || ''
    }
    // 质量要求与补充说明：已保存则加载，未保存则用默认值
    editQualityNotes.value = Array.isArray(po.quality_notes) && po.quality_notes.length
      ? po.quality_notes.map(q => ({ ...q }))
      : defaultQualityNotes()
    editVisible.value = true
  } catch { /* 拦截器 */ }
}

async function onSave() {
  if (!editForm.value.po_number) return ElMessage.warning('请填写采购订货单编号')
  if (!editForm.value.supplier_id) return ElMessage.warning('请选择供应商')
  if (!editForm.value.delivery_date) return ElMessage.warning('请选择交货日期')

  saving.value = true
  try {
    // 明细行扩展字段按 index 顺序组装
    const item_extensions = editingItems.value.map(it => ({
      shell_color: it.shell_color,
      screen_spec: it.screen_spec,
      sensor: it.sensor,
      bracket: it.bracket,
      pan_spec: it.pan_spec,
      remark: it.remark
    }))

    await (editingRefType.value === 'sample' ? updateSample : updateOrder)(editingOrderId.value, {
      supplier_id: editForm.value.supplier_id || null,
      production_order: {
        po_number: editForm.value.po_number,
        board_model: editForm.value.board_model,
        work_voltage: editForm.value.work_voltage,
        charge_mode: editForm.value.charge_mode,
        battery_spec: editForm.value.battery_spec,
        ptc_protection: editForm.value.ptc_protection,
        face_sticker_req: editForm.value.face_sticker_req,
        nameplate_seal_req: editForm.value.nameplate_seal_req,
        power_cord_spec: editForm.value.power_cord_spec,
        packing_desc: editForm.value.packing_desc,
        client_logo_req: editForm.value.client_logo_req,
        tech_req: editForm.value.tech_req,
        mark_req: editForm.value.mark_req,
        quality_notes: editQualityNotes.value.map(q => ({ title: q.title || '', content: q.content || '' })),
        item_extensions
      },
      delivery_date: editForm.value.delivery_date
    })
    ElMessage.success('采购订货单已保存，交货日期已同步至关联单据')
    editVisible.value = false
    loadList()
  } catch { /* 拦截器 */ }
  finally { saving.value = false }
}

onMounted(() => { loadList(); loadOptions() })
</script>

<style scoped>
.page-header { margin-bottom: 14px; }
.page-title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; }
.sub-text { font-size: 11px; color: #94a3b8; }
.ref-type-tag { display: inline-block; margin-top: 2px; padding: 1px 6px; font-size: 10px; color: #fff; background: #0ea5e9; border-radius: 4px; }
.quality-note-row { display: flex; gap: 10px; margin-bottom: 10px; align-items: flex-start; }

.doc-toolbar { display: flex; gap: 8px; margin-bottom: 10px; }
.doc-page { background: white; padding: 25px 30px; font-size: 11px; color: #0f172a; line-height: 1.5; border: 1px solid #cbd5e1; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.doc-page table { font-size: 11px; margin: 0; width: 100%; border-collapse: collapse; }
.doc-page th, .doc-page td { border: 1px solid #0f172a; padding: 6px 8px; }
.doc-page th { background: #f1f5f9; }

@media print {
  :deep(.no-print) { display: none !important; }
  :deep(.el-dialog__header), :deep(.el-dialog__footer) { display: none !important; }
}
</style>
