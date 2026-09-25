<template>
  <el-card shadow="never" class="page-card">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title">采购管理 - 购销合同</h2>
    </div>

    <!-- 列表 -->
    <el-table v-loading="loading" :data="list" stripe>
      <el-table-column label="购销合同编号" width="170">
        <template #default="{ row }">
          <strong>{{ contractNo(row) }}</strong>
        </template>
      </el-table-column>
      <el-table-column label="关联数据" width="160">
        <template #default="{ row }">
          <strong style="color: #2563eb;">{{ row.ref_number }}</strong>
          <div v-if="row.ref_type === 'sample'" class="ref-type-tag">样品单</div>
        </template>
      </el-table-column>
      <el-table-column label="供方工厂（卖方）" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <strong>{{ supplierName(row) || '—' }}</strong>
        </template>
      </el-table-column>
      <el-table-column label="含税采购总额(¥)" width="170" align="right">
        <template #default="{ row }">
          <strong style="color: #dc2626;">¥{{ formatMoney(row.cny_purchase_cost || 0) }}</strong>
        </template>
      </el-table-column>
      <el-table-column label="交货期限与地点" min-width="220">
        <template #default="{ row }">
          <div>{{ parseDoc(row.purchase_contract).delivery_deadline || '合同签订后30天内' }}</div>
          <div class="sub-text">{{ parseDoc(row.purchase_contract).delivery_location || '' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="合同预览与导出" width="180" align="center">
        <template #default="{ row }">
          <el-button type="warning" size="small" @click="openPreview(row)">📄 预览购销合同</el-button>
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
      :title="`SALES CONTRACT - ${currentOrder?.ref_number || currentOrder?.pi_number || ''}`"
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
      title="编辑国内工贸购销合同"
      width="1100px"
      destroy-on-close
      top="3vh"
    >
      <el-form ref="editFormRef" :model="editForm" label-position="top">
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="购销合同编号 *" required>
              <el-input v-model="editForm.contract_no" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="签订日期 *" required>
              <el-date-picker
                v-model="editForm.sign_date"
                type="date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="供方工厂（卖方） *" required>
              <el-select v-model="editForm.supplier_id" filterable style="width: 100%">
                <el-option v-for="s in supplierOptions" :key="s.id" :label="s.name" :value="s.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="交货期限 *" required>
              <el-input v-model="editForm.delivery_deadline" />
            </el-form-item>
          </el-col>
          <el-col :span="16">
            <el-form-item label="交货地点与仓库 *" required>
              <el-input v-model="editForm.delivery_location" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 采购商品清单（与订单明细联动） -->
        <div class="items-section">
          <div class="items-section-header">
            <strong>采购商品清单</strong>
            <el-button type="warning" size="small" @click="addItemRow">+ 添加采购商品行</el-button>
          </div>
          <el-table :data="editItems" border size="small" class="items-table">
            <el-table-column label="序号" width="45" align="center">
              <template #default="{ $index }">{{ $index + 1 }}</template>
            </el-table-column>
            <el-table-column label="产品型号 (Art No.)" width="170">
              <template #default="{ row }">
                <el-input v-model="row.model" size="small" />
              </template>
            </el-table-column>
            <el-table-column label="货物名称及规格" min-width="220">
              <template #default="{ row }">
                <el-input v-model="row.spec" size="small" />
              </template>
            </el-table-column>
            <el-table-column label="采购数量" width="110">
              <template #default="{ row }">
                <el-input-number v-model="row.qty" size="small" :min="0" :controls="false" style="width: 100%" />
              </template>
            </el-table-column>
            <el-table-column label="单位" width="90">
              <template #default="{ row }">
                <el-input v-model="row.unit" size="small" />
              </template>
            </el-table-column>
            <el-table-column label="含税单价 (¥)" width="120">
              <template #default="{ row }">
                <el-input-number v-model="row.cost_cny" size="small" :min="0" :precision="2" :controls="false" style="width: 100%" />
              </template>
            </el-table-column>
            <el-table-column label="金额小计 (¥)" width="120" align="right">
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
        </div>

        <!-- 购销合同条款设置 -->
        <div class="terms-section">
          <strong class="terms-title">购销合同条款设置：</strong>
          <div class="terms-item">
            <label>一、质量标准：</label>
            <el-input v-model="editForm.quality_req" type="textarea" :rows="2" />
          </div>
          <div class="terms-item">
            <label>二、包装要求：</label>
            <el-input v-model="editForm.packing_req" type="textarea" :rows="2" />
          </div>
          <div class="terms-item">
            <label>三、结算方式及发票：</label>
            <el-input v-model="editForm.payment_terms" type="textarea" :rows="2" />
          </div>
          <div class="terms-item">
            <label>四、违约责任：</label>
            <el-input v-model="editForm.penalty_req" type="textarea" :rows="2" />
          </div>
          <div class="terms-item">
            <label>五、争议解决：</label>
            <el-input v-model="editForm.dispute_req" type="textarea" :rows="2" />
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
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Printer, Download, Close } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { listOrders, getOrder, updateOrder } from '@/api/orders'
import { listSamples, getSample, updateSample } from '@/api/samples'
import { listSuppliers } from '@/api/suppliers'
import { getCompanySettings } from '@/api/companySettings'
import { formatMoney, numberToChineseRMB, printDocument, exportExcel } from '@/utils/docUtils'

const userStore = useUserStore()
// 合同维护权限：跟单(5)只读，仅主管及以上可编辑
const canMaintain = userStore.permissionLevel <= 2

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
const editItems = ref([])
const editingOrderId = ref(null)
const editingRefType = ref('order')

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
  const pc = parseDoc(row.purchase_contract)
  const refNo = row.ref_number || row.pi_number || row.sample_number || ''
  return pc.contract_no || (refNo ? refNo + '-CG' : '—')
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
    // 1. 外销订单：客户自行报关 + 我司代办报关（都生成购销合同）
    const d = await listOrders({ page: 1, pageSize: 500 })
    const orderList = (d.list || [])
      .filter((o) => o.customs_responsibility !== '请选择')
      .map((o) => ({ ...o, ref_type: 'order', ref_number: o.pi_number }))
    // 2. 样品单：全部（默认按客户自行报关逻辑生成购销合同）
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
    previewHtml.value = buildContractHtml(currentOrder.value, company, supplier)
    previewVisible.value = true
  } catch { /* 拦截器 */ }
}

