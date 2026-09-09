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
      <el-button :icon="Search" @click="onSearch">搜索</el-button>
      <div class="toolbar-right">
        <span class="filter-tag">仅显示「我司代办报关」订单</span>
      </div>
    </div>

    <!-- 列表 -->
    <el-table v-loading="loading" :data="list" border stripe>
      <el-table-column prop="pi_number" label="PI 编号" width="160" />
      <el-table-column prop="client_name" label="客户名" min-width="200" show-overflow-tooltip />
      <el-table-column prop="destination_port" label="目的港" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ row.destination_port || '—' }}</template>
      </el-table-column>
      <el-table-column prop="loading_port" label="起运港" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">{{ row.loading_port || '—' }}</template>
      </el-table-column>
      <el-table-column prop="trade_terms" label="贸易条款" width="110" align="center">
        <template #default="{ row }">
          <el-tag size="small" type="info">{{ row.trade_terms || '—' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="500" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openPreview(row, 'inv')">📄 Commercial Invoice</el-button>
          <el-button link type="success" @click="openPreview(row, 'cont')">📝 Sales Contract</el-button>
          <el-button link type="primary" @click="openPreview(row, 'pl')">📦 Packing List</el-button>
          <el-button link type="primary" @click="openEditClearance(row)">编辑清关资料</el-button>
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

    <!-- ========== 单据预览弹窗 ========== -->
    <el-dialog
      v-model="previewVisible"
      :title="previewTitle"
      width="1100px"
      destroy-on-close
      top="3vh"
      class="doc-dialog"
    >
      <div class="doc-toolbar no-print">
        <el-button :icon="Printer" @click="onPrint">🖨️ 打印 / 另存为 PDF</el-button>
        <el-button type="success" @click="onExportExcel">📊 下载 Excel (.xls)</el-button>
      </div>

      <div class="doc-page" v-html="previewHtml"></div>

      <template #footer>
        <el-button @click="previewVisible = false">关 闭</el-button>
      </template>
    </el-dialog>

    <!-- ========== 编辑清关资料 (customs_data) 弹窗 ========== -->
    <el-dialog
      v-model="editVisible"
      :title="`编辑清关资料 - ${editForm.pi_number || ''}`"
      width="1200px"
      destroy-on-close
      top="5vh"
    >
      <el-form ref="editFormRef" :model="editForm" label-width="120px">
        <div class="form-grid-4">
          <el-form-item label="合同号 SC No.">
            <el-input v-model="editForm.sc_no" placeholder="SC No." />
          </el-form-item>
          <el-form-item label="发票号 Inv No.">
            <el-input v-model="editForm.inv_no" placeholder="Inv No." />
          </el-form-item>
          <el-form-item label="日期">
            <el-date-picker v-model="editForm.date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
          <el-form-item label="付款方式">
            <el-input v-model="editForm.payment_terms" placeholder="付款方式" />
          </el-form-item>
        </div>
        <div class="form-grid-4">
          <el-form-item label="价格条款">
            <el-input v-model="editForm.price_terms" placeholder="如: FOB" />
          </el-form-item>
          <el-form-item label="装运时间">
            <el-input v-model="editForm.loading_time" placeholder="装运时间" />
          </el-form-item>
          <el-form-item label="起运港">
            <el-input v-model="editForm.loading_port" placeholder="起运港" />
          </el-form-item>
          <el-form-item label="目的港">
            <el-input v-model="editForm.dest_port" placeholder="目的港" />
          </el-form-item>
        </div>
        <div class="form-grid-4">
          <el-form-item label="运输方式">
            <el-input v-model="editForm.shipping_method" placeholder="如: BY SEA" />
          </el-form-item>
          <el-form-item label="唛头">
            <el-input v-model="editForm.shipping_mark" placeholder="唛头" />
          </el-form-item>
          <el-form-item label="金额大写" class="grid-col-2">
            <el-input v-model="editForm.total_amount_en" placeholder="SAY TOTAL ... ONLY" />
          </el-form-item>
        </div>

        <el-divider content-position="left">
          <div class="divider-title">
            清关商品明细
            <el-button type="primary" size="small" plain :icon="Plus" @click="addClearanceItem">+ 添加商品行</el-button>
          </div>
        </el-divider>

        <el-table :data="editForm.items" border size="small" class="items-table">
          <el-table-column type="index" label="No." width="55" align="center" />
          <el-table-column label="货物描述 (Description)" min-width="220">
            <template #default="{ row }">
              <el-input v-model="row.product" size="small" placeholder="货物描述" type="textarea" :rows="2" />
            </template>
          </el-table-column>
          <el-table-column label="数量" width="90" align="center">
            <template #default="{ row }">
              <el-input-number v-model="row.qty" :min="0" :controls="false" size="small" style="width: 100%" @change="calcClearanceRow(row)" />
            </template>
          </el-table-column>
          <el-table-column label="箱数 (CTN)" width="90" align="center">
            <template #default="{ row }">
              <el-input-number v-model="row.ctn" :min="0" :controls="false" size="small" style="width: 100%" />
            </template>
          </el-table-column>
          <el-table-column label="净重 N.W." width="90" align="center">
            <template #default="{ row }">
              <el-input-number v-model="row.nw" :min="0" :step="0.1" :controls="false" size="small" style="width: 100%" />
            </template>
          </el-table-column>
          <el-table-column label="毛重 G.W." width="90" align="center">
            <template #default="{ row }">
              <el-input-number v-model="row.gw" :min="0" :step="0.1" :controls="false" size="small" style="width: 100%" />
            </template>
          </el-table-column>
          <el-table-column label="体积 CBM" width="90" align="center">
            <template #default="{ row }">
              <el-input-number v-model="row.cbm" :min="0" :step="0.001" :controls="false" size="small" style="width: 100%" />
            </template>
          </el-table-column>
          <el-table-column label="唛头" width="120">
            <template #default="{ row }">
              <el-input v-model="row.shipping_mark" size="small" placeholder="唛头" />
            </template>
          </el-table-column>
          <el-table-column label="单价" width="110" align="center">
            <template #default="{ row }">
              <el-input-number v-model="row.price" :min="0" :step="0.01" :controls="false" size="small" style="width: 100%" @change="calcClearanceRow(row)" />
            </template>
          </el-table-column>
          <el-table-column label="总价" width="120" align="right">
            <template #default="{ row }">
              <span class="subtotal">${{ formatMoney(row.total) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="60" align="center" fixed="right">
            <template #default="{ $index }">
              <el-button link type="danger" size="small" @click="editForm.items.splice($index, 1)">✕</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="total-bar">
          <span>清关合计：</span>
          <span class="total-amount">${{ formatMoney(clearanceTotal) }}</span>
        </div>
      </el-form>

      <template #footer>
        <el-button @click="editVisible = false">取 消</el-button>
        <el-button type="primary" :loading="saving" @click="onSaveClearance">保存清关资料</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { onMounted, reactive, ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Search, Printer } from '@element-plus/icons-vue'
import { listOrders, getOrder, updateOrder } from '@/api/orders'
import { getCompanySettings } from '@/api/companySettings'
import { listClients } from '@/api/clients'
import {
  formatMoney, numberToEnglishWords, getOrderTotals, printDocument, exportExcel
} from '@/utils/docUtils'

const loading = ref(false)
const saving = ref(false)
const list = ref([])
const total = ref(0)
const companySettings = ref({})
const clientOptions = ref([])
const query = reactive({ q: '', page: 1, pageSize: 10 })

// 预览
const previewVisible = ref(false)
const previewTitle = ref('')
const previewHtml = ref('')
const previewDocType = ref('')
const previewOrder = ref(null)

// 编辑 customs_data
const editVisible = ref(false)
const editFormRef = ref()
const editForm = ref({
  id: null,
  pi_number: '',
  sc_no: '',
  inv_no: '',
  date: '',
  payment_terms: '',
  price_terms: '',
  loading_time: '',
  loading_port: '',
  dest_port: '',
  shipping_method: '',
  shipping_mark: '',
  total_amount_en: '',
  items: []
})

const clearanceTotal = computed(() => (editForm.value.items || []).reduce((s, it) => s + Number(it.total || 0), 0))

const docTitleMap = {
  inv: 'COMMERCIAL INVOICE',
  cont: 'SALES CONTRACT',
  pl: 'PACKING LIST'
}

/* ========== 数据加载 ========== */
async function loadList() {
  loading.value = true
  try {
    const d = await listOrders({
      q: query.q,
      page: query.page,
      pageSize: query.pageSize,
      customs_responsibility: '我司代办报关'
    })
    list.value = d.list
    total.value = d.total
  } catch { /* 拦截器 */ }
  finally { loading.value = false }
}

async function loadOptions() {
  try {
    const [co, c] = await Promise.all([
      getCompanySettings(),
      listClients({ page: 1, pageSize: 500 })
    ])
    companySettings.value = co || {}
    clientOptions.value = c.list
  } catch { /* 拦截器 */ }
}

function onSearch() { query.page = 1; loadList() }

/* ========== Commercial Invoice / Sales Contract / Packing List HTML ========== */
function buildCustomsDocHtml(order, company, client, docType) {
  const cd = order.customs_data || {}
  const items = cd.items || []
  const totals = getOrderTotals(order)
  const currSign = order.currency === 'RMB' ? '¥' : '$'
  let title = 'COMMERCIAL INVOICE'
  if (docType === 'cont') title = 'SALES CONTRACT'
  if (docType === 'pl') title = 'PACKING LIST'
  const docNo = docType === 'inv' ? cd.inv_no : (docType === 'cont' ? cd.sc_no : cd.inv_no)

  let itemsTable = ''
  if (docType === 'pl') {
    itemsTable = `<table><thead><tr><th style="width:30px;text-align:center;">NO.</th><th>Description of Goods</th><th style="text-align:center;">CTNS</th><th style="text-align:center;">Qty (pcs)</th><th style="text-align:center;">N.W.(kg)</th><th style="text-align:center;">G.W.(kg)</th><th style="text-align:center;">CBM</th></tr></thead>
      <tbody>${items.map((it, idx) => `<tr><td style="text-align:center;">${idx + 1}</td><td>${it.product || ''}</td><td style="text-align:center;">${it.ctn || 0}</td><td style="text-align:right;">${it.qty || 0}</td><td style="text-align:right;">${it.nw || 0}</td><td style="text-align:right;">${it.gw || 0}</td><td style="text-align:right;">${it.cbm || 0}</td></tr>`).join('')}</tbody>
      <tfoot><tr style="font-weight:bold;background:#f8fafc;"><td colspan="2" style="text-align:right;">TOTAL:</td><td style="text-align:center;">${totals.ctns}</td><td style="text-align:right;">${totals.qty}</td><td></td><td style="text-align:right;">${totals.gw}</td><td style="text-align:right;">${totals.cbm}</td></tr></tfoot></table>`
  } else {
    itemsTable = `<table><thead><tr><th style="width:30px;text-align:center;">NO.</th><th style="width:40%;">Description of Goods</th><th style="width:12%;text-align:center;">Qty</th><th style="width:12%;text-align:center;">Unit</th><th style="width:15%;text-align:right;">Unit Price</th><th style="width:15%;text-align:right;">Amount</th></tr></thead>
      <tbody>${items.map((it, idx) => `<tr><td style="text-align:center;">${idx + 1}</td><td>${it.product || ''}</td><td style="text-align:right;font-weight:bold;">${it.qty || 0}</td><td style="text-align:center;">PCS</td><td style="text-align:right;">${currSign}${formatMoney(it.price || 0)}</td><td style="text-align:right;font-weight:bold;">${currSign}${formatMoney(it.total || 0)}</td></tr>`).join('')}</tbody>
      <tfoot><tr style="font-weight:bold;background:#f8fafc;"><td colspan="5" style="text-align:right;">TOTAL:</td><td style="text-align:right;color:#059669;">${currSign}${formatMoney(items.reduce((s, it) => s + Number(it.total || 0), 0))}</td></tr></tfoot></table>`
  }

  return `
    <div style="padding-bottom:10px;display:flex;justify-content:space-between;">
      <div><h1 style="font-size:18px;font-weight:900;text-transform:uppercase;">${company.name_en || ''}</h1><p style="font-size:12px;font-weight:bold;">${company.name_cn || ''}</p><p style="font-size:10px;color:#64748b;">${company.address_en || ''}</p><p style="font-size:10px;color:#64748b;">TEL: ${company.tel || ''} | EMAIL: ${company.email || ''}</p></div>
      <div style="text-align:right;font-size:10px;color:#64748b;"><div>DATE: ${cd.date || order.signing_date || ''}</div><div>REF: ${docNo || order.pi_number}</div></div>
    </div>
    <div class="doc-title-section"><span class="doc-badge-title">${title}</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:12px;font-size:11px;">
      <div style="border:1px solid #cbd5e1;padding:8px;border-radius:4px;"><strong>To:</strong><br><strong>${client.name_en || client.name || ''}</strong><br>${client.address_en || client.address || ''}</div>
      <div style="border:1px solid #cbd5e1;padding:8px;border-radius:4px;line-height:1.6;"><strong>NO.:</strong> ${docNo || ''}<br><strong>PRICE TERMS:</strong> ${cd.price_terms || order.trade_terms || ''} ${cd.loading_port || order.loading_port || ''}<br><strong>PAYMENT TERMS:</strong> ${cd.payment_terms || order.payment_terms || ''}<br><strong>PORT OF LOADING:</strong> ${cd.loading_port || order.loading_port || ''}<br><strong>PORT OF DISCHARGE:</strong> ${cd.dest_port || order.destination_port || ''}<br><strong>SHIPPING METHOD:</strong> ${cd.shipping_method || 'BY SEA'}</div>
    </div>
    ${itemsTable}
    ${docType !== 'pl' ? `<div style="margin-top:6px;font-weight:bold;font-size:10px;">${cd.total_amount_en || ('SAY TOTAL ' + (order.currency === 'RMB' ? 'CHINESE YUAN' : 'US DOLLARS') + ' ' + numberToEnglishWords(items.reduce((s, it) => s + Number(it.total || 0), 0)) + ' ONLY')}</div>` : ''}
    ${docType === 'pl' ? `<div style="margin-top:12px;font-size:11px;line-height:1.8;"><div><strong>TOTAL PACKAGES:</strong> ${totals.ctns} CARTONS</div><div><strong>TOTAL GROSS WEIGHT:</strong> ${totals.gw} KGS</div><div><strong>TOTAL MEASUREMENT:</strong> ${totals.cbm} CBM</div></div>` : ''}
    <div style="margin-top:40px;display:flex;justify-content:space-between;font-size:11px;"><div><strong>SELLER:</strong><br>${company.name_en || ''}</div><div style="text-align:right;"><strong>BUYER:</strong><br>${client.name_en || client.name || ''}</div></div>
  `
}

/* ========== 预览交互 ========== */
async function openPreview(row, docType) {
  try {
    const detail = await getOrder(row.id)
    previewOrder.value = detail
    previewDocType.value = docType
    const company = companySettings.value || {}
    const client = clientOptions.value.find(c => c.id === detail.client_id) || {}
    const html = buildCustomsDocHtml(detail, company, client, docType)
    previewHtml.value = html
    previewTitle.value = `${docTitleMap[docType] || ''} - ${detail.pi_number || ''}`
    previewVisible.value = true
  } catch { /* 拦截器 */ }
}

function onPrint() {
  printDocument(previewHtml.value, previewTitle.value)
}

function onExportExcel() {
  const order = previewOrder.value || {}
  const fileName = `${previewDocType.value}_${order.pi_number || 'export'}.xls`
  exportExcel(previewHtml.value, fileName)
}

/* ========== 编辑 customs_data ========== */
function blankClearanceItem() {
  return {
    product: '', qty: 0, ctn: 0, nw: 0, gw: 0, cbm: 0,
    shipping_mark: '', price: 0, total: 0
  }
}

function calcClearanceRow(row) {
  const qty = Number(row.qty || 0)
  const price = Number(row.price || 0)
  row.total = Number((qty * price).toFixed(2))
}

function addClearanceItem() {
  editForm.value.items.push(blankClearanceItem())
}

async function openEditClearance(row) {
  try {
    const detail = await getOrder(row.id)
    const cd = detail.customs_data || {}
    editForm.value = {
      id: detail.id,
      pi_number: detail.pi_number,
      sc_no: cd.sc_no || '',
      inv_no: cd.inv_no || detail.pi_number || '',
      date: cd.date || detail.signing_date || '',
      payment_terms: cd.payment_terms || detail.payment_terms || '',
      price_terms: cd.price_terms || detail.trade_terms || '',
      loading_time: cd.loading_time || '',
      loading_port: cd.loading_port || detail.loading_port || '',
      dest_port: cd.dest_port || detail.destination_port || '',
      shipping_method: cd.shipping_method || 'BY SEA',
      shipping_mark: cd.shipping_mark || '',
      total_amount_en: cd.total_amount_en || '',
      items: (cd.items || []).map(it => ({
        product: it.product || '',
        qty: Number(it.qty || 0),
        ctn: Number(it.ctn || 0),
        nw: Number(it.nw || 0),
        gw: Number(it.gw || 0),
        cbm: Number(it.cbm || 0),
        shipping_mark: it.shipping_mark || '',
        price: Number(it.price || 0),
        total: Number(it.total || 0)
      }))
    }
    if (editForm.value.items.length === 0) editForm.value.items.push(blankClearanceItem())
    editVisible.value = true
  } catch { /* 拦截器 */ }
}

async function onSaveClearance() {
  const payload = {
    customs_data: {
      sc_no: editForm.value.sc_no,
      inv_no: editForm.value.inv_no,
      date: editForm.value.date,
      payment_terms: editForm.value.payment_terms,
      price_terms: editForm.value.price_terms,
      loading_time: editForm.value.loading_time,
      loading_port: editForm.value.loading_port,
      dest_port: editForm.value.dest_port,
      shipping_method: editForm.value.shipping_method,
      shipping_mark: editForm.value.shipping_mark,
      total_amount_en: editForm.value.total_amount_en,
      items: (editForm.value.items || []).map(it => ({
        product: it.product,
        qty: Number(it.qty || 0),
        ctn: Number(it.ctn || 0),
        nw: Number(it.nw || 0),
        gw: Number(it.gw || 0),
        cbm: Number(it.cbm || 0),
        shipping_mark: it.shipping_mark,
        price: Number(it.price || 0),
        total: Number(it.total || 0)
      }))
    }
  }
  saving.value = true
  try {
    await updateOrder(editForm.value.id, payload)
    ElMessage.success('清关资料保存成功')
    editVisible.value = false
    loadList()
  } catch { /* 拦截器 */ }
  finally { saving.value = false }
}

onMounted(() => { loadList(); loadOptions() })
</script>

<style scoped>
.filter-tag {
  display: inline-block;
  padding: 4px 10px;
  background: #ecf5ff;
  color: #409eff;
  border: 1px solid #d9ecff;
  border-radius: 4px;
  font-size: 12px;
}
.form-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0 16px; }
.grid-col-2 { grid-column: span 2; }
.divider-title { display: flex; justify-content: space-between; align-items: center; width: 100%; font-size: 14px; font-weight: 600; padding-right: 10px; }
.items-table { font-size: 12px; }
.items-table .el-table__cell { padding: 4px 6px; }
.subtotal { font-weight: 600; color: #16a34a; }
.total-bar { display: flex; justify-content: flex-end; align-items: center; margin-top: 14px; padding: 10px 16px; background: #f0f9eb; border-radius: 4px; font-size: 14px; }
.total-amount { font-size: 18px; font-weight: 700; color: #16a34a; margin-left: 8px; }

/* ======== 单据预览样式 ======== */
.doc-toolbar { display: flex; gap: 8px; margin-bottom: 10px; }
.doc-page { background: white; padding: 35px 40px; font-size: 11px; color: #0f172a; line-height: 1.5; border: 1px solid #cbd5e1; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.doc-page table { font-size: 11px; margin: 10px 0; width: 100%; border-collapse: collapse; }
.doc-page th, .doc-page td { border: 1px solid #cbd5e1; padding: 6px 8px; }
.doc-page th { background: #f8fafc; }
.doc-badge-title { font-size: 15pt; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; color: #0f172a; }
.doc-title-section { text-align: center; margin: 12px 0; padding: 8px 0; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; }

@media print {
  :deep(.no-print) { display: none !important; }
  :deep(.el-dialog__header), :deep(.el-dialog__footer) { display: none !important; }
}
</style>
