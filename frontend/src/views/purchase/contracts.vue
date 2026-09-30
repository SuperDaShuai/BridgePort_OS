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
            <el-table-column label="数量（台）" width="120">
              <template #default="{ row }">
                <el-input-number v-model="row.qty" size="small" :min="0" :controls="false" style="width: 100%" />
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
            <span>数量：<strong>{{ editTotalQty }}</strong> 台</span>
            <span>金额（小写）：<strong style="color: #dc2626;">¥{{ formatMoney(editTotalAmount) }}</strong></span>
            <span>金额（大写）：人民币 {{ numberToChineseRMB(editTotalAmount) }}</span>
          </div>
        </div>

        <!-- 三、质量要求与检测 -->
        <div class="terms-section">
          <strong class="terms-title">三、质量要求与检测</strong>
          <div class="terms-item">
            <label>1.</label>
            <el-input v-model="editForm.quality_req_1" type="textarea" :rows="2" />
          </div>
          <div class="terms-item">
            <label>2.</label>
            <el-input v-model="editForm.quality_req_2" type="textarea" :rows="2" />
          </div>
          <div class="terms-item">
            <label>3.</label>
            <el-input v-model="editForm.quality_req_3" type="textarea" :rows="2" />
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
              <el-form-item label="1. 付款方式">
                <el-input v-model="editForm.payment_method" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="2. 发票">
                <el-input v-model="editForm.invoice_clause" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="收款人">
                <el-input v-model="editForm.payee_name" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="收款账户">
                <el-input v-model="editForm.payee_account" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="收款银行">
                <el-input v-model="editForm.payee_bank" />
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <!-- 六、其他条款 -->
        <div class="terms-section">
          <strong class="terms-title">六、其他条款</strong>
          <div class="terms-item">
            <label>1.</label>
            <el-input v-model="editForm.other_clause_1" type="textarea" :rows="2" />
          </div>
          <div class="terms-item">
            <label>2.</label>
            <el-input v-model="editForm.other_clause_2" type="textarea" :rows="2" />
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
import { onMounted, reactive, ref, computed } from 'vue'
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

// 编辑区采购总额（数量小计 + 金额小计）
const editTotalQty = computed(() => editItems.value.reduce((s, it) => s + Number(it.qty || 0), 0))
const editTotalAmount = computed(() => editItems.value.reduce((s, it) => s + Number(it.qty || 0) * Number(it.cost_cny || 0), 0))

