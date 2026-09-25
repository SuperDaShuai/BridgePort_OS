<template>
  <el-card shadow="never" class="page-card">
    <!-- 页面标题（仿参考项目） -->
    <div class="page-header">
      <h2 class="page-title">出口报关单据套件 (Export Customs Documents)</h2>
      <p class="page-subtitle">自动关联订单生成报关草单、Commercial Invoice、Packing List 及 Sales Contract（商品按 HS 编码归并）</p>
    </div>

    <!-- 列表（图1样式） -->
    <el-table v-loading="loading" :data="list" stripe>
      <el-table-column label="关联 PI 号" width="160">
        <template #default="{ row }">
          <strong style="color: #2563eb; font-size: 15px;">{{ row.pi_number }}</strong>
        </template>
      </el-table-column>
      <el-table-column label="申报海关口岸" min-width="220">
        <template #default="{ row }">
          {{ exitPortText(row) }}
        </template>
      </el-table-column>
      <el-table-column label="Declaration Draft" width="180" align="center">
        <template #default="{ row }">
          <el-button size="small" @click="openPreview(row, 'decl')">Declaration Draft</el-button>
        </template>
      </el-table-column>
      <el-table-column label="Commercial Invoice" width="190" align="center">
        <template #default="{ row }">
          <el-button size="small" @click="openPreview(row, 'ci')">Commercial Invoice</el-button>
        </template>
      </el-table-column>
      <el-table-column label="Sales Contract" width="170" align="center">
        <template #default="{ row }">
          <el-button size="small" @click="openPreview(row, 'sc')">Sales Contract</el-button>
        </template>
      </el-table-column>
      <el-table-column label="Packing List" width="160" align="center">
        <template #default="{ row }">
          <el-button size="small" @click="openPreview(row, 'pl')">Packing List</el-button>
        </template>
      </el-table-column>
      <el-table-column label="操作 (补录信息)" width="180" align="center" fixed="right">
        <template #default="{ row }">
          <el-button v-if="canMaintain" size="small" @click="openCustomsEdit(row)">编辑清关外销单据</el-button>
        </template>
      </el-table-column>
      <template #empty>暂无「我司代办报关」的订单</template>
    </el-table>

    <!-- ========== 单据预览弹窗 ========== -->
    <el-dialog
      v-model="previewVisible" :close-on-click-modal="false"
      :title="previewTitle"
      width="1100px"
      destroy-on-close
      top="3vh"
      class="doc-dialog"
    >
      <div class="doc-toolbar no-print">
        <el-button v-if="canMaintain && previewType === 'decl'" type="primary" plain :icon="Edit" @click="openDeclEditFromPreview">编辑草单要素</el-button>
        <el-button v-else-if="canMaintain" type="primary" plain :icon="Edit" @click="openCustomsEditFromPreview">编辑单据信息</el-button>
        <el-button type="success" :icon="Download" @click="onExportExcel">下载 Excel (.xls)</el-button>
        <el-button type="warning" :icon="Printer" @click="onPrint">打印 / 另存为 PDF</el-button>
      </div>
      <div class="doc-page" v-html="previewHtml"></div>
      <template #footer>
        <el-button @click="previewVisible = false">关 闭</el-button>
      </template>
    </el-dialog>

    <!-- ========== 编辑：出口报关草单 (Declaration Draft) ========== -->
    <el-dialog
      v-model="declEditVisible" :close-on-click-modal="false"
      title="编辑出口报关单要素 (Declaration Draft)"
      width="1050px"
      destroy-on-close
      top="3vh"
    >
      <el-form :model="declForm" label-position="top" class="decl-form">
        <el-row :gutter="12">
          <el-col :span="6"><el-form-item label="报关行"><el-input v-model="declForm.broker" placeholder="如：港捷（中国）国际 3101980062" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="申报海关口岸（出境关别）"><el-input v-model="declForm.exit_customs" placeholder="如：上海海关 / 宁波海关" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="境内发货人"><el-input v-model="declForm.shipper" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="境外收货人"><el-input v-model="declForm.consignee" /></el-form-item></el-col>

          <el-col :span="6"><el-form-item label="生产销售单位"><el-input v-model="declForm.manufacturer" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="目的国"><el-input v-model="declForm.country" placeholder="如：Philippines" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="成交方式"><el-input v-model="declForm.trade_terms" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="运输方式"><el-input v-model="declForm.transport_mode" /></el-form-item></el-col>

          <el-col :span="6"><el-form-item label="预录入编号"><el-input v-model="declForm.pre_entry_no" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="海关编号"><el-input v-model="declForm.customs_no" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="备案号"><el-input v-model="declForm.record_no" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="许可证号"><el-input v-model="declForm.license_no" /></el-form-item></el-col>

          <el-col :span="6"><el-form-item label="出口日期"><el-date-picker v-model="declForm.export_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="申报日期"><el-date-picker v-model="declForm.declare_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="运输工具名称及航次号"><el-input v-model="declForm.vessel_voyage" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="提运单号"><el-input v-model="declForm.bill_no" /></el-form-item></el-col>

          <el-col :span="6"><el-form-item label="监管方式"><el-input v-model="declForm.supervision_mode" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="征免性质"><el-input v-model="declForm.levy_nature" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="申报单位"><el-input v-model="declForm.declare_unit" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="申报联系电话"><el-input v-model="declForm.declarer_tel" /></el-form-item></el-col>

          <el-col :span="6"><el-form-item label="申报人员"><el-input v-model="declForm.declarer" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="申报人员证号"><el-input v-model="declForm.declarer_no" /></el-form-item></el-col>
          <el-col :span="12">
            <el-form-item label="申报确认项">
              <div class="decl-checks">
                <span>特殊关系确认：</span><el-select v-model="declForm.special_relation" style="width:70px"><el-option label="否" value="否" /><el-option label="是" value="是" /></el-select>
                <span>价格影响确认：</span><el-select v-model="declForm.price_affect" style="width:70px"><el-option label="否" value="否" /><el-option label="是" value="是" /></el-select>
                <span>特许权使用费：</span><el-select v-model="declForm.royalty" style="width:70px"><el-option label="否" value="否" /><el-option label="是" value="是" /></el-select>
                <span>自报自缴：</span><el-select v-model="declForm.self_declare" style="width:70px"><el-option label="是" value="是" /><el-option label="否" value="否" /></el-select>
              </div>
            </el-form-item>
          </el-col>

          <el-col :span="6"><el-form-item label="合同协议号"><el-input v-model="declForm.contract_no" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="贸易国(地区)"><el-input v-model="declForm.trade_country" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="运抵国(地区)"><el-input v-model="declForm.dest_country" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="指运港"><el-input v-model="declForm.dest_port" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="离境口岸"><el-input v-model="declForm.exit_port" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="成交方式"><el-input v-model="declForm.trade_mode" /></el-form-item></el-col>

          <el-col :span="4"><el-form-item label="包装种类"><el-input v-model="declForm.pack_type" placeholder="如：纸箱" /></el-form-item></el-col>
          <el-col :span="4"><el-form-item label="件数"><el-input-number v-model="declForm.total_packages" :min="0" :controls="false" style="width:100%" /></el-form-item></el-col>
          <el-col :span="4"><el-form-item label="毛重(千克)"><el-input-number v-model="declForm.gross_weight" :min="0" :precision="2" :controls="false" style="width:100%" /></el-form-item></el-col>
          <el-col :span="4"><el-form-item label="净重(千克)"><el-input-number v-model="declForm.net_weight" :min="0" :precision="2" :controls="false" style="width:100%" /></el-form-item></el-col>
          <el-col :span="4"><el-form-item label="运费"><el-input v-model="declForm.freight" /></el-form-item></el-col>
          <el-col :span="4"><el-form-item label="保费"><el-input v-model="declForm.insurance" /></el-form-item></el-col>

          <el-col :span="6"><el-form-item label="随附单证 1"><el-input v-model="declForm.attached_docs_1" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="随附单证 2"><el-input v-model="declForm.attached_docs_2" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="杂费"><el-input v-model="declForm.misc_fees" /></el-form-item></el-col>

          <el-col :span="12"><el-form-item label="标记唛码及备注"><el-input v-model="declForm.shipping_marks_notes" type="textarea" :rows="2" placeholder="支持多行换行" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="境内货源地"><el-input v-model="declForm.origin_source" placeholder="如：金华、浙江" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="征免"><el-input v-model="declForm.levy" placeholder="如：征税" /></el-form-item></el-col>
        </el-row>

        <div class="items-section">
          <div class="items-section-head">
            <strong>报关商品要素清单（按 HS 编码归并）</strong>
            <el-button type="primary" size="small" :icon="Plus" @click="addDeclRow">添加申报行</el-button>
          </div>
          <el-table :data="declForm.items" border size="small">
            <el-table-column type="index" label="项号" width="50" align="center" />
            <el-table-column label="HS 编码" width="130">
              <template #default="{ row }"><el-input v-model="row.hs_code" size="small" /></template>
            </el-table-column>
            <el-table-column label="商品品名与规格型号申报要素" min-width="240">
              <template #default="{ row }"><el-input v-model="row.name" size="small" type="textarea" :autosize="{ minRows: 1 }" /></template>
            </el-table-column>
            <el-table-column label="数量" width="110">
              <template #default="{ row }"><el-input-number v-model="row.qty" :min="0" :controls="false" size="small" style="width:100%" @change="calcDeclRow(row)" /></template>
            </el-table-column>
            <el-table-column label="单位" width="80">
              <template #default="{ row }"><el-input v-model="row.unit" size="small" /></template>
            </el-table-column>
            <el-table-column label="单价 ($)" width="120">
              <template #default="{ row }"><el-input-number v-model="row.price" :min="0" :precision="2" :controls="false" size="small" style="width:100%" @change="calcDeclRow(row)" /></template>
            </el-table-column>
            <el-table-column label="总价 ($)" width="130">
              <template #default="{ row }"><span class="row-total">${{ formatMoney(row.total) }}</span></template>
            </el-table-column>
            <el-table-column label="操作" width="60" align="center">
              <template #default="{ $index }"><el-button link type="danger" size="small" @click="declForm.items.splice($index, 1)">删</el-button></template>
            </el-table-column>
          </el-table>
        </div>
      </el-form>

      <template #footer>
        <el-button @click="declEditVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveDecl">保存报关单信息</el-button>
      </template>
    </el-dialog>

    <!-- ========== 编辑：清关外销三单共享 (Invoice / Contract / Packing List) ========== -->
    <el-dialog
      v-model="custEditVisible" :close-on-click-modal="false"
      title="编辑外销与清关单据 (Sales Contract / Invoice / Packing List)"
      width="1150px"
      destroy-on-close
      top="3vh"
    >
      <el-form :model="custForm" label-position="top">
        <el-row :gutter="12">
          <el-col :span="6"><el-form-item label="客户 (Customer)"><el-select v-model="custForm.client_id" filterable style="width:100%"><el-option v-for="c in clientOptions" :key="c.id" :label="c.name_en || c.name" :value="c.id" /></el-select></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="销售合同号 (S/C No.)"><el-input v-model="custForm.sc_no" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="发票号码 (Invoice No.)"><el-input v-model="custForm.inv_no" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="单据时间 (Date)"><el-date-picker v-model="custForm.date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>

          <el-col :span="6"><el-form-item label="付款方式 (Payment Terms)"><el-input v-model="custForm.payment_terms" placeholder="如：T/T" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="价格条款 (Price Terms)"><el-input v-model="custForm.price_terms" placeholder="如：FOB Shanghai" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="装运方式 (Shipping Method)"><el-input v-model="custForm.shipping_method" placeholder="如：By sea" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="装货时间 (Lead Time)"><el-input v-model="custForm.loading_time" placeholder="如：30-45days after confirmation" /></el-form-item></el-col>

          <el-col :span="6"><el-form-item label="出运港 (Loading Port)"><el-input v-model="custForm.loading_port" placeholder="如：SHANGHAI" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="目的港 (Discharge Port)"><el-input v-model="custForm.dest_port" placeholder="如：Manila" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="全局唛头 (Shipping Mark)"><el-input v-model="custForm.shipping_mark" type="textarea" :rows="1" placeholder="支持换行" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="英文总价表示方式"><el-input v-model="custForm.total_amount_en" type="textarea" :rows="1" placeholder="留空则按总金额自动生成" /></el-form-item></el-col>
        </el-row>

        <div class="items-section">
          <div class="items-section-head">
            <strong>商品明细（按 HS 编码归并，不含图片）</strong>
            <el-button type="primary" size="small" :icon="Plus" @click="addCustRow">添加商品行</el-button>
          </div>
          <el-table :data="custForm.items" border size="small">
            <el-table-column type="index" label="NO." width="45" align="center" />
            <el-table-column label="产品名称 (Product / Description)" min-width="220">
              <template #default="{ row }"><el-input v-model="row.product" size="small" type="textarea" :autosize="{ minRows: 1 }" /></template>
            </el-table-column>
            <el-table-column label="数量 (pcs)" width="100">
              <template #default="{ row }"><el-input-number v-model="row.qty" :min="0" :controls="false" size="small" style="width:100%" @change="calcCustRow(row)" /></template>
            </el-table-column>
            <el-table-column label="Master CTN" width="90">
              <template #default="{ row }"><el-input-number v-model="row.ctn" :min="0" :controls="false" size="small" style="width:100%" /></template>
            </el-table-column>
            <el-table-column label="N.W. (KG)" width="100">
              <template #default="{ row }"><el-input-number v-model="row.nw" :min="0" :precision="1" :controls="false" size="small" style="width:100%" /></template>
            </el-table-column>
            <el-table-column label="G.W. (KG)" width="100">
              <template #default="{ row }"><el-input-number v-model="row.gw" :min="0" :precision="1" :controls="false" size="small" style="width:100%" /></template>
            </el-table-column>
            <el-table-column label="CBM" width="100">
              <template #default="{ row }"><el-input-number v-model="row.cbm" :min="0" :precision="3" :step="0.001" :controls="false" size="small" style="width:100%" /></template>
            </el-table-column>
            <el-table-column label="Shipping Mark" width="120">
              <template #default="{ row }"><el-input v-model="row.shipping_mark" size="small" /></template>
            </el-table-column>
            <el-table-column label="单价 ($)" width="110">
              <template #default="{ row }"><el-input-number v-model="row.price" :min="0" :precision="2" :controls="false" size="small" style="width:100%" @change="calcCustRow(row)" /></template>
            </el-table-column>
            <el-table-column label="总价 ($)" width="120">
              <template #default="{ row }"><span class="row-total">${{ formatMoney(row.total) }}</span></template>
            </el-table-column>
            <el-table-column label="删" width="50" align="center">
              <template #default="{ $index }"><el-button link type="danger" size="small" @click="custForm.items.splice($index, 1)">✕</el-button></template>
            </el-table-column>
          </el-table>
        </div>
      </el-form>

      <template #footer>
        <el-button @click="custEditVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveCust">保存单据信息</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Printer, Download, Edit, Plus } from '@element-plus/icons-vue'
