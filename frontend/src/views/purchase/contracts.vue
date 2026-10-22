<template>
  <el-card shadow="never" class="page-card">
    <!-- 页面标题 -->
    <div class="page-header" style="display: flex; align-items: center; gap: 16px;">
      <h2 class="page-title">采购管理 - 购销合同</h2>
      <el-radio-group v-model="filterType" size="small">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="order">外销订单</el-radio-button>
        <el-radio-button value="sample">样品单</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 列表（树形：多供应商订单可展开子合同；默认不展开） -->
    <el-table v-loading="loading" :data="filteredList" stripe
      row-key="rowKey" :tree-props="{ children: 'children' }">
      <el-table-column label="购销合同编号" width="170">
        <template #default="{ row }">
          <strong>{{ contractNo(row) }}</strong>
        </template>
      </el-table-column>
      <el-table-column label="关联数据" width="160">
        <template #default="{ row }">
          <strong style="color: #2563eb;">{{ row.ref_number }}</strong>
        </template>
      </el-table-column>
      <el-table-column label="供方工厂（卖方）" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <template v-if="!(row.is_parent && row.children?.length > 0)">
            <strong>{{ supplierName(row) || '—' }}</strong>
          </template>
        </template>
      </el-table-column>
      <el-table-column label="含税采购总额(¥)" width="170" align="right">
        <template #default="{ row }">
          <template v-if="!(row.is_parent && row.children?.length > 0)">
            <strong style="color: #dc2626;">¥{{ formatMoney(row.cny_purchase_cost || 0) }}</strong>
          </template>
        </template>
      </el-table-column>
      <el-table-column label="交货期限与地点" min-width="220">
        <template #default="{ row }">
          <template v-if="!(row.is_parent && row.children?.length > 0)">
            <div>{{ parseDoc(row.purchase_contract).delivery_deadline || '合同签订后30天内' }}</div>
            <div class="sub-text">{{ parseDoc(row.purchase_contract).delivery_location || '' }}</div>
          </template>
        </template>
      </el-table-column>
      <el-table-column label="合同预览与导出" width="180" align="center">
        <template #default="{ row }">
          <el-button v-if="!(row.is_parent && row.children?.length > 0)" type="warning" size="small" @click="openPreview(row)">📄 预览购销合同</el-button>
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
      :title="`采购合同 - ${currentOrder?.ref_number || currentOrder?.pi_number || ''}`"
      width="1100px"
      destroy-on-close
      top="3vh"
      class="doc-dialog"
    >
      <div class="doc-toolbar no-print">
        <el-button type="success" :icon="Download" @click="onExportExcel">下载 Excel (.xls)</el-button>
        <el-button type="warning" :icon="Printer" @click="onPrint">打印 / 另存为 PDF</el-button>
      </div>

      <div class="doc-page" v-html="previewHtml"></div>

      <template #footer>
        <el-button @click="previewVisible = false">关 闭</el-button>
      </template>
    </el-dialog>

    <!-- ========== 编辑弹窗（与预览联动） ========== -->
    <el-dialog
      v-model="editVisible" :close-on-click-modal="false"
      title="编辑采购合同"
      width="1100px"
      destroy-on-close
      top="3vh"
    >
      <el-form ref="editFormRef" :model="editForm" label-position="top">
        <!-- 子合同选择器（多供应商订单才显示） -->
        <el-form-item v-if="editForm.sub_contracts && editForm.sub_contracts.length > 0" label="当前编辑的子合同">
          <el-select v-model="editForm.active_sub_index" placeholder="选择子合同" style="width: 100%">
            <el-option v-for="(sc, i) in editForm.sub_contracts" :key="i"
              :label="`${sc.contract_no} - ${sc.supplier_name || '未指定供应商'}`" :value="i" />
          </el-select>
        </el-form-item>
        <!-- 合同编号 + 签订日期 -->
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="合同编号 *" required>
              <el-input v-model="editForm.contract_no" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="签订日期 *" required>
              <el-date-picker
                v-model="editForm.sign_date"
                type="date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 一、合同双方 -->
        <div class="party-section">
          <strong class="section-title">一、合同双方</strong>
          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="采购方（甲方）名称 *">
                <el-input v-model="editForm.buyer_name" placeholder="甲方公司名称" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="甲方统一社会信用代码">
                <el-input v-model="editForm.buyer_credit_code" placeholder="18位信用代码" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="甲方地址">
                <el-input v-model="editForm.buyer_address" placeholder="甲方详细地址" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="供应方（乙方）名称 *" required>
                <el-select v-model="editForm.supplier_id" filterable style="width: 100%" @change="onSupplierChange">
                  <el-option v-for="s in supplierOptions" :key="s.id" :label="s.name" :value="s.id" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="乙方统一社会信用代码">
                <el-input v-model="editForm.supplier_credit_code" placeholder="18位信用代码" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="乙方地址">
                <el-input v-model="editForm.supplier_address" placeholder="乙方详细地址" />
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <!-- 二、采购产品明细 -->
        <div class="items-section">
          <div class="items-section-header">
            <strong>二、采购产品明细</strong>
            <el-button type="warning" size="small" @click="addItemRow">+ 添加采购商品行</el-button>
          </div>
          <el-table :data="editItems" border size="small" class="items-table">
            <el-table-column label="序号" width="55" align="center">
              <template #default="{ $index }">{{ $index + 1 }}</template>
            </el-table-column>
            <el-table-column label="产品型号" min-width="280">
              <template #default="{ row }">
                <el-input v-model="row.supplier_model" size="small" placeholder="供应商型号" />
              </template>
            </el-table-column>
            <el-table-column label="单价（元）" width="140">
              <template #default="{ row }">
                <el-input-number v-model="row.cost_cny" size="small" :min="0" :precision="2" :controls="false" style="width: 100%" />
              </template>
            </el-table-column>
            <el-table-column label="数量" width="100">
              <template #default="{ row }">
                <el-input-number v-model="row.qty" size="small" :min="0" :controls="false" style="width: 100%" />
              </template>
            </el-table-column>
            <el-table-column label="单位" width="90">
              <template #default="{ row }">
                <el-input v-model="row.unit" size="small" maxlength="6" placeholder="如 台/个/箱" />
              </template>
            </el-table-column>
            <el-table-column label="小计（元）" width="140" align="right">
              <template #default="{ row }">
                <strong style="color: #dc2626;">¥{{ formatMoney(Number(row.qty || 0) * Number(row.cost_cny || 0)) }}</strong>
              </template>
            </el-table-column>
            <el-table-column label="删" width="55" align="center">
              <template #default="{ $index }">
                <el-button link type="danger" :icon="Close" @click="editItems.splice($index, 1)" />
              </template>
            </el-table-column>
          </el-table>
          <div class="items-total">
            <span>总计</span>
            <span>数量：<strong>{{ editTotalQty }}</strong> {{ editUnit }}</span>
            <span>金额（小写）：<strong style="color: #dc2626;">¥{{ formatMoney(editTotalAmount) }}</strong></span>
            <span>金额（大写）：人民币 {{ numberToChineseRMB(editTotalAmount) }}</span>
          </div>
        </div>

        <!-- 三、质量要求与检测 -->
        <div class="terms-section">
          <strong class="terms-title">三、质量要求与检测</strong>
          <div class="terms-item">
            <el-input v-model="editForm.quality_notes" type="textarea" :rows="6" placeholder="质量要求与检测内容" />
          </div>
        </div>

        <!-- 四、交货条款 -->
        <div class="terms-section">
          <strong class="terms-title">四、交货条款</strong>
          <el-row :gutter="12">
            <el-col :span="8">
              <el-form-item label="1. 交货地点">
                <el-input v-model="editForm.delivery_location" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="2. 交货时间">
                <el-input v-model="editForm.delivery_time" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="3. 包装要求">
                <el-input v-model="editForm.packing_req" type="textarea" :rows="1" />
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <!-- 五、结算条款 -->
        <div class="terms-section">
          <strong class="terms-title">五、结算条款</strong>
          <el-row :gutter="12">
            <el-col :span="12">
              <el-form-item label="收款方式">
                <el-select
                  v-model="editForm.payment_route_type"
                  filterable clearable
                  placeholder="选择供应方收款资料中的路线类型"
                  style="width: 100%"
                  @change="onPaymentRouteChange"
                >
                  <el-option
                    v-for="r in paymentRouteOptions"
                    :key="r.route_type"
                    :label="r.route_type"
                    :value="r.route_type"
                  />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <!-- 六、其他条款 -->
        <div class="terms-section">
          <strong class="terms-title">六、其他条款</strong>
          <div class="terms-item">
            <el-input v-model="editForm.other_clauses" type="textarea" :rows="4" placeholder="其他条款内容" />
          </div>
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
import { onMounted, reactive, ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Printer, Download, Close } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { listOrders, getOrder, updateOrder } from '@/api/orders'
import { listSamples, getSample, updateSample } from '@/api/samples'
import { listSuppliers, getSupplier } from '@/api/suppliers'
import { getCompanySettings } from '@/api/companySettings'
import { formatMoney, numberToChineseRMB, printDocument, exportExcel } from '@/utils/docUtils'

