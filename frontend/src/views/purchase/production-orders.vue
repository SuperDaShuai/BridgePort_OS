<template>
  <el-card shadow="never" class="page-card">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title">采购管理 - 工厂生产任务单 (PO)</h2>
    </div>

    <!-- 列表 -->
    <el-table v-loading="loading" :data="list" stripe>
      <el-table-column label="PO 任务单号" width="170">
        <template #default="{ row }">
          <strong>{{ poNo(row) }}</strong>
        </template>
      </el-table-column>
      <el-table-column label="关联购销合同" width="170">
        <template #default="{ row }">
          <strong style="color: #2563eb;">{{ row.pi_number ? row.pi_number + '-CG' : '—' }}</strong>
        </template>
      </el-table-column>
      <el-table-column label="承接工厂" min-width="200" show-overflow-tooltip>
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
      <el-table-column label="任务单预览与导出" width="190" align="center">
        <template #default="{ row }">
          <el-button type="warning" size="small" @click="openPreview(row)">📋 预览生产任务单</el-button>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
        </template>
      </el-table-column>
      <template #empty>暂无订单数据，请先在外销订单中创建订单</template>
    </el-table>

    <!-- ========== 预览弹窗 ========== -->
    <el-dialog
      v-model="previewVisible"
      :title="`PRODUCTION ORDER (PO) - ${currentOrder?.pi_number || ''}`"
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

    <!-- ========== 编辑弹窗（与订单明细/预览联动，仿参考项目 modal-po-edit） ========== -->
    <el-dialog
      v-model="editVisible"
      title="编辑工厂生产任务单"
      width="900px"
      destroy-on-close
      top="3vh"
    >
      <el-form ref="editFormRef" :model="editForm" label-position="top">
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="PO 任务单号 *" required>
              <el-input v-model="editForm.po_no" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="承接工厂 *" required>
              <el-input v-model="editForm.factory_name" disabled />
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
          <el-col :span="8">
            <el-form-item label="送达仓库港口 *" required>
              <el-input v-model="editForm.loading_port" />
            </el-form-item>
          </el-col>
          <el-col :span="16">
            <el-form-item label="装配生产工艺要求">
              <el-input v-model="editForm.tech_req" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
          <el-col :span="16">
            <el-form-item label="包装唛头要求">
              <el-input v-model="editForm.mark_req" type="textarea" :rows="2" />
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
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Printer, Download } from '@element-plus/icons-vue'
import { listOrders, getOrder, updateOrder } from '@/api/orders'
import { listSuppliers } from '@/api/suppliers'
import { getCompanySettings } from '@/api/companySettings'
import { formatMoney, getOrderTotals, printDocument, exportExcel } from '@/utils/docUtils'

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

/* ========== 工具：JSON 字段兼容解析（对象/字符串/null） ========== */
function parseDoc(val) {
  if (!val) return {}
  if (typeof val === 'string') {
    try { return JSON.parse(val) || {} } catch { return {} }
  }
  return val
}

/* ========== 列表派生字段 ========== */
function poNo(row) {
  const po = parseDoc(row.production_order)
  return po.po_no || (row.pi_number ? row.pi_number + '-PO' : '—')
}
function supplierName(row) {
  if (row.supplier_name) return row.supplier_name
  const s = supplierOptions.value.find(x => x.id === row.supplier_id)
  return s ? s.name : ''
}

