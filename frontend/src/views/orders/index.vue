<template>
  <el-card shadow="never" class="page-card">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-input
        v-model="query.q"
        placeholder="搜索 PI 编号 / 客户"
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
        <el-button type="primary" :icon="Plus" @click="openCreate">新建外贸订单</el-button>
      </div>
    </div>

    <!-- 列表 -->
    <el-table v-loading="loading" :data="list" border stripe>
      <el-table-column prop="pi_number" label="PI 编号" width="150" />
      <el-table-column prop="signing_date" label="签约日期" width="110" />
      <el-table-column prop="client_name" label="签约客户" min-width="200" show-overflow-tooltip />
      <el-table-column label="订单明细" min-width="180">
        <template #default="{ row }">
          {{ row.product_kind_count || 0 }} 种品类 (共 {{ row.total_qty || 0 }} PCS)
        </template>
      </el-table-column>
      <el-table-column prop="total_amount" label="外销总额" width="120" align="right">
        <template #default="{ row }">
          {{ row.currency === 'RMB' ? '¥' : '$' }}{{ formatMoney(row.total_amount) }}
        </template>
      </el-table-column>
      <el-table-column label="条款与交期" width="160">
        <template #default="{ row }">
          <div>{{ row.trade_terms || '—' }} | {{ row.delivery_date || '—' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="履约状态" width="110" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="statusTag[row.current_node] || 'info'">
            {{ row.current_node || '—' }}
          </el-tag>
          <div class="progress-text">{{ row.progress_percent || 0 }}%</div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="240" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="success" @click="openPi(row)">📄 生成 PI</el-button>
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
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

    <!-- 新增/编辑订单弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? '编辑外贸订单 (PI)' : '新建外贸订单 (PI)'"
      width="1200px"
      destroy-on-close
      top="5vh"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <div class="form-grid-4">
          <el-form-item label="PI 编号" prop="pi_number">
            <el-input v-model="form.pi_number" placeholder="BP-YYYY-NNN" />
          </el-form-item>
          <el-form-item label="签约日期" prop="signing_date">
            <el-date-picker v-model="form.signing_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
          <el-form-item label="交货日期">
            <el-date-picker v-model="form.delivery_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
          <el-form-item label="签约客户" prop="client_id">
            <el-select v-model="form.client_id" filterable placeholder="选择客户" style="width: 100%" @change="onClientChange">
              <el-option v-for="c in clientOptions" :key="c.id" :label="c.name_en" :value="c.id">
                <span>{{ c.name_en }}</span>
                <span class="opt-sub" v-if="c.country"> · {{ c.country }}</span>
              </el-option>
            </el-select>
          </el-form-item>
        </div>
        <div class="form-grid-4">
          <el-form-item label="采购供应商">
            <el-select v-model="form.supplier_id" filterable clearable placeholder="选择供应商" style="width: 100%">
              <el-option v-for="s in supplierOptions" :key="s.id" :label="s.name" :value="s.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="结算币种">
            <el-select v-model="form.currency" style="width: 100%">
              <el-option value="USD" label="USD ($)" />
              <el-option value="RMB" label="RMB (¥)" />
            </el-select>
          </el-form-item>
          <el-form-item label="贸易条款">
            <el-select v-model="form.trade_terms" style="width: 100%">
              <el-option value="FOB" label="FOB" />
              <el-option value="CIF" label="CIF" />
              <el-option value="CFR" label="CFR" />
              <el-option value="EXW" label="EXW" />
              <el-option value="DDP" label="DDP" />
            </el-select>
          </el-form-item>
          <el-form-item label="报关责任">
            <el-select v-model="form.customs_responsibility" style="width: 100%">
              <el-option value="请选择" label="请选择（转PI默认，待确认）" />
              <el-option value="我司代办报关" label="我司代办报关" />
              <el-option value="客户自行报关" label="客户自行报关" />
            </el-select>
            <div v-if="form.customs_responsibility === '请选择'" class="field-hint">
              转PI订单待确认：请选择报关责任后保存，系统将自动生成购销合同等单据
            </div>
          </el-form-item>
        </div>
        <div class="form-grid-4">
          <el-form-item label="收款方式">
            <el-radio-group v-model="form.pay_method" @change="onPayMethodChange">
              <el-radio value="bank">银行账户</el-radio>
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
          <el-form-item label="起运港">
            <el-input v-model="form.loading_port" placeholder="如: Ningbo, China" />
          </el-form-item>
          <el-form-item label="目的港">
            <el-input v-model="form.destination_port" placeholder="选择客户后自动填充" />
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
        <div class="form-grid-2">
          <el-form-item label="PI 显示特殊要求"><el-switch v-model="form.show_special_req" /></el-form-item>
          <el-form-item label="PI 显示电子签章"><el-switch v-model="form.show_stamp" /></el-form-item>
        </div>

        <el-divider content-position="left">
          <div class="divider-title">
            商品明细清单
            <el-button type="primary" size="small" plain :icon="Plus" @click="addItemRow">+ 添加商品行</el-button>
          </div>
        </el-divider>

        <el-table :data="form.items" border size="small" class="items-table">
          <el-table-column type="index" label="No." width="45" align="center" />
          <el-table-column label="Art No." width="170">
            <template #default="{ row }">
              <el-select v-model="row.product_id" filterable clearable placeholder="选择产品" size="small" style="width: 100%" @change="(val) => onProductPick(row, val)">
                <el-option v-for="p in productOptions" :key="p.id" :label="p.model" :value="p.id" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="图片" width="70" align="center">
            <template #default="{ row }">
              <el-image v-if="row.img_url" :src="row.img_url" fit="contain" style="width: 48px; height: 48px; border-radius: 4px; border: 1px solid #e4e7ed;" :preview-src-list="[row.img_url]" preview-teleported />
              <div v-else class="no-photo">—</div>
            </template>
          </el-table-column>
          <el-table-column label="Specification" min-width="200">
            <template #default="{ row }">
              <el-input v-model="row.spec" type="textarea" :rows="3" size="small" style="font-size: 11px; line-height: 1.4;" />
            </template>
          </el-table-column>
          <el-table-column label="单箱数量" width="90" align="center">
            <template #default="{ row }">
              <el-input-number v-model="row.pcs_per_ctn" :min="1" :controls="false" size="small" style="width: 100%" @change="calcRow(row)" />
            </template>
          </el-table-column>
          <el-table-column label="纸箱数" width="90" align="center">
            <template #default="{ row }">
              <el-input-number v-model="row.ctns" :min="0" :controls="false" size="small" style="width: 100%" @change="calcRow(row)" />
            </template>
          </el-table-column>
          <el-table-column label="订单数量" width="100" align="center">
            <template #default="{ row }">
              <el-input-number v-model="row.qty" :min="0" :controls="false" size="small" readonly style="width: 100%" />
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
          <span>订单外销总额：</span>
          <span class="total-amount">{{ priceSign }}{{ formatMoney(orderTotal) }}</span>
        </div>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取 消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保存订单</el-button>
      </template>
    </el-dialog>

    <!-- ========== PI 预览弹窗 ========== -->
    <el-dialog
      v-model="piVisible"
      :title="`PROFORMA INVOICE - ${piData?.pi_number || ''}`"
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
  listOrders, getOrder, createOrder, updateOrder, deleteOrder, getNextOrderNumber
} from '@/api/orders'
import { listClients } from '@/api/clients'
import { listProducts } from '@/api/products'
import { listSuppliers } from '@/api/suppliers'
import { listBankAccounts } from '@/api/bankAccounts'
import { listPaymentTerms } from '@/api/paymentTerms'
import { getCompanySettings } from '@/api/companySettings'

const STATUSES = ['PI确认', '生产中', '已发货', '已到港', '已签收', '已完成']
const statusTag = { PI确认: 'info', 生产中: 'warning', 已发货: 'primary', 已到港: 'primary', 已签收: 'success', 已完成: 'success' }

const loading = ref(false)
const saving = ref(false)
const list = ref([])
const total = ref(0)
const clientOptions = ref([])
const productOptions = ref([])
const supplierOptions = ref([])
const bankOptions = ref([])
const paymentTermOptions = ref([])
const companySettings = ref({})
const query = reactive({ q: '', status: '', page: 1, pageSize: 10 })

// 明细单价币种切换：默认人民币，点击列头在 ¥/$ 间切换
const priceCurrency = ref('RMB') // 'RMB' 或 'USD'
const priceSign = computed(() => priceCurrency.value === 'RMB' ? '¥' : '$')

const dialogVisible = ref(false)
const formRef = ref()
const form = ref({})

// PI 预览
const piVisible = ref(false)
const piData = ref(null)
const piContentRef = ref(null)
const piHtml = ref('')

const rules = {
  pi_number: [{ required: true, message: 'PI 编号不能为空', trigger: 'blur' }],
  signing_date: [{ required: true, message: '请选择签约日期', trigger: 'change' }],
  client_id: [{ required: true, message: '请选择签约客户', trigger: 'change' }]
}

const blankForm = () => ({
  pi_number: '', signing_date: '', client_id: null, supplier_id: null,
  currency: 'USD', trade_terms: 'FOB', customs_responsibility: '我司代办报关',
  pay_method: 'bank', bank_account_id: null, alipay_qrcode: null, payment_terms: '', delivery_date: '',
  loading_port: 'Ningbo, China', destination_port: '',
  packing_desc: 'Standard Neutral Export Cartons',
  special_req: 'Standard requirements.',
  show_special_req: true, show_stamp: true,
  total_amount: undefined, quotation_id: null, items: []
})
const blankItem = () => ({
  product_id: null, model: '', name_en: '', hs_code: '', unit: '',
  img_url: '', spec: '', pcs_per_ctn: 1, ctns: 0, qty: 0,
  price: undefined, price_rmb: undefined, subtotal_amount: 0,
  nw_per_ctn: null, gw_per_ctn: null, cbm_per_ctn: null
})

const orderTotal = computed(() => (form.value.items || []).reduce((s, it) => s + (Number(it.subtotal_amount) || 0), 0))
function formatMoney(v) { return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

/* ========== 辅助函数（移植自参考项目 utils.js） ========== */
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

function getOrderTotals(order) {
  let qty = 0, amount = 0, ctns = 0, nw = 0, gw = 0, cbm = 0
  ;(order.items || []).forEach(it => {
    const q = Number(it.qty || 0)
    const p = Number(it.price || 0)
    const itemCtns = Number(it.ctns || Math.ceil(q / (it.pcs_per_ctn || 1)))
    qty += q; amount += q * p; ctns += itemCtns
    nw += itemCtns * Number(it.nw_per_ctn || it.nwPerCtn || 0)
    gw += itemCtns * Number(it.gw_per_ctn || it.gwPerCtn || 0)
    cbm += itemCtns * Number(it.cbm_per_ctn || it.cbmPerCtn || 0)
  })
  return { qty, amount, ctns, nw: nw.toFixed(1), gw: gw.toFixed(1), cbm: cbm.toFixed(3) }
}

/* ========== 数据加载 ========== */
async function loadList() {
  loading.value = true
  try {
    const d = await listOrders({ q: query.q, status: query.status, page: query.page, pageSize: query.pageSize })
    list.value = d.list; total.value = d.total
  } catch { /* 拦截器 */ }
  finally { loading.value = false }
}

async function loadOptions() {
  try {
    const [c, p, s, b, t, co] = await Promise.all([
      listClients({ page: 1, pageSize: 500 }),
      listProducts({ page: 1, pageSize: 500 }),
      listSuppliers({ page: 1, pageSize: 500 }),
      listBankAccounts({ page: 1, pageSize: 500 }),
      listPaymentTerms().catch(() => ({ list: [] })),
      getCompanySettings()
    ])
    clientOptions.value = c.list
    productOptions.value = p.list
    supplierOptions.value = s.list
    bankOptions.value = b.list
    paymentTermOptions.value = t.list || []
    companySettings.value = co || {}
  } catch { /* 拦截器 */ }
}

/* ========== 表单交互 ========== */
function onClientChange(clientId) {
  if (!clientId) { form.value.destination_port = ''; return }
  const c = clientOptions.value.find(x => x.id === clientId)
  if (c && c.destination_port) form.value.destination_port = c.destination_port
}
function onProductPick(row, productId) {
  row.product_id = productId
  const p = productOptions.value.find(x => x.id === productId)
  if (!p) return
  row.model = p.model; row.name_en = p.name_en
  row.hs_code = p.hs_code; row.unit = p.unit || '台'; row.img_url = p.img_url || ''
  row.pcs_per_ctn = p.pcs_per_ctn ?? 1
  row.nw_per_ctn = p.net_weight_kg ?? null; row.gw_per_ctn = p.gross_weight_kg ?? null
  row.cbm_per_ctn = p.ctn_cbm ?? null
  // 以产品数据库的人民币外销价为基准，USD 模式下派生显示
  row.price_rmb = p.export_price_usd ?? undefined
  if (row.price_rmb != null && priceCurrency.value === 'USD') {
    const usdRate = Number(companySettings.value.default_usd_rate) || 7.2
    row.price = Number((row.price_rmb / usdRate).toFixed(2))
  } else {
    row.price = row.price_rmb
  }
  row.ctns = 1
  // Specification（产品英文名已在标题列以粗体单独展示，不再写入 spec 避免重复）
  const specLines = []
  if (p.spec) specLines.push(p.spec)
  if (p.hs_code) specLines.push('HS: ' + p.hs_code)
  row.spec = specLines.join('\n')
  calcRow(row)
}
function calcRow(row) {
  const pcs = Number(row.pcs_per_ctn) || 0
  const ctns = Number(row.ctns) || 0
  // 手动改了单价 → 同步回基准 RMB 价
  const p = Number(row.price) || 0
  if (p > 0) {
    if (priceCurrency.value === 'RMB') {
      row.price_rmb = p
    } else {
      const usdRate = Number(companySettings.value.default_usd_rate) || 7.2
      row.price_rmb = Number((p * usdRate).toFixed(2))
    }
  }
  row.qty = pcs * ctns
  row.subtotal_amount = Number((row.qty * p).toFixed(2))
}

// 切换明细单价币种：人民币 ↔ 美元
// 始终以 price_rmb（产品数据库的人民币外销价）为基准派生，不做反向乘回，消除精度漂移
function togglePriceCurrency() {
  const usdRate = Number(companySettings.value.default_usd_rate) || 7.2
  const to = priceCurrency.value === 'RMB' ? 'USD' : 'RMB'
  ;(form.value.items || []).forEach((it) => {
    const rmb = Number(it.price_rmb) || 0
    if (rmb <= 0) return
    it.price = to === 'RMB' ? rmb : Number((rmb / usdRate).toFixed(2))
    const p = Number(it.price) || 0
    it.subtotal_amount = Number(((Number(it.qty) || 0) * p).toFixed(2))
  })
  priceCurrency.value = to
}
function addItemRow() { form.value.items.push(blankItem()) }
function onSearch() { query.page = 1; loadList() }

async function openCreate() {
  form.value = blankForm()
  priceCurrency.value = 'RMB'
  try { form.value.pi_number = await getNextOrderNumber() } catch {}
  form.value.signing_date = new Date().toISOString().slice(0, 10)
  form.value.payment_terms =
    paymentTermOptions.value.find((t) => t.is_default)?.term_text
    || companySettings.value.payment_terms_template
    || '30% T/T Deposit, 70% Against B/L Copy'
  addItemRow(); dialogVisible.value = true
}

async function openEdit(row) {
  const detail = await getOrder(row.id)
  priceCurrency.value = 'RMB' // 编辑时默认人民币显示，用户可点击切换
  detail.show_special_req = !!detail.show_special_req
  detail.show_stamp = !!detail.show_stamp
  // 收款方式：有支付宝收款码即视为支付宝模式（与银行账户互斥）
  detail.pay_method = detail.alipay_qrcode ? 'alipay' : 'bank'
  detail.items = (detail.items || []).map(it => ({
    ...it,
    price_rmb: it.price_rmb ?? it.price ?? undefined, // 已存订单以 price 为 RMB 基准
    subtotal_amount: Number(it.subtotal_amount) || 0
  }))
  form.value = detail
  dialogVisible.value = true
}

/* ========== 收款方式：银行账户 / 支付宝（互斥） ========== */
function onPayMethodChange(method) {
  if (method === 'alipay') {
    form.value.bank_account_id = null // 切支付宝：清空银行账户
  } else {
    form.value.alipay_qrcode = null   // 切银行账户：清空收款码
  }
}

// 支付宝收款码上传：压缩为最长边 500px 的 base64（保持 PNG 以确保二维码清晰可扫）
function handleAlipayImg(file) {
  const MAX_SIDE = 500
  const reader = new FileReader()
  reader.onload = (evt) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      form.value.alipay_qrcode = canvas.toDataURL('image/png', 0.9)
      ElMessage.success('收款码已预览，保存订单后生效')
    }
    img.src = evt.target.result
  }
  reader.readAsDataURL(file)
  return false // 阻止自动上传，只做本地压缩
}