const userStore = useUserStore()
// 合同维护权限：跟单(5)只读，仅主管及以上可编辑
const canMaintain = userStore.permissionLevel <= 2

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

// 三、质量要求与检测 / 六、其他条款 默认模板（多行文本，可自由编辑）
const QUALITY_NOTES_DEFAULT = [
  '1. 乙方需按上述规格参数生产，产品需符合《电子秤通用技术规范》（GB/T 7722-2017），且满足防水、称重精准等核心功能要求；',
  '2. 乙方需对所有样品进行全检（含功能测试、外观检查），确保"检测没问题"后再打包，甲方有权抽检，若发现不合格品，乙方需免费更换；',
  '3. 样品需附带产品合格检测报告（每台对应检测记录）。'
].join('\n')
const OTHER_CLAUSES_DEFAULT = [
  '1. 本合同一式两份，甲乙双方各执一份，签字盖章后生效；',
  '2. 未尽事宜，双方协商解决；协商不成的，向永康人民法院提起诉讼。'
].join('\n')

// 旧数据兼容：历史合同存的是 quality_req_1/2/3、other_clause_1/2 编号字段，合并为多行文本
function legacyQualityNotes(obj = {}) {
  const vals = [obj.quality_req_1, obj.quality_req_2, obj.quality_req_3].filter(v => v && String(v).trim())
  return vals.map((v, i) => `${i + 1}. ${v}`).join('\n')
}
function legacyOtherClauses(obj = {}) {
  const vals = [obj.other_clause_1, obj.other_clause_2].filter(v => v && String(v).trim())
  return vals.map((v, i) => `${i + 1}. ${v}`).join('\n')
}
// 当前供应商的收款资料路线库（供收款方式下拉用）
const supplierBankInfo = reactive({ routes: [] })