// 选择乙方时自动回填乙方信息（信用代码/地址/收款人/收款账号/收款银行）
// 始终拉取最新供应商详情，确保信用代码等字段为最新值
async function onSupplierChange(supplierId) {
  const s = supplierOptions.value.find(x => x.id === supplierId)
  if (!s) return
  // 回填乙方名称
  if (!editForm.value.supplier_name) editForm.value.supplier_name = s.name || ''
  try {
    // 拉取最新供应商详情（含 credit_code / contacts 等完整字段）
    const detail = await getSupplier(supplierId)
    if (!editForm.value.supplier_credit_code) editForm.value.supplier_credit_code = detail.credit_code || ''
    if (!editForm.value.supplier_address) editForm.value.supplier_address = detail.factory_address || ''
    if (!editForm.value.payee_account) editForm.value.payee_account = detail.account_number || ''
    if (!editForm.value.payee_bank) editForm.value.payee_bank = detail.bank_name || ''
    // 收款人默认取供应商第一个关联联系人
    if (!editForm.value.payee_name) {
      const contacts = detail.contacts || []
      if (contacts.length) editForm.value.payee_name = contacts[0].name || ''
    }
  } catch {
    // 回退到 supplierOptions 数据
    if (!editForm.value.supplier_credit_code) editForm.value.supplier_credit_code = s.credit_code || ''
    if (!editForm.value.supplier_address) editForm.value.supplier_address = s.factory_address || ''
    if (!editForm.value.payee_account) editForm.value.payee_account = s.account_number || ''
    if (!editForm.value.payee_bank) editForm.value.payee_bank = s.bank_name || ''
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
  // 采购总额 = Σ(数量 × 单价)
  const cnyTotal = items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.cost_cny || 0), 0)
  const totalQty = items.reduce((s, it) => s + Number(it.qty || 0), 0)
  const contractNo = pc.contract_no || ((order.ref_number || order.pi_number || '') + '-CG')
  const signDate = (pc.sign_date || order.signing_date || '').slice(0, 10)

  // 甲方信息：优先取合同保存值，回退 companySettings
  const buyerName = pc.buyer_name || company.name_cn || ''
  const buyerCreditCode = pc.buyer_credit_code || company.tax_number || ''
  const buyerAddress = pc.buyer_address || company.address_cn || ''
  // 乙方信息：优先取合同保存值，回退 supplier
  const supplierNameVal = pc.supplier_name || supplier.name || ''
  const supplierCreditCode = pc.supplier_credit_code || supplier.credit_code || ''
  const supplierAddressVal = pc.supplier_address || supplier.factory_address || ''

  // 商品行：产品型号优先用 supplier_model(our_model)，回退 model
  const itemRows = items.map((it, idx) => {
    const model = it.supplier_model || it.model || ''
    const qty = Number(it.qty || 0)
    const price = Number(it.cost_cny || 0)
    const subtotal = qty * price
    return `<tr><td style="border:0.5px solid #999; padding:6px 8px; text-align:center;">${idx + 1}</td><td style="border:0.5px solid #999; padding:6px 8px;">${model}</td><td style="border:0.5px solid #999; padding:6px 8px; text-align:right;">${formatMoney(price)}</td><td style="border:0.5px solid #999; padding:6px 8px; text-align:right;">${qty}</td><td style="border:0.5px solid #999; padding:6px 8px; text-align:right; font-weight:bold;">${formatMoney(subtotal)}</td></tr>`
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
        <th style="border:0.5px solid #999; padding:6px 8px; text-align:center; width:110px; background:#fff;">数量（台）</th>
        <th style="border:0.5px solid #999; padding:6px 8px; text-align:center; width:130px; background:#fff;">小计（元）</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot><tr>
        <td colspan="2" style="border:0.5px solid #999; padding:6px 8px; text-align:right; font-weight:bold;">总计</td>
        <td style="border:0.5px solid #999; padding:6px 8px;"></td>
        <td style="border:0.5px solid #999; padding:6px 8px; text-align:right; font-weight:bold;">${totalQty}</td>
        <td style="border:0.5px solid #999; padding:6px 8px; text-align:right; font-weight:bold;">${formatMoney(cnyTotal)}</td>
      </tr></tfoot>
    </table>
    <div style="font-size:14px; margin-top:8px; font-weight:bold;">合计人民币（大写）：${numberToChineseRMB(cnyTotal)}</div>

    <div style="font-size:14px; line-height:1.6; margin-top:12px;">
      <div style="font-weight:bold; margin-bottom:4px;">三、质量要求与检测</div>
      <div>1. ${pc.quality_req_1 || ''}</div>
      <div>2. ${pc.quality_req_2 || ''}</div>
      <div>3. ${pc.quality_req_3 || ''}</div>
    </div>

    <div style="font-size:14px; line-height:1.6; margin-top:12px;">
      <div style="font-weight:bold; margin-bottom:4px;">四、交货条款</div>
      <div>1. 交货地点：${pc.delivery_location || ''}</div>
      <div>2. 交货时间：${pc.delivery_time || ''}</div>
      <div>3. 包装要求：${pc.packing_req || ''}</div>
    </div>

    <div style="font-size:14px; line-height:1.6; margin-top:12px;">
      <div style="font-weight:bold; margin-bottom:4px;">五、结算条款</div>
      <div>1. 付款方式：${pc.payment_method || ''}</div>
      <div style="padding-left:2em;">收款人：${pc.payee_name || ''}</div>
      <div style="padding-left:2em;">收款账户：${pc.payee_account || ''}</div>
      <div style="padding-left:2em;">收款银行：${pc.payee_bank || ''}</div>
      <div>2. 发票：${pc.invoice_clause || ''}</div>
    </div>

    <div style="font-size:14px; line-height:1.6; margin-top:12px;">
      <div style="font-weight:bold; margin-bottom:4px;">六、其他条款</div>
      <div>1. ${pc.other_clause_1 || ''}</div>
      <div>2. ${pc.other_clause_2 || ''}</div>
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
    }
    editForm.value = {
      contract_no: pc.contract_no || (refNo + '-CG'),
      sign_date: (pc.sign_date || detail.signing_date || '').slice(0, 10),
      // 一、合同双方
      buyer_name: pc.buyer_name || co.name_cn || '',
      buyer_credit_code: pc.buyer_credit_code || co.tax_number || '',
      buyer_address: pc.buyer_address || co.address_cn || '',
      supplier_id: detail.supplier_id,
      supplier_name: pc.supplier_name || supplier.name || '',
      supplier_credit_code: pc.supplier_credit_code || supplier.credit_code || '',
      supplier_address: pc.supplier_address || supplier.factory_address || '',
      // 三、质量要求与检测（按模板默认）
      quality_req_1: pc.quality_req_1 || '乙方需按上述规格参数生产，产品需符合《电子秤通用技术规范》（GB/T 7722-2017），且满足防水、称重精准等核心功能要求；',
      quality_req_2: pc.quality_req_2 || '乙方需对所有样品进行全检（含功能测试、外观检查），确保"检测没问题"后再打包，甲方有权抽检，若发现不合格品，乙方需免费更换；',
      quality_req_3: pc.quality_req_3 || '样品需附带产品合格检测报告（每台对应检测记录）。',
      // 四、交货条款
      delivery_location: pc.delivery_location || '甲方指定地址',
      delivery_time: pc.delivery_time || '合同签订后30天内',
      packing_req: pc.packing_req || '采用出口标准包装（防水、防摔），外箱标注"样品""易碎"标识。',
      // 五、结算条款
      payment_method: pc.payment_method || '验货完成后全额付款',
      payee_name: pc.payee_name || '',
      payee_account: pc.payee_account || supplier.account_number || '',
      payee_bank: pc.payee_bank || supplier.bank_name || '',
      invoice_clause: pc.invoice_clause || '以上价格是出厂不含税价格',
      // 六、其他条款（按模板默认）
      other_clause_1: pc.other_clause_1 || '本合同一式两份，甲乙双方各执一份，签字盖章后生效；',
      other_clause_2: pc.other_clause_2 || '未尽事宜，双方协商解决；协商不成的，向永康人民法院提起诉讼。'
    }
    // 收款人默认取供应商第一个关联联系人（仅在未保存时）
    if (!pc.payee_name && supplier.contacts && supplier.contacts.length) {
      editForm.value.payee_name = supplier.contacts[0].name || ''
    }
    // 明细行：产品型号优先 supplier_model(our_model)，回退 model
    editItems.value = (detail.items || []).map(it => ({
      ...it,
      supplier_model: it.supplier_model || it.model || '',
      qty: Number(it.qty || 0),
      unit: it.unit || '台',
      cost_cny: it.cost_cny === null || it.cost_cny === undefined ? Number(it.price || 0) : Number(it.cost_cny)
    }))
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
    // 联动重算：箱数、外销小计、订单外销总额（qty 或装箱变化时同步）
    const items = editItems.value.map(it => {
      const qty = Number(it.qty || 0)
      const pcs = Number(it.pcs_per_ctn || 0)
      const row = { ...it, qty }
      // 同步 supplier_model 到 model 字段，保证其他单据读取一致
      if (it.supplier_model) row.model = it.supplier_model
      if (pcs > 0) row.ctns = Math.ceil(qty / pcs)
      row.subtotal_amount = Number((qty * Number(it.price || 0)).toFixed(2))
      return row
    })
    const totalAmount = Number(items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.price || 0), 0).toFixed(2))

    // 找到乙方对象，回写乙方名称到合同 JSON
    const supplier = supplierOptions.value.find(s => s.id === editForm.value.supplier_id) || {}

    await (editingRefType.value === 'sample' ? updateSample : updateOrder)(editingOrderId.value, {
      supplier_id: editForm.value.supplier_id,
      purchase_contract: {
        contract_no: editForm.value.contract_no,
        sign_date: editForm.value.sign_date,
        // 一、合同双方
        buyer_name: editForm.value.buyer_name,
        buyer_credit_code: editForm.value.buyer_credit_code,
        buyer_address: editForm.value.buyer_address,
        supplier_name: editForm.value.supplier_name || supplier.name || '',
        supplier_credit_code: editForm.value.supplier_credit_code,
        supplier_address: editForm.value.supplier_address,
        // 三、质量要求与检测
        quality_req_1: editForm.value.quality_req_1,
        quality_req_2: editForm.value.quality_req_2,
        quality_req_3: editForm.value.quality_req_3,
        // 四、交货条款
        delivery_location: editForm.value.delivery_location,
        delivery_time: editForm.value.delivery_time,
        packing_req: editForm.value.packing_req,
        // 五、结算条款
        payment_method: editForm.value.payment_method,
        payee_name: editForm.value.payee_name,
        payee_account: editForm.value.payee_account,
        payee_bank: editForm.value.payee_bank,
        invoice_clause: editForm.value.invoice_clause,
        // 六、其他条款
        other_clause_1: editForm.value.other_clause_1,
        other_clause_2: editForm.value.other_clause_2
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