async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  const items = (form.value.items || []).filter(it => it.model && it.price != null)
  if (items.length === 0) { ElMessage.warning('请至少添加一行商品明细'); return }
  form.value.total_amount = Number(orderTotal.value.toFixed(2))
  // 收款方式互斥落库：支付宝 → 清空银行账户；银行账户 → 清空收款码
  if (form.value.pay_method === 'alipay' && !form.value.alipay_qrcode) {
    ElMessage.warning('已选择支付宝收款，请先上传收款二维码')
    return
  }
  const payload = {
    ...form.value,
    show_special_req: form.value.show_special_req ? 1 : 0,
    show_stamp: form.value.show_stamp ? 1 : 0,
    bank_account_id: form.value.pay_method === 'alipay' ? null : form.value.bank_account_id,
    alipay_qrcode: form.value.pay_method === 'alipay' ? form.value.alipay_qrcode : null,
    items
  }
  saving.value = true
  try {
    if (form.value.id) {
      const r = await updateOrder(form.value.id, payload)
      ElMessage.success(r?.docs_generated ? '更新成功，已根据报关责任自动生成购销合同等单据默认数据' : '更新成功')
    }
    else { await createOrder(payload); ElMessage.success('创建成功') }
    dialogVisible.value = false; loadList()
  } catch { /* 拦截器 */ }
  finally { saving.value = false }
}