// 收款方式下拉选项：取供应商收款资料中的路线类型（去重）
const paymentRouteOptions = computed(() => {
  const seen = new Set()
  return supplierBankInfo.routes.filter(r => {
    const type = (r.route_type || '').trim()
    if (!type || seen.has(type)) return false
    seen.add(type)
    return true
  })
})

// 选择收款方式后，把该路线的路由备注带出（随合同一起保存）
function onPaymentRouteChange(routeType) {
  const route = supplierBankInfo.routes.find(r => (r.route_type || '').trim() === routeType)
  editForm.value.payment_routing_note = route ? (route.routing_note || '') : ''
}

// 加载指定供应商的收款资料路线库（el-select 数据源），返回供应商详情
async function loadSupplierBankInfo(supplierId) {
  supplierBankInfo.routes = []
  if (!supplierId) return null
  try {
    const s = await getSupplier(supplierId)
    supplierBankInfo.routes = (s.bank_accounts || []).filter(r => r && (r.route_type || '').trim())
    return s
  } catch { return null }
}

// 预览
const previewVisible = ref(false)
const previewHtml = ref('')
const currentOrder = ref(null)

// 编辑
const editVisible = ref(false)
const editFormRef = ref()
const editForm = ref({})
const editItems = ref([])
const editingOrderId = ref(null)
const editingRefType = ref('order')

// 编辑区采购总额（数量小计 + 金额小计）
const editTotalQty = computed(() => editItems.value.reduce((s, it) => s + Number(it.qty || 0), 0))
const editUnit = computed(() => editItems.value.find(it => it.unit)?.unit || '台')
const editTotalAmount = computed(() => editItems.value.reduce((s, it) => s + Number(it.qty || 0) * Number(it.cost_cny || 0), 0))

