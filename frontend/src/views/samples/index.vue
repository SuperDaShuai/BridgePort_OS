<template>
  <el-card shadow="never" class="page-card">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-input
        v-model="query.q"
        placeholder="搜索单号 / 客户 / 快递单号"
        clearable
        style="width: 270px"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <el-select
        v-model="query.status"
        placeholder="全部状态"
        clearable
        style="width: 140px"
        @change="onSearch"
      >
        <el-option v-for="s in FEEDBACK_STATUSES" :key="s" :label="s" :value="s" />
      </el-select>
      <el-button :icon="Search" @click="onSearch">搜索</el-button>
      <div class="toolbar-right">
        <el-button v-if="canEdit" type="primary" :icon="Plus" @click="openCreate">新增样品单</el-button>
      </div>
    </div>

    <!-- 列表 -->
    <el-table v-loading="loading" :data="list" border stripe>
      <el-table-column prop="sample_number" label="样品单号" width="150" />
      <el-table-column prop="client_name" label="客户" min-width="150" show-overflow-tooltip />
      <el-table-column prop="signing_date" label="签约日期" width="105" />
      <el-table-column prop="delivery_date" label="交货日期" width="105" />
      <el-table-column label="明细" min-width="180">
        <template #default="{ row }">
          {{ row.item_count || 0 }} 个品种 (共 {{ row.total_qty || 0 }} PCS)
          <div v-if="row.product_models" class="opt-sub" style="font-size: 11px;">{{ row.product_models }}</div>
        </template>
      </el-table-column>
      <el-table-column label="快递" width="140" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.courier_name || '—' }}<span v-if="row.tracking_number" class="opt-sub"> · {{ row.tracking_number }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="sent_date" label="寄出日期" width="105" />
      <el-table-column label="反馈状态" width="110" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.feedback_status" :type="feedbackTag[row.feedback_status] || 'info'" size="small">
            {{ row.feedback_status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="负责人" width="90" align="center">
        <template #default="{ row }">{{ row.owner_name || '—' }}</template>
      </el-table-column>
      <el-table-column label="备注" min-width="180">
        <template #default="{ row }">
          <div v-if="row.remarks" class="remarks-cell">{{ row.remarks }}</div>
          <span v-else style="color:#c0c4cc">—</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" align="center" fixed="right">
        <template #default="{ row }">
          <el-button v-if="canEdit" link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="success" @click="openPi(row)">📄 生成PI</el-button>
          <el-button v-if="canEdit" link type="danger" @click="onDelete(row)">删除</el-button>
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

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible" :close-on-click-modal="false"
      :title="form.id ? '编辑样品单' : '新增样品单'"
      width="1180px"
      destroy-on-close
      top="3vh"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <div class="form-grid-4">
          <el-form-item label="样品单号" prop="sample_number">
            <el-input v-model="form.sample_number" placeholder="SMP-YYYY-NNN" />
          </el-form-item>
          <el-form-item label="签约日期">
            <el-date-picker v-model="form.signing_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
          <el-form-item label="交货日期">
            <el-date-picker v-model="form.delivery_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
          <el-form-item label="签约客户" prop="client_id">
            <el-select v-model="form.client_id" filterable placeholder="选择客户" style="width: 100%">
              <el-option v-for="c in clientOptions" :key="c.id" :label="c.name_en" :value="c.id">
                <span>{{ c.name_en }}</span>
                <span class="opt-sub" v-if="c.country"> · {{ c.country }}</span>
              </el-option>
            </el-select>
          </el-form-item>
        </div>
        <div class="form-grid-4">
          <el-form-item label="来源询盘">
            <el-select v-model="form.rfq_id" filterable clearable placeholder="选填" style="width: 100%">
              <el-option v-for="r in rfqOptions" :key="r.id" :label="r.rfq_number" :value="r.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="收款方式">
            <el-radio-group v-model="form.pay_method" @change="onPayMethodChange">
              <el-radio value="bank">银行</el-radio>
              <el-radio value="alipay">支付宝</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="form.pay_method === 'bank'" label="收款银行账户">
            <el-select v-model="form.bank_account_id" filterable clearable placeholder="选择收款账户" style="width: 100%">
              <el-option v-for="b in bankOptions" :key="b.id" :label="b.route_type" :value="b.id" />
            </el-select>
          </el-form-item>
          <el-form-item v-else label="支付宝收款码">
            <div v-if="form.alipay_qrcode" class="alipay-preview">
              <el-image :src="form.alipay_qrcode" fit="contain" class="alipay-img" :preview-src-list="[form.alipay_qrcode]" preview-teleported />
              <el-button size="small" type="danger" link @click="form.alipay_qrcode = null">移除</el-button>
            </div>
            <el-upload v-else :show-file-list="false" :before-upload="handleAlipayImg" accept="image/*">
              <el-button type="primary" plain>上传收款二维码</el-button>
            </el-upload>
          </el-form-item>
        </div>
        <div class="form-grid-4">
          <el-form-item label="付款方式">
            <el-select
              v-model="form.payment_terms"
              filterable allow-create clearable default-first-option
              placeholder="选择或输入付款方式"
              style="width: 100%"
            >
              <el-option v-for="t in paymentTermOptions" :key="t.id" :label="t.term_text" :value="t.term_text" />
            </el-select>
          </el-form-item>
          <el-form-item label="负责人">
            <el-input v-model="form.owner_name" disabled placeholder="创建后自动记录" />
          </el-form-item>
        </div>
        <div class="form-grid-2">
          <el-form-item label="包装说明">
            <el-input v-model="form.packing_desc" placeholder="如: Standard Neutral Export Cartons" />
          </el-form-item>
          <el-form-item label="特殊要求">
            <el-input v-model="form.special_req" type="textarea" :rows="2" placeholder="SPECIAL REQUIREMENTS" />
          </el-form-item>
        </div>
        <el-form-item label="内部备注">
          <el-input v-model="form.remarks" type="textarea" :rows="3" placeholder="业务员内部记录，不会打印到 PI 中" />
        </el-form-item>
        <div class="form-grid-2">
          <el-form-item label="显示特殊要求"><el-switch v-model="form.show_special_req" /></el-form-item>
          <el-form-item label="显示电子签章"><el-switch v-model="form.show_stamp" /></el-form-item>
          <el-form-item label="显示HS编码"><el-switch v-model="form.show_hs_code" /></el-form-item>
        </div>

        <el-divider content-position="left">
          <div class="divider-title">
            样品明细清单
            <el-button type="primary" size="small" plain :icon="Plus" @click="addItemRow">+ 添加样品行</el-button>
          </div>
        </el-divider>

        <el-table :data="form.items" border size="small" class="items-table">
          <el-table-column type="index" label="No." width="42" align="center" />
          <el-table-column label="Art No." width="170">
            <template #default="{ row }">
              <el-select v-model="row.product_id" filterable clearable placeholder="选择产品" size="small" style="width: 100%" @change="(val) => onProductPick(row, val)">
                <el-option v-for="p in productOptions" :key="p.id" :label="p.model" :value="p.id" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="图片" width="62" align="center">
            <template #default="{ row }">
              <el-image v-if="row.img_url" :src="row.img_url" fit="contain" style="width: 42px; height: 42px; border-radius: 4px; border: 1px solid #e4e7ed;" :preview-src-list="[row.img_url, ...(row._photos || [])]" preview-teleported />
              <div v-else class="no-photo">—</div>
            </template>
          </el-table-column>
          <el-table-column label="Specification" min-width="200">
            <template #default="{ row }">
              <el-input v-model="row.spec" type="textarea" :rows="3" size="small" style="font-size: 11px; line-height: 1.4;" />
            </template>
          </el-table-column>
          <el-table-column label="数量" width="80" align="center">
            <template #default="{ row }">
              <el-input-number v-model="row.qty" :min="0" :controls="false" size="small" style="width: 100%" @change="calcRow(row)" />
            </template>
          </el-table-column>
          <el-table-column :label="`单价(${priceSign})`" width="120" align="center">
            <template #header>
              <span style="cursor:pointer; user-select:none" @click="togglePriceCurrency">单价({{ priceSign }}) ⇄</span>
            </template>
            <template #default="{ row }">
              <el-input-number v-model="row.price" :min="0" :step="0.01" :controls="false" size="small" style="width: 100%" @change="calcRow(row)" />
            </template>
          </el-table-column>
          <el-table-column :label="`总价(${priceSign})`" width="110" align="right">
            <template #default="{ row }">
              <span class="subtotal">{{ priceSign }}{{ formatMoney(row.subtotal_amount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="50" align="center" fixed="right">
            <template #default="{ $index }">
              <el-button link type="danger" size="small" @click="form.items.splice($index, 1)">✕</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="total-bar">
          <span>样品外销总额：</span>
          <span class="total-amount">{{ priceSign }}{{ formatMoney(orderTotal) }}</span>
        </div>

        <el-divider content-position="left">快递与费用信息</el-divider>
        <div class="form-grid-4">
          <el-form-item label="快递公司">
            <el-input v-model="form.courier_name" placeholder="DHL / FedEx / UPS" />
          </el-form-item>
          <el-form-item label="快递单号">
            <el-input v-model="form.tracking_number" />
          </el-form-item>
          <el-form-item label="寄出日期">
            <el-date-picker v-model="form.sent_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
          <el-form-item label="反馈状态">
            <el-select v-model="form.feedback_status" style="width: 100%">
              <el-option v-for="s in FEEDBACK_STATUSES" :key="s" :label="s" :value="s" />
            </el-select>
          </el-form-item>
        </div>
        <div class="form-grid-4">
          <el-form-item label="样品费(¥)">
            <el-input-number v-model="form.sample_fee" :min="0" :controls="false" style="width: 100%" />
          </el-form-item>
          <el-form-item label="快递运费(¥)">
            <el-input-number v-model="form.freight_cost" :min="0" :controls="false" style="width: 100%" />
          </el-form-item>
        </div>
        <div class="form-grid-2">
          <el-form-item label="客户评语">
            <el-input v-model="form.client_feedback_note" type="textarea" :rows="2" />
          </el-form-item>
        </div>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取 消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保 存</el-button>
      </template>
    </el-dialog>

    <!-- ========== 样品 PI 预览弹窗 ========== -->
    <el-dialog
      v-model="piVisible" :close-on-click-modal="false"
      :title="`SAMPLE PROFORMA INVOICE - ${piData?.sample_number || ''}`"
      width="1100px"
      destroy-on-close
      top="3vh"
      class="pi-dialog"
    >
      <div class="pi-toolbar no-print">
        <el-button @click="onPrint" :icon="Printer">🖨️ 打印 / 另存为 PDF</el-button>
        <el-button type="success" @click="onExportExcel">📊 下载 Excel (.xls)</el-button>
      </div>

      <!-- PI 内容（v-html 渲染完整 HTML 模板） -->
      <div ref="piContentRef" class="doc-page" v-html="piHtml"></div>

      <template #footer>
        <el-button @click="piVisible = false">关 闭</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { onMounted, reactive, ref, computed, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Printer } from '@element-plus/icons-vue'
import {
  listSamples, getSample, createSample, updateSample, deleteSample, getNextSampleNumber
} from '@/api/samples'
import { listClients } from '@/api/clients'
import { listProducts } from '@/api/products'
import { listRfqs } from '@/api/rfqs'
import { listBankAccounts } from '@/api/bankAccounts'
import { listPaymentTerms } from '@/api/paymentTerms'
import { getCompanySettings } from '@/api/companySettings'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
// 样品单操作权限：跟单(5)/财务(4)只读，业务员(3)可操作，主管及以上不限
const canEdit = userStore.permissionLevel <= 3

const FEEDBACK_STATUSES = ['准备中', '已寄出', '客户已签收', '确认合格', '需重新打样']
const feedbackTag = {
  准备中: 'info', 已寄出: 'primary', 客户已签收: 'warning', 确认合格: 'success', 需重新打样: 'danger'
}

const loading = ref(false)
const saving = ref(false)
const list = ref([])
const total = ref(0)
const clientOptions = ref([])
const productOptions = ref([])
const rfqOptions = ref([])
const bankOptions = ref([])
const paymentTermOptions = ref([])
const companySettings = ref({})
const query = reactive({ q: '', status: '', page: 1, pageSize: 10 })

const dialogVisible = ref(false)
const formRef = ref()
const form = ref({})
const priceCurrency = ref('RMB')
const priceSign = computed(() => priceCurrency.value === 'RMB' ? '¥' : '$')
const rules = {
  sample_number: [{ required: true, message: '请输入样品单号', trigger: 'blur' }],
  client_id: [{ required: true, message: '请选择客户', trigger: 'change' }]
}

const blankForm = () => ({
  sample_number: '', client_id: null, rfq_id: null,
  courier_name: '', tracking_number: '', sent_date: '',
  sample_fee: undefined, freight_cost: undefined,
  feedback_status: '准备中', client_feedback_note: '',
  // 订单化字段
  signing_date: '', delivery_date: '',
  currency: 'RMB',
  pay_method: 'bank', bank_account_id: null, alipay_qrcode: null,
  payment_terms: '', packing_desc: 'Standard Neutral Export Cartons',
  special_req: '', remarks: '', show_special_req: true, show_stamp: true, show_hs_code: false,
  items: [], owner_name: ''
})
const blankItem = () => ({
  product_id: null, model: '', name_en: '', hs_code: '',
  img_url: '', spec: '', qty: 1, unit: 'PCS',
  price: undefined, price_rmb: undefined, subtotal_amount: 0,
  nw_per_ctn: null, gw_per_ctn: null, cbm_per_ctn: null
})

// 样品明细总额
const orderTotal = computed(() =>
  (form.value.items || []).reduce((s, it) => s + (Number(it.subtotal_amount) || 0), 0)
)
function formatMoney(v) { return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

async function loadList() {
  loading.value = true
  try {
    const d = await listSamples({ q: query.q, status: query.status, page: query.page, pageSize: query.pageSize })
    list.value = d.list
    total.value = d.total
  } catch { /* 拦截器已提示 */ } finally { loading.value = false }
}

async function loadOptions() {
  try {
    const [c, p, r, b, t, co] = await Promise.all([
      listClients({ page: 1, pageSize: 500 }),
      listProducts({ page: 1, pageSize: 500 }),
      listRfqs({ page: 1, pageSize: 200 }),
      listBankAccounts(),
      listPaymentTerms(),
      getCompanySettings()
    ])
    clientOptions.value = c.list
    productOptions.value = p.list
    rfqOptions.value = r.list
    bankOptions.value = b.list || []
    paymentTermOptions.value = t.list || []
    companySettings.value = co || {}
  } catch { /* 拦截器已提示 */ }
}

function onSearch() { query.page = 1; loadList() }

/* ========== 明细行交互 ========== */
function onProductPick(row, productId) {
  row.product_id = productId
  const p = productOptions.value.find(x => x.id === productId)
  if (!p) return
  row.model = p.model
  row.name_en = p.name_en || ''
  row.hs_code = p.hs_code || ''
  row.img_url = p.img_url || ''
  row.unit = p.unit || 'PCS'
  row.nw_per_ctn = p.net_weight_kg ?? null
  row.gw_per_ctn = p.gross_weight_kg ?? null
  row.cbm_per_ctn = p.ctn_cbm ?? null
  // 基准价：产品数据库外销价（字段名 export_price_usd 但数据是 RMB）
  row.price_rmb = p.export_price_usd ?? undefined
  const usdRate = Number(companySettings.value.default_usd_rate) || 7.2
  if (row.price_rmb != null && priceCurrency.value === 'USD') {
    row.price = Number((row.price_rmb / usdRate).toFixed(2))
  } else {
    row.price = row.price_rmb
  }
  row.spec = p.spec || ''
  calcRow(row)
  // 异步加载产品多图
  import('@/api/products').then(({ listProductPhotos }) => {
    listProductPhotos(productId).then(d => {
      row._photos = (d.list || []).map(x => x.photo_url)
    }).catch(() => {})
  })
}

function calcRow(row) {
  // 注意：手动改单价不回写 price_rmb 基准，避免 toFixed 累积漂移
  const p = Number(row.price) || 0
  const q = Number(row.qty) || 0
  row.subtotal_amount = Number((q * p).toFixed(2))
}

function togglePriceCurrency() {
  const usdRate = Number(companySettings.value.default_usd_rate) || 7.2
  const to = priceCurrency.value === 'RMB' ? 'USD' : 'RMB'
  ;(form.value.items || []).forEach((it) => {
    const rmb = Number(it.price_rmb) || 0
    if (rmb <= 0) return
    it.price = to === 'RMB' ? rmb : Number((rmb / usdRate).toFixed(2))
    it.subtotal_amount = Number(((Number(it.qty) || 0) * Number(it.price)).toFixed(2))
  })
  priceCurrency.value = to
}

function addItemRow() { form.value.items.push(blankItem()) }

/* ========== 收款方式 ========== */
function onPayMethodChange(method) {
  if (method === 'alipay') form.value.bank_account_id = null
  else form.value.alipay_qrcode = null
}

function handleAlipayImg(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const maxSide = 500
        let { width, height } = img
        if (Math.max(width, height) > maxSide) {
          if (width >= height) { height = Math.round(height * maxSide / width); width = maxSide }
          else { width = Math.round(width * maxSide / height); height = maxSide }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        form.value.alipay_qrcode = canvas.toDataURL('image/png', 0.9)
        ElMessage.success('收款码已预览，保存后生效')
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
    resolve(false)
  })
}

/* ========== 弹窗打开 ========== */
async function openCreate() {
  form.value = blankForm()
  form.value.owner_name = userStore.displayName
  try { form.value.sample_number = await getNextSampleNumber() } catch {}
  form.value.signing_date = new Date().toISOString().slice(0, 10)
  form.value.sent_date = form.value.signing_date
  priceCurrency.value = 'RMB'
  form.value.payment_terms =
    paymentTermOptions.value.find((t) => t.is_default)?.term_text
    || companySettings.value.payment_terms_template || ''
  addItemRow()
  dialogVisible.value = true
}

async function openEdit(row) {
  const detail = await getSample(row.id)
  // 币种开关按已存订单初始化
  priceCurrency.value = (detail.currency === 'USD') ? 'USD' : 'RMB'
  detail.show_special_req = !!detail.show_special_req
  detail.show_stamp = !!detail.show_stamp
  detail.show_hs_code = !!detail.show_hs_code
  // 收款方式：有支付宝收款码即视为支付宝模式
  detail.pay_method = detail.alipay_qrcode ? 'alipay' : 'bank'

  detail.items = (detail.items || []).map(it => {
    // 回显价格基准：优先用已存的 price_rmb；历史订单按币种补偿
    let baseRmb = Number(it.price_rmb)
    if (!baseRmb || isNaN(baseRmb)) {
      const savedPrice = Number(it.price) || 0
      if (savedPrice > 0) {
        const usdRate = Number(companySettings.value.default_usd_rate) || 7.2
        baseRmb = detail.currency === 'USD'
          ? Number((savedPrice * usdRate).toFixed(2))
          : savedPrice
      }
    }
    let displayPrice = Number(it.price)
    if (baseRmb > 0) {
      const usdRate = Number(companySettings.value.default_usd_rate) || 7.2
      displayPrice = priceCurrency.value === 'USD'
        ? Number((baseRmb / usdRate).toFixed(2))
        : baseRmb
    }
    return {
      ...it,
      price_rmb: baseRmb || undefined,
      price: displayPrice,
      subtotal_amount: Number(((Number(it.qty) || 0) * displayPrice).toFixed(2))
    }
  })
  form.value = detail
  dialogVisible.value = true
}

async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  const items = (form.value.items || []).filter(it => it.model)
  if (items.length === 0) { ElMessage.warning('请至少添加一行样品明细'); return }
  if (form.value.pay_method === 'alipay' && !form.value.alipay_qrcode) {
    ElMessage.warning('已选择支付宝收款，请先上传收款二维码'); return
  }
  const payload = {
    ...form.value,
    currency: priceCurrency.value,
    show_special_req: form.value.show_special_req ? 1 : 0,
    show_stamp: form.value.show_stamp ? 1 : 0,
    show_hs_code: form.value.show_hs_code ? 1 : 0,
    bank_account_id: form.value.pay_method === 'alipay' ? null : form.value.bank_account_id,
    alipay_qrcode: form.value.pay_method === 'alipay' ? form.value.alipay_qrcode : null,
    items
  }
  saving.value = true
  try {
    if (form.value.id) { await updateSample(form.value.id, payload); ElMessage.success('更新成功') }
    else { await createSample(payload); ElMessage.success('创建成功') }
    dialogVisible.value = false
    loadList()
  } catch { /* 拦截器已提示 */ } finally { saving.value = false }
}

async function onDelete(row) {
  const ok = await ElMessageBox.confirm(`确认删除样品单「${row.sample_number}」？`, '删除确认', { type: 'warning' }).catch(() => false)
  if (!ok) return
  try { await deleteSample(row.id); ElMessage.success('删除成功') } catch { /* 拦截器已提示 */ }
  loadList()
}

/* ========== 样品 PI 生成（仿照外销订单 PI 模板，使用样品单字段） ========== */
// PI 预览
const piVisible = ref(false)
const piData = ref(null)
const piContentRef = ref(null)
const piHtml = ref('')

// 数字转英文大写（用于 SAY TOTAL US DOLLARS ... ONLY）
function numberToEnglishWords(num) {
  if (isNaN(num)) return ''
  const a = ['', 'ONE ', 'TWO ', 'THREE ', 'FOUR ', 'FIVE ', 'SIX ', 'SEVEN ', 'EIGHT ', 'NINE ', 'TEN ', 'ELEVEN ', 'TWELVE ', 'THIRTEEN ', 'FOURTEEN ', 'FIFTEEN ', 'SIXTEEN ', 'SEVENTEEN ', 'EIGHTEEN ', 'NINETEEN ']
  const b = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY']
  function inWords(n) {
    if ((n = n.toString()).length > 9) return 'OVERFLOW'
    const m = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/)
    if (!m) return ''
    let str = ''
    str += (m[1] != 0) ? (a[Number(m[1])] || b[m[1][0]] + ' ' + a[m[1][1]]) + 'CRORE ' : ''
    str += (m[2] != 0) ? (a[Number(m[2])] || b[m[2][0]] + ' ' + a[m[2][1]]) + 'LAKH ' : ''
    str += (m[3] != 0) ? (a[Number(m[3])] || b[m[3][0]] + ' ' + a[m[3][1]]) + 'THOUSAND ' : ''
    str += (m[4] != 0) ? (a[Number(m[4])] || b[m[4][0]] + ' ' + a[m[4][1]]) + 'HUNDRED ' : ''
    str += (m[5] != 0) ? ((str != '') ? 'AND ' : '') + (a[Number(m[5])] || b[m[5][0]] + ' ' + a[m[5][1]]) : ''
    return str.trim()
  }
  const parts = Number(num || 0).toFixed(2).split('.')
  const integerPart = parseInt(parts[0], 10)
  const decimalPart = parseInt(parts[1], 10)
  let words = inWords(integerPart)
  if (!words) words = 'ZERO'
  let result = words
  if (decimalPart > 0) result += ' AND CENTS ' + inWords(decimalPart)
  return result
}

// 样品单总额计算（样品无箱数概念，仅合计数量与金额）
function getSampleTotals(order) {
  let qty = 0, amount = 0
  ;(order.items || []).forEach(it => {
    const q = Number(it.qty || 0)
    const p = Number(it.price || 0)
    qty += q; amount += q * p
  })
  return { qty, amount }
}

async function openPi(row) {
  const detail = await getSample(row.id)
  // 每次打开 PI 都重新拉企业配置，确保签章等最新值
  try {
    const fresh = await getCompanySettings()
    companySettings.value = fresh || companySettings.value
  } catch { /* 忽略，用已有缓存 */ }
  piData.value = detail
  await nextTick()
  piHtml.value = buildPiHtml(detail)
  piVisible.value = true
}

function buildPiHtml(order) {
  if (!order) return ''
  const company = companySettings.value || {}
  const client = clientOptions.value.find(c => c.id === order.client_id) || {}
  const bank = bankOptions.value.find(b => b.id === order.bank_account_id) || bankOptions.value[0] || {}
  const totals = getSampleTotals(order)
  const currSign = order.currency === 'RMB' ? '¥' : '$'
  const totalWords = numberToEnglishWords(totals.amount)

  // 公司抬头
  const header = `
    <div style="padding-bottom:6px; display:flex; justify-content:space-between; align-items:flex-start;">
      <div style="line-height:1.35;">
        <h1 style="font-size:18px; font-weight:900; text-transform:uppercase; letter-spacing:0.5px; color:#0f172a; margin:0;">${company.name_en || 'SELLER COMPANY'}</h1>
        <p style="font-size:12px; font-weight:bold; color:#334155; margin:2px 0 0;">${company.name_cn || ''}</p>
        <p style="font-size:10px; color:#64748b; margin:1px 0 0;">${company.address_en || ''}</p>
        <p style="font-size:10px; color:#64748b; margin:1px 0 0;">TEL: ${company.tel || ''} | EMAIL: ${company.email || ''}</p>
      </div>
      <div style="text-align:right; font-size:10px; color:#64748b; line-height:1.5;">
        <div>DATE: ${order.signing_date || ''}</div>
        <div>REF: ${order.sample_number || ''}</div>
      </div>
    </div>
    <div style="text-align:center; margin:14px 0 12px; font-size:15pt; font-weight:900; letter-spacing:1px; text-transform:uppercase; color:#0f172a;">SAMPLE PROFORMA INVOICE</div>
  `

  // BUYER + PI INFO 双栏
  const buyerAddress = client.address_en || client.address || ''
  const buyerContact = [client.email ? 'Email: ' + client.email : '', client.tel ? 'Tel: ' + client.tel : ''].filter(Boolean).join(' ')
  const buyerBox = `
    <div style="border:1px solid #cbd5e1; padding:8px; border-radius:4px; line-height:1.6;">
      <strong>BUYER / CONSIGNEE:</strong><br>
      <strong>${client.name_en || client.name || ''}</strong>
      ${buyerAddress ? `<br><span style="white-space:pre-wrap;">${buyerAddress}</span>` : ''}
      ${buyerContact ? `<br>${buyerContact}` : ''}
    </div>
  `
  const piInfoBox = `
    <div style="border:1px solid #cbd5e1; padding:8px; border-radius:4px; line-height:1.6;">
      <strong>PI NO.:</strong> ${order.sample_number || ''}<br>
      <strong>PAYMENT TERMS:</strong> ${order.payment_terms || ''}<br>
      <strong>ESTIMATED DELIVERY:</strong> ${order.delivery_date || 'Within 30 days'}
    </div>
  `

  // 明细表格（样品单无 PCS/CTN、CTNS 列）
  const itemsRows = (order.items || []).map((it, idx) => {
    const qty = Number(it.qty || 0), price = Number(it.price || 0)
    // 剥离 spec 快照中的 HS 行与与产品英文名重复的行（兼容历史数据），仅展示规格描述
    const specRaw = it.spec ? String(it.spec) : ''
    const specHsMatch = specRaw.match(/HS\s*[:：]\s*([A-Za-z0-9.]+)/i)
    const nameEn = (it.name_en || '').trim().toLowerCase()
    const specClean = specRaw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s && !/^HS\s*[:：]/i.test(s) && (!nameEn || s.toLowerCase() !== nameEn))
      .join('\n')
    const hsCode = it.hs_code || (specHsMatch ? specHsMatch[1] : '')
    return `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td><strong>${it.model || ''}</strong></td>
        <td style="text-align:center; padding:4px;">${it.img_url ? `<img src="${it.img_url}" style="width:80px;height:80px;object-fit:contain;display:block;margin:0 auto;">` : '-'}</td>
        <td style="line-height:1.4;">
          ${specClean ? `<span style="font-size:9.5px; color:#475569; white-space:pre-wrap;">${specClean}</span>` : ''}
          ${(order.show_hs_code && hsCode) ? `<br><span style="font-size:9px; color:#94a3b8;">HS: ${hsCode}</span>` : ''}
        </td>
        <td style="text-align:center; font-weight:bold;">${qty}</td>
        <td style="text-align:center;">${currSign}${formatMoney(price)}</td>
        <td style="text-align:right; font-weight:bold;">${currSign}${formatMoney(qty * price)}</td>
      </tr>
    `
  }).join('')

  const totalsRow = `
    <tr style="font-weight:bold; background:#f8fafc;">
      <td colspan="4" style="text-align:right;">TOTAL:</td>
      <td style="text-align:center;">${totals.qty}</td>
      <td></td>
      <td style="text-align:right; color:#059669;">${currSign}${formatMoney(totals.amount)}</td>
    </tr>
  `

  const table = `
    <table>
      <thead><tr>
        <th style="width:30px; text-align:center;">NO.</th>
        <th style="width:12%; text-align:center;">Art No.</th>
        <th style="width:90px; text-align:center;">Photo</th>
        <th style="width:40%; text-align:center;">Specification</th>
        <th style="width:12%; text-align:center;">Qty (pcs)</th>
        <th style="width:12%; text-align:center;">Price</th>
        <th style="width:14%; text-align:center;">Amount</th>
      </tr></thead>
      <tbody>${itemsRows}${totalsRow}</tbody>
    </table>
  `

  // SAY TOTAL WORDS
  const sayTotal = `
    <div style="margin-top:6px; font-weight:bold; font-size:10px;">
      ${order.currency === 'RMB' ? 'SAY TOTAL CHINESE YUAN ' : 'SAY TOTAL US DOLLARS '}${totalWords} ONLY***
    </div>
  `

  // SPECIAL REQUIREMENTS（条件显示）
  const specialReq = (order.show_special_req && order.special_req) ? `
    <div style="margin-top:12px; font-size:10.5px; line-height:1.5;">
      <div style="font-weight:bold; margin-bottom:4px; color:#1e40af;">SPECIAL REQUIREMENTS:</div>
      <div style="white-space:pre-wrap; color:#334155;">${order.special_req}</div>
    </div>
  ` : ''

  // BENEFICIARY BANK —— 支付宝模式仅显示收款二维码；否则使用收款路线库「路由备注」（保留换行）；
  // 路由备注为空时回落到结构化银行行
  const bankHtml = order.alipay_qrcode ? `
    <div style="margin-top:16px; font-size:11px; border-top:1px solid #e2e8f0; padding-top:12px;">
      <div style="padding-bottom:8px;">
        <strong>BENEFICIARY BANK DETAILS:</strong>
        <div style="margin-top:8px;">
          <img src="${order.alipay_qrcode}" alt="ALIPAY QR CODE" style="max-width:180px; max-height:180px; display:block;" />
        </div>
      </div>
    </div>
  ` : bank.routing_note ? `
    <div style="margin-top:16px; font-size:11px; border-top:1px solid #e2e8f0; padding-top:12px;">
      <div style="padding-bottom:8px;">
        <strong>BENEFICIARY BANK DETAILS:</strong>
        <div style="white-space:pre-wrap; margin-top:4px; line-height:1.6;">${bank.routing_note}</div>
      </div>
    </div>
  ` : `
    <div style="margin-top:16px; font-size:11px; border-top:1px solid #e2e8f0; padding-top:12px;">
      <div style="padding-bottom:8px;">
        <strong>BENEFICIARY BANK DETAILS:</strong><br>
        Bank Name: ${bank.bank_name || company.bank_name || ''}<br>
        Account No: ${bank.account_number || company.bank_account || ''}<br>
        Swift Code: ${bank.swift_code || company.swift_code || '-'}<br>
        Beneficiary: ${company.name_en || ''}
      </div>
    </div>
  `

  // ARBITRATION AWARD CLAUSE（冲裁条款）
  const awardClause = company.award_clause ? `
    <div style="margin-top:12px; font-size:9.5px; color:#475569; line-height:1.5;">
      <strong>ARBITRATION AWARD CLAUSE:</strong><br>${company.award_clause}
    </div>
  ` : ''

  // ARBITRATION CLAUSE
  const arbitration = company.arbitration_clause ? `
    <div style="margin-top:12px; font-size:9.5px; color:#475569; line-height:1.4;">
      <strong>ARBITRATION CLAUSE:</strong><br>${company.arbitration_clause}
    </div>
  ` : ''

  // 签章区
  const signHtml = order.show_stamp
    ? `<div style="position:relative; display:inline-block; width:220px; height:48px;">
        <img src="${company.seal_img || '/seal.png'}" style="position:absolute; left:50%; top:-15px; transform:translate(-50%,-50%) rotate(-8deg); max-width:225px; max-height:115px; z-index:1;" alt="SEAL" />
      </div>`
    : `<div style="margin-top:35px; border-bottom:1px solid #94a3b8; width:180px; display:inline-block;"></div><p style="margin-top:4px; color:#64748b; font-size:9px;">Authorized Signature & Chop</p>`

  const signatures = `
    <div style="margin-top:16px; display:flex; justify-content:space-between; font-size:11px; line-height:1.4;">
      <div style="text-align:left;">
        <p style="margin:0;"><strong>ACCEPTED & CONFIRMED BY BUYER:</strong><br>${client.name_en || 'BUYER'}</p>
        <div style="margin-top:20px; border-bottom:1px solid #94a3b8; width:180px;"></div>
        <p style="margin:4px 0 0; color:#64748b; font-size:9px;">Authorized Signature & Chop</p>
      </div>
      <div style="text-align:right;">
        <p style="margin:0;"><strong>FOR AND ON BEHALF OF SELLER:</strong><br>${company.name_en || ''}</p>
        ${signHtml}
      </div>
    </div>
  `

  return header +
    `<div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:12px; font-size:11px;">${buyerBox}${piInfoBox}</div>` +
    table + sayTotal + specialReq + bankHtml + awardClause + arbitration + signatures
}

function onPrint() {
  const win = window.open('', '_blank', 'width=1200,height=900')
  win.document.write(`
    <!DOCTYPE html>
    <html><head><meta charset="utf-8">
    <title>SAMPLE PROFORMA INVOICE - ${piData.value?.sample_number || ''}</title>
    <style>
      @page { margin: 12mm 10mm; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { margin: 0; font-family: 'Segoe UI', 'Microsoft YaHei', 'PingFang SC', Arial, sans-serif; color: #0f172a; }
      .doc-page { padding: 0; font-size: 11px; color: #0f172a; line-height: 1.5; }
      .doc-page table { font-size: 11px; margin: 10px 0; width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; }
      .doc-page th, .doc-page td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: middle; }
      .doc-page th { background: #f8fafc; }
      .doc-page tr { page-break-inside: avoid; }
      img { max-width: 100%; }
      @media print { body { margin: 0; } }
    </style></head><body><div class="doc-page">${piHtml.value}</div></body></html>
  `)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}

function onExportExcel() {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head><meta charset="utf-8"></head><body>${piHtml.value}</body></html>`
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `SamplePI_${piData.value?.sample_number || 'export'}.xls`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

onMounted(() => { loadList(); loadOptions() })
</script>

<style scoped>
.divider-title { display: flex; align-items: center; gap: 12px; font-weight: bold; }
.items-table { margin-bottom: 12px; }
.no-photo { color: #c0c4cc; text-align: center; }
.total-bar { display: flex; align-items: center; padding: 10px 16px; background: #f8fafc; border-radius: 4px; font-size: 14px; color: #475569; }
.total-amount { font-size: 18px; font-weight: bold; color: #059669; }
.opt-sub { color: #94a3b8; font-size: 12px; }
.form-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0 16px; }
.form-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0 16px; }
.subtotal { color: #059669; font-weight: bold; }
.alipay-preview { display: flex; align-items: center; gap: 8px; }
.alipay-img { width: 110px; height: 110px; border: 1px solid #e2e8f0; border-radius: 4px; background: #f8fafc; }

/* 备注列：严格保留编辑时的换行格式 */
.remarks-cell {
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
  line-height: 1.5;
  color: #475569;
  max-height: 120px;
  overflow-y: auto;
}

/* ======== 样品 PI 预览样式 ======== */
.pi-toolbar { display: flex; gap: 8px; margin-bottom: 10px; }
.doc-page { background: white; padding: 35px 40px; font-size: 11px; color: #0f172a; line-height: 1.5; border: 1px solid #cbd5e1; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.doc-page table { font-size: 11px; margin: 10px 0; width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; }
.doc-page th, .doc-page td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: middle; }
.doc-page th { background: #f8fafc; }

/* 打印时隐藏工具栏 */
@media print {
  :deep(.no-print) { display: none !important; }
  :deep(.el-dialog__header), :deep(.el-dialog__footer) { display: none !important; }
}
</style>