function buildContractHtml(order, company, supplier) {
  const pc = parseDoc(order.purchase_contract)
  const items = order.items || []
  // 含税采购总额 = Σ(采购数量 × 含税单价)
  const cnyTotal = items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.cost_cny || 0), 0)
  const totalQty = items.reduce((s, it) => s + Number(it.qty || 0), 0)

  return `
    <div style="text-align:center; margin:0 0 12px; padding-bottom:10px; border-bottom:1.5px solid #0f172a; font-size:15pt; font-weight:900; letter-spacing:6px; color:#0f172a;">购 销 合 同</div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; font-size:11px;">
      <div><strong>需方（买方）：</strong>${company.name_cn || ''}</div>
      <div><strong>合同编号：</strong>${pc.contract_no || ((order.ref_number || order.pi_number || '') + '-CG')}</div>
      <div><strong>供方（卖方）：</strong>${supplier.name || '供方工厂'}</div>
      <div><strong>签订日期：</strong>${(pc.sign_date || order.signing_date || '').slice(0, 10)}</div>
      <div><strong>交货地点：</strong>${pc.delivery_location || '送至买方指定出口监管仓库'}</div>
      <div><strong>交货期限：</strong>${pc.delivery_deadline || '合同签订后30天内'}</div>
    </div>
    <table>
      <thead><tr><th style="width:35px;text-align:center;">序号</th><th style="width:18%;">产品型号</th><th style="width:28%;">货物名称及规格</th><th style="width:12%;text-align:right;">采购数量</th><th style="width:8%;text-align:center;">单位</th><th style="width:15%;text-align:right;">含税单价(元)</th><th style="width:16%;text-align:right;">金额小计(元)</th></tr></thead>
      <tbody>${items.map((it, idx) => `<tr><td style="text-align:center;">${idx + 1}</td><td><strong>${it.model || ''}</strong></td><td>${it.spec || ''}</td><td style="text-align:right;">${it.qty || 0}</td><td style="text-align:center;">${it.unit || '台'}</td><td style="text-align:right;">¥${formatMoney(it.cost_cny || 0)}</td><td style="text-align:right;font-weight:bold;">¥${formatMoney(Number(it.qty || 0) * Number(it.cost_cny || 0))}</td></tr>`).join('')}</tbody>
      <tfoot><tr style="font-weight:bold;background:#f8fafc;"><td colspan="3" style="text-align:right;">合计金额（小写）：</td><td style="text-align:right;">${totalQty}</td><td></td><td></td><td style="text-align:right;color:#dc2626;">¥${formatMoney(cnyTotal)}</td></tr></tfoot>
    </table>
    <div style="margin-top:8px;padding:8px 12px;background:#f8fafc;border:1px solid #cbd5e1;font-weight:bold;font-size:11px;">合计总金额（大写）：人民币 ${numberToChineseRMB(cnyTotal)}</div>
    <div style="font-size:10px;margin-top:14px;line-height:1.7;">
      <strong>一、质量标准：</strong>${pc.quality_req || ''}<br>
      <strong>二、包装要求：</strong>${pc.packing_req || ''}<br>
      <strong>三、结算方式及发票：</strong>${pc.payment_terms || ''}<br>
      <strong>四、违约责任：</strong>${pc.penalty_req || ''}<br>
      <strong>五、争议解决：</strong>${pc.dispute_req || ''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:25px;font-size:11px;border-top:1px solid #cbd5e1;padding-top:14px;">
      <div><strong>需方（盖章）：</strong>${company.name_cn || ''}<br>法定代表/代理人：________________<br>开户银行：${company.bank_name || ''}<br>银行账号：${company.bank_account || ''}</div>
      <div><strong>供方（盖章）：</strong>${supplier.name || ''}<br>法定代表/代理人：________________<br>开户银行：${supplier.bank_name || ''}<br>银行账号：${supplier.account_number || ''}</div>
    </div>
  `
}