async function onDelete(row) {
  const ok = await ElMessageBox.confirm(`确认删除订单「${row.pi_number}」？`, '删除确认', { type: 'warning' }).catch(() => false)
  if (!ok) return
  try { await deleteOrder(row.id); ElMessage.success('删除成功') } catch {}
  loadList()
}

/* ========== PI 生成 ========== */
async function openPi(row) {
  const detail = await getOrder(row.id)
  // 每次打开 PI 都重新拉企业配置，确保签章等最新值（企业配置页保存后订单页缓存不会自动刷新）
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
  const totals = getOrderTotals(order)
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
        <div>REF: ${order.pi_number || ''}</div>
      </div>
    </div>
    <div style="text-align:center; margin:14px 0 12px; padding-bottom:10px; border-bottom:1.5px solid #0f172a; font-size:15pt; font-weight:900; letter-spacing:1px; text-transform:uppercase; color:#0f172a;">PROFORMA INVOICE</div>
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
      <strong>PI NO.:</strong> ${order.pi_number}<br>
      <strong>TRADE TERMS:</strong> ${order.trade_terms || ''} ${order.loading_port || ''}<br>
      <strong>DESTINATION PORT:</strong> ${order.destination_port || ''}<br>
      <strong>PAYMENT TERMS:</strong> ${order.payment_terms || ''}<br>
      <strong>ESTIMATED DELIVERY:</strong> ${order.delivery_date || 'Within 30 days'}
    </div>
  `

  // 明细表格
  const itemsRows = (order.items || []).map((it, idx) => {
    const qty = Number(it.qty || 0), price = Number(it.price || 0)
    // 剥离 spec 快照中的 HS 行与与产品英文名重复的行（兼容历史数据）
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
          <strong>${it.name_en || ''}</strong>
          ${specClean ? `<br><span style="font-size:9.5px; color:#475569; white-space:pre-wrap;">${specClean}</span>` : ''}
          ${hsCode ? `<br><span style="font-size:9px; color:#94a3b8;">HS: ${hsCode}</span>` : ''}
        </td>
        <td style="text-align:center;">${it.pcs_per_ctn || ''}</td>
        <td style="text-align:center;">${it.ctns || ''}</td>
        <td style="text-align:right; font-weight:bold;">${qty}</td>
        <td style="text-align:right;">${currSign}${formatMoney(price)}</td>
        <td style="text-align:right; font-weight:bold;">${currSign}${formatMoney(qty * price)}</td>
      </tr>
    `
  }).join('')

  const totalsRow = `
    <tr style="font-weight:bold; background:#f8fafc;">
      <td colspan="5" style="text-align:right;">TOTAL:</td>
      <td style="text-align:center;">${totals.ctns}</td>
      <td style="text-align:right;">${totals.qty}</td>
      <td></td>
      <td style="text-align:right; color:#059669;">${currSign}${formatMoney(totals.amount)}</td>
    </tr>
  `

  const table = `
    <table>
      <thead><tr>
        <th style="width:30px; text-align:center;">NO.</th>
        <th style="width:9%; text-align:center;">Art No.</th>
        <th style="width:90px; text-align:center;">Photo</th>
        <th style="width:30%; text-align:center;">Product Name & Specification</th>
        <th style="width:8%; text-align:center;">PCS/CTN</th>
        <th style="width:8%; text-align:center;">CTNS</th>
        <th style="width:10%; text-align:center;">Total Qty (pcs)</th>
        <th style="width:10%; text-align:center;">Price</th>
        <th style="width:12%; text-align:center;">Amount</th>
      </tr></thead>
      <tbody>${itemsRows}${totalsRow}</tbody>
    </table>
  `

  // SAY TOTAL WORDS
  const sayTotal = `
    <div style="margin-top:6px; font-weight:bold; font-size:10px;">
      ${order.currency === 'RMB' ? 'SAY TOTAL CHINESE YUAN ' : 'SAY TOTAL US DOLLARS '}${totalWords} ONLY
    </div>
  `

  // TOTAL PACKAGES / MEASUREMENT / GROSS WEIGHT
  const totalStats = `
    <div style="margin-top:12px; font-size:11px; line-height:1.8;">
      <div><strong>TOTAL PACKAGES:</strong> ${totals.ctns} CARTONS</div>
      <div><strong>TOTAL MEASUREMENT:</strong> ${totals.cbm} CBM</div>
      <div><strong>TOTAL GROSS WEIGHT:</strong> ${totals.gw} KGS</div>
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

  // ARBITRATION AWARD CLAUSE（冲裁条款，位于银行信息与仲裁条款之间）
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

  // 签章区：优先企业配置上传的 seal_img（base64），无则回退 public/seal.png 静态文件
  const signHtml = order.show_stamp
    ? `<img src="${company.seal_img || '/seal.png'}" style="max-width:220px; max-height:130px; display:block; margin-top:4px;" alt="SEAL" />`
    : `<div style="margin-top:35px; border-bottom:1px solid #94a3b8; width:180px; display:inline-block;"></div><p style="margin-top:4px; color:#64748b; font-size:9px;">Authorized Signature & Chop</p>`

  const signatures = `
    <div style="margin-top:40px; display:flex; justify-content:space-between; font-size:11px;">
      <div style="text-align:left;">
        <p><strong>ACCEPTED & CONFIRMED BY BUYER:</strong><br>${client.name_en || 'BUYER'}</p>
        <div style="margin-top:35px; border-bottom:1px solid #94a3b8; width:180px;"></div>
        <p style="margin-top:4px; color:#64748b; font-size:9px;">Authorized Signature & Chop</p>
      </div>
      <div style="text-align:right;">
        <p><strong>FOR AND ON BEHALF OF SELLER:</strong><br>${company.name_en || ''}</p>
        ${signHtml}
      </div>
    </div>
  `

  return header +
    `<div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:12px; font-size:11px;">${buyerBox}${piInfoBox}</div>` +
    table + sayTotal + totalStats + specialReq + bankHtml + awardClause + arbitration + signatures
}