/* ========== 数据加载（参考项目为全量列表，无分页） ========== */
async function loadList() {
  loading.value = true
  try {
    const d = await listOrders({ page: 1, pageSize: 500 })
    // 「请选择」= 报关责任未确认（转PI默认），选择并保存后才进入单据流程
    list.value = (d.list || []).filter((o) => o.customs_responsibility !== '请选择')
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

/* ========== 预览：生成生产任务单 HTML ========== */
async function openPreview(row) {
  try {
    const detail = await getOrder(row.id)
    currentOrder.value = detail
    const company = companySettings.value || {}
    const supplier = supplierOptions.value.find(s => s.id === detail.supplier_id) || {}
    previewHtml.value = buildPoHtml(detail, company, supplier)
    previewVisible.value = true
  } catch { /* 拦截器 */ }
}

function buildPoHtml(order, company, supplier) {
  const po = parseDoc(order.production_order)
  const items = order.items || []
  const totals = getOrderTotals(order)
  const currSign = order.currency === 'RMB' ? '¥' : '$'

  return `
    <div style="text-align:center; margin:0 0 12px; padding-bottom:10px; border-bottom:1.5px solid #0f172a; font-size:15pt; font-weight:900; letter-spacing:1px; color:#0f172a;">PRODUCTION ORDER (PO)</div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; font-size:11px;">
      <div><strong>PO 任务单号：</strong>${po.po_no || (order.pi_number + '-PO')}</div>
      <div><strong>关联合同：</strong>${order.pi_number}-CG</div>
      <div><strong>承接工厂：</strong>${supplier.name || ''}</div>
      <div><strong>PI 编号：</strong>${order.pi_number}</div>
      <div><strong>交货日期：</strong>${order.delivery_date || '尽快'}</div>
      <div><strong>送达仓库港口：</strong>${order.loading_port || '宁波港'}</div>
    </div>
    <table>
      <thead><tr><th style="width:35px; text-align:center;">序号</th><th style="width:15%;">产品型号</th><th style="width:30%;">货物名称及规格</th><th style="width:10%; text-align:right;">排产数量</th><th style="width:8%; text-align:center;">单位</th><th style="width:11%; text-align:center;">装箱(PCS/CTN)</th><th style="width:9%; text-align:center;">箱数</th><th style="width:12%; text-align:right;">外销单价</th></tr></thead>
      <tbody>${items.map((it, idx) => `<tr><td style="text-align:center;">${idx + 1}</td><td><strong>${it.model || ''}</strong></td><td>${it.spec || ''}<br><span style="font-size:9px; color:#64748b;">${it.name_en || ''}</span></td><td style="text-align:right; font-weight:bold;">${it.qty || 0}</td><td style="text-align:center;">${it.unit || 'PCS'}</td><td style="text-align:center;">${it.pcs_per_ctn || ''}</td><td style="text-align:center;">${it.ctns || ''}</td><td style="text-align:right;">${currSign}${formatMoney(it.price || 0)}</td></tr>`).join('')}</tbody>
      <tfoot><tr style="font-weight:bold; background:#f8fafc;"><td colspan="3" style="text-align:right;">合计：</td><td style="text-align:right;">${totals.qty}</td><td></td><td></td><td style="text-align:center;">${totals.ctns}</td><td></td></tr></tfoot>
    </table>
    <div style="margin-top:12px; font-size:11px; line-height:1.8;">
      <div><strong>装配生产工艺要求：</strong>${po.tech_req || ''}</div>
      <div><strong>包装唛头要求：</strong>${po.mark_req || ''}</div>
      <div><strong>包装说明：</strong>${order.packing_desc || 'Standard Neutral Export Cartons'}</div>
    </div>
    <div style="margin-top:20px; display:grid; grid-template-columns:1fr 1fr; gap:30px; font-size:11px; border-top:1px solid #cbd5e1; padding-top:14px;">
      <div><strong>委托方（盖章）：</strong>${company.name_cn || ''}<br>法定代表/代理人：________________<br>日期：${order.signing_date || ''}</div>
      <div><strong>生产方（盖章）：</strong>${supplier.name || ''}<br>法定代表/代理人：________________<br>日期：________________</div>
    </div>
  `
}

function onPrint() {
  printDocument(previewHtml.value, '生产任务单 - ' + (currentOrder.value?.pi_number || ''))
}
function onExportExcel() {
  exportExcel(previewHtml.value, 'ProductionOrder_' + (currentOrder.value?.pi_number || 'export') + '.xls')
}

/* ========== 编辑（仿参考项目 openPoEditModal / savePoTaskData） ========== */
async function openEdit(row) {
  try {
    const detail = await getOrder(row.id)
    editingOrderId.value = row.id
    const po = parseDoc(detail.production_order)
    const supplier = supplierOptions.value.find(s => s.id === detail.supplier_id)
    editForm.value = {
      po_no: po.po_no || (detail.pi_number + '-PO'),
      factory_name: supplier ? supplier.name : (detail.supplier_name || ''),
      delivery_date: (detail.delivery_date || '').slice(0, 10),
      loading_port: detail.loading_port || '宁波港',
      tech_req: po.tech_req || '',
      mark_req: po.mark_req || ''
    }
    editVisible.value = true
  } catch { /* 拦截器 */ }
}

async function onSave() {
  if (!editForm.value.po_no) return ElMessage.warning('请填写 PO 任务单号')
  if (!editForm.value.delivery_date) return ElMessage.warning('请选择交货日期')
  if (!editForm.value.loading_port) return ElMessage.warning('请填写送达仓库港口')

  saving.value = true
  try {
    // 联动：delivery_date / loading_port 直写订单主表，PI 预览、订舱委托书等单据同步更新
    await updateOrder(editingOrderId.value, {
      production_order: {
        po_no: editForm.value.po_no,
        tech_req: editForm.value.tech_req,
        mark_req: editForm.value.mark_req
      },
      delivery_date: editForm.value.delivery_date,
      loading_port: editForm.value.loading_port
    })
    ElMessage.success('生产任务单已保存，交货日期与送达港口已同步至关联单据')
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

.doc-toolbar { display: flex; gap: 8px; margin-bottom: 10px; }
.doc-page { background: white; padding: 35px 40px; font-size: 11px; color: #0f172a; line-height: 1.5; border: 1px solid #cbd5e1; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.doc-page table { font-size: 11px; margin: 10px 0; width: 100%; border-collapse: collapse; }
.doc-page th, .doc-page td { border: 1px solid #cbd5e1; padding: 6px 8px; }
.doc-page th { background: #f8fafc; }

@media print {
  :deep(.no-print) { display: none !important; }
  :deep(.el-dialog__header), :deep(.el-dialog__footer) { display: none !important; }
}
</style>