import { listOrders, getOrder, updateOrder } from '@/api/orders'
import { listClients } from '@/api/clients'
import { getCompanySettings } from '@/api/companySettings'
import { formatMoney, numberToEnglishWords, getOrderTotals, printDocument, exportExcel } from '@/utils/docUtils'
import { useUserStore } from '@/stores/user'

// 单据维护权限：业务员（等级3）仅可下载打印，编辑由主管及以上操作
const userStore = useUserStore()
const canMaintain = userStore.permissionLevel <= 5

const loading = ref(false)
const saving = ref(false)
const list = ref([])
const clientOptions = ref([])
const companySettings = ref({})

// 预览
const previewVisible = ref(false)
const previewType = ref('decl')
const previewTitle = ref('')
const previewHtml = ref('')
const currentOrder = ref(null)

// 编辑弹窗
const declEditVisible = ref(false)
const custEditVisible = ref(false)
const declForm = ref({ items: [] })
const custForm = ref({ items: [] })
const editingOrderId = ref(null)

/* ========== 工具 ========== */
function parseDoc(v) {
  if (!v) return null
  if (typeof v === 'string') {
    try { return JSON.parse(v) } catch { return null }
  }
  return v
}

/* HS 编码归并（与后端 groupItemsByHs 同逻辑，用于旧数据/未保存时实时构建） */
function groupItemsByHs(items) {
  const map = new Map()
  ;(items || []).forEach((it) => {
    const key = (String(it.hs_code || '').trim()) || 'N/A'
    const qty = Number(it.qty || 0)          // 报价单 MOQ（订单场景 qty = MOQ）
    const pcs = Number(it.pcs_per_ctn) || 1   // 件/箱
    // 件数 = MOQ ÷ 件/箱（直接相除，不再使用 it.ctns 兜底或 Math.ceil 取整）
    const ctns = pcs > 0 ? qty / pcs : 0
    if (!map.has(key)) {
      map.set(key, { hs_code: key, models: [], names: [], specs: [], units: [], qty: 0, ctn: 0, nw: 0, gw: 0, cbm: 0, amount: 0 })
    }
    const g = map.get(key)
    g.qty += qty
    g.ctn += ctns
    g.nw += ctns * Number(it.nw_per_ctn || 0)
    g.gw += ctns * Number(it.gw_per_ctn || 0)
    g.cbm += ctns * Number(it.cbm_per_ctn || 0)
    g.amount += qty * Number(it.price || 0)
    if (it.model) g.models.push(String(it.model))
    if (it.name_en) g.names.push(String(it.name_en))
    if (it.spec) g.specs.push(String(it.spec))
    if (it.unit) g.units.push(String(it.unit))
  })
  const uniq = (a) => [...new Set(a.filter((x) => x && String(x).trim()))]
  return [...map.values()].map((g) => {
    const models = uniq(g.models), names = uniq(g.names), specs = uniq(g.specs), units = uniq(g.units)
    return {
      hs_code: g.hs_code === 'N/A' ? '' : g.hs_code,
      product: names.join(' / ') + (models.length ? ' (' + models.join('/') + ')' : ''),
      name: models.join('/') + (specs.length ? ' / ' + specs.join(' / ') : names.length ? ' / ' + names.join(' / ') : ''),
      qty: g.qty, ctn: Number(g.ctn.toFixed(2)),
      nw: Number(g.nw.toFixed(2)), gw: Number(g.gw.toFixed(2)), cbm: Number(g.cbm.toFixed(3)),
      shipping_mark: 'N/M',
      unit: units[0] || '台',
      price: g.qty ? Number((g.amount / g.qty).toFixed(2)) : 0,
      total: Number(g.amount.toFixed(2))
    }
  })
}

