<template>
  <el-card shadow="never" class="page-card">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title">订舱管理 - 海运订舱委托书 (SO)</h2>
    </div>

    <!-- 列表（仿参考项目 renderShipping） -->
    <el-table v-loading="loading" :data="list" stripe>
      <el-table-column label="订舱托书号" width="180">
        <template #default="{ row }">
          <strong style="color: #4f46e5;">{{ row.pi_number }}-SHP</strong>
        </template>
      </el-table-column>
      <el-table-column label="关联外销 PI" width="150">
        <template #default="{ row }">
          <strong>{{ row.pi_number }}</strong>
        </template>
      </el-table-column>
      <el-table-column label="起运港 ➔ 目的港" min-width="200">
        <template #default="{ row }">
          {{ row.loading_port || '—' }} ➔ <strong>{{ row.destination_port || '—' }}</strong>
        </template>
      </el-table-column>
      <el-table-column label="总箱数 / 毛重 / 体积" min-width="230">
        <template #default="{ row }">
          <div>{{ cargoSummary(row) }}</div>
          <span class="fcl-badge">{{ fclInfo(row) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="生成订舱托书 (SO)" width="200" align="center">
        <template #default="{ row }">
          <el-button type="warning" size="small" @click="openPreview(row)">📄 生成订舱单 (SO)</el-button>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" align="center" fixed="right">
        <template #default="{ row }">
          <el-button v-if="canMaintain" plain size="small" @click="openEdit(row)">编辑托书信息</el-button>
        </template>
      </el-table-column>
      <template #empty>暂无订单数据，请先在外销订单中创建订单</template>
    </el-table>

    <!-- ========== 订舱委托书预览弹窗 ========== -->
    <el-dialog
      v-model="previewVisible" :close-on-click-modal="false"
      :title="`BOOKING NOTE (SO) - ${previewOrder?.pi_number || ''}-SHP`"
      width="1100px"
      destroy-on-close
      top="3vh"
      class="bk-dialog"
    >
      <div class="bk-toolbar no-print">
        <el-button type="success" :icon="Download" @click="onExportExcel">下载 Excel (.xls)</el-button>
        <el-button type="warning" :icon="Printer" @click="onPrint">打印 / 另存为 PDF</el-button>
      </div>
      <div class="doc-page" v-html="previewHtml"></div>
      <template #footer>
        <el-button @click="previewVisible = false">关 闭</el-button>
      </template>
    </el-dialog>

    <!-- ========== 编辑订舱委托书弹窗（仿参考项目 modal-booking-edit） ========== -->
    <el-dialog
      v-model="editVisible" :close-on-click-modal="false"
      title="编辑订舱委托书 (Booking Note & Shipping Order)"
      width="900px"
      destroy-on-close
      top="3vh"
    >
      <el-form :model="editForm" label-position="top">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="Shipper (发货人 - 支持手动换行)">
              <el-input v-model="editForm.shipper" type="textarea" :rows="3" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Consignee (收货人 - 支持手动换行)">
              <el-input v-model="editForm.consignee" type="textarea" :rows="3" />
            </el-form-item>
          </el-col>

          <el-col :span="12">
            <el-form-item label="Port of Loading (起运港 - POL)">
              <el-input v-model="editForm.loading_port" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Port of Discharge (卸货港 - POD)">
              <el-input v-model="editForm.discharge_port" />
            </el-form-item>
          </el-col>

          <el-col :span="12">
            <el-form-item label="Port of Delivery (目的地 - Delivery)">
              <el-input v-model="editForm.delivery_port" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Incoterms (价格贸易条款)">
              <el-input v-model="editForm.trade_terms" />
            </el-form-item>
          </el-col>

          <el-col :span="12">
            <el-form-item label="Freight Term (运费条款)">
              <el-select v-model="editForm.freight_term" style="width: 100%">
                <el-option label="Prepaid (运费预付)" value="Prepaid" />
                <el-option label="Collect (运费到付)" value="Collect" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Target Vessel / Voyage (指定船期/航次)">
              <el-input v-model="editForm.vessel" placeholder="选填" />
            </el-form-item>
          </el-col>

          <el-col :span="12">
            <el-form-item label="B/L Type (出单方式)">
              <el-select v-model="editForm.bl_type" style="width: 100%">
                <el-option label="Original (正本提单)" value="Original (正本提单)" />
                <el-option label="Telex Release (电放提单)" value="Telex Release (电放提单)" />
                <el-option label="Sea Waybill (海运单)" value="Sea Waybill (海运单)" />
              </el-select>
            </el-form-item>
          </el-col>

          <el-col :span="24">
            <el-form-item label="柜型柜量 (FCL / LCL)">
              <div class="fcl-row">
                <span>20'GP</span>
                <el-input-number v-model="editForm.qty20" :min="0" :controls="false" style="width: 70px" />
                <span>40'GP</span>
                <el-input-number v-model="editForm.qty40" :min="0" :controls="false" style="width: 70px" />
                <span>40'HQ</span>
                <el-input-number v-model="editForm.qty40hq" :min="0" :controls="false" style="width: 70px" />
                <span class="fcl-divider">|</span>
                <el-checkbox v-model="editForm.is_lcl">走散货拼箱 (LCL)</el-checkbox>
              </div>
            </el-form-item>
          </el-col>

          <el-col :span="24" class="cargo-section">
            <strong class="cargo-section-title">货物与包装明细 (可直接编辑覆盖)</strong>
            <el-row :gutter="16">
              <el-col :span="6">
                <el-form-item label="Marks 唛头">
                  <el-input v-model="editForm.marks" />
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="总件数 (CTNS)">
                  <el-input-number v-model="editForm.ctns" :min="0" :controls="false" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="总毛重 (KGS)">
                  <el-input-number v-model="editForm.gw" :min="0" :precision="1" :controls="false" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="总体积 (CBM)">
                  <el-input-number v-model="editForm.cbm" :min="0" :precision="3" :step="0.001" :controls="false" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label="Cargo Description (货物描述 / 品名规格)">
                  <el-input v-model="editForm.desc" type="textarea" :rows="2" />
                </el-form-item>
              </el-col>
            </el-row>
          </el-col>

          <el-col :span="24">
            <el-form-item label="Remarks (订舱备注说明)">
              <el-input v-model="editForm.remarks" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="warning" :loading="saving" @click="onSave">保存并应用到托书</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Printer, Download } from '@element-plus/icons-vue'
import { listOrders, getOrder, updateOrder } from '@/api/orders'
import { getCompanySettings } from '@/api/companySettings'
import { listClients } from '@/api/clients'
import { getOrderTotals, printDocument, exportExcel } from '@/utils/docUtils'
import { useUserStore } from '@/stores/user'

// 托书维护权限：业务员（等级3）仅可下载打印，编辑由主管及以上操作
const userStore = useUserStore()
const canMaintain = userStore.permissionLevel <= 5

const loading = ref(false)
const saving = ref(false)
const list = ref([])
const clientOptions = ref([])
const companySettings = ref({})

// 预览
const previewVisible = ref(false)
const previewHtml = ref('')
const previewOrder = ref(null)

// 编辑
const editVisible = ref(false)
const editOrder = ref(null)
const editForm = ref({})

/* ========== 工具：JSON 字段兼容解析（对象/字符串/null） ========== */
function parseBooking(v) {
  if (!v) return {}
  if (typeof v === 'string') {
    try { return JSON.parse(v) || {} } catch { return {} }
  }
  return v
}

/* ========== 列表派生（仿参考项目 renderShipping） ========== */
// 箱数/毛重/体积：优先托书已保存值，否则用订单明细聚合
function cargoSummary(row) {
  const bk = parseBooking(row.booking_data)
  const ctns = bk.ctns !== undefined && bk.ctns !== '' ? bk.ctns : (row.total_ctns || 0)
  const gw = bk.gw !== undefined && bk.gw !== '' ? bk.gw : Number(row.total_gw || 0).toFixed(1)
  const cbm = bk.cbm !== undefined && bk.cbm !== '' ? bk.cbm : Number(row.total_cbm || 0).toFixed(3)
  return `${ctns} 箱 | ${gw} KG | ${cbm} M³`
}

// 柜型标签：20GP → 40GP → 40HQ → LCL → 未定柜型
function fclInfo(row) {
  const bk = parseBooking(row.booking_data)
  if (bk.qty20) return `20GPx${bk.qty20}`
  if (bk.qty40) return `40GPx${bk.qty40}`
  if (bk.qty40hq) return `40HQx${bk.qty40hq}`
  if (bk.is_lcl) return 'LCL拼箱'
  return '未定柜型'
}

/* ========== 数据加载（参考项目为全量列表，无分页） ========== */
async function loadList() {
  loading.value = true
  try {
    const d = await listOrders({ page: 1, pageSize: 500 })
    // 订舱委托书仅适用于「我司代办报关」的订单
    list.value = (d.list || []).filter((o) => o.customs_responsibility === '我司代办报关')
  } catch { /* 拦截器 */ }
  finally { loading.value = false }
}

async function loadOptions() {
  try {
    const [c, co] = await Promise.all([
      listClients({ page: 1, pageSize: 500 }),
      getCompanySettings()
    ])
    clientOptions.value = c.list
    companySettings.value = co || {}
  } catch { /* 拦截器 */ }
}

/* ========== 生成订舱单预览 ========== */
async function openPreview(row) {
  try {
    const detail = await getOrder(row.id)
    detail.booking_data = parseBooking(detail.booking_data)
    previewOrder.value = detail
    const client = clientOptions.value.find(c => c.id === detail.client_id) || {}
    previewHtml.value = buildBookingHtml(detail, companySettings.value, client)
    previewVisible.value = true
  } catch { /* 拦截器 */ }
}

function onPrint() {
  printDocument(previewHtml.value, `BOOKING NOTE - ${previewOrder.value?.pi_number || ''}-SHP`)
}

function onExportExcel() {
  exportExcel(previewHtml.value, `Booking_${previewOrder.value?.pi_number || 'export'}.xls`)
}

/* ========== 编辑托书信息（仿参考项目 openBookingModal / saveBookingData） ========== */
async function openEdit(row) {
  try {
    const detail = await getOrder(row.id)
    const bk = parseBooking(detail.booking_data)
    const totals = getOrderTotals(detail)
    const client = clientOptions.value.find(c => c.id === detail.client_id) || {}
    const company = companySettings.value || {}

    const defaultShipper = `${company.name_en || ''}\n${company.address_en || ''}\nTEL: ${company.tel || ''}`
    const defaultConsignee = `${client.name_en || client.name || ''}\n${client.address_en || client.address || ''}\nATTN: ${client.contact_name || ''} ${client.tel || ''}`
    const defaultDesc = (detail.items || [])
      .map(it => `${it.name_en || ''} (${it.model || ''}) - ${it.qty || 0} PCS`)
      .join('\n')
    const freightTerm = bk.freight_term || (['FOB', 'EXW', 'FCA'].includes(detail.trade_terms) ? 'Collect' : 'Prepaid')

    editOrder.value = detail
    editForm.value = {
      shipper: bk.shipper ?? defaultShipper,
      consignee: bk.consignee ?? defaultConsignee,
      loading_port: bk.loading_port || detail.loading_port || 'Ningbo, China',
      discharge_port: bk.discharge_port || detail.destination_port || '',
      delivery_port: bk.delivery_port || detail.destination_port || '',
      trade_terms: bk.trade_terms || detail.trade_terms || 'FOB',
      freight_term: freightTerm,
      vessel: bk.vessel || '',
      bl_type: bk.bl_type || 'Original (正本提单)',
      qty20: Number(bk.qty20) || undefined,
      qty40: Number(bk.qty40) || undefined,
      qty40hq: Number(bk.qty40hq) || undefined,
      is_lcl: !!bk.is_lcl,
      marks: bk.marks || 'N/M',
      ctns: Number(bk.ctns ?? totals.ctns) || 0,
      gw: Number(bk.gw ?? totals.gw) || 0,
      cbm: Number(bk.cbm ?? totals.cbm) || 0,
      desc: bk.desc ?? defaultDesc,
      remarks: bk.remarks || 'Please arrange the earliest vessel.'
    }
    editVisible.value = true
  } catch { /* 拦截器 */ }
}

async function onSave() {
  saving.value = true
  try {
    // 联动：booking_data 整体保存，预览/列表/打印全部同步
    await updateOrder(editOrder.value.id, { booking_data: { ...editForm.value } })
    ElMessage.success('订舱托书编辑内容已保存并应用到托书！')
    editVisible.value = false
    loadList()
  } catch { /* 拦截器 */ }
  finally { saving.value = false }
}

/* ========== 订舱委托书 HTML 模板（严格对照参考项目 export.js booking 分支） ========== */
function buildBookingHtml(order, company, client) {
  const bk = order.booking_data || {}
  const totals = getOrderTotals(order)
  const dateToday = new Date().toISOString().split('T')[0]

  const defaultShipper = `${company.name_en || ''}\n${company.address_en || ''}\nTEL: ${company.tel || ''}`
  const defaultConsignee = `${client.name_en || client.name || ''}\n${client.address_en || client.address || ''}\nATTN: ${client.contact_name || ''} ${client.tel || ''}`
  // 支持手动换行的长地址完美折行
  const shipperHtml = (bk.shipper || defaultShipper).replace(/\n/g, '<br>')
  const consigneeHtml = (bk.consignee || defaultConsignee).replace(/\n/g, '<br>')

  const freightTerm = bk.freight_term || (['FOB', 'EXW', 'FCA'].includes(order.trade_terms) ? 'Collect' : 'Prepaid')
  const freightTermHtml = freightTerm === 'Collect'
    ? '[ ] Prepaid (预付) &nbsp;&nbsp;&nbsp;&nbsp; [√] Collect (到付)'
    : '[√] Prepaid (预付) &nbsp;&nbsp;&nbsp;&nbsp; [ ] Collect (到付)'

  const finalCtns = bk.ctns !== undefined && bk.ctns !== '' ? bk.ctns : totals.ctns
  const finalGw = bk.gw !== undefined && bk.gw !== '' ? bk.gw : totals.gw
  const finalCbm = bk.cbm !== undefined && bk.cbm !== '' ? bk.cbm : totals.cbm

  const defaultDesc = (order.items || []).map(it => `${it.name_en || ''} (${it.model || ''}) - ${it.qty || 0} PCS`).join('\n')
  const productsDescHtml = (bk.desc || defaultDesc).replace(/\n/g, '<br>')

  const vessel = bk.vessel || ''
  const tradeTerms = bk.trade_terms || order.trade_terms || 'FOB'
  const loadingPort = bk.loading_port || order.loading_port || 'Ningbo, China'
  const dischargePort = bk.discharge_port || order.destination_port || ''
  const deliveryPort = bk.delivery_port || order.destination_port || ''
  const blType = bk.bl_type || 'Original (正本提单)'
  const marks = bk.marks || 'N/M'
  const remarks = bk.remarks || 'Please arrange the earliest vessel.'

  const fclText = `- FCL (整柜): [ ${bk.qty20 ? '√' : '&nbsp;&nbsp;'} ] 20'GP x <u>&nbsp;${bk.qty20 || ' '}&nbsp;</u> &nbsp;&nbsp; [ ${bk.qty40 ? '√' : '&nbsp;&nbsp;'} ] 40'GP x <u>&nbsp;${bk.qty40 || ' '}&nbsp;</u> &nbsp;&nbsp; [ ${bk.qty40hq ? '√' : '&nbsp;&nbsp;'} ] 40'HQ x <u>&nbsp;${bk.qty40hq || ' '}&nbsp;</u><br>- LCL (拼箱): [ ${bk.is_lcl ? '√' : '&nbsp;&nbsp;'} ] Yes`
  const blText = `[ ${blType.includes('Original') ? '√' : '&nbsp;&nbsp;'} ] Original (正本提单) &nbsp;&nbsp;&nbsp;&nbsp; [ ${blType.includes('Telex') ? '√' : '&nbsp;&nbsp;'} ] Telex Release (电放提单) &nbsp;&nbsp;&nbsp;&nbsp; [ ${blType.includes('Waybill') ? '√' : '&nbsp;&nbsp;'} ] Sea Waybill (海运单)`

  return `
    <style>
      .bk-table { width:100%; border-collapse:collapse; font-family:Arial,sans-serif; font-size:11px; }
      .bk-table td { border:1px solid #000; padding:6px 8px; vertical-align:top; line-height:1.5; word-break:break-word; }
      .bk-title { font-size:18px; font-weight:bold; text-align:center; background:#e2e8f0; vertical-align:middle; height:35px; }
      .bk-sec-title { background:#f1f5f9; font-weight:bold; font-size:12px; }
    </style>
    <table class="bk-table">
      <tr><td colspan="6" class="bk-title">BOOKING NOTE (海运订舱委托书)</td></tr>
      <tr><td colspan="3" style="min-height:75px;"><strong>Shipper (发货人)</strong><br><div style="white-space:pre-wrap;margin-top:4px;">${shipperHtml}</div></td><td colspan="3"><div style="border-bottom:1px solid #cbd5e1;padding-bottom:6px;margin-bottom:6px;"><strong>Reference No. (客户单号):</strong> ${order.pi_number}-SHP</div><div><strong>Booking Date (订舱日期):</strong> ${dateToday}</div></td></tr>
      <tr><td colspan="3" style="min-height:75px;"><strong>Consignee (收货人)</strong><br><div style="white-space:pre-wrap;margin-top:4px;">${consigneeHtml}</div></td><td colspan="3"><strong>Port of Loading (起运港 - POL)</strong><br>${loadingPort}</td></tr>
      <tr><td colspan="3" style="min-height:60px;"><strong>Notify Party (通知人)</strong><br>SAME AS CONSIGNEE</td><td colspan="3"><strong>Port of Discharge (卸货港 - POD)</strong><br>${dischargePort}</td></tr>
      <tr><td colspan="3"><strong>Port of Delivery (目的地 - Delivery)</strong><br>${deliveryPort}</td><td colspan="3"><strong>Forwarder / Agent (代理/货代)</strong><br>Direct Booking</td></tr>
      <tr><td colspan="6" class="bk-sec-title"> Route & Terms (航线及条款)</td></tr>
      <tr><td colspan="2"><strong>Service Term (运输条款)</strong></td><td>CY/CY</td><td colspan="2"><strong>Freight Term (运费条款)</strong></td><td>${freightTermHtml}</td></tr>
      <tr><td colspan="2"><strong>Incoterms (贸易条款)</strong></td><td>${tradeTerms}</td><td colspan="2"><strong>Target Vessel/Voyage (指定船期)</strong></td><td>${vessel}</td></tr>
      <tr><td colspan="6" class="bk-sec-title"> Cargo Details (货物详情)</td></tr>
      <tr style="text-align:center;font-weight:bold;background:#f8fafc;"><td>Marks & Nos<br>(唛头)</td><td colspan="2">Description of Goods<br>(货物描述)</td><td>Quantity & Pkg<br>(件数及包装)</td><td>Gross Weight<br>(毛重 - KGS)</td><td>Measurement<br>(体积 - CBM)</td></tr>
      <tr style="text-align:center;"><td>${marks}</td><td colspan="2" style="text-align:left;white-space:pre-wrap;">${productsDescHtml}</td><td>${finalCtns} CTNS</td><td>${finalGw}</td><td>${finalCbm}</td></tr>
      <tr style="font-weight:bold;background:#f8fafc;"><td colspan="3" style="text-align:right;">TOTAL (合计):</td><td style="text-align:center;">${finalCtns} CTNS</td><td style="text-align:center;">${finalGw}</td><td style="text-align:center;">${finalCbm}</td></tr>
      <tr><td colspan="6" class="bk-sec-title"> Equipment & Special Requirements (要求)</td></tr>
      <tr><td colspan="2"><strong>Container Type & Qty<br>(柜型柜量)</strong></td><td colspan="4">${fclText}</td></tr>
      <tr><td colspan="2"><strong>Cargo Type<br>(货物类型)</strong></td><td colspan="4">[√] General Cargo (普通货物)</td></tr>
      <tr><td colspan="2"><strong>B/L Type<br>(出单方式)</strong></td><td colspan="4">${blText}</td></tr>
      <tr><td colspan="2"><strong>Remarks<br>(备注说明)</strong></td><td colspan="4" style="height:60px;white-space:pre-wrap;">${remarks}</td></tr>
    </table>
  `
}

onMounted(() => { loadList(); loadOptions() })
</script>

<style scoped>
.page-header { margin-bottom: 14px; }
.page-title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; }

.fcl-badge {
  display: inline-block;
  margin-top: 4px;
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 10px;
  background: #fef3c7;
  color: #b45309;
}

/* 编辑弹窗：柜型柜量横排 */
.fcl-row { display: flex; gap: 8px; align-items: center; }
.fcl-divider { color: #cbd5e1; }

/* 编辑弹窗：货物与包装明细分区 */
.cargo-section { border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 6px; }
.cargo-section-title { font-size: 13px; color: #2563eb; }

/* ======== 预览样式 ======== */
.bk-toolbar { display: flex; gap: 8px; margin-bottom: 10px; }
.doc-page { background: white; padding: 30px 36px; font-size: 11px; color: #0f172a; line-height: 1.5; border: 1px solid #cbd5e1; border-radius: 4px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }

@media print {
  :deep(.no-print) { display: none !important; }
  :deep(.el-dialog__header), :deep(.el-dialog__footer) { display: none !important; }
}
</style>
