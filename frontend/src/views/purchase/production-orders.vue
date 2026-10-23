<template>
  <el-card shadow="never" class="page-card">
    <!-- 页面标题 + 来源筛选 -->
    <div class="page-header" style="display: flex; align-items: center; gap: 16px;">
      <h2 class="page-title">采购管理 - 采购订货单 (POD)</h2>
      <el-radio-group v-model="filterType" size="small">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="order">外销订单</el-radio-button>
        <el-radio-button value="sample">样品单</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 列表（树形：多供应商订单可展开子任务单；不再显示采购订货单编号列；默认不展开） -->
    <el-table v-loading="loading" :data="filteredList" stripe
      row-key="rowKey" :tree-props="{ children: 'children' }">
      <el-table-column label="采购合同编号" width="190">
        <template #default="{ row }">
          <strong style="color: #2563eb;">{{ (row.is_sub && row.sub_order) ? (row.sub_order.po_number || row.sub_order.sub_contract_no) : poNumber(row) }}</strong>
        </template>
      </el-table-column>
      <el-table-column label="客户名称" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          {{ clientNameWithCountry(row) }}
        </template>
      </el-table-column>
      <el-table-column label="供应商" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <template v-if="!(row.is_parent && row.children?.length > 0)">
            <strong>{{ supplierName(row) || '—' }}</strong>
          </template>
        </template>
      </el-table-column>
      <el-table-column label="排产数量 / 品类" width="170" align="right">
        <template #default="{ row }">
          <template v-if="!(row.is_parent && row.children?.length > 0)">
            <strong>{{ row.total_qty || 0 }}</strong> PCS
            <span class="sub-text">/ {{ row.product_kind_count || 0 }} 品类</span>
          </template>
        </template>
      </el-table-column>
      <el-table-column label="交货期" width="130">
        <template #default="{ row }">
          <template v-if="!(row.is_parent && row.children?.length > 0)">
            {{ row.delivery_date || '尽快' }}
          </template>
        </template>
      </el-table-column>
      <el-table-column label="订货单预览与导出" width="190" align="center">
        <template #default="{ row }">
          <el-button v-if="!(row.is_parent && row.children?.length > 0)" type="warning" size="small" @click="openPreview(row)">📋 预览采购订货单</el-button>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" align="center" fixed="right">
        <template #default="{ row }">
          <el-button v-if="canMaintain && !(row.is_parent && row.children?.length > 0)" link type="primary" @click="openEdit(row)">编辑</el-button>
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
        <el-button v-if="canMaintain" type="success" :icon="Download" :loading="downloading" @click="onExportExcel">下载 Excel (.xlsx 模板版)</el-button>
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
        <!-- 子任务单选择器（多供应商订单才显示，可切换编辑不同供应商的子任务单） -->
        <el-form-item v-if="editForm.sub_orders && editForm.sub_orders.length > 0" label="当前编辑的子任务单">
          <el-select v-model="editForm.active_sub_index" placeholder="选择子任务单" style="width: 100%">
            <el-option v-for="(so, i) in editForm.sub_orders" :key="i"
              :label="`${so.po_number || so.sub_contract_no} - ${so.supplier_name || '未指定供应商'}`" :value="i" />
          </el-select>
        </el-form-item>

        <!-- 分区 1：基础参数（不再包含供应商字段；子任务单模式显示关联合同号） -->
        <el-divider content-position="left">一、基础参数（可关联订单自动填充）</el-divider>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="采购合同编号 *" required>
              <el-input v-model="editForm.po_number" :disabled="editForm.is_sub" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
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

        <!-- 分区 1（续）：产品明细扩展字段（支持添加/删除明细行，保存后同步至预览打印与 Excel 下载） -->
        <div class="ext-toolbar">
          <el-button type="primary" size="small" @click="addItemRow">+ 添加明细行</el-button>
          <span class="ext-hint">可添加自定义行或删除不需要的行，保存后预览/打印与 Excel 下载同步生效</span>
        </div>
        <el-table :data="editingItems" border size="small" style="width: 100%">
          <el-table-column label="序号" width="50" align="center" type="index" />
          <el-table-column label="产品型号" width="150">
            <template #default="{ row }">
              <el-input v-if="row._custom" v-model="row.model" size="small" placeholder="输入自定义型号" />
              <template v-else>
                <strong>{{ row.supplier_model || row.model || '—' }}</strong>
                <div v-if="row.supplier_model && row.model" style="font-size:10px; color:#94a3b8; margin-top:2px;">自编号: {{ row.model }}</div>
              </template>
            </template>
          </el-table-column>
          <el-table-column label="图片" width="70" align="center">
            <template #default="{ row }">
              <el-image
                v-if="row.img_url"
                :src="row.img_url"
                fit="cover"
                :preview-src-list="[row.img_url]"
                preview-teleported
                hide-on-click-modal
                style="width:40px; height:40px; border-radius:4px; display:block; margin:0 auto;"
              />
              <span v-else style="color:#cbd5e1;">—</span>
            </template>
          </el-table-column>
          <el-table-column label="数量" width="80" align="right">
            <template #default="{ row }">
              <el-input-number v-if="row._custom" v-model="row.qty" size="small" :min="0" :controls="false" style="width: 100%" />
              <template v-else>{{ row.qty }}</template>
            </template>
          </el-table-column>
          <el-table-column label="装箱量" width="100" align="center">
            <template #default="{ row }">
              <span>{{ formatPcsPerCtn(row.pcs_per_ctn) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="详细规范" min-width="280">
            <template #default="{ row }">
              <el-input
                v-model="row.detail_spec"
                type="textarea"
                :rows="4"
                size="small"
                :placeholder="'根据产品类型自动生成配置模板'"
                @focus="ensureDetailSpecTemplate(row)"
              />
              <el-button
                v-if="!row._custom"
                link
                type="primary"
                size="small"
                style="margin-top: 2px;"
                @click="fillDetailSpecTemplate(row)"
              >重新生成模板</el-button>
            </template>
          </el-table-column>
          <el-table-column label="备注" min-width="120">
            <template #default="{ row }">
              <el-input v-model="row.remark" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="删" width="50" align="center">
            <template #default="{ $index }">
              <el-button link type="danger" @click="editingItems.splice($index, 1)">✕</el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分区 2：核心电气配置（多行文本模板，类似详细规范） -->
        <el-divider content-position="left">二、核心电气、传感器与部件配置</el-divider>
        <el-row :gutter="16">
          <el-col :span="24">
            <el-form-item label="产品类型">
              <el-select
                v-model="editForm.product_config_types"
                multiple
                filterable
                allow-create
                default-first-option
                clearable
                placeholder="选择产品类型（可多选），选中后下方自动出现配置字段"
                style="width: 100%"
              >
                <el-option
                  v-for="t in productConfigTypes"
                  :key="t.id"
                  :label="t.product_type"
                  :value="t.product_type"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 模块二多行文本：选择类型自动追加对应区块，多个类型间用【标题】+空行分隔 -->
        <el-row :gutter="16">
          <el-col :span="24">
            <el-form-item label="配置内容">
              <el-input
                v-model="editForm.product_config_text"
                type="textarea"
                :rows="10"
                placeholder="选择产品类型后自动追加对应字段模板，可在此基础上编辑"
              />
              <el-button
                link
                type="primary"
                size="small"
                style="margin-top: 2px;"
                @click="regenConfigTemplate"
              >重新生成模板</el-button>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 分区 3：其他要求 -->
        <!-- 分区 3：其他要求（合并原模块3+4，只保留图片上传 + 多行备注） -->
        <el-divider content-position="left">三、其他要求（图片 + 备注）</el-divider>
        <el-row :gutter="16">
          <el-col :span="24">
            <el-form-item label="实物图片（可多张，下载采购订货单 Excel 时自动插入「包装与运输说明」下方，靠左独占一行）">
              <div class="plug-photos-wrap">
                <div v-for="(p, i) in editForm.plug_photos" :key="i" class="plug-photo-thumb">
                  <img :src="p" />
                  <el-button class="plug-photo-del" link type="danger" :icon="Close" @click="editForm.plug_photos.splice(i, 1)" />
                </div>
                <el-upload
                  v-if="editForm.plug_photos.length < 8"
                  :show-file-list="false"
                  :before-upload="onPlugPhotoSelect"
                  accept="image/*"
                  multiple
                >
                  <div class="plug-photo-add">＋ 上传照片</div>
                </el-upload>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input v-model="editForm.remark_note" type="textarea" :rows="5" placeholder="无" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="warning" :loading="saving" @click="onSave">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { onMounted, reactive, ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Printer, Download, Close } from '@element-plus/icons-vue'
import { listOrders, getOrder, updateOrder } from '@/api/orders'
import { listSamples, getSample, updateSample } from '@/api/samples'
import { listSuppliers } from '@/api/suppliers'
import { listProducts, listProductConfigs } from '@/api/products'
import { getCompanySettings } from '@/api/companySettings'
import { formatMoney, getOrderTotals, printDocument } from '@/utils/docUtils'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
// 任务单维护权限：跟单(5)/主管(2)/管理员(1)可编辑，业务员(3)只读（仅查看自己的任务单，不可编辑、不可下载 Excel）
const canMaintain = userStore.permissionLevel <= 5 && userStore.permissionLevel !== 3
const downloading = ref(false)

// 4 个下拉选项常量（来自上传的 Excel 模板数据验证）
const VOLTAGE_OPTIONS = [
  '交流 220伏 (50赫兹)',
  '交流 220伏 (60赫兹)',
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
  '8000mA锂电池',
  '不配电池 (客户自配)'
]
const PTC_OPTIONS = [
  '是 (必须带PTC保护板)',
  '否 (不带PTC保护)'
]

// 默认文本（从模板示例值带出，用户可改）
const POWER_CORD_DEFAULT = '无'
const PACKING_DEFAULT = '无'
const LOGO_REQ_DEFAULT = '无'

// 子任务单独立字段：优先从 src（子任务单）读取，回退到 fb（顶层 po）
// 保证两个子合同编辑内容各自独立，互不影响
// 模块3+4合并后只保留 plug_photos 和 remark_note 两个独立字段
function readSubFields(src, fb = {}) {
  const s = src || {}
  const f = fb || {}
  const types = Array.isArray(s.product_config_types) && s.product_config_types.length
    ? [...s.product_config_types]
    : (Array.isArray(f.product_config_types) ? [...f.product_config_types] : [])
  let configData = (s.product_config_data && typeof s.product_config_data === 'object')
    ? { ...s.product_config_data }
    : (f.product_config_data && typeof f.product_config_data === 'object' ? { ...f.product_config_data } : null)
  // 旧字段兼容：无 config_data 时从旧字段构建
  if (!configData) {
    configData = {
      board_model: s.board_model || f.board_model || '',
      work_voltage: s.work_voltage || f.work_voltage || '',
      charge_mode: s.charge_mode || f.charge_mode || '',
      battery_spec: s.battery_spec || f.battery_spec || '',
      ptc_protection: s.ptc_protection || f.ptc_protection || ''
    }
  }
  // 从 config_data 还原文本（带【类型】标题分组，多个类型间空行分隔；已保存过文本优先用原文本）
  let configText = s.product_config_text || f.product_config_text || ''
  if (!configText && types.length) {
    const typeMap = new Map((productConfigTypes.value || []).map(t => [t.product_type, t]))
    const blocks = []
    for (const typeName of types) {
      const cfg = typeMap.get(typeName)
      const fields = cfg && Array.isArray(cfg.config_fields) ? cfg.config_fields : []
      const lines = [`【${typeName}】`]
      for (const f of fields) {
        const v = configData[f.key]
        if (v !== undefined && v !== null && v !== '') {
          lines.push(`${f.label}:${v}`)
        } else {
          lines.push(`${f.label}:`)
        }
      }
      blocks.push(lines.join('\n'))
    }
    configText = blocks.join('\n\n')
  }
  return {
    product_config_types: types,
    product_config_data: configData,
    product_config_text: configText,
    plug_photos: Array.isArray(s.plug_photos) ? [...s.plug_photos] : (Array.isArray(f.plug_photos) ? [...f.plug_photos] : []),
    remark_note: s.remark_note ?? f.remark_note ?? ''
  }
}

const loading = ref(false)
const saving = ref(false)
const list = ref([])
// 来源筛选：all=全部 / order=仅外销订单 / sample=仅样品单
const filterType = ref('all')
const filteredList = computed(() => {
  if (filterType.value === 'all') return list.value
  return list.value.filter((row) => row.ref_type === filterType.value)
})
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
// 详情明细缓存（用于子任务单切换时按 product_ids 重新过滤）
const detailItemsCache = ref([])
// 详情快照缓存 + 产品库映射缓存（用于子任务单切换时重新过滤）
const detailExtsCache = ref([])
const productMapCache = ref({})
// 原始 production_order JSON 缓存（保存时合并结构字段 is_parent/sub_orders/po_no，避免覆盖丢失）
const originalPoCache = ref({})

// 分页拉取全量产品库建映射（后端 parsePagination 上限 200/页，必须循环翻页）
async function fetchAllProductsMap() {
  const map = {}
  const pageSize = 200
  try {
    const first = await listProducts({ page: 1, pageSize })
    const list = first.list || []
    const total = Number(first.total) || list.length
    list.forEach(p => { map[p.id] = p })
    const totalPages = Math.ceil(total / pageSize)
    for (let pg = 2; pg <= totalPages; pg++) {
      const next = await listProducts({ page: pg, pageSize })
      ;(next.list || []).forEach(p => { map[p.id] = p })
    }
  } catch { /* 映射失败时回退明细自带值 */ }
  return map
}

// 以产品库为准解析产品：先按 product_id 查，查不到按型号（our_model/model）兜底匹配
function resolveProd(row, productMap) {
  if (row.product_id && productMap[row.product_id]) return productMap[row.product_id]
  const m = row.supplier_model || row.model || ''
  if (!m) return null
  return Object.values(productMap).find(p => (p.our_model && p.our_model === m) || p.model === m) || null
}

// 装箱量格式化：4 → "4件/箱"，空值 → "—"
function formatPcsPerCtn(v) {
  if (v === null || v === undefined || v === '' || v === 0) return '—'
  return `${v}件/箱`
}

// 产品配置管理：所有产品类型定义（来自 product_configs 表）
const productConfigTypes = ref([])

// 监听产品类型变化（幂等增量更新，保留用户已填内容）：
// 新增类型 → 文本中无对应【标题】区块时追加；移除类型 → 删除对应区块
watch(() => editForm.value.product_config_types, (newTypes, oldTypes) => {
  const nt = [...(newTypes || [])]
  const ot = [...(oldTypes || [])]
  if (!nt.length) {
    // 无选中时清空文本
    editForm.value.product_config_text = ''
    return
  }
  const added = nt.filter(t => !ot.includes(t))
  const removed = ot.filter(t => !nt.includes(t))
  let text = (editForm.value.product_config_text || '').trim()
  if (removed.length) text = removeConfigBlocks(text, removed)
  if (added.length) {
    // 幂等保护：openEdit/子任务单切换程序化回填时文本已含对应区块，不重复追加
    const missing = added.filter(t => !text.includes(`【${t}】`))
    if (missing.length) {
      const blocks = buildConfigTemplateText(missing)
      if (blocks) text = text ? text + '\n\n' + blocks : blocks
    }
  }
  editForm.value.product_config_text = text
}, { deep: true })

// 生成带【类型】标题的配置模板（每个类型一个区块，区块间空行分隔，多类型时分隔清晰）
function buildConfigTemplateText(selectedTypes) {
  const typeMap = new Map(productConfigTypes.value.map(t => [t.product_type, t]))
  const blocks = []
  for (const typeName of selectedTypes) {
    const cfg = typeMap.get(typeName)
    const fields = cfg && Array.isArray(cfg.config_fields) ? cfg.config_fields : []
    const lines = [`【${typeName}】`]
    for (const f of fields) lines.push(`${f.label}:`)
    blocks.push(lines.join('\n'))
  }
  return blocks.join('\n\n')
}

// 从文本中移除指定类型的区块（按【标题】行解析分组，无标题的行保留）
function removeConfigBlocks(text, removedTypes) {
  if (!text) return ''
  const removedSet = new Set(removedTypes)
  const blocks = []
  let current = null
  for (const line of text.split('\n')) {
    const m = line.match(/^【(.+?)】\s*$/)
    if (m) {
      if (current) blocks.push(current)
      current = { title: m[1], lines: [line] }
    } else if (current) {
      current.lines.push(line)
    } else {
      current = { title: null, lines: [line] }
    }
  }
  if (current) blocks.push(current)
  return blocks
    .filter(b => !b.title || !removedSet.has(b.title))
    .map(b => b.lines.join('\n'))
    .join('\n\n')
    .trim()
}

// 重新生成模板：按当前所选产品类型完整重建（覆盖已填内容）
function regenConfigTemplate() {
  const types = editForm.value.product_config_types || []
  if (!types.length) {
    ElMessage.warning('请先选择产品类型')
    return
  }
  editForm.value.product_config_text = buildConfigTemplateText(types)
}

// 从文本解析回 product_config_data（保存时）
function parseConfigTextToData(text, allTypes, selectedTypes) {
  const typeMap = new Map(allTypes.map(t => [t.product_type, t]))
  const data = {}
  const lines = (text || '').split('\n').map(s => s.trim()).filter(Boolean)
  const allFields = []
  for (const typeName of selectedTypes) {
    const cfg = typeMap.get(typeName)
    if (cfg && Array.isArray(cfg.config_fields)) {
      allFields.push(...cfg.config_fields)
    }
  }
  for (const line of lines) {
    if (/^【.+?】$/.test(line)) continue // 跳过【类型】标题行
    // 匹配 "标签:值" 或 "标签：值"
    const m = line.match(/^(.+?)[:：](.*)$/)
    if (m) {
      const label = m[1].trim()
      const value = m[2].trim()
      const field = allFields.find(f => f.label === label)
      if (field) {
        data[field.key] = value
      }
    }
  }
  return data
}

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
  return po.po_number || po.po_no || (refNo ? refNo + 'PO' : '—')
}
function supplierName(row) {
  if (row.supplier_name) return row.supplier_name
  // 单供应商样品单：回退到生产任务单 JSON 中的 supplier_name
  const po = parseDoc(row.production_order)
  if (po.supplier_name) return po.supplier_name
  if (row.is_sub && row.sub_order?.supplier_name) return row.sub_order.supplier_name
  const sid = row.supplier_id || po.supplier_id
  if (sid) {
    const s = supplierOptions.value.find(x => x.id === sid)
    if (s) return s.name
  }
  return ''
}

// 客户名称 + 所在国家（订单行 client_country，样品单行 country）
function clientNameWithCountry(row) {
  const name = row.client_short_name || row.client_name || ''
  if (!name) return '—'
  const country = row.client_country || row.country || ''
  return country ? `${name}（${country}）` : name
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
    const merged = [...orderList, ...sampleList].sort((a, b) => {
      const ta = new Date(a.created_at || a.signing_date || 0).getTime()
      const tb = new Date(b.created_at || b.signing_date || 0).getTime()
      return tb - ta
    })
    // 4. 构造树形：多供应商订单生成子任务单虚拟行
    // 对有子任务单的订单，批量拉取明细以计算各子任务单的排产数量和品类数
    const parentRows = merged.filter((row) => {
      const po = parseDoc(row.production_order)
      return Array.isArray(po.sub_orders) && po.sub_orders.length > 0
    })
    const itemsMap = new Map()
    if (parentRows.length) {
      const detailPromises = parentRows.map(async (row) => {
        const api = row.ref_type === 'sample' ? getSample : getOrder
        const detail = await api(row.id)
        return { key: `${row.ref_type}-${row.id || row.ref_number}`, items: detail.items || [] }
      })
      const details = await Promise.all(detailPromises)
      for (const { key, items } of details) itemsMap.set(key, items)
    }

    list.value = merged.map((row) => {
      const po = parseDoc(row.production_order)
      const rowKey = `${row.ref_type}-${row.id || row.ref_number}`
      const subs = Array.isArray(po.sub_orders) ? po.sub_orders : []
      if (subs.length > 0) {
        // 从明细计算各子任务单的排产数量和品类数
        const allItems = itemsMap.get(rowKey) || []
        return {
          ...row,
          rowKey,
          is_parent: true,
          children: subs.map((so, i) => {
            const pids = Array.isArray(so.product_ids) ? so.product_ids : []
            const pidSet = new Set(pids.map(id => Number(id)))
            const subItems = allItems.filter(it => pidSet.has(Number(it.product_id)))
            const subQty = subItems.reduce((sum, it) => sum + (Number(it.qty) || 0), 0)
            const subKinds = new Set(subItems.map(it => it.product_id)).size
            return {
              ...row,
              rowKey: `${rowKey}-sub-${i}`,
              is_sub: true,
              sub_order: so,
              supplier_id: so.supplier_id,
              supplier_name: so.supplier_name,
              sub_index: i,
              total_qty: subQty,
              product_kind_count: subKinds
            }
          })
        }
      }
      // 单供应商：从生产任务单 JSON 补充供应商信息（样品单表 JOIN 无供应商时回退）
      return {
        ...row,
        rowKey,
        supplier_id: row.supplier_id || po.supplier_id || null,
        supplier_name: row.supplier_name || po.supplier_name || '',
        product_kind_count: row.item_count || 0
      }
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

// 电源线/插头实物照片：压缩至 800px 长边 JPEG base64（最多 8 张，随 production_order JSON 保存）
function onPlugPhotoSelect(file) {
  if (!Array.isArray(editForm.value.plug_photos)) editForm.value.plug_photos = []
  if (editForm.value.plug_photos.length >= 8) {
    ElMessage.warning('最多上传 8 张照片')
    return false
  }
  const MAX_SIDE = 800
  const reader = new FileReader()
  reader.onload = (evt) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff' // 透明底转 JPEG 时垫白，避免发黑
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      editForm.value.plug_photos.push(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.src = evt.target.result
  }
  reader.readAsDataURL(file)
  return false // 阻止 el-upload 自动上传
}

/* ========== 预览：生成采购订货单 HTML（复刻上传的 Excel 模板） ========== */
async function openPreview(row) {
  try {
    const detail = row.ref_type === 'sample'
      ? await getSample(row.id)
      : await getOrder(row.id)
    currentOrder.value = { ...detail, ref_number: row.ref_number, ref_type: row.ref_type }
    // 分页拉全产品库建映射，取供应商型号（与编辑弹窗一致，映射失败时回退自编号）
    const productMap = await fetchAllProductsMap()
    // 加载产品配置类型（用于预览模块二动态渲染）
    try {
      const pcd = await listProductConfigs({ page: 1, pageSize: 100 })
      window.__PRODUCT_CONFIG_TYPES__ = pcd.list || []
    } catch { window.__PRODUCT_CONFIG_TYPES__ = [] }
    const company = companySettings.value || {}
    const supplier = supplierOptions.value.find(s => s.id === detail.supplier_id) || {}
    // 子任务单行：传入 sub_order 用于过滤明细和替换供应商
    const subOrder = row.is_sub ? row.sub_order : null
    currentOrder.value = { ...currentOrder.value, sub_order: subOrder, sub_index: row.sub_index }
    previewHtml.value = buildPurchaseOrderHtml(currentOrder.value, company, supplier, productMap, subOrder)
    previewVisible.value = true
  } catch { /* 拦截器 */ }
}

function buildPurchaseOrderHtml(order, company, supplier, productMap = {}, subOrder = null) {
  const po = parseDoc(order.production_order)
  let items = order.items || []
  // 子任务单预览：按 product_ids 过滤（同一供应商的产品）；product_ids 为空时回退按 product_supplier_id 过滤
  // 大任务单（subOrder 为 null）则关联全部产品
  if (subOrder) {
    const pids = Array.isArray(subOrder.product_ids) ? subOrder.product_ids : []
    if (pids.length > 0) {
      const idSet = new Set(pids.map(id => Number(id)))
      items = items.filter(it => idSet.has(Number(it.product_id)))
    } else if (subOrder.supplier_id !== null && subOrder.supplier_id !== undefined) {
      const sid = Number(subOrder.supplier_id)
      items = items.filter(it => Number(it.product_supplier_id) === sid)
    }
  }
  const today = new Date()
  const orderDate = today.toISOString().slice(0, 10)
  const exts = po.item_extensions || []
  // 行源：子任务单模式强制走非 snapshot 分支
  const hasSnapshot = !subOrder && exts.length > 0 && exts[0].model !== undefined
  const rows = hasSnapshot
    ? exts.map((e) => {
        const prod = resolveProd(e, productMap)
        return {
          model: (prod && prod.our_model) || e.supplier_model || e.model || '',
          supplier_model: e.supplier_model || (prod ? (prod.our_model || '') : ''),
          qty: Number(e.qty) || 0,
          img_url: e.img_url || (prod ? (prod.img_url || '') : ''),
          pcs_per_ctn: prod ? (prod.pcs_per_ctn ?? '') : (e.pcs_per_ctn || ''),
          detail_spec: e.detail_spec || '',
          remark: e.remark || ''
        }
      })
    : items.map((it, idx) => {
        const prod = resolveProd(it, productMap)
        const ext = exts[idx] || {}
        return {
          model: (prod && prod.our_model) || it.model || '',
          supplier_model: prod ? (prod.our_model || '') : (it.supplier_model || ''),
          qty: it.qty || 0,
          img_url: it.img_url || (prod ? (prod.img_url || '') : ''),
          pcs_per_ctn: prod ? (prod.pcs_per_ctn ?? '') : (it.pcs_per_ctn || ''),
          detail_spec: ext.detail_spec || '',
          remark: ext.remark || ''
        }
      })
  const totalQty = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0)

  // 通用样式（与新 Excel 模板配色一致）
  const BORDER = '1px solid #1F4E78'
  const HEAD_BG = 'background:#1F4E78; color:#fff;'
  const SECTION_BG = 'background:#D9E1F2;'
  const cellStyle = `border:${BORDER}; padding:6px 8px; font-size:11px; vertical-align:middle;`
  const headStyle = `border:${BORDER}; padding:6px 8px; font-size:11px; font-weight:bold; text-align:center; ${HEAD_BG}`
  const sectionStyle = `border:${BORDER}; padding:6px 10px; font-size:11px; font-weight:bold; ${SECTION_BG}`

  // ===== 一、产品明细清单（8 列结构：序号/型号/图片/数量/装箱量/详细规范(F:G)/备注） =====
  const detailRows = rows.map((r, idx) => {
    const detailSpecHtml = (r.detail_spec || '').split('\n').map(line =>
      `<div style="margin:0; line-height:1.5;">${(line || '').replace(/</g, '&lt;')}</div>`
    ).join('') || '—'
    return `<tr>
      <td style="${cellStyle} text-align:center;">${idx + 1}</td>
      <td style="${cellStyle}"><strong>${r.model}</strong></td>
      <td style="${cellStyle} text-align:center;">${r.img_url ? `<img src="${r.img_url}" style="width:36px; height:36px; object-fit:cover; border-radius:3px; display:block; margin:0 auto;" />` : '—'}</td>
      <td style="${cellStyle} text-align:right;">${r.qty || 0}</td>
      <td style="${cellStyle} text-align:center;">${formatPcsPerCtn(r.pcs_per_ctn)}</td>
      <td style="${cellStyle}" colspan="2">${detailSpecHtml}</td>
      <td style="${cellStyle}">${(r.remark || '').replace(/</g, '&lt;')}</td>
    </tr>`
  }).join('')

  // ===== 子任务单字段：优先从 subOrder 读取（保证两个子合同内容各自独立） =====
  const sf = readSubFields(subOrder, po)
  const photos = Array.isArray(sf.plug_photos) ? sf.plug_photos : []
  const remarkText = sf.remark_note || ''

  // ===== 统一采购备注：模块2 电气配置文本（直接显示多行文本内容）=====
  const configData = (sf.product_config_data && typeof sf.product_config_data === 'object') ? sf.product_config_data : null
  const configTypes = Array.isArray(sf.product_config_types) ? sf.product_config_types : []
  // 优先用 product_config_text（多行文本），其次用旧格式从 configData 生成
  let generalRemarksText = ''
  const configText = sf.product_config_text || ''
  if (configText.trim()) {
    generalRemarksText = configText.split('\n').map(line =>
      `<div style="margin:0; line-height:1.6;">${(line || '').replace(/</g, '&lt;')}</div>`
    ).join('')
  } else if (configData) {
    // 旧格式回退：从 configData 逐字段生成
    const allCfgTypes = (window.__PRODUCT_CONFIG_TYPES__ || productConfigTypes.value || [])
    const remarksLines = []
    const seenKeys = new Set()
    for (const typeName of configTypes) {
      const cfg = allCfgTypes.find(t => t.product_type === typeName)
      if (cfg && Array.isArray(cfg.config_fields)) {
        for (const f of cfg.config_fields) {
          if (seenKeys.has(f.key)) continue
          seenKeys.add(f.key)
          const v = configData[f.key]
          if (v !== undefined && v !== null && v !== '') {
            remarksLines.push(`${f.label}：${v}`)
          }
        }
      }
    }
    if (remarksLines.length) {
      generalRemarksText = remarksLines.map(l =>
        `<div style="margin:0; line-height:1.6;">${l.replace(/</g, '&lt;')}</div>`
      ).join('')
    }
  }
  // 旧字段兼容（无 configData 时）
  if (!generalRemarksText && !configData) {
    const legacy = [
      { label: '主板型号', key: 'board_model' },
      { label: '充电模式', key: 'charge_mode' },
      { label: '工作电压', key: 'work_voltage' },
      { label: '电池规格', key: 'battery_spec' },
      { label: 'PTC保护', key: 'ptc_protection' }
    ]
    const lines = []
    for (const f of legacy) {
      const v = sf[f.key]
      if (v) lines.push(`${f.label}：${v}`)
    }
    if (lines.length) {
      generalRemarksText = lines.map(l =>
        `<div style="margin:0; line-height:1.6;">${l.replace(/</g, '&lt;')}</div>`
      ).join('')
    }
  }
  if (!generalRemarksText) {
    generalRemarksText = '<div style="color:#64748b; font-style:italic;">无</div>'
  }

  return `
    <div style="text-align:center; font-size:22pt; font-weight:900; letter-spacing:16px; padding:16px 0; color:#1a1a1a;">采 购 订 货 单</div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0; font-size:11px; border:${BORDER};">
      <div style="padding:8px 10px; border-right:${BORDER};"><strong>客户名称：</strong>${order.client_short_name || order.client_name || ''}</div>
      <div style="padding:8px 10px;"><strong>制单人：</strong>${userStore.displayName}</div>
      <div style="padding:8px 10px; border-right:${BORDER}; border-top:${BORDER};"><strong>下单日期：</strong>${orderDate}</div>
      <div style="padding:8px 10px; border-top:${BORDER};"><strong>交货日期：</strong>${(order.delivery_date || '').slice(0, 10) || ''}</div>
    </div>

    <div style="margin-top:10px; border:${BORDER};">
      <table style="border-collapse:collapse; width:100%; margin:0;">
        <thead><tr>
          <th style="${headStyle} width:40px;">序号</th>
          <th style="${headStyle} width:120px;">型号</th>
          <th style="${headStyle} width:55px;">图片</th>
          <th style="${headStyle} width:60px;">数量</th>
          <th style="${headStyle} width:75px;">装箱量</th>
          <th style="${headStyle};" colspan="2">详细规范</th>
          <th style="${headStyle} width:90px;">备注</th>
        </tr></thead>
        <tbody>${detailRows || `<tr><td colspan="8" style="${cellStyle} text-align:center; color:#94a3b8;">暂无明细</td></tr>`}</tbody>
        <tfoot><tr>
          <td style="${cellStyle} text-align:right;" colspan="3"><strong>合计总数量：</strong></td>
          <td style="${cellStyle} text-align:right;"><strong>${totalQty}</strong></td>
          <td style="${cellStyle}" colspan="4"><em>总计台数请核对装箱数与整批出货体积</em></td>
        </tr></tfoot>
      </table>
    </div>

    <table style="border-collapse:collapse; width:100%; margin-top:8px;">
      <tr><td style="${sectionStyle} border-top:${BORDER};">统一采购备注 (General Purchase Remarks)</td></tr>
      <tr><td style="${cellStyle} background:#fff; white-space:pre-wrap;">${generalRemarksText}</td></tr>
    </table>

    <table style="border-collapse:collapse; width:100%; margin-top:0;">
      <tr><td style="${sectionStyle} border-top:${BORDER};">客户需求与其他备注 (Customer Requirements & Other Remarks)</td></tr>
      ${photos.length ? `
      <tr><td style="${cellStyle} background:#fff; padding:8px;">
        <div style="display:flex; flex-wrap:wrap; gap:8px; justify-content:flex-start;">
          ${photos.map(p => `<img src="${p}" style="width:100px; height:100px; object-fit:cover; border:1px solid #cbd5e1; border-radius:4px;" />`).join('')}
        </div>
      </td></tr>` : ''}
      <tr><td style="${cellStyle} background:#fff; white-space:pre-wrap;">${remarkText || '<span style="color:#64748b; font-style:italic;">无</span>'}</td></tr>
    </table>
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
    // 子任务单模式：URL 带 sub_index 参数
    const subIdx = currentOrder.value.sub_index !== undefined ? `?sub_index=${currentOrder.value.sub_index}` : ''
    const res = await fetch(`/api/${apiBase}/${currentOrder.value.id}/purchase-order-xlsx${subIdx}`, {
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
// 按子任务单过滤明细行（子任务单模式只显示该供应商的产品）
// 优先用 product_ids 快照（归类后固定，不受产品库 supplier_id 变化影响）
//   - product_ids 非空 → 按 product_id 精确匹配
//   - product_ids 为空 + supplier_id 有值 → 回退按 supplier_id 过滤（旧数据兼容）
//   - 都为空 → 只显示自定义产品
// subOrder 为 null（大任务单）则关联全部产品
function filterItemsBySubOrder(allItems, allExts, productMap, subOrder) {
  let filterFn
  if (!subOrder) {
    filterFn = () => true
  } else {
    const pids = Array.isArray(subOrder.product_ids) ? subOrder.product_ids.filter(Boolean) : []
    if (pids.length > 0) {
      // 优先用 product_ids 快照精确匹配（归类后固定）
      const idSet = new Set(pids.map(id => Number(id)))
      filterFn = (pid) => idSet.has(Number(pid))
    } else if (subOrder.supplier_id !== null && subOrder.supplier_id !== undefined) {
      // 旧数据无 product_ids 快照时回退按 supplier_id 过滤
      const sid = Number(subOrder.supplier_id)
      filterFn = (pid, itemSupplierId) => {
        const itemSid = itemSupplierId !== undefined
          ? Number(itemSupplierId)
          : (pid && productMap[pid] ? Number(productMap[pid].supplier_id) : null)
        return itemSid !== null && itemSid === sid
      }
    } else {
      // supplier_id 也为空：只显示自定义产品
      filterFn = (pid) => !pid
    }
  }
  const hasSnapshot = allExts.length > 0 && allExts[0].model !== undefined
  const snapshotImg = (ext) => {
    if (ext.img_url) return ext.img_url
    if (ext.product_id && productMap[ext.product_id]) return productMap[ext.product_id].img_url || ''
    const m = ext.supplier_model || ext.model || ''
    if (!m) return ''
    const hit = Object.values(productMap).find((p) => (p.our_model && p.our_model === m) || p.model === m)
    return hit ? (hit.img_url || '') : ''
  }
  return hasSnapshot
    ? allExts.filter(ext => filterFn(ext.product_id, ext.product_supplier_id)).map((ext, idx) => {
        const prod = resolveProd(ext, productMap)
        return {
          idx,
          product_id: ext.product_id || (prod ? prod.id : null),
          model: ext.model || '',
          supplier_model: prod ? (prod.our_model || '') : (ext.supplier_model || ''),
          qty: Number(ext.qty) || 0,
          img_url: snapshotImg(ext),
          // 装箱量/产品类型严格以产品库为准（图二为准），产品库缺失时才回退快照值
          pcs_per_ctn: prod ? (prod.pcs_per_ctn ?? '') : (ext.pcs_per_ctn || ''),
          product_type: prod ? (prod.product_type || '') : (ext.product_type || ''),
          detail_spec: ext.detail_spec || '',
          remark: ext.remark || ''
        }
      })
    : (allItems || []).filter(it => filterFn(it.product_id, it.product_supplier_id)).map((it, idx) => {
        const ext = allExts[idx] || {}
        const prod = resolveProd(it, productMap)
        return {
          idx,
          product_id: it.product_id || (prod ? prod.id : null),
          model: it.model,
          supplier_model: prod ? (prod.our_model || '') : '',
          qty: it.qty,
          img_url: it.img_url || (prod ? (prod.img_url || '') : ''),
          // 装箱量/产品类型严格以产品库为准（图二为准），产品库缺失时才回退明细值
          pcs_per_ctn: prod ? (prod.pcs_per_ctn ?? '') : (it.pcs_per_ctn || ''),
          product_type: prod ? (prod.product_type || '') : (it.product_type || ''),
          detail_spec: ext.detail_spec || '',
          remark: ext.remark || ''
        }
      })
}

// 切换子任务单时重新过滤明细 + 加载该子任务单的独立字段（保留 detail.items / exts / productMap 缓存）
watch(() => editForm.value.active_sub_index, (idx) => {
  if (idx === null || idx === undefined) return
  const sub = editForm.value.sub_orders?.[idx]
  if (!sub) return
  editForm.value.po_number = sub.po_number || sub.sub_contract_no || editForm.value.po_number
  // 加载该子任务单的独立编辑字段（回退到顶层 po）
  const fields = readSubFields(sub, originalPoCache.value || {})
  Object.assign(editForm.value, fields)
  editingItems.value = filterItemsBySubOrder(
    detailItemsCache.value,
    detailExtsCache.value,
    productMapCache.value,
    sub
  )
})

async function openEdit(row) {
  try {
    const detail = row.ref_type === 'sample'
      ? await getSample(row.id)
      : await getOrder(row.id)
    editingOrderId.value = row.id
    editingRefType.value = row.ref_type
    const po = parseDoc(detail.production_order)
    originalPoCache.value = po ? { ...po } : {}
    const refNo = row.ref_number || detail.pi_number || detail.sample_number || ''

    // 子任务单模式：行 is_sub 时携带 sub_order；行 is_parent 时取 sub_orders 数组
    const subOrders = Array.isArray(po.sub_orders) ? po.sub_orders : []
    const isSub = !!(row.is_sub && row.sub_order)
    const subOrder = isSub ? row.sub_order : null

    // 分页拉全产品库建映射，取供应商型号
    const productMap = await fetchAllProductsMap()

    // 加载产品配置类型（用于模块二动态字段）
    try {
      const pcd = await listProductConfigs({ page: 1, pageSize: 100 })
      productConfigTypes.value = pcd.list || []
    } catch { productConfigTypes.value = [] }

    const exts = po.item_extensions || []
    // 缓存用于子任务单切换时重新过滤
    detailItemsCache.value = detail.items || []
    detailExtsCache.value = exts
    productMapCache.value = productMap

    // 按子任务单过滤明细（大任务单 subOrder 为 null 时全部显示）
    editingItems.value = filterItemsBySubOrder(detail.items || [], exts, productMap, subOrder)
    // 对非自定义行，detail_spec 为空时自动填充产品类型对应的配置模板
    editingItems.value.forEach(row => {
      if (!row._custom && !row.detail_spec) {
        const tpl = buildDetailSpecTemplate(row.product_type)
        if (tpl) row.detail_spec = tpl
      }
    })

    editForm.value = {
      po_number: subOrder
        ? (subOrder.po_number || subOrder.sub_contract_no)
        : (po.po_number || po.po_no || (refNo + 'PO')),
      is_sub: isSub,
      // 子任务单模式：保留 sub_order.supplier_id（不显示选择字段）；大任务单：保留订单原 supplier_id
      supplier_id: subOrder?.supplier_id || detail.supplier_id || null,
      delivery_date: (detail.delivery_date || '').slice(0, 10),
      // 子任务单独立字段：优先从 subOrder 读取（保证两个子合同独立），回退到顶层 po
      ...readSubFields(subOrder, po),
      // 子任务单数组（多供应商拆分时使用）
      sub_orders: subOrders,
      active_sub_index: isSub ? row.sub_index : null
    }
    editVisible.value = true
  } catch { /* 拦截器 */ }
}

// 添加自定义明细行：型号/数量可编辑，扩展字段与普通行一致
function addItemRow() {
  editingItems.value.push({
    idx: editingItems.value.length,
    product_id: null,
    model: '',
    supplier_model: '',
    qty: 0,
    img_url: '',
    pcs_per_ctn: '',
    detail_spec: '',
    remark: '',
    _custom: true
  })
}

// 根据产品类型生成详细规范模板文本
// spec_fields 为纯文本模板字符串，有内容直接使用；为空回退 config_fields（兼容旧数据）
function buildDetailSpecTemplate(productType) {
  if (!productType) return ''
  const cfg = productConfigTypes.value.find(t => t.product_type === productType)
  if (!cfg) return ''
  // 新格式: spec_fields 为非空字符串，直接作为模板返回
  if (cfg.spec_fields && typeof cfg.spec_fields === 'string' && cfg.spec_fields.trim()) {
    return cfg.spec_fields
  }
  // 回退: 旧数据无 spec_fields 时用 config_fields 生成
  const fields = Array.isArray(cfg.config_fields) ? cfg.config_fields : []
  if (!fields.length) return ''
  return fields.map((f, i) => `${i + 1}. ${f.label}:`).join('\n')
}

// 主动填充/覆盖详细规范模板
function fillDetailSpecTemplate(row) {
  const tpl = buildDetailSpecTemplate(row.product_type)
  row.detail_spec = tpl
}

// 聚焦时若为空自动填充模板（不覆盖已填内容）
function ensureDetailSpecTemplate(row) {
  if (row._custom) return
  if (row.detail_spec) return
  const tpl = buildDetailSpecTemplate(row.product_type)
  if (tpl) row.detail_spec = tpl
}

async function onSave() {
  if (!editForm.value.po_number) return ElMessage.warning('请填写采购订货单编号')
  if (!editForm.value.delivery_date) return ElMessage.warning('请选择交货日期')
  if (!editingItems.value.length) return ElMessage.warning('产品明细至少保留一行')

  saving.value = true
  try {
    // 明细行快照：含型号/数量（支持增删行），预览/打印与 Excel 下载按此快照渲染
    const editedExts = editingItems.value.map(it => ({
      product_id: it.product_id || null,
      model: it.model || '',
      supplier_model: it.supplier_model || '',
      qty: Number(it.qty) || 0,
      img_url: typeof it.img_url === 'string' && it.img_url.startsWith('data:image') ? it.img_url : '',
      pcs_per_ctn: it.pcs_per_ctn || '',
      product_type: it.product_type || '',
      detail_spec: it.detail_spec || '',
      remark: it.remark
    }))

    // 子任务单模式：editedExts 仅含当前供应商的产品，需合并回全量快照（按 product_id 替换匹配项，保留其他供应商的行）
    // 大任务单模式：直接用 editedExts 作为新的全量快照
    const origPo = originalPoCache.value || {}
    const isSub = !!editForm.value.is_sub
    const subOrders = Array.isArray(editForm.value.sub_orders) ? editForm.value.sub_orders : []
    let item_extensions
    if (isSub) {
      // 全量快照来源：优先用已存在的 item_extensions（二次保存场景）；
      // 首次保存时 production_order 无 item_extensions，回退到 DB 明细行派生（否则其他子任务单的产品会丢失）
      const pMap = productMapCache.value || {}
      let origExts = Array.isArray(origPo.item_extensions) && origPo.item_extensions.length > 0
        ? origPo.item_extensions
        : (detailItemsCache.value || []).map(it => {
            const prod = resolveProd(it, pMap)
            return {
              product_id: it.product_id || (prod ? prod.id : null) || null,
              model: it.model || '',
              supplier_model: prod ? (prod.our_model || '') : (it.supplier_model || ''),
              qty: Number(it.qty) || 0,
              img_url: typeof it.img_url === 'string' && it.img_url.startsWith('data:image') ? it.img_url : (it.img_url || ''),
              pcs_per_ctn: prod ? (prod.pcs_per_ctn ?? '') : (it.pcs_per_ctn || ''),
              product_type: prod ? (prod.product_type || '') : (it.product_type || ''),
              detail_spec: '',
              remark: ''
            }
          })
      const editedIds = new Set(editedExts.map(e => Number(e.product_id)).filter(Boolean))
      // 保留原始快照中不属于当前子任务单的行，再追加当前编辑的行
      const kept = origExts.filter(e => {
        const pid = Number(e.product_id)
        return pid ? !editedIds.has(pid) : true
      })
      item_extensions = [...kept, ...editedExts]
    } else {
      item_extensions = editedExts
    }

    // 构造子任务单独立字段对象（模块3+4合并后只保留 plug_photos 和 remark_note）
    // 从多行文本解析回 product_config_data
    const configTypes = editForm.value.product_config_types || []
    const parsedConfigData = parseConfigTextToData(
      editForm.value.product_config_text || '',
      productConfigTypes.value,
      configTypes
    )
    const perSubData = {
      product_config_types: configTypes,
      product_config_data: parsedConfigData,
      product_config_text: editForm.value.product_config_text || '',
      plug_photos: (editForm.value.plug_photos || []).filter((p) => typeof p === 'string' && p.startsWith('data:image')),
      remark_note: editForm.value.remark_note
    }

    // 多供应商：把当前编辑的独立字段写入 sub_orders[active_sub_index]，顶层保留原值（保证两个子合同独立）
    if (subOrders.length > 0 && isSub) {
      const idx = editForm.value.active_sub_index
      if (idx !== null && idx !== undefined && subOrders[idx]) {
        Object.assign(subOrders[idx], perSubData, {
          // 子任务单自己的采购合同编号（如 MT26001PO1）
          po_number: editForm.value.po_number || subOrders[idx].po_number || '',
          // product_ids 保持原样（辅助追踪），真正过滤靠 supplier_id
          product_ids: editedExts.map(e => e.product_id).filter(Boolean)
        })
      }
    }

    await (editingRefType.value === 'sample' ? updateSample : updateOrder)(editingOrderId.value, {
      production_order: {
        // 结构字段：保留多供应商拆分（缺失会覆盖丢失）
        po_no: origPo.po_no || '',
        is_parent: subOrders.length > 0,
        sub_orders: subOrders,
        po_number: subOrders.length > 0
          ? (origPo.po_number || origPo.po_no || '')
          : editForm.value.po_number,
        // 供应商信息：单供应商时保留在顶层（列表展示需要），多供应商时各子任务单各自持有
        ...(subOrders.length === 0 ? {
          supplier_id: origPo.supplier_id || editForm.value.supplier_id || null,
          supplier_name: origPo.supplier_name || ''
        } : {}),
        // 子任务单模式：顶层不写当前子任务单的独立字段（已写入 sub_orders[idx]），保留原顶层值避免覆盖另一个子合同
        // 大任务单模式（单供应商）：独立字段写入顶层
        ...((!isSub || subOrders.length === 0) ? perSubData : readSubFields(origPo, {})),
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
/* 电源线/插头实物照片上传 */
.plug-photos-wrap { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.plug-photo-thumb { position: relative; width: 88px; height: 88px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; background: #f8fafc; }
.plug-photo-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.plug-photo-del { position: absolute; top: 0; right: 0; background: rgba(255, 255, 255, 0.9); border-radius: 0 0 0 6px; }
.plug-photo-add { width: 88px; height: 88px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #64748b; border: 1px dashed #cbd5e1; border-radius: 6px; cursor: pointer; background: #f8fafc; }
.plug-photo-add:hover { border-color: #f59e0b; color: #f59e0b; }
.sub-text { font-size: 11px; color: #94a3b8; }
.ext-toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 8px; }
.ext-hint { font-size: 11px; color: #94a3b8; }

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