/* ========== 列表 ========== */
function exitPortText(row) {
  const dd = parseDoc(row.decl_data)
  const port = (dd && dd.exit_customs) || (row.loading_port ? row.loading_port + ' 海关' : '—')
  return `${port} | ${row.trade_terms || '—'}`
}

async function loadList() {
  loading.value = true
  try {
    const d = await listOrders({ page: 1, pageSize: 500 })
    // 仅「我司代办报关」的订单才生成报关单据套件（「请选择」表示报关责任未确认，暂不进入关务流程）
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

/* ========== 构建/读取单据数据（已保存优先，否则实时归并） ========== */
async function getOrderDocs(row) {
  const detail = await getOrder(row.id)
  const company = companySettings.value || {}
  const client = clientOptions.value.find((c) => c.id === detail.client_id) || {}
  const totals = getOrderTotals(detail)
  const grouped = groupItemsByHs(detail.items)

  let customs = parseDoc(detail.customs_data)
  if (!customs) {
    customs = {
      client_id: detail.client_id,
      sc_no: detail.pi_number + '-SC',
      inv_no: detail.pi_number + '-INV',
      date: detail.signing_date || '',
      payment_terms: detail.payment_terms || 'T/T',
      price_terms: (detail.trade_terms || 'FOB') + (detail.loading_port ? ' ' + detail.loading_port : ''),
      loading_time: detail.delivery_date || '',
      loading_port: (detail.loading_port || '').toUpperCase(),
      dest_port: detail.destination_port || '',
      shipping_method: 'By sea',
      shipping_mark: 'N/M',
      total_amount_en: '',
      items: grouped.map((g) => ({ product: g.product, qty: g.qty, ctn: g.ctn, nw: g.nw, gw: g.gw, cbm: g.cbm, shipping_mark: g.shipping_mark, price: g.price, total: g.total }))
    }
  }

  let decl = parseDoc(detail.decl_data)
  if (!decl) {
    const totalCtns = Number(grouped.reduce((s, g) => s + (Number(g.ctn) || 0), 0).toFixed(2))
    const totalNw = Number(grouped.reduce((s, g) => s + (Number(g.nw) || 0), 0).toFixed(2))
    const totalGw = Number(grouped.reduce((s, g) => s + (Number(g.gw) || 0), 0).toFixed(2))
    decl = {
      broker: '', pre_entry_no: '', customs_no: '',
      shipper: company.name_cn || '',
      exit_customs: (detail.loading_port || '').toUpperCase().includes('SHANGHAI') ? '上海海关' : (detail.loading_port || '').toUpperCase().includes('NINGBO') ? '宁波海关' : '',
      export_date: '', declare_date: detail.signing_date || '', record_no: '',
      consignee: client.name_en || client.name || '',
      country: client.country || '',
      transport_mode: '海运', vessel_voyage: '', bill_no: '',
      manufacturer: detail.supplier_name || '',
      supervision_mode: '一般贸易', levy_nature: '一般征税', license_no: '',
      // 新增：合同协议号/贸易国/指运港
      contract_no: detail.pi_number || '',
      trade_country: client.country || '',
      dest_country: client.country || '',
      dest_port: detail.destination_port || '',
      exit_port: (detail.loading_port || '').toUpperCase(),
      // 新增：包装种类行
      pack_type: '纸箱', total_packages: totalCtns, gross_weight: totalGw, net_weight: totalNw,
      trade_mode: detail.trade_terms || 'FOB',
      freight: '', insurance: '', misc_fees: '',
      // 新增：随附单证 + 标记唛码
      attached_docs_1: '', attached_docs_2: '',
      shipping_marks_notes: 'N/M',
      // 商品表扩展
      dest_country_name: client.country || '', origin_source: '', levy: '征税',
      special_relation: '否', price_affect: '否', royalty: '否', self_declare: '是',
      declarer: '', declarer_no: '', declarer_tel: company.tel || '', declare_unit: company.name_cn || '',
      currency: detail.currency || 'USD', origin_country: '中国',
      items: grouped.map((g) => ({
        hs_code: g.hs_code, name: g.name, qty: g.qty, unit: g.unit, price: g.price, total: g.total,
        currency: detail.currency || 'USD', origin_country: '中国',
        dest_country: client.country || '', origin_source: '', levy: '征税', elements: ''
      }))
    }
  }

  return { detail, company, client, totals, customs, decl }
}

/* ========== 预览 ========== */
async function openPreview(row, type) {
  try {
    const docs = await getOrderDocs(row)
    currentOrder.value = docs
    previewType.value = type
    const titleMap = {
      decl: `DECLARATION DRAFT - ${docs.detail.pi_number}`,
      ci: `COMMERCIAL INVOICE - ${docs.customs.inv_no || docs.detail.pi_number}`,
      sc: `SALES CONTRACT - ${docs.customs.sc_no || docs.detail.pi_number}`,
      pl: `PACKING LIST - ${docs.customs.inv_no || docs.detail.pi_number}`
    }
    previewTitle.value = titleMap[type]
    if (type === 'decl') previewHtml.value = buildDeclHtml(docs)
    if (type === 'ci') previewHtml.value = buildCiHtml(docs)
    if (type === 'sc') previewHtml.value = buildScHtml(docs)
    if (type === 'pl') previewHtml.value = buildPlHtml(docs)
    previewVisible.value = true
  } catch { /* 拦截器 */ }
}

function onPrint() {
  printDocument(previewHtml.value, previewTitle.value)
}
function onExportExcel() {
  const nameMap = { decl: 'DeclarationDraft', ci: 'CommercialInvoice', sc: 'SalesContract', pl: 'PackingList' }
  exportExcel(previewHtml.value, `${nameMap[previewType.value]}_${currentOrder.value.detail.pi_number}.xls`)
}

/* ========== 编辑：报关草单 ========== */
async function openDeclEdit(row) {
  const docs = await getOrderDocs(row)
  currentOrder.value = docs
  editingOrderId.value = docs.detail.id
  declForm.value = JSON.parse(JSON.stringify(docs.decl))
  if (!declForm.value.items) declForm.value.items = []
  declEditVisible.value = true
}
function openDeclEditFromPreview() {
  previewVisible.value = false
  openDeclEdit({ id: currentOrder.value.detail.id })
}
function addDeclRow() {
  declForm.value.items.push({ hs_code: '', name: '', qty: 0, unit: '台', price: 0, total: 0 })
}
function calcDeclRow(row) {
  row.total = Number(((Number(row.qty) || 0) * (Number(row.price) || 0)).toFixed(2))
}
async function saveDecl() {
  saving.value = true
  try {
    await updateOrder(editingOrderId.value, { decl_data: declForm.value })
    ElMessage.success('报关草单已保存')
    declEditVisible.value = false
    loadList()
  } catch { /* 拦截器 */ }
  finally { saving.value = false }
}

/* ========== 编辑：清关三单共享 ========== */
async function openCustomsEdit(row) {
  const docs = await getOrderDocs(row)
  currentOrder.value = docs
  editingOrderId.value = docs.detail.id
  custForm.value = JSON.parse(JSON.stringify(docs.customs))
  if (!custForm.value.items) custForm.value.items = []
  custEditVisible.value = true
}
function openCustomsEditFromPreview() {
  previewVisible.value = false
  openCustomsEdit({ id: currentOrder.value.detail.id })
}
function addCustRow() {
  custForm.value.items.push({ product: '', qty: 0, ctn: 0, nw: 0, gw: 0, cbm: 0, shipping_mark: 'N/M', price: 0, total: 0 })
}
function calcCustRow(row) {
  row.total = Number(((Number(row.qty) || 0) * (Number(row.price) || 0)).toFixed(2))
}
async function saveCust() {
  saving.value = true
  try {
    await updateOrder(editingOrderId.value, { customs_data: custForm.value })
    ElMessage.success('清关外销单据信息已保存（发票 / 合同 / 箱单同步更新）')
    custEditVisible.value = false
    loadList()
  } catch { /* 拦截器 */ }
  finally { saving.value = false }
}

/* ==================== 单据 HTML 模板 ==================== */

const COMMON_STYLE = `
  <style>
    .exp-doc { font-family: 'Times New Roman', Arial, sans-serif; color:#000; font-size:11pt; }
    .exp-doc table { border-collapse: collapse; width: 100%; }
    .exp-doc .hdr-company { font-size:14pt; font-weight:bold; text-align:center; }
    .exp-doc .hdr-addr { font-size:9pt; text-align:center; margin-top:2px; }
    .exp-doc .doc-title { font-size:18pt; font-weight:bold; text-align:center; text-decoration:underline; margin:14px 0 10px; }
    .exp-doc .info td { padding:3px 6px; vertical-align:top; font-size:10.5pt; }
    .exp-doc .goods { margin-top:10px; }
    .exp-doc .goods th { background:#d9d9d9; border:1px solid #000; padding:5px 6px; font-size:10pt; text-align:center; }
    .exp-doc .goods td { border:1px solid #000; padding:5px 6px; font-size:10pt; }
    .exp-doc .goods .num { text-align:right; }
    .exp-doc .goods .ctr { text-align:center; }
    .exp-doc .mark-box { margin-top:14px; }
    .exp-doc .mark-box td { border:1px solid #000; padding:8px 10px; font-size:10.5pt; vertical-align:top; }
    .exp-doc .made-in { text-align:center; margin-top:14px; font-size:11pt; }
    .exp-doc .say-total { margin-top:8px; font-weight:bold; font-size:11pt; }
  </style>`

function docHead(company, title) {
  return `
    <div class="hdr-company">${company.name_en || ''}</div>
    <div class="hdr-addr">${company.address_en || ''}</div>
    <div class="doc-title">${title}</div>`
}

function custTotals(customs) {
  const items = customs.items || []
  return {
    qty: items.reduce((s, it) => s + (Number(it.qty) || 0), 0),
    ctn: items.reduce((s, it) => s + (Number(it.ctn) || 0), 0),
    nw: items.reduce((s, it) => s + (Number(it.nw) || 0), 0),
    gw: items.reduce((s, it) => s + (Number(it.gw) || 0), 0),
    cbm: items.reduce((s, it) => s + (Number(it.cbm) || 0), 0),
    amount: items.reduce((s, it) => s + (Number(it.total) || 0), 0)
  }
}

function sayTotalText(customs, totals, currency) {
  if (customs.total_amount_en && String(customs.total_amount_en).trim()) return customs.total_amount_en
  const ccy = currency === 'RMB' ? 'RMB' : 'US DOLLARS'
  return 'SAY TOTAL ' + ccy + ' ' + numberToEnglishWords(totals.amount) + ' ONLY'
}

function markBoxHtml(customs, totals) {
  const mark = (customs.shipping_mark && customs.shipping_mark !== 'N/M') ? customs.shipping_mark : 'N/M'
  return `
    <table class="mark-box">
      <tr>
        <td style="width:22%; font-weight:bold;">Shipping Mark</td>
        <td style="white-space:pre-wrap;">${mark}<br><br>
          GROSS WEIGHT: ${Number(totals.gw).toFixed(1)} KGS&nbsp;&nbsp;&nbsp;NET WEIGHT: ${Number(totals.nw).toFixed(1)} KGS<br>
          CARTON# OF ${totals.ctn}<br>
          MEASUREMENT: ${Number(totals.cbm).toFixed(3)} CBM
        </td>
      </tr>
    </table>`
}

/* ---------- Commercial Invoice ---------- */
function buildCiHtml(docs) {
  const { company, client, customs, detail } = docs
  const t = custTotals(customs)
  const buyerAddr = [client.address_en || client.address || '', client.country || ''].filter(Boolean).join('<br>')
  const rows = (customs.items || []).map((it, i) => `
    <tr>
      <td class="ctr">${i + 1}</td>
      <td>${it.product || ''}</td>
      <td class="num">${it.qty || 0}</td>
      <td class="num">$${formatMoney(it.price || 0)}</td>
      <td class="num">$${formatMoney(it.total || 0)}</td>
    </tr>`).join('')
  return `
    ${COMMON_STYLE}
    <div class="exp-doc">
      ${docHead(company, 'COMMERCIAL INVOICE')}
      <table class="info">
        <tr>
          <td style="width:60%;"><strong>BUYER:</strong> ${client.name_en || client.name || ''}<br>${buyerAddr}</td>
          <td><strong>INVOICE No.:</strong> ${customs.inv_no || ''}<br><strong>Date:</strong> ${customs.date || ''}<br><strong>Payment term:</strong> ${customs.payment_terms || 'T/T'}</td>
        </tr>
      </table>
      <table class="goods">
        <thead><tr><th style="width:40px;">No.</th><th>Description of goods</th><th style="width:90px;">Qty (pcs)</th><th style="width:110px;">Unit Price (USD)</th><th style="width:120px;">Amount (USD)</th></tr></thead>
        <tbody>${rows}
          <tr style="font-weight:bold;background:#f2f2f2;">
            <td colspan="2" style="text-align:right;">TOTAL</td>
            <td class="num">${t.qty}</td>
            <td></td>
            <td class="num">$${formatMoney(t.amount)}</td>
          </tr>
        </tbody>
      </table>
      ${markBoxHtml(customs, t)}
      <div class="made-in">Made in China</div>
      <div class="say-total">${sayTotalText(customs, t, detail.currency)}</div>
    </div>`
}

/* ---------- Sales Contract ---------- */
function buildScHtml(docs) {
  const { company, client, customs, detail } = docs
  const t = custTotals(customs)
  const buyerAddr = [client.address_en || client.address || '', client.country || ''].filter(Boolean).join('<br>')
  const rows = (customs.items || []).map((it, i) => `
    <tr>
      <td class="ctr">${i + 1}</td>
      <td>${it.product || ''}</td>
      <td class="ctr">${it.ctn || 0}</td>
      <td class="num">${it.qty || 0}</td>
      <td class="num">${Number(it.nw || 0).toFixed(1)}</td>
      <td class="num">${Number(it.gw || 0).toFixed(1)}</td>
      <td class="num">${Number(it.cbm || 0).toFixed(3)}</td>
      <td class="num">$${formatMoney(it.price || 0)}</td>
      <td class="num">$${formatMoney(it.total || 0)}</td>
    </tr>`).join('')
  return `
    ${COMMON_STYLE}
    <div class="exp-doc">
      ${docHead(company, 'SALES CONTRACT')}
      <table class="info">
        <tr>
          <td style="width:60%;"><strong>Buyer:</strong> ${client.name_en || client.name || ''}<br>${buyerAddr}</td>
          <td><strong>S/C NO.:</strong> ${customs.sc_no || ''}<br><strong>Date:</strong> ${customs.date || ''}<br><strong>Payment Term:</strong> ${customs.payment_terms || 'T/T'}</td>
        </tr>
        <tr>
          <td><strong>Price Term:</strong> ${customs.price_terms || ''}<br><strong>Lead Time:</strong> ${customs.loading_time || ''}</td>
          <td><strong>Shipping port:</strong> ${customs.loading_port || ''}<br><strong>Discharging Port:</strong> ${customs.dest_port || ''}<br><strong>Shipping Method:</strong> ${customs.shipping_method || 'By sea'}</td>
        </tr>
      </table>
      <table class="goods">
        <thead><tr>
          <th style="width:36px;" rowspan="2">No.</th><th rowspan="2">Description of goods</th>
          <th style="width:70px;" rowspan="2">Master CTN</th><th style="width:80px;" rowspan="2">Total Qty (pcs)</th>
          <th colspan="2">Weight (KG)</th><th style="width:70px;" rowspan="2">Meas. (CBM)</th>
          <th colspan="2">Price (USD)</th>
        </tr><tr>
          <th style="width:75px;">N.W.</th><th style="width:75px;">G.W.</th>
          <th style="width:85px;">Unit</th><th style="width:95px;">Total</th>
        </tr></thead>
        <tbody>${rows}
          <tr style="font-weight:bold;background:#f2f2f2;">
            <td colspan="2" style="text-align:right;">TOTAL</td>
            <td class="ctr">${t.ctn}</td><td class="num">${t.qty}</td>
            <td class="num">${Number(t.nw).toFixed(1)}</td><td class="num">${Number(t.gw).toFixed(1)}</td><td class="num">${Number(t.cbm).toFixed(3)}</td>
            <td></td><td class="num">US$${formatMoney(t.amount)}</td>
          </tr>
        </tbody>
      </table>
      ${markBoxHtml(customs, t)}
      <div class="say-total">${sayTotalText(customs, t, detail.currency)}</div>
    </div>`
}

/* ---------- Packing List ---------- */
function buildPlHtml(docs) {
  const { company, client, customs } = docs
  const t = custTotals(customs)
  const buyerAddr = [client.address_en || client.address || '', client.country || ''].filter(Boolean).join('<br>')
  const rows = (customs.items || []).map((it, i) => `
    <tr>
      <td class="ctr">${i + 1}</td>
      <td>${it.product || ''}</td>
      <td class="num">${it.qty || 0}</td>
      <td class="ctr">${it.ctn || 0}</td>
      <td class="num">${Number(it.nw || 0).toFixed(1)}</td>
      <td class="num">${Number(it.gw || 0).toFixed(1)}</td>
      <td class="num">${Number(it.cbm || 0).toFixed(3)}</td>
    </tr>`).join('')
  return `
    ${COMMON_STYLE}
    <div class="exp-doc">
      ${docHead(company, 'PACKING LIST')}
      <table class="info">
        <tr>
          <td style="width:60%;"><strong>Buyer:</strong> ${client.name_en || client.name || ''}<br>${buyerAddr}</td>
          <td><strong>INVOICE NO.:</strong> ${customs.inv_no || ''}<br><strong>DATE:</strong> ${customs.date || ''}</td>
        </tr>
        <tr>
          <td><strong>Shipping port:</strong> ${customs.loading_port || ''}<br><strong>Discharging Port:</strong> ${customs.dest_port || ''}<br><strong>SC No.:</strong> SC${(customs.sc_no || '').replace(/^.*?-/, '')}</td>
          <td></td>
        </tr>
      </table>
      <table class="goods">
        <thead><tr>
          <th style="width:40px;" rowspan="2">No.</th><th rowspan="2">Description of goods</th>
          <th colspan="2">Qty</th><th colspan="2">Weight (KG)</th><th style="width:90px;" rowspan="2">CBM</th>
        </tr><tr>
          <th style="width:80px;">pcs</th><th style="width:70px;">CTN</th>
          <th style="width:80px;">N.W</th><th style="width:80px;">G.W</th>
        </tr></thead>
        <tbody>${rows}
          <tr style="font-weight:bold;background:#f2f2f2;">
            <td colspan="2" style="text-align:right;">Total</td>
            <td class="num">${t.qty}</td><td class="ctr">${t.ctn}</td>
            <td class="num">${Number(t.nw).toFixed(1)}</td><td class="num">${Number(t.gw).toFixed(1)}</td><td class="num">${Number(t.cbm).toFixed(3)}</td>
          </tr>
        </tbody>
      </table>
      ${markBoxHtml(customs, t)}
      <div class="made-in">Made in China</div>
    </div>`
}

/* ---------- 出口报关草单（中华人民共和国海关出口货物报关单，严格仿 PDF 版式） ---------- */
function buildDeclHtml(docs) {
  const { decl, company } = docs
  const items = decl.items || []

  // 商品表 12 列 HTML（每项商品行 + 下方申报要素子行）
  const itemRowsHtml = items.map((it, i) => {
    const cur = it.currency || decl.currency || 'USD'
    const oc = it.origin_country || decl.origin_country || '中国'
    const dc = it.dest_country || decl.dest_country_name || decl.country || ''
    const os = it.origin_source || decl.origin_source || ''
    const lv = it.levy || decl.levy || '征税'
    const priceFmt = Number(it.price || 0).toFixed(2)
    const totalFmt = Number(it.total || 0).toFixed(2)
    // 主数据行（12 列）—— td 不加额外类，边框由 .decl-doc td 基础规则统一提供
    const mainRow = `
      <tr>
        <td class="ctr">${i + 1}</td>
        <td class="ctr">${it.hs_code || ''}</td>
        <td class="topleft">${it.name || ''}</td>
        <td class="ctr">${it.qty || 0}</td>
        <td class="ctr">${it.unit || ''}</td>
        <td class="num">${priceFmt}</td>
        <td class="num">${totalFmt}</td>
        <td class="ctr">${cur}</td>
        <td class="ctr">${oc}</td>
        <td class="ctr">${dc}</td>
        <td class="ctr">${os}</td>
        <td class="ctr">${lv}</td>
      </tr>`
    // 申报要素子行（跨整行，描述该商品的申报要素说明）
    const elements = (it.elements || '').trim()
    const elRow = elements ? `
      <tr>
        <td colspan="12" class="el-row">
          <strong>申报要素：</strong>${elements.replace(/\n/g, '；')}
        </td>
      </tr>` : ''
    return mainRow + elRow
  }).join('')

  return `
    <style>
      .decl-doc { font-family: SimSun, '宋体', 'SimHei', '黑体', serif; color:#000; font-size:9pt; }
      .decl-doc table { border-collapse: collapse; width:100%; table-layout: fixed; }
      /* 基础单元格：所有 td 默认全边框 + 自动换行，杜绝文字溢出/缺线 */
      .decl-doc td { border:1px solid #000; padding:3px 4px; vertical-align:middle; font-size:9pt; line-height:1.25; word-break:break-word; overflow-wrap:break-word; }
      /* 标签格：灰底加粗居中，允许窄列内换行（不 nowrap，防止溢出） */
      .decl-doc .lbl { background:#f0f0f0; font-weight:bold; text-align:center; white-space:normal; word-break:break-all; line-height:1.15; }
      .decl-doc .ctr { text-align:center; }
      .decl-doc .topleft { text-align:left; }
      .decl-doc .num { text-align:right; padding-right:6px; white-space:nowrap; }
      .decl-doc .el-row { font-size:8.5pt; color:#333; text-align:left; }
      .decl-doc .decl-title-row td { text-align:center; font-size:15pt; font-weight:bold; padding:10px 0; letter-spacing:4px; }
      .decl-doc .head-row td { background:#f0f0f0; font-weight:bold; text-align:center; white-space:normal; word-break:break-all; line-height:1.15; }
      .decl-doc .page-footer { text-align:right; font-size:9pt; padding:4px 6px; color:#555; border:none; }
    </style>
    <div class="decl-doc">
      <table>
        <!-- 固定 12 列网格宽度：标签常出现的列保证 ≥7%（约70px），品名弹性列 20% -->
        <colgroup>
          <col style="width:7%"><col style="width:9%"><col style="width:20%"><col style="width:7%"><col style="width:7%"><col style="width:7%"><col style="width:7.5%"><col style="width:6.5%"><col style="width:7.5%"><col style="width:7.5%"><col style="width:7.5%"><col style="width:6.5%">
        </colgroup>

        <!-- ============ 标题行 ============ -->
        <tr class="decl-title-row">
          <td colspan="12">中华人民共和国海关出口货物报关单</td>
        </tr>

        <!-- ============ 头部：报关行 + 预录入号 + 海关编号 ============ -->
        <tr>
          <td class="lbl">报关行</td>
          <td colspan="4">${decl.broker || ''}</td>
          <td class="lbl">预录入编号</td>
          <td>${decl.pre_entry_no || ''}</td>
          <td class="lbl">海关编号</td>
          <td colspan="4">${decl.customs_no || ''}</td>
        </tr>

        <!-- ============ 第一行：境内发货人 / 出境关别 / 出口日期 / 申报日期 / 备案号 ============ -->
        <tr>
          <td class="lbl">境内发货人</td>
          <td colspan="3">${decl.shipper || ''}</td>
          <td class="lbl">出境关别</td>
          <td>${decl.exit_customs || ''}</td>
          <td class="lbl">出口日期</td>
          <td>${decl.export_date || ''}</td>
          <td class="lbl">申报日期</td>
          <td>${decl.declare_date || ''}</td>
          <td class="lbl">备案号</td>
          <td>${decl.record_no || ''}</td>
        </tr>

        <!-- ============ 第二行：境外收货人 / 运输方式 / 运输工具名称及航次号 / 提运单号 ============ -->
        <tr>
          <td class="lbl">境外收货人</td>
          <td colspan="3">${decl.consignee || ''}</td>
          <td class="lbl">运输方式</td>
          <td>${decl.transport_mode || ''}</td>
          <td class="lbl">运输工具名称及航次号</td>
          <td colspan="2">${decl.vessel_voyage || ''}</td>
          <td class="lbl">提运单号</td>
          <td colspan="2">${decl.bill_no || ''}</td>
        </tr>

        <!-- ============ 第三行：生产销售单位 / 监管方式 / 征免性质 / 许可证号 ============ -->
        <tr>
          <td class="lbl">生产销售单位</td>
          <td colspan="3">${decl.manufacturer || ''}</td>
          <td class="lbl">监管方式</td>
          <td>${decl.supervision_mode || '一般贸易'}</td>
          <td class="lbl">征免性质</td>
          <td>${decl.levy_nature || '一般征税'}</td>
          <td class="lbl">许可证号</td>
          <td colspan="3">${decl.license_no || ''}</td>
        </tr>

        <!-- ============ 第四行：合同协议号 / 贸易国(地区) / 运抵国(地区) / 指运港 / 离境口岸 ============ -->
        <tr>
          <td class="lbl">合同协议号</td>
          <td colspan="2">${decl.contract_no || ''}</td>
          <td class="lbl">贸易国(地区)</td>
          <td>${decl.trade_country || ''}</td>
          <td class="lbl">运抵国(地区)</td>
          <td>${decl.dest_country || ''}</td>
          <td class="lbl">指运港</td>
          <td>${decl.dest_port || ''}</td>
          <td class="lbl">离境口岸</td>
          <td colspan="2">${decl.exit_port || ''}</td>
        </tr>

        <!-- ============ 第五行：包装种类 / 件数 / 毛重(千克) / 净重(千克) / 成交方式 / 运费 / 保费 / 杂费 ============ -->
        <tr>
          <td class="lbl">包装种类</td>
          <td>${decl.pack_type || ''}</td>
          <td class="lbl">件数</td>
          <td class="ctr">${decl.total_packages ?? ''}</td>
          <td class="lbl">毛重(千克)</td>
          <td class="num">${decl.gross_weight ?? ''}</td>
          <td class="lbl">净重(千克)</td>
          <td class="num">${decl.net_weight ?? ''}</td>
          <td class="lbl">成交方式</td>
          <td class="ctr">${decl.trade_mode || ''}</td>
          <td class="lbl">运费</td>
          <td>${decl.freight || ''}</td>
        </tr>
        <tr>
          <td class="lbl">保费</td>
          <td>${decl.insurance || ''}</td>
          <td class="lbl">杂费</td>
          <td colspan="9">${decl.misc_fees || ''}</td>
        </tr>

        <!-- ============ 第六行：随附单证 1 / 随附单证 2 ============ -->
        <tr>
          <td class="lbl">随附单证</td>
          <td colspan="5">随附单证 1：${decl.attached_docs_1 || ''}</td>
          <td colspan="6">随附单证 2：${decl.attached_docs_2 || ''}</td>
        </tr>

        <!-- ============ 第七行：标记唛码及备注 ============ -->
        <tr>
          <td class="lbl" style="height:64px;">标记唛码及备注</td>
          <td colspan="11" style="white-space:pre-wrap;">${decl.shipping_marks_notes || ''}</td>
        </tr>

        <!-- ============ 商品表：12 列表头（宽度由 colgroup 统一控制） ============ -->
        <tr class="head-row">
          <td>项号</td>
          <td>商品编号</td>
          <td>商品名称及规格型号</td>
          <td>数量</td>
          <td>单位</td>
          <td>单价</td>
          <td>总价</td>
          <td>币制</td>
          <td>原产国(地区)</td>
          <td>最终目的国(地区)</td>
          <td>境内货源地</td>
          <td>征免</td>
        </tr>
        ${itemRowsHtml}
        ${items.length === 0 ? `<tr><td colspan="12" class="ctr" style="color:#999;">（暂无商品数据）</td></tr>` : ''}

        <!-- ============ 特殊关系等确认（长标签跨 2 列，防止溢出） ============ -->
        <tr>
          <td class="lbl" colspan="2">特殊关系确认</td>
          <td class="ctr">${decl.special_relation || '否'}</td>
          <td class="lbl" colspan="2">价格影响确认</td>
          <td class="ctr">${decl.price_affect || '否'}</td>
          <td class="lbl" colspan="2">支付特许权使用费确认</td>
          <td class="ctr">${decl.royalty || '否'}</td>
          <td class="lbl">自报自缴</td>
          <td class="ctr" colspan="2">${decl.self_declare || '是'}</td>
        </tr>

        <!-- ============ 底部：申报人员 / 证号 / 电话 / 声明+签章 / 海关批注 ============ -->
        <tr>
          <td class="lbl" style="height:72px;">申报人员</td>
          <td>${decl.declarer || ''}</td>
          <td class="lbl">申报人员证号</td>
          <td>${decl.declarer_no || ''}</td>
          <td class="lbl">电话</td>
          <td>${decl.declarer_tel || ''}</td>
          <td colspan="5" style="font-size:9pt;line-height:1.6;text-align:left;">
            兹申明以上内容承担如实申报、依法纳税之法律责任<br/><br/>
            申报单位(签章)：${decl.declare_unit || company.name_cn || ''}
          </td>
          <td class="lbl">海关批注及签章</td>
        </tr>

        <!-- ============ 页码 ============ -->
        <tr><td colspan="12" class="page-footer">-- 1 of 1 --</td></tr>
      </table>
    </div>`
}

onMounted(() => { loadList(); loadOptions() })
</script>

<style scoped>
.page-header { margin-bottom: 14px; }
.page-title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; }
.page-subtitle { font-size: 13px; color: #64748b; margin: 4px 0 0; }

.doc-toolbar { display: flex; gap: 8px; margin-bottom: 10px; }
.doc-page { background: white; padding: 30px 36px; font-size: 11px; color: #0f172a; line-height: 1.5; border: 1px solid #cbd5e1; border-radius: 4px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }

.decl-form .decl-checks { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12px; }
.items-section { margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
.items-section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.row-total { font-weight: 700; color: #dc2626; }

@media print {
  :deep(.no-print) { display: none !important; }
  :deep(.el-dialog__header), :deep(.el-dialog__footer) { display: none !important; }
}
</style>
