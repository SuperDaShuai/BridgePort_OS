<template>
  <el-card shadow="never" class="page-card">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-input
        v-model="query.q"
        placeholder="搜索单号 / 客户"
        clearable
        style="width: 240px"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <el-select
        v-model="query.status"
        placeholder="全部状态"
        clearable
        style="width: 130px"
        @change="onSearch"
      >
        <el-option v-for="s in STATUSES" :key="s" :label="s" :value="s" />
      </el-select>
      <el-button :icon="Search" @click="onSearch">搜索</el-button>
      <div class="toolbar-right">
        <el-button type="primary" :icon="Plus" @click="openCreate">新增报价单</el-button>
      </div>
    </div>

    <!-- 列表 -->
    <el-table v-loading="loading" :data="list" border stripe>
      <el-table-column prop="quotation_number" label="报价单号" width="170">
        <template #default="{ row }">
          <strong style="color:#0f766e;">{{ row.quotation_number }}</strong>
        </template>
      </el-table-column>
      <el-table-column label="询价客户" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <strong>{{ row.client_name }}</strong>
        </template>
      </el-table-column>
      <el-table-column label="报价日期 / 有效期" width="170">
        <template #default="{ row }">
          <div>{{ row.quotation_date || '—' }}</div>
          <small style="color:#909399;">有效至: {{ row.valid_until || '—' }}</small>
        </template>
      </el-table-column>
      <el-table-column label="交期 / 付款方式" width="190">
        <template #default="{ row }">
          <small>{{ row.lead_time || '25-30 days' }}</small>
          <br>
          <small style="color:#909399;">{{ row.payment_terms || '—' }}</small>
        </template>
      </el-table-column>
      <el-table-column label="币种 / 价格条款" width="140" align="center">
        <template #default="{ row }">
          <el-tag size="small" type="warning" effect="plain">{{ row.currency || 'USD' }}</el-tag>
          <span style="margin-left:4px;">{{ row.price_terms || '—' }}</span>
        </template>
      </el-table-column>
      <!-- <el-table-column prop="item_count" label="产品种类" width="80" align="center" /> -->
      <el-table-column label="总金额" width="120" align="right">
        <template #default="{ row }">
          <strong style="color:#059669;">{{ row.currency === 'RMB' ? '¥' : '$' }}{{ formatMoney(row.total_amount) }}</strong>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.status" :type="statusTag[row.status] || 'info'" size="small">
            {{ row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作与流转" width="270" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="success" @click="onPreview(row)">📄 预览</el-button>
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button
            link
            type="warning"
            :disabled="row.status === '已转PI'"
            @click="onConvertToPi(row)"
          >⚡ 转PI</el-button>
          <el-button link type="danger" @click="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <el-pagination
      v-model:current-page="query.page"
      v-model:page-size="query.pageSize"
      class="pagination"
      :total="total"
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next"
      @change="loadList"
    />

    <!-- 新增/编辑报价单弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? '编辑报价单' : '新增报价单'"
      width="1150px"
      destroy-on-close
      top="5vh"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <!-- 基本信息 -->
        <div class="form-grid-4">
          <el-form-item label="报价单号" prop="quotation_number">
            <el-input v-model="form.quotation_number" placeholder="QT-YYYYMMDD-NNN" />
          </el-form-item>
          <el-form-item label="报价日期" prop="quotation_date">
            <el-date-picker v-model="form.quotation_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
          <el-form-item label="有效期至">
            <el-date-picker v-model="form.valid_until" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
          <el-form-item label="客户" prop="client_id">
            <el-select
              v-model="form.client_id"
              filterable
              placeholder="选择客户"
              style="width: 100%"
              @change="onClientChange"
            >
              <el-option v-for="c in clientOptions" :key="c.id" :label="c.name_en" :value="c.id">
                <span>{{ c.name_en }}</span>
                <span class="client-sub" v-if="c.country"> · {{ c.country }}</span>
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="采购供应商">
            <el-select
              v-model="form.supplier_id"
              filterable
              clearable
              placeholder="选择供应商"
              style="width: 100%"
            >
              <el-option v-for="s in supplierOptions" :key="s.id" :label="s.name" :value="s.id" />
            </el-select>
          </el-form-item>
        </div>

        <div class="form-grid-6">
          <el-form-item label="结算币种" prop="currency">
            <el-select v-model="form.currency" style="width: 100%">
              <el-option value="USD" label="USD ($)" />
              <el-option value="RMB" label="RMB (¥)" />
            </el-select>
          </el-form-item>
          <el-form-item label="价格条款" prop="price_terms">
            <el-select v-model="form.price_terms" style="width: 100%">
              <el-option value="FOB" label="FOB" />
              <el-option value="CIF" label="CIF" />
              <el-option value="CFR" label="CFR" />
              <el-option value="EXW" label="EXW" />
              <el-option value="DDP" label="DDP" />
            </el-select>
          </el-form-item>
          <el-form-item label="交货周期">
            <el-input v-model="form.lead_time" placeholder="如: 25-30 days after deposit" />
          </el-form-item>
          <el-form-item label="付款方式">
            <el-select
              v-model="form.payment_terms"
              filterable allow-create clearable
              default-first-option
              placeholder="选择或输入付款方式"
              style="width: 100%"
            >
              <el-option v-for="t in paymentTermOptions" :key="t.id" :label="t.term_text" :value="t.term_text" />
            </el-select>
          </el-form-item>
          <el-form-item label="装运港口">
            <el-input v-model="form.loading_port" placeholder="如: Ningbo, China" />
          </el-form-item>
          <el-form-item label="目的港口">
            <el-input v-model="form.destination_port" placeholder="选择客户后自动填充" />
          </el-form-item>
        </div>

        <!-- 报价产品明细 -->
        <el-divider content-position="left">
          <div class="divider-title">
            报价产品明细
            <el-button type="primary" size="small" plain :icon="Plus" @click="addItemRow">+ 添加报价商品</el-button>
          </div>
        </el-divider>

        <el-table :data="form.items" border size="small" class="items-table">
          <el-table-column type="index" label="No." width="40" align="center" />

          <el-table-column label="Art No." width="150">
            <template #default="{ row }">
              <el-select
                v-model="row.product_id"
                filterable
                clearable
                placeholder="选择产品"
                size="small"
                style="width: 100%"
                @change="(val) => onProductPick(row, val)"
              >
                <el-option
                  v-for="p in productOptions"
                  :key="p.id"
                  :label="p.model"
                  :value="p.id"
                />
              </el-select>
            </template>
          </el-table-column>

          <el-table-column label="Item Photo" width="70" align="center">
            <template #default="{ row }">
              <el-image
                v-if="row.img_url"
                :src="row.img_url"
                fit="contain"
                style="width: 48px; height: 48px; border-radius: 4px; border: 1px solid #e4e7ed;"
                :preview-src-list="[row.img_url]"
                preview-teleported
              />
              <div v-else class="no-photo">—</div>
            </template>
          </el-table-column>

          <el-table-column label="Specification" min-width="220">
            <template #default="{ row }">
              <el-input
                v-model="row.spec"
                type="textarea"
                :rows="3"
                size="small"
                style="font-size: 11px; line-height: 1.4;"
              />
            </template>
          </el-table-column>

          <el-table-column label="Packing" min-width="200">
            <template #default="{ row }">
              <el-input
                v-model="row.packing_desc"
                type="textarea"
                :rows="3"
                size="small"
                style="font-size: 10px; line-height: 1.3;"
              />
            </template>
          </el-table-column>
          <el-table-column label="数量(箱)" width="95" align="center">
            <template #default="{ row }">
              <el-input-number
                v-model="row.moq"
                :min="0"
                :controls="false"
                size="small"
                style="width: 100%"
                @change="calcQuoteRow(row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="单价" width="100" align="center">
            <template #default="{ row }">
              <el-input-number
                v-model="row.price"
                :min="0"
                :step="0.01"
                :controls="false"
                size="small"
                style="width: 100%"
                @change="calcQuoteRow(row)"
              />
            </template>
          </el-table-column>

          <el-table-column label="合计" width="160" align="center">
            <template #default="{ row }">
              <div class="calc-info" v-if="row.moq && row.pcs_per_ctn">
                <div class="ci-line"><span class="ci-label">数量:</span> {{ (row.moq * row.pcs_per_ctn).toLocaleString() }} PCS</div>
                <div class="ci-line"><span class="ci-label">金额:</span> {{ row.currency || form.currency === 'RMB' ? '¥' : '$' }}{{ formatMoney((row.moq || 0) * (row.pcs_per_ctn || 0) * (row.price || 0)) }}</div>
                <div class="ci-line"><span class="ci-label">毛重:</span> {{ ((row.moq || 0) * (row.gw_per_ctn || 0)).toFixed(1) }} kg</div>
                <div class="ci-line"><span class="ci-label">体积:</span> {{ ((row.moq || 0) * (row.cbm_per_ctn || 0)).toFixed(3) }} cbm</div>
              </div>
              <div v-else class="load-qty-empty">—</div>
            </template>
          </el-table-column>

          <el-table-column label="操作" width="50" align="center" fixed="right">
            <template #default="{ $index }">
              <el-button link type="danger" size="small" @click="form.items.splice($index, 1)">✕</el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 备注条款 -->
        <div class="remark-block">
          <el-form-item label="备注条款" class="remark-label">
            <el-input
              v-model="form.remark"
              type="textarea"
              :rows="4"
              placeholder="REMARK: 贸易条款补充说明、仲裁条款等"
            />
          </el-form-item>
        </div>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取 消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保 存</el-button>
      </template>
    </el-dialog>

    <!-- ========== 报价单预览弹窗 ========== -->
    <el-dialog
      v-model="previewVisible"
      :title="`QUOTATION - ${previewData?.quotation_number || ''}`"
      width="1000px"
      destroy-on-close
      top="5vh"
      class="quote-preview-dialog"
    >
      <div class="preview-toolbar">
        <el-button type="success" :disabled="previewData?.status === '已转PI'" @click="onConvertToPi(previewData, true)">
          ⚡ 转为正式 PI
        </el-button>
        <el-button @click="onPrintPreview">🖨️ 打印 / 另存为 PDF</el-button>
      </div>
      <div ref="previewContentRef" class="doc-page" v-html="previewHtml"></div>
      <template #footer>
        <el-button @click="previewVisible = false">关 闭</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { onMounted, reactive, ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import {
  listQuotations, getQuotation, createQuotation, updateQuotation, deleteQuotation,
  getNextQuotationNumber, convertQuotationToOrder
} from '@/api/quotations'
import { listClients } from '@/api/clients'
import { listProducts } from '@/api/products'
import { listSuppliers } from '@/api/suppliers'
import { getCompanySettings } from '@/api/companySettings'
import { listPaymentTerms } from '@/api/paymentTerms'

const router = useRouter()

const STATUSES = ['草稿', '已发送', '已接受', '已失效', '已转PI']
const CURRENCIES = { USD: 'USD ($)', RMB: 'RMB (¥)' }
const statusTag = {
  草稿: 'info', 已发送: 'primary', 已接受: 'success',
  已失效: 'danger', 已转PI: 'warning'
}

const loading = ref(false)
const saving = ref(false)
const list = ref([])
const total = ref(0)
const clientOptions = ref([])
const productOptions = ref([])
const supplierOptions = ref([])
const paymentTermOptions = ref([])
const companySettings = ref({})
const query = reactive({ q: '', status: '', page: 1, pageSize: 10 })

const dialogVisible = ref(false)
const formRef = ref()
const form = ref({})

// 报价单预览
const previewVisible = ref(false)
const previewData = ref(null)
const previewHtml = ref('')
const previewContentRef = ref(null)
// 转PI 进行中标记
const converting = ref(false)

// 金额格式化
function formatMoney(v) {
  return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
const rules = {
  quotation_number: [{ required: true, message: '报价单号不能为空', trigger: 'blur' }],
  quotation_date: [{ required: true, message: '请选择报价日期', trigger: 'change' }],
  client_id: [{ required: true, message: '请选择客户', trigger: 'change' }],
  currency: [{ required: true, message: '请选择结算币种', trigger: 'change' }],
  price_terms: [{ required: true, message: '请选择价格条款', trigger: 'change' }]
}

const blankForm = () => ({
  quotation_number: '', quotation_date: '', valid_until: '', client_id: null, supplier_id: null,
  currency: 'USD', price_terms: 'FOB', lead_time: '', payment_terms: '',
  loading_port: '', destination_port: '', total_amount: undefined,
  status: '草稿', remark: '', items: []
})

const blankItem = () => ({
  product_id: null, model: '', name_en: '', hs_code: '', unit: '',
  img_url: '', spec: '', packing_desc: '',
  pcs_per_ctn: null, ctn_length: null, ctn_width: null, ctn_height: null,
  nw_per_ctn: null, gw_per_ctn: null, cbm_per_ctn: null,
  price: undefined, moq: undefined,
  est_qty_20gp: null, est_qty_40gp: null, est_qty_40hq: null,
  load_quantity_desc: ''
})

async function loadList() {
  loading.value = true
  try {
    const d = await listQuotations({ q: query.q, status: query.status, page: query.page, pageSize: query.pageSize })
    list.value = d.list
    total.value = d.total
  } catch { /* 拦截器已提示 */ }
  finally { loading.value = false }
}

async function loadOptions() {
  try {
    const [c, p, s, co, t] = await Promise.all([
      listClients({ page: 1, pageSize: 500 }),
      listProducts({ page: 1, pageSize: 500 }),
      listSuppliers({ page: 1, pageSize: 500 }),
      getCompanySettings().catch(() => ({})),
      listPaymentTerms().catch(() => ({ list: [] }))
    ])
    clientOptions.value = c.list
    productOptions.value = p.list
    supplierOptions.value = s.list
    companySettings.value = co || {}
    paymentTermOptions.value = t.list || []
  } catch { /* 拦截器已提示 */ }
}

// 客户变更 → 自动填充目的港
function onClientChange(clientId) {
  if (!clientId) { form.value.destination_port = ''; return }
  const c = clientOptions.value.find(x => x.id === clientId)
  if (c && c.destination_port) {
    form.value.destination_port = c.destination_port
  }
}

// 选择产品 → 完整快照填充
function onProductPick(row, productId) {
  row.product_id = productId
  const p = productOptions.value.find(x => x.id === productId)
  if (!p) return

  // 基础快照字段
  row.model = p.model
  row.name_en = p.name_en
  row.hs_code = p.hs_code
  row.unit = p.unit || '台'
  row.img_url = p.img_url || ''

  // 装箱与尺寸快照
  row.pcs_per_ctn = p.pcs_per_ctn ?? null
  row.ctn_length = p.ctn_length ?? null
  row.ctn_width = p.ctn_width ?? null
  row.ctn_height = p.ctn_height ?? null
  row.nw_per_ctn = p.net_weight_kg ?? null
  row.gw_per_ctn = p.gross_weight_kg ?? null
  row.cbm_per_ctn = p.ctn_cbm ?? null

  // 整柜装箱量快照
  row.est_qty_20gp = p.est_qty_20gp ?? null
  row.est_qty_40gp = p.est_qty_40gp ?? null
  row.est_qty_40hq = p.est_qty_40hq ?? null

  // 价格快照
  row.price = p.export_price_usd ?? undefined
  // 数量(箱) 默认 1 箱
  if (!row.moq) row.moq = 1
  calcQuoteRow(row)

  // Specification 多行框（产品英文名已在标题列以粗体单独展示，不再写入 spec 避免重复）
  const specLines = []
  if (p.spec) specLines.push(p.spec)
  if (p.hs_code) specLines.push('HS: ' + p.hs_code)
  row.spec = specLines.join('\n')

  // Packing 多行框（换行格式）
  const packingLines = []
  if (p.pcs_per_ctn) packingLines.push(p.pcs_per_ctn + ' PCS/CTN')
  if (p.ctn_length && p.ctn_width && p.ctn_height) {
    packingLines.push(`CTNS: ${p.ctn_length}x${p.ctn_width}x${p.ctn_height} cm`)
  }
  if (p.net_weight_kg || p.gross_weight_kg) {
    const parts = []
    if (p.net_weight_kg) parts.push('N.W. ' + p.net_weight_kg + ' kg')
    if (p.gross_weight_kg) parts.push('G.W. ' + p.gross_weight_kg + ' kg')
    packingLines.push(parts.join(' / '))
  }
  row.packing_desc = packingLines.join('\n')
}

function addItemRow() {
  form.value.items.push(blankItem())
}

// 报价行计算：moq(箱数) × pcs_per_ctn = 总数量, 总数量 × price = 金额
function calcQuoteRow(row) {
  // 触发响应式更新即可，合计列在模板里直接计算
  // 这里可做额外校验（如最小箱数等），目前只需触发刷新
  return row
}

function onSearch() { query.page = 1; loadList() }

async function openCreate() {
  form.value = blankForm()
  // 自动生成报价单号
  try {
    form.value.quotation_number = await getNextQuotationNumber()
  } catch { /* 后端也会兜底生成 */ }
  // 默认报价日期 = 今天
  form.value.quotation_date = new Date().toISOString().slice(0, 10)
  // 默认有效期 = 30 天后
  const d = new Date()
  d.setDate(d.getDate() + 30)
  form.value.valid_until = d.toISOString().slice(0, 10)
  // 默认装运港
  form.value.loading_port = 'Ningbo, China'
  // 默认交货周期 / 付款方式（取付款方式字典默认项）
  form.value.lead_time = '25-30 days after deposit'
  form.value.payment_terms =
    paymentTermOptions.value.find((t) => t.is_default)?.term_text
    || companySettings.value.payment_terms_template
    || '30% T/T Deposit, 70% Before Shipment'
  form.value.remark = 'REMARK: \n1. Prices are FOB Ningbo, China.\n2. Validity: 30 days from date of quotation.\n3. Lead time: 25-30 days after deposit received.\n4. Payment: 30% T/T deposit, 70% before shipment.\n5. Packing: standard neutral export cartons.\n6. All specifications are subject to final confirmation.'
  addItemRow()
  dialogVisible.value = true
}

async function openEdit(row) {
  const detail = await getQuotation(row.id)
  form.value = { ...detail, items: detail.items || [] }
  dialogVisible.value = true
}

async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  const items = (form.value.items || []).filter(it => it.model && it.price != null)
  if (items.length === 0) {
    ElMessage.warning('请至少添加一行产品明细（需选择产品并填写单价）')
    return
  }
  // 计算总金额：moq(箱数) × pcs_per_ctn(件/箱) × price(单价)
  form.value.total_amount = items.reduce((s, it) => {
    const ctns = Number(it.moq) || 0
    const pcs = Number(it.pcs_per_ctn) || 0
    return s + ctns * pcs * (Number(it.price) || 0)
  }, 0)

  saving.value = true
  try {
    if (form.value.id) {
      await updateQuotation(form.value.id, { ...form.value, items })
      ElMessage.success('更新成功')
    } else {
      await createQuotation({ ...form.value, items })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadList()
  } catch { /* 拦截器已提示 */ }
  finally { saving.value = false }
}

async function onDelete(row) {
  const ok = await ElMessageBox.confirm(
    `确认删除报价单「${row.quotation_number}」？明细将一并删除`,
    '删除确认', { type: 'warning' }
  ).catch(() => false)
  if (!ok) return
  try {
    await deleteQuotation(row.id)
    ElMessage.success('删除成功')
  } catch { /* 拦截器已提示 */ }
  loadList()
}

/* ========== 报价单预览 ========== */
async function onPreview(row) {
  try {
    const detail = await getQuotation(row.id)
    previewData.value = detail
    await nextTick()
    previewHtml.value = buildQuoteHtml(detail)
    previewVisible.value = true
  } catch { /* 拦截器已提示 */ }
}

function buildQuoteHtml(q) {
  if (!q) return ''
  const company = companySettings.value || {}
  const client = clientOptions.value.find(c => c.id === q.client_id) || {}
  const currSign = q.currency === 'RMB' ? '¥' : '$'
  const items = q.items || []
  const total = items.reduce((s, it) => {
    const ctns = Number(it.moq) || 0
    const pcs = Number(it.pcs_per_ctn) || 0
    return s + ctns * pcs * (Number(it.price) || 0)
  }, 0)
  const totalCtns = items.reduce((s, it) => s + (Number(it.moq) || 0), 0)
  const totalQty = items.reduce((s, it) => s + (Number(it.moq) || 0) * (Number(it.pcs_per_ctn) || 0), 0)
  const totalGw = items.reduce((s, it) => s + (Number(it.moq) || 0) * (Number(it.gw_per_ctn) || 0), 0)
  const totalCbm = items.reduce((s, it) => s + (Number(it.moq) || 0) * (Number(it.cbm_per_ctn) || 0), 0)

  const header = `
    <div style="padding-bottom:6px; display:flex; justify-content:space-between; align-items:flex-start;">
      <div style="line-height:1.35;">
        <h1 style="font-size:18px; font-weight:900; text-transform:uppercase; letter-spacing:0.5px; color:#0f172a; margin:0;">${company.name_en || 'SELLER COMPANY'}</h1>
        <p style="font-size:12px; font-weight:bold; color:#334155; margin:2px 0 0;">${company.name_cn || ''}</p>
        <p style="font-size:10px; color:#64748b; margin:1px 0 0;">${company.address_en || ''}</p>
        <p style="font-size:10px; color:#64748b; margin:1px 0 0;">TEL: ${company.tel || ''} | EMAIL: ${company.email || ''}</p>
      </div>
      <div style="text-align:right; font-size:10px; color:#64748b; line-height:1.5;">
        <div>DATE: ${q.quotation_date || ''}</div>
        <div>VALID UNTIL: ${q.valid_until || ''}</div>
        <div>REF: ${q.quotation_number || ''}</div>
      </div>
    </div>
    <div class="doc-title-section"><span class="doc-badge-title">QUOTATION</span></div>
  `

  const buyerAddress = client.address_en || client.address || ''
  const buyerContact = [client.email ? 'Email: ' + client.email : '', client.tel ? 'Tel: ' + client.tel : ''].filter(Boolean).join(' ')
  const buyerBox = `
    <div style="border:1px solid #cbd5e1; padding:8px; border-radius:4px; line-height:1.6;">
      <strong>TO (BUYER):</strong><br>
      <strong>${client.name_en || client.name || ''}</strong>
      ${buyerAddress ? `<br><span style="white-space:pre-wrap;">${buyerAddress}</span>` : ''}
      ${buyerContact ? `<br>${buyerContact}` : ''}
    </div>
  `
  const quoteInfoBox = `
    <div style="border:1px solid #cbd5e1; padding:8px; border-radius:4px; line-height:1.6;">
      <strong>TRADE TERMS:</strong> ${q.price_terms || ''} ${q.loading_port || ''}<br>
      <strong>DESTINATION:</strong> ${q.destination_port || '—'}<br>
      <strong>LEAD TIME:</strong> ${q.lead_time || '25-30 days'}<br>
      <strong>PAYMENT:</strong> ${q.payment_terms || '—'}
    </div>
  `

  const itemRows = items.map((it, idx) => {
    const ctns = Number(it.moq) || 0
    const pcs = Number(it.pcs_per_ctn) || 0
    const qty = ctns * pcs
    const price = Number(it.price) || 0
    const amount = qty * price
    // 从 spec 快照中剥离 HS 行与与产品英文名重复的行，统一只渲染一次（兼容历史数据）
    const specRaw = it.spec ? String(it.spec) : ''
    const specHsMatch = specRaw.match(/HS\s*[:：]\s*([A-Za-z0-9.]+)/i)
    const nameEn = (it.name_en || '').trim().toLowerCase()
    const specClean = specRaw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s && !/^HS\s*[:：]/i.test(s) && (!nameEn || s.toLowerCase() !== nameEn))
      .join('\n')
    const hsCode = it.hs_code || (specHsMatch ? specHsMatch[1] : '')
    // 历史快照中装箱尺寸标签为「外箱:」，统一展示为「CTNS:」
    const packingText = String(it.packing_desc || '').replace(/外箱\s*[:：]/g, 'CTNS:')
    return `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td><strong>${it.model || ''}</strong></td>
        <td style="text-align:center; padding:4px;">${it.img_url ? `<img src="${it.img_url}" style="width:70px;height:70px;object-fit:contain;display:block;margin:0 auto;">` : '-'}</td>
        <td style="line-height:1.4;">
          <strong>${it.name_en || ''}</strong>
          ${specClean ? `<br><span style="font-size:9.5px; color:#475569; white-space:pre-wrap;">${specClean}</span>` : ''}
          ${hsCode ? `<br><span style="font-size:9px; color:#94a3b8;">HS: ${hsCode}</span>` : ''}
        </td>
        <td style="line-height:1.4; font-size:9.5px; white-space:pre-wrap;">${packingText}</td>
        <td style="text-align:right;">${ctns}</td>
        <td style="text-align:right; font-weight:bold;">${qty}</td>
        <td style="text-align:right;">${currSign}${formatMoney(price)}</td>
        <td style="text-align:right; font-weight:bold; color:#059669;">${currSign}${formatMoney(amount)}</td>
      </tr>
    `
  }).join('')

  const table = `
    <table>
      <thead><tr>
        <th style="width:30px; text-align:center;">NO.</th>
        <th style="width:8%; text-align:center;">Art No.</th>
        <th style="width:70px; text-align:center;">Photo</th>
        <th style="width:26%; text-align:center;">Description & Specification</th>
        <th style="width:16%; text-align:center;">Packing</th>
        <th style="width:7%; text-align:center;">CTNS</th>
        <th style="width:9%; text-align:center;">Qty (pcs)</th>
        <th style="width:8%; text-align:center;">Unit Price</th>
        <th style="width:11%; text-align:center;">Amount</th>
      </tr></thead>
      <tbody>
        ${itemRows}
        <tr style="font-weight:bold; background:#f8fafc;">
          <td colspan="5" style="text-align:right;">TOTAL:</td>
          <td style="text-align:right;">${totalCtns}</td>
          <td style="text-align:right;">${totalQty}</td>
          <td></td>
          <td style="text-align:right; color:#059669;">${currSign}${formatMoney(total)}</td>
        </tr>
        <tr style="font-size:9px; color:#64748b;">
          <td colspan="9" style="text-align:right;">TOTAL G.W.: ${totalGw.toFixed(1)} KGS &nbsp;|&nbsp; TOTAL MEASUREMENT: ${totalCbm.toFixed(3)} CBM</td>
        </tr>
      </tbody>
    </table>
  `

  const remarkBlock = q.remark
    ? `<div style="margin-top:12px; padding:10px; border:1px dashed #cbd5e1; border-radius:4px; font-size:10px; line-height:1.6; white-space:pre-wrap;">${q.remark}</div>`
    : ''

  return header +
    `<div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:12px; font-size:11px;">${buyerBox}${quoteInfoBox}</div>` +
    table + remarkBlock
}

function onPrintPreview() {
  const win = window.open('', '_blank', 'width=1100,height=900')
  win.document.write(`
    <!DOCTYPE html><html><head><meta charset="utf-8">
    <title>QUOTATION - ${previewData.value?.quotation_number || ''}</title>
    <style>
      @page { margin: 12mm 10mm; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { margin: 0; font-family: 'Segoe UI', 'Microsoft YaHei', 'PingFang SC', Arial, sans-serif; color: #0f172a; }
      .doc-page { padding: 0; font-size: 11px; color: #0f172a; line-height: 1.5; }
      .doc-page table { font-size: 11px; margin: 10px 0; width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; }
      .doc-page th, .doc-page td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: middle; }
      .doc-page th { background: #f8fafc; }
      .doc-page tr { page-break-inside: avoid; }
      .doc-badge-title { font-size: 15pt; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; color: #0f172a; }
      .doc-title-section { text-align: center; margin: 10px 0; padding: 4px 0; }
      img { max-width: 100%; }
      @media print { body { margin: 0; } }
    </style></head><body><div class="doc-page">${previewHtml.value}</div></body></html>
  `)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}

/* ========== 转 PI（直接转单，报关责任留待外销订单编辑时选择） ========== */
async function onConvertToPi(row, fromPreview = false) {
  if (!row) return
  if (row.status === '已转PI') {
    ElMessage.warning('该报价单已转为 PI，无法重复转化')
    return
  }
  const ok = await ElMessageBox.confirm(
    '将报价单转为正式 PI（外销订单）？报关责任默认为「请选择」，可在外销订单编辑时再选择，选择保存后系统将自动生成相关单据。',
    '转 PI 确认',
    { confirmButtonText: '确认转 PI', cancelButtonText: '取 消', type: 'warning' }
  ).catch(() => false)
  if (!ok) return
  converting.value = true
  try {
    const result = await convertQuotationToOrder(row.id)
    ElMessage.success(`报价单已转为正式 PI：${result?.pi_number || ''}，报关责任为「请选择」，请在外销订单中编辑确认`)
    // 关闭报价单预览弹窗（若入口来自预览）
    if (fromPreview) previewVisible.value = false
    // 刷新报价单列表
    loadList()
    // 跳转到订单管理页面
    router.push({ name: 'Orders' })
  } catch { /* 拦截器已提示 */ }
  finally { converting.value = false }
}

onMounted(() => { loadList(); loadOptions() })
</script>

<style scoped>
.client-sub {
  color: #909399;
  font-size: 12px;
}
.form-grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0 16px;
}
.form-grid-6 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0 16px;
}
.divider-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  font-size: 14px;
  font-weight: 600;
  padding-right: 10px;
}
.items-table {
  font-size: 12px;
}
.items-table .el-table__cell {
  padding: 4px 6px;
}
.no-photo {
  width: 48px;
  height: 48px;
  line-height: 48px;
  text-align: center;
  background: #f5f7fa;
  border-radius: 4px;
  color: #c0c4cc;
}
.load-qty {
  font-size: 11px;
  color: #1e40af;
  text-align: left;
  padding-left: 4px;
  line-height: 1.5;
}
.lq-line {
  white-space: nowrap;
}
.load-qty-empty {
  color: #c0c4cc;
}
.calc-info {
  font-size: 11px;
  text-align: left;
  padding-left: 4px;
  line-height: 1.6;
}
.ci-line {
  white-space: nowrap;
}
.ci-label {
  color: #909399;
}
.remark-block {
  margin-top: 12px;
}
.remark-label {
  margin-bottom: 0;
}
/* 预览弹窗 */
.preview-toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 0 0 12px;
  border-bottom: 1px dashed #e4e7ed;
  margin-bottom: 12px;
}
.doc-page {
  padding: 16px 8px;
  font-size: 11px;
  color: #0f172a;
  line-height: 1.5;
}
.doc-page :deep(table) {
  font-size: 11px;
  margin: 10px 0;
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #cbd5e1;
}
.doc-page :deep(th),
.doc-page :deep(td) {
  border: 1px solid #cbd5e1;
  padding: 6px 8px;
  vertical-align: middle;
}
.doc-page :deep(th) {
  background: #f8fafc;
}
.doc-page :deep(.doc-badge-title) {
  font-size: 15pt;
  font-weight: 900;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #0f172a;
}
.doc-page :deep(.doc-title-section) {
  text-align: center;
  margin: 10px 0;
  padding: 4px 0;
}
</style>