// 选择乙方时自动回填乙方信息（信用代码/地址）
// 始终拉取最新供应商详情，确保信用代码等字段为最新值
// 同时加载收款资料路线库到 supplierBankInfo（供收款方式下拉用）
async function onSupplierChange(supplierId) {
  const detail = await loadSupplierBankInfo(supplierId)
  const s = supplierOptions.value.find(x => x.id === supplierId) || {}
  if (!detail && !s.id) return
  if (!editForm.value.supplier_name) editForm.value.supplier_name = s.name || detail?.name || ''
  if (!editForm.value.supplier_credit_code) editForm.value.supplier_credit_code = detail?.credit_code || s.credit_code || ''
  if (!editForm.value.supplier_address) editForm.value.supplier_address = detail?.factory_address || s.factory_address || ''
  // 切换供应商后，原收款方式若不在新供应商的收款资料中则清空
  if (editForm.value.payment_route_type &&
      !supplierBankInfo.routes.some(r => (r.route_type || '').trim() === editForm.value.payment_route_type)) {
    editForm.value.payment_route_type = ''
    editForm.value.payment_routing_note = ''
  }
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
function contractNo(row) {
  // 子合同行：直接返回子合同编号
  if (row.is_sub && row.sub_contract) return row.sub_contract.contract_no
  const pc = parseDoc(row.purchase_contract)
  const refNo = row.ref_number || row.pi_number || row.sample_number || ''
  return pc.contract_no || (refNo ? refNo + 'GX' : '—')
}
function supplierName(row) {
  if (row.supplier_name) return row.supplier_name
  // 单供应商样品单：回退到合同 JSON 中的 supplier_name
  const pc = parseDoc(row.purchase_contract)
  if (pc.supplier_name) return pc.supplier_name
  if (row.is_sub && row.sub_contract?.supplier_name) return row.sub_contract.supplier_name
  const sid = row.supplier_id || pc.supplier_id
  if (sid) {
    const s = supplierOptions.value.find(x => x.id === sid)
    if (s) return s.name
  }
  return ''
}

/* ========== 数据加载（合并外销订单 + 样品单，构造子合同树） ========== */
async function loadList() {
  loading.value = true
  try {
    // 1. 外销订单：客户自行报关 + 我司代办报关（都生成购销合同）
    const d = await listOrders({ page: 1, pageSize: 500 })
    const orderList = (d.list || [])
      .filter((o) => o.customs_responsibility !== '请选择')
      .map((o) => ({ ...o, ref_type: 'order', ref_number: o.pi_number }))
    // 2. 样品单：全部（默认按客户自行报关逻辑生成购销合同）
    const ds = await listSamples({ page: 1, pageSize: 500 })
    const sampleList = (ds.list || []).map((s) => ({ ...s, ref_type: 'sample', ref_number: s.sample_number }))
    // 3. 合并：按创建时间倒序
    const merged = [...orderList, ...sampleList].sort((a, b) => {
      const ta = new Date(a.created_at || a.signing_date || 0).getTime()
      const tb = new Date(b.created_at || b.signing_date || 0).getTime()
      return tb - ta
    })
    // 4. 构造树形：多供应商订单生成子合同虚拟行
    list.value = merged.map((row) => {
      const pc = parseDoc(row.purchase_contract)
      const rowKey = `${row.ref_type}-${row.id || row.ref_number}`
      const subs = Array.isArray(pc.sub_contracts) ? pc.sub_contracts : []
      if (subs.length > 0) {
        return {
          ...row,
          rowKey,
          is_parent: true,
          children: subs.map((sc, i) => ({
            ...row,
            rowKey: `${rowKey}-sub-${i}`,
            is_sub: true,
            sub_contract: sc,
            supplier_id: sc.supplier_id,
            supplier_name: sc.supplier_name,
            sub_index: i
          }))
        }
      }
      // 单供应商：从合同 JSON 补充供应商信息（样品单表 JOIN 无供应商时回退）
      return {
        ...row,
        rowKey,
        supplier_id: row.supplier_id || pc.supplier_id || null,
        supplier_name: row.supplier_name || pc.supplier_name || ''
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

/* ========== 预览：生成购销合同 HTML（严格对照参考项目模板） ========== */
async function openPreview(row) {
  try {
    // 根据来源类型拉取完整详情
    const detail = row.ref_type === 'sample'
      ? await getSample(row.id)
      : await getOrder(row.id)
    // 样品单没有 pi_number，统一用 ref_number 用于 HTML 模板
    currentOrder.value = { ...detail, ref_number: row.ref_number, ref_type: row.ref_type }
    const company = companySettings.value || {}
    const supplier = supplierOptions.value.find(s => s.id === detail.supplier_id) || {}
    // 子合同行：传入 sub_contract 用于过滤明细和替换乙方信息
    const subContract = row.is_sub ? row.sub_contract : null
    previewHtml.value = buildContractHtml(currentOrder.value, company, supplier, subContract)
    previewVisible.value = true
  } catch { /* 拦截器 */ }
}

function buildContractHtml(order, company, supplier, subContract) {
  const pc = parseDoc(order.purchase_contract)
  let items = order.items || []
  // 子合同预览：优先用 product_ids 快照过滤（归类后固定，不受产品库 supplier_id 变化影响）
  // 大合同（subContract 为 null）则关联全部产品
  if (subContract) {
    const pids = Array.isArray(subContract.product_ids) ? subContract.product_ids.filter(Boolean) : []
    if (pids.length > 0) {
      const idSet = new Set(pids.map(id => Number(id)))
      items = items.filter(it => idSet.has(Number(it.product_id)))
    } else if (subContract.supplier_id !== null && subContract.supplier_id !== undefined) {
      // 旧数据无 product_ids 快照时回退按 supplier_id 过滤
      const sid = Number(subContract.supplier_id)
      items = items.filter(it => Number(it.product_supplier_id) === sid)
    } else {
      // supplier_id 也为空：只显示自定义产品
      items = items.filter(it => !it.product_id)
    }
  }
  // 采购总额 = Σ(数量 × 单价)
  const cnyTotal = items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.cost_cny || 0), 0)
  const totalQty = items.reduce((s, it) => s + Number(it.qty || 0), 0)
  const contractNo = subContract?.contract_no || pc.contract_no || ((order.ref_number || order.pi_number || '') + 'GX')
  const signDate = (subContract?.sign_date || pc.sign_date || order.signing_date || '').slice(0, 10)

  // 甲方信息：优先取合同保存值，回退 companySettings
  const buyerName = pc.buyer_name || company.name_cn || ''
  const buyerCreditCode = pc.buyer_credit_code || company.tax_number || ''
  const buyerAddress = pc.buyer_address || company.address_cn || ''
  // 乙方信息：子合同优先，回退主合同，再回退 supplier
  const supplierNameVal = subContract?.supplier_name || pc.supplier_name || supplier.name || ''
  const supplierCreditCode = subContract?.supplier_credit_code || pc.supplier_credit_code || supplier.credit_code || ''
  const supplierAddressVal = subContract?.supplier_address || pc.supplier_address || supplier.factory_address || ''

  // 文档字段统一来源：子合同优先，回退主合同
  const doc = subContract || pc
  // 质量要求/其他条款：多行文本字段，旧数据回退合并编号字段
  const qualityNotesText = doc.quality_notes || legacyQualityNotes(doc) || QUALITY_NOTES_DEFAULT
  const otherClausesText = doc.other_clauses || legacyOtherClauses(doc) || OTHER_CLAUSES_DEFAULT

  // 商品行：产品型号优先用 supplier_model(our_model)，回退 model
  const itemRows = items.map((it, idx) => {
    const model = it.supplier_model || it.model || ''
    const qty = Number(it.qty || 0)
    const unit = it.unit || '台'
    const price = Number(it.cost_cny || 0)
    const subtotal = qty * price
    return `<tr><td style="border:0.5px solid #999; padding:6px 8px; text-align:center;">${idx + 1}</td><td style="border:0.5px solid #999; padding:6px 8px;">${model}</td><td style="border:0.5px solid #999; padding:6px 8px; text-align:right;">${formatMoney(price)}</td><td style="border:0.5px solid #999; padding:6px 8px; text-align:right;">${qty}</td><td style="border:0.5px solid #999; padding:6px 8px; text-align:center;">${unit}</td><td style="border:0.5px solid #999; padding:6px 8px; text-align:right; font-weight:bold;">${formatMoney(subtotal)}</td></tr>`
  }).join('')

  const contractSeal = company.contract_seal_img || ''

  return `
    <div style="font-family:'SimSun','宋体',serif; color:#000;">
    <div style="text-align:center; font-size:22px; font-weight:bold; margin:0 0 24px;">采购合同</div>
    <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:20px;">
      <span>合同编号：${contractNo}</span>
      <span>签订日期：${signDate}</span>
    </div>

    <div style="font-size:14px; line-height:1.6; margin-bottom:10px;">
      <div style="font-weight:bold; margin-bottom:6px;">一、合同双方</div>
      <div style="display:flex; gap:32px;">
        <div style="flex:1;">
          <div>采购方（甲方）：${buyerName}</div>
          <div>统一社会信用代码：${buyerCreditCode}</div>
          <div>地址：${buyerAddress}</div>
        </div>
        <div style="flex:1;">
          <div>供应方（乙方）：${supplierNameVal}</div>
          <div>统一社会信用代码：${supplierCreditCode}</div>
          <div>地址：${supplierAddressVal}</div>
        </div>
      </div>
    </div>

    <div style="font-size:14px; font-weight:bold; margin:16px 0 8px;">二、采购产品明细</div>
    <table style="width:100%; border-collapse:collapse; font-size:13px;">
      <thead><tr>
        <th style="border:0.5px solid #999; padding:6px 8px; text-align:center; width:50px; background:#fff;">序号</th>
        <th style="border:0.5px solid #999; padding:6px 8px; text-align:center; background:#fff;">产品型号</th>
        <th style="border:0.5px solid #999; padding:6px 8px; text-align:center; width:120px; background:#fff;">单价（元）</th>
        <th style="border:0.5px solid #999; padding:6px 8px; text-align:center; width:80px; background:#fff;">数量</th>
        <th style="border:0.5px solid #999; padding:6px 8px; text-align:center; width:70px; background:#fff;">单位</th>
        <th style="border:0.5px solid #999; padding:6px 8px; text-align:center; width:130px; background:#fff;">小计（元）</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot><tr>
        <td colspan="2" style="border:0.5px solid #999; padding:6px 8px; text-align:right; font-weight:bold;">总计</td>
        <td style="border:0.5px solid #999; padding:6px 8px;"></td>
        <td style="border:0.5px solid #999; padding:6px 8px; text-align:right; font-weight:bold;">${totalQty}</td>
        <td style="border:0.5px solid #999; padding:6px 8px; text-align:center; font-weight:bold;">${items[0]?.unit || ''}</td>
        <td style="border:0.5px solid #999; padding:6px 8px; text-align:right; font-weight:bold;">${formatMoney(cnyTotal)}</td>
      </tr></tfoot>
    </table>
    <div style="font-size:14px; margin-top:8px; font-weight:bold;">合计人民币（大写）：${numberToChineseRMB(cnyTotal)}</div>

    <div style="font-size:14px; line-height:1.6; margin-top:12px;">
      <div style="font-weight:bold; margin-bottom:4px;">三、质量要求与检测</div>
      <div style="white-space:pre-wrap;">${qualityNotesText}</div>
    </div>

    <div style="font-size:14px; line-height:1.6; margin-top:12px;">
      <div style="font-weight:bold; margin-bottom:4px;">四、交货条款</div>
      <div>1. 交货地点：${doc.delivery_location || ''}</div>
      <div>2. 交货时间：${doc.delivery_time || ''}</div>
      <div>3. 包装要求：${doc.packing_req || ''}</div>
    </div>

    <div style="font-size:14px; line-height:1.6; margin-top:12px;">
      <div style="font-weight:bold; margin-bottom:4px;">五、结算条款</div>
      ${doc.payment_routing_note ? `<div style="white-space:pre-wrap;">${doc.payment_routing_note}</div>` : ''}
    </div>

    <div style="font-size:14px; line-height:1.6; margin-top:12px;">
      <div style="font-weight:bold; margin-bottom:4px;">六、其他条款</div>
      <div style="white-space:pre-wrap;">${otherClausesText}</div>
    </div>

    <div style="display:flex; justify-content:space-between; font-size:14px; margin-top:24px;">
      <div style="position:relative;">
        <div>采购方（甲方）签字盖章：</div>
        ${contractSeal ? `<img src="${contractSeal}" style="position:absolute; top:11px; right:-10px; max-height:260px; width:100%; opacity:0.85; pointer-events:none; transform:translateY(-50%);" />` : ''}
        <div style="margin-top:24px;">日期：________________</div>
      </div>
      <div>
        <div>供应方（乙方）签字盖章：</div>
        <div style="margin-top:24px;">日期：________________</div>
      </div>
    </div>
    </div>
  `
}

function onPrint() {
  printDocument(previewHtml.value, '采购合同 - ' + (currentOrder.value?.ref_number || currentOrder.value?.pi_number || ''))
}
function onExportExcel() {
  exportExcel(previewHtml.value, '采购合同_' + (currentOrder.value?.ref_number || currentOrder.value?.pi_number || 'export') + '.xls')
}

/* ========== 编辑（与订单明细/预览联动，仿参考项目 savePurchaseContractData） ========== */
// 把指定子合同的字段加载到 editForm 顶层（便于复用现有表单绑定）
async function loadSubContractToForm(idx) {
  const sc = editForm.value.sub_contracts[idx]
  if (!sc) return
  // 子合同字段覆盖顶层（保留 buyer_* 甲方信息不变，因为甲方是同一家）
  editForm.value.contract_no = sc.contract_no || editForm.value.contract_no
  editForm.value.supplier_id = sc.supplier_id || editForm.value.supplier_id
  editForm.value.supplier_name = sc.supplier_name || ''
  editForm.value.supplier_credit_code = sc.supplier_credit_code || ''
  editForm.value.supplier_address = sc.supplier_address || ''
  editForm.value.sign_date = (sc.sign_date || editForm.value.sign_date || '').slice(0, 10)
  editForm.value.quality_notes = sc.quality_notes || legacyQualityNotes(sc) || editForm.value.quality_notes
  editForm.value.delivery_location = sc.delivery_location || editForm.value.delivery_location
  editForm.value.delivery_time = sc.delivery_time || editForm.value.delivery_time
  editForm.value.packing_req = sc.packing_req || editForm.value.packing_req
  editForm.value.payment_route_type = sc.payment_route_type || ''
  editForm.value.payment_routing_note = sc.payment_routing_note || ''
  editForm.value.other_clauses = sc.other_clauses || legacyOtherClauses(sc) || editForm.value.other_clauses
  // 同步加载子合同供应商的收款资料路线库（收款方式下拉用）
  if (sc.supplier_id) await loadSupplierBankInfo(sc.supplier_id)
}

// 按子合同过滤明细行（用于子合同编辑时只显示该供应商的产品）
// 优先用 product_ids 快照（归类后固定），无快照时回退 supplier_id
function filterItemsBySub(allItems, subContract) {
  let filtered
  if (!subContract) {
    // 大合同：关联全部产品
    filtered = allItems || []
  } else {
    const pids = Array.isArray(subContract.product_ids) ? subContract.product_ids.filter(Boolean) : []
    if (pids.length > 0) {
      const idSet = new Set(pids.map(id => Number(id)))
      filtered = (allItems || []).filter(it => idSet.has(Number(it.product_id)))
    } else if (subContract.supplier_id !== null && subContract.supplier_id !== undefined) {
      // 旧数据无 product_ids 快照时回退按 supplier_id 过滤
      const sid = Number(subContract.supplier_id)
      filtered = (allItems || []).filter(it => Number(it.product_supplier_id) === sid)
    } else {
      // supplier_id 也为空：只显示自定义产品
      filtered = (allItems || []).filter(it => !it.product_id)
    }
  }
  editItems.value = filtered.map(it => ({
    ...it,
    supplier_model: it.supplier_model || it.model || '',
    qty: Number(it.qty || 0),
    unit: it.unit || '台',
    cost_cny: it.cost_cny === null || it.cost_cny === undefined || it.cost_cny === ''
      ? Number(it.product_purchase_cost || 0)
      : Number(it.cost_cny)
  }))
}

// 切换子合同时重新加载字段和明细（需保留 detail.items 缓存以过滤）
const detailItemsCache = ref([])
watch(() => editForm.value.active_sub_index, (idx) => {
  if (idx === null || idx === undefined) return
  loadSubContractToForm(idx)
  filterItemsBySub(detailItemsCache.value, editForm.value.sub_contracts[idx])
})

async function openEdit(row) {
  try {
    const detail = row.ref_type === 'sample'
      ? await getSample(row.id)
      : await getOrder(row.id)
    editingOrderId.value = row.id
    editingRefType.value = row.ref_type
    const refNo = row.ref_number || detail.pi_number || detail.sample_number || ''
    const pc = parseDoc(detail.purchase_contract)
    const co = companySettings.value || {}
    const supplierOpt = supplierOptions.value.find(s => s.id === detail.supplier_id) || {}
    // 拉取最新供应商详情（含 credit_code / contacts 等完整字段），确保信用代码为最新值
    let supplier = supplierOpt
    if (detail.supplier_id) {
      try { supplier = await getSupplier(detail.supplier_id) } catch { /* 回退 supplierOptions */ }
      // 同步加载供应商收款资料路线库（收款方式下拉用）
      await loadSupplierBankInfo(detail.supplier_id)
    }
    editForm.value = {
      contract_no: pc.contract_no || (refNo + 'GX'),
      sign_date: (pc.sign_date || detail.signing_date || '').slice(0, 10),
      // 一、合同双方
      buyer_name: pc.buyer_name || co.name_cn || '',
      buyer_credit_code: pc.buyer_credit_code || co.tax_number || '',
      buyer_address: pc.buyer_address || co.address_cn || '',
      supplier_id: detail.supplier_id,
      supplier_name: pc.supplier_name || supplier.name || '',
      supplier_credit_code: pc.supplier_credit_code || supplier.credit_code || '',
      supplier_address: pc.supplier_address || supplier.factory_address || '',
      // 三、质量要求与检测（多行文本，旧数据回退合并编号字段）
      quality_notes: pc.quality_notes || legacyQualityNotes(pc) || QUALITY_NOTES_DEFAULT,
      // 四、交货条款
      delivery_location: pc.delivery_location || '甲方指定地址',
      delivery_time: pc.delivery_time || '合同签订后30天内',
      packing_req: pc.packing_req || '采用出口标准包装（防水、防摔），外箱标注"样品""易碎"标识。',
      // 五、结算条款（收款方式：供应方收款资料路线库）
      payment_route_type: pc.payment_route_type || '',
      payment_routing_note: pc.payment_routing_note || '',
      // 六、其他条款（多行文本，旧数据回退合并编号字段）
      other_clauses: pc.other_clauses || legacyOtherClauses(pc) || OTHER_CLAUSES_DEFAULT,
      // 子合同数组（多供应商拆分时使用）
      sub_contracts: Array.isArray(pc.sub_contracts) ? pc.sub_contracts : [],
      active_sub_index: null
    }
    // 多供应商：缓存明细用于子合同切换时重新过滤
    detailItemsCache.value = detail.items || []
    if (row.is_sub && row.sub_contract && row.sub_index !== undefined) {
      // 子合同模式：加载用户点击的子合同，并按其 product_ids/supplier_id 过滤明细
      editForm.value.active_sub_index = row.sub_index
      loadSubContractToForm(row.sub_index)
      filterItemsBySub(detail.items || [], row.sub_contract)
    } else if (editForm.value.sub_contracts.length > 0) {
      // 大合同模式：关联全部产品，子合同选择器可选切换
      editForm.value.active_sub_index = null
      editItems.value = (detail.items || []).map(it => ({
        ...it,
        supplier_model: it.supplier_model || it.model || '',
        qty: Number(it.qty || 0),
        unit: it.unit || '台',
        cost_cny: it.cost_cny === null || it.cost_cny === undefined || it.cost_cny === ''
          ? Number(it.product_purchase_cost || 0)
          : Number(it.cost_cny)
      }))
    } else {
      // 单供应商：明细全部显示
      editItems.value = (detail.items || []).map(it => ({
        ...it,
        supplier_model: it.supplier_model || it.model || '',
        qty: Number(it.qty || 0),
        unit: it.unit || '台',
        cost_cny: it.cost_cny === null || it.cost_cny === undefined || it.cost_cny === ''
          ? Number(it.product_purchase_cost || 0)
          : Number(it.cost_cny)
      }))
    }
    editVisible.value = true
  } catch { /* 拦截器 */ }
}

function addItemRow() {
  editItems.value.push({
    product_id: null, model: '', supplier_model: '', name_en: '', hs_code: '', unit: '台',
    img_url: null, spec: null, pcs_per_ctn: null, ctns: null, qty: 0,
    price: 0, cost_cny: 0, subtotal_amount: 0,
    nw_per_ctn: null, gw_per_ctn: null, cbm_per_ctn: null
  })
}

async function onSave() {
  if (!editForm.value.contract_no) return ElMessage.warning('请填写购销合同编号')
  if (!editForm.value.supplier_id) return ElMessage.warning('请选择供应方（乙方）')
  if (editItems.value.length === 0) return ElMessage.warning('请至少保留一行采购商品')

  saving.value = true
  try {
    // 联动重算：合同明细独立用 cost_cny（采购价）算 subtotal，并同步到 price
    const items = editItems.value.map(it => {
      const qty = Number(it.qty || 0)
      const pcs = Number(it.pcs_per_ctn || 0)
      // 产品型号：supplier_model（供应商型号）优先，空则用自编号 model，都空留空让后端也能保存
      const model = it.supplier_model || it.model || ''
      // 单价：cost_cny（采购价）优先，price（外销价）回退
      const price = Number(it.cost_cny || it.price || 0)
      const row = { ...it, model, qty, price, cost_cny: price }
      if (pcs > 0) row.ctns = Math.ceil(qty / pcs)
      row.subtotal_amount = Number((qty * price).toFixed(2))
      return row
    })
    const totalAmount = Number(items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.price || 0), 0).toFixed(2))

    // 找到乙方对象，回写乙方名称到合同 JSON
    const supplier = supplierOptions.value.find(s => s.id === editForm.value.supplier_id) || {}

    // 构造合同字段对象（顶层）
    const pcFields = {
      contract_no: editForm.value.contract_no,
      sign_date: editForm.value.sign_date,
      buyer_name: editForm.value.buyer_name,
      buyer_credit_code: editForm.value.buyer_credit_code,
      buyer_address: editForm.value.buyer_address,
      supplier_name: editForm.value.supplier_name || supplier.name || '',
      supplier_credit_code: editForm.value.supplier_credit_code,
      supplier_address: editForm.value.supplier_address,
      quality_notes: editForm.value.quality_notes,
      delivery_location: editForm.value.delivery_location,
      delivery_time: editForm.value.delivery_time,
      packing_req: editForm.value.packing_req,
      payment_route_type: editForm.value.payment_route_type,
      payment_routing_note: editForm.value.payment_routing_note,
      other_clauses: editForm.value.other_clauses
    }

    // 多供应商：把当前顶层字段同步回 sub_contracts[active_sub_index]
    const subs = editForm.value.sub_contracts || []
    const activeIdx = editForm.value.active_sub_index
    if (subs.length > 0 && activeIdx !== null && activeIdx !== undefined && subs[activeIdx]) {
      Object.assign(subs[activeIdx], pcFields, {
        contract_no: editForm.value.contract_no,
        supplier_id: editForm.value.supplier_id,
        supplier_name: editForm.value.supplier_name || supplier.name || ''
      })
    }

    await (editingRefType.value === 'sample' ? updateSample : updateOrder)(editingOrderId.value, {
      supplier_id: editForm.value.supplier_id,
      purchase_contract: {
        ...pcFields,
        is_parent: subs.length > 0,
        sub_contracts: subs
      },
      items,
      total_amount: totalAmount
    })
    ElMessage.success('采购合同已保存，订单明细与单据预览已同步更新')
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
.sub-text { font-size: 11px; color: #94a3b8; margin-top: 2px; }

.doc-toolbar { display: flex; gap: 8px; margin-bottom: 10px; }
.doc-page { background: white; padding: 35px 40px; font-size: 11px; color: #0f172a; line-height: 1.5; border: 1px solid #cbd5e1; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.doc-page table { font-size: 11px; margin: 10px 0; width: 100%; border-collapse: collapse; }
.doc-page th, .doc-page td { border: 1px solid #cbd5e1; padding: 6px 8px; }
.doc-page th { background: #f8fafc; }
.doc-badge-title { font-size: 15pt; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; color: #0f172a; }
.doc-title-section { text-align: center; margin: 12px 0; padding: 8px 0; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; }

/* 编辑弹窗：采购商品清单分区 */
.items-section { margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
.items-section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.items-section-header strong { font-size: 13px; }
.items-table { width: 100%; }
.items-total { display: flex; gap: 24px; align-items: center; margin-top: 10px; padding: 8px 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px; }

/* 编辑弹窗：合同双方分区 */
.party-section { margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
.section-title { font-size: 13px; color: #2563eb; display: block; margin-bottom: 8px; }

/* 编辑弹窗：条款设置分区 */
.terms-section { margin-top: 12px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; display: flex; flex-direction: column; gap: 10px; }
.terms-title { font-size: 13px; color: #2563eb; }
.terms-item { display: flex; gap: 8px; align-items: flex-start; }
.terms-item label { font-weight: 600; font-size: 12px; min-width: 20px; padding-top: 6px; }
.terms-item :deep(.el-textarea__inner) { font-size: 12px; }

@media print {
  :deep(.no-print) { display: none !important; }
  :deep(.el-dialog__header), :deep(.el-dialog__footer) { display: none !important; }
}
</style>