function onPrint() {
  const win = window.open('', '_blank', 'width=1200,height=900')
  win.document.write(`
    <!DOCTYPE html>
    <html><head><meta charset="utf-8">
    <title>PROFORMA INVOICE - ${piData.value?.pi_number || ''}</title>
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
      .doc-title-section { text-align: center; margin: 12px 0; padding: 8px 0; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; }
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
  a.href = url; a.download = `PI_${piData.value?.pi_number || 'export'}.xls`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

onMounted(() => { loadList(); loadOptions() })
</script>

<style scoped>
.opt-sub { color: #909399; font-size: 12px; }
.form-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0 16px; }
.form-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0 16px; }
.divider-title { display: flex; justify-content: space-between; align-items: center; width: 100%; font-size: 14px; font-weight: 600; padding-right: 10px; }
.items-table { font-size: 12px; }
.items-table .el-table__cell { padding: 4px 6px; }
.no-photo { width: 48px; height: 48px; line-height: 48px; text-align: center; background: #f5f7fa; border-radius: 4px; color: #c0c4cc; }
.subtotal { font-weight: 600; color: #16a34a; }
.progress-text { font-size: 11px; color: #909399; margin-top: 2px; }
.field-hint { font-size: 12px; color: #e6a23c; line-height: 1.5; margin-top: 2px; }
.alipay-preview { display: flex; align-items: center; gap: 8px; }
.alipay-img { width: 110px; height: 110px; border: 1px solid #e2e8f0; border-radius: 4px; background: #f8fafc; }
.total-bar { display: flex; justify-content: flex-end; align-items: center; margin-top: 14px; padding: 10px 16px; background: #f0f9eb; border-radius: 4px; font-size: 14px; }
.total-amount { font-size: 18px; font-weight: 700; color: #16a34a; margin-left: 8px; }

/* ======== PI 预览样式 ======== */
.pi-toolbar { display: flex; gap: 8px; margin-bottom: 10px; }
.doc-page { background: white; padding: 35px 40px; font-size: 11px; color: #0f172a; line-height: 1.5; border: 1px solid #cbd5e1; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.doc-page table { font-size: 11px; margin: 10px 0; width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; }
.doc-page th, .doc-page td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: middle; }
.doc-page th { background: #f8fafc; }
.doc-badge-title { font-size: 15pt; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; color: #0f172a; }
.doc-title-section { text-align: center; margin: 12px 0; padding: 8px 0; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; }

/* 打印时隐藏工具栏 */
@media print {
  :deep(.no-print) { display: none !important; }
  :deep(.el-dialog__header), :deep(.el-dialog__footer) { display: none !important; }
}
</style>