function onPrint() {
  printDocument(previewHtml.value, '购销合同 - ' + (currentOrder.value?.ref_number || currentOrder.value?.pi_number || ''))
}
function onExportExcel() {
  exportExcel(previewHtml.value, 'Contract_' + (currentOrder.value?.ref_number || currentOrder.value?.pi_number || 'export') + '.xls')
}

/* ========== 编辑（与订单明细/预览联动，仿参考项目 savePurchaseContractData） ========== */
async function openEdit(row) {
  try {
    const detail = row.ref_type === 'sample'
      ? await getSample(row.id)
      : await getOrder(row.id)
    editingOrderId.value = row.id
    editingRefType.value = row.ref_type
    const refNo = row.ref_number || detail.pi_number || detail.sample_number || ''
    const pc = parseDoc(detail.purchase_contract)
    editForm.value = {
      contract_no: pc.contract_no || (refNo + '-CG'),
      sign_date: (pc.sign_date || detail.signing_date || '').slice(0, 10),
      supplier_id: detail.supplier_id,
      delivery_deadline: pc.delivery_deadline || '合同签订后30天内完成生产交货',
      delivery_location: pc.delivery_location || '送至买方指定出口监管仓库',
      quality_req: pc.quality_req || '',
      packing_req: pc.packing_req || '',
      payment_terms: pc.payment_terms || '',
      penalty_req: pc.penalty_req || '',
      dispute_req: pc.dispute_req || ''
    }
    // 明细行：仅开放 model / spec / qty / unit / cost_cny 编辑，其余字段原样保留用于回写
    editItems.value = (detail.items || []).map(it => ({
      ...it,
      model: it.model || '',
      qty: Number(it.qty || 0),
      unit: it.unit || '台',
      cost_cny: it.cost_cny === null || it.cost_cny === undefined ? Number(it.price || 0) : Number(it.cost_cny)
    }))
    editVisible.value = true
  } catch { /* 拦截器 */ }
}

function addItemRow() {
  editItems.value.push({
    product_id: null, model: '', name_en: '', hs_code: '', unit: '台',
    img_url: null, spec: null, pcs_per_ctn: null, ctns: null, qty: 0,
    price: 0, cost_cny: 0, subtotal_amount: 0,
    nw_per_ctn: null, gw_per_ctn: null, cbm_per_ctn: null
  })
}

async function onSave() {
  if (!editForm.value.contract_no) return ElMessage.warning('请填写购销合同编号')
  if (!editForm.value.supplier_id) return ElMessage.warning('请选择供方工厂（卖方）')
  if (editItems.value.length === 0) return ElMessage.warning('请至少保留一行采购商品')

  saving.value = true
  try {
    // 联动重算：箱数、外销小计、订单外销总额（qty 或装箱变化时同步）
    const items = editItems.value.map(it => {
      const qty = Number(it.qty || 0)
      const pcs = Number(it.pcs_per_ctn || 0)
      const row = { ...it, qty }
      if (pcs > 0) row.ctns = Math.ceil(qty / pcs)
      row.subtotal_amount = Number((qty * Number(it.price || 0)).toFixed(2))
      return row
    })
    const totalAmount = Number(items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.price || 0), 0).toFixed(2))

    await (editingRefType.value === 'sample' ? updateSample : updateOrder)(editingOrderId.value, {
      supplier_id: editForm.value.supplier_id,
      purchase_contract: {
        contract_no: editForm.value.contract_no,
        sign_date: editForm.value.sign_date,
        delivery_deadline: editForm.value.delivery_deadline,
        delivery_location: editForm.value.delivery_location,
        payment_terms: editForm.value.payment_terms,
        quality_req: editForm.value.quality_req,
        packing_req: editForm.value.packing_req,
        penalty_req: editForm.value.penalty_req,
        dispute_req: editForm.value.dispute_req
      },
      items,
      total_amount: totalAmount
    })
    ElMessage.success('购销合同已保存，订单明细与单据预览已同步更新')
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
.ref-type-tag { display: inline-block; margin-top: 2px; padding: 1px 6px; font-size: 10px; color: #fff; background: #0ea5e9; border-radius: 4px; }

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

/* 编辑弹窗：条款设置分区 */
.terms-section { margin-top: 12px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; display: flex; flex-direction: column; gap: 10px; }
.terms-title { font-size: 13px; color: #2563eb; }
.terms-item label { font-weight: 600; font-size: 12px; display: block; margin-bottom: 4px; }

@media print {
  :deep(.no-print) { display: none !important; }
  :deep(.el-dialog__header), :deep(.el-dialog__footer) { display: none !important; }
}
</style>
