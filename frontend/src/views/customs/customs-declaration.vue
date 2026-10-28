﻿<template>
  <el-card shadow="never" class="page-card">
    <!-- 页面标题（仿参考项目） -->
    <div class="page-header">
      <h2 class="page-title">出口报关单据套件 (Export Customs Documents)</h2>
      <p class="page-subtitle">自动关联订单生成报关草单、Commercial Invoice、Packing List 及 Sales Contract（订单每条产品独立一行，不按 HS 编码合并）</p>
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
            <strong>报关商品要素清单（每条订单产品单独一行）</strong>
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
        </el-row>
        <el-row :gutter="16">
          <el-col :span="24"><el-form-item label="全局唛头 (Shipping Mark)"><el-input v-model="custForm.shipping_mark" type="textarea" :rows="2" placeholder="支持多行换行，自动关联订单的 Shipping Mark" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="24"><el-form-item label="英文总价表示方式"><el-input v-model="custForm.total_amount_en" type="textarea" :rows="1" placeholder="留空则按总金额自动生成" /></el-form-item></el-col>
        </el-row>

        <div class="items-section">
          <div class="items-section-head">
            <strong>商品明细（每条订单产品单独一行）</strong>
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

          <!-- 订单实时汇总：仅总毛重/总净重/总金额，靠右显示 -->
          <div class="order-summary-bar">
            <span>总毛重 <b>{{ totals.gw || 0 }} kg</b></span>
            <span>总净重 <b>{{ totals.nw || 0 }} kg</b></span>
            <span>总金额 <b>${{ formatMoney(totals.amount || 0) }}</b></span>
          </div>
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
import { computed, onMounted, ref } from 'vue'
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

// 汇总条 computed：基于 custForm.items 实时计算（清关外销单据编辑弹窗内）
const totals = computed(() => {
  const items = custForm.value.items || []
  return {
    qty: items.reduce((s, it) => s + (Number(it.qty) || 0), 0),
    ctn: items.reduce((s, it) => s + (Number(it.ctn) || 0), 0),
    nw: items.reduce((s, it) => s + (Number(it.nw) || 0), 0),
    gw: items.reduce((s, it) => s + (Number(it.gw) || 0), 0),
    cbm: items.reduce((s, it) => s + (Number(it.cbm) || 0), 0),
    amount: items.reduce((s, it) => s + (Number(it.total) || 0), 0)
  }
})

/* ========== 工具 ========== */
function parseDoc(v) {
  if (!v) return null
  if (typeof v === 'string') {
    try { return JSON.parse(v) } catch { return null }
  }
  return v
}

/* 展平：每条订单 item 单独一行，不按 HS 编码归并 */
function flatItemsFromOrder(items, kind) {
  return (items || []).map((it) => {
    const qty = Number(it.qty || 0)
    const pcs = Number(it.pcs_per_ctn) || 1
    const ctns = pcs > 0 ? qty / pcs : 0
    const hsCode = it.hs_code || it.product_hs_code || ''
    const model = it.model || it.supplier_model || it.product_our_model || ''
    const name = it.name_en || it.name || ''
    const spec = it.spec || ''
    const unit = it.unit || '台'
    const nw = ctns * Number(it.nw_per_ctn || 0)
    const gw = ctns * Number(it.gw_per_ctn || 0)
    const cbm = ctns * Number(it.cbm_per_ctn || 0)
    const price = Number(it.price || 0) || Number(it.cost_cny || 0)
    const total = Number((qty * price).toFixed(2))

    if (kind === 'decl') {
      // 商品名称：优先用 hs_codes 标准品名，拿不到则 fallback 旧的产品名拼接
      const hsProductName = it.hs_product_name || ''
      const fallbackName = model + (spec ? ' / ' + spec : name ? ' / ' + name : '')
      return {
        hs_code: hsCode,
        name: hsProductName || fallbackName,
        qty, unit, price, total,
        currency: 'USD', origin_country: '中国',
        dest_country: '', origin_source: '', levy: '征税',
        elements: it.hs_elements || ''
      }
    }
    return {
      product: (name || '') + (model ? ' (' + model + ')' : ''),
      qty, ctn: Number(ctns.toFixed(2)),
      nw: Number(nw.toFixed(2)), gw: Number(gw.toFixed(2)), cbm: Number(cbm.toFixed(3)),
      price, total,
      unit
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

/* ========== 构建/读取单据数据（已保存优先，但 items 每次实时从订单重建） ========== */
async function getOrderDocs(row) {
  const detail = await getOrder(row.id)
  const company = companySettings.value || {}
  const client = clientOptions.value.find((c) => c.id === detail.client_id) || {}
  const totals = getOrderTotals(detail)
  // 每条订单 item 单独一行，不按 HS 编码归并
  const flatDecl = flatItemsFromOrder(detail.items, 'decl')
  const flatCust = flatItemsFromOrder(detail.items, 'cust')

  // ===== 商业发票/装箱单 =====
  const savedCustoms = parseDoc(detail.customs_data)
  const customs = savedCustoms ? {
    ...savedCustoms,
    items: mergeItems(savedCustoms.items, flatCust, 'customs')
  } : {
    client_id: detail.client_id,
    sc_no: detail.pi_number + 'SC',
    inv_no: detail.pi_number + 'INV',
    date: detail.signing_date || '',
    payment_terms: detail.payment_terms || 'T/T',
    price_terms: (detail.trade_terms || 'FOB') + (detail.loading_port ? ' ' + detail.loading_port : ''),
    loading_time: detail.delivery_date || '',
    loading_port: (detail.loading_port || '').toUpperCase(),
    dest_port: detail.destination_port || '',
    shipping_method: 'By sea',
    shipping_mark: detail.shipping_mark && String(detail.shipping_mark).trim() ? String(detail.shipping_mark).trim() : 'N/M',
    total_amount_en: '',
    items: flatCust
  }

  // ===== 出口报关草单 =====
  const savedDecl = parseDoc(detail.decl_data)
  // 按实时 items 重新算总毛净重
  const sum = (arr, k) => Number(arr.reduce((s, g) => s + (Number(g[k]) || 0), 0).toFixed(2))
  const totalCtns = sum(flatCust, 'ctn')
  const totalNw = sum(flatCust, 'nw')
  const totalGw = sum(flatCust, 'gw')
  const decl = savedDecl ? {
    ...savedDecl,
    items: mergeItems(savedDecl.items, flatDecl, 'decl'),
    total_packages: savedDecl.total_packages || totalCtns,
    gross_weight: savedDecl.gross_weight || totalGw,
    net_weight: savedDecl.net_weight || totalNw
  } : {
    broker: '', pre_entry_no: '', customs_no: '',
    shipper: company.name_cn || '',
    exit_customs: (detail.loading_port || '').toUpperCase().includes('SHANGHAI') ? '上海海关' : (detail.loading_port || '').toUpperCase().includes('NINGBO') ? '宁波海关' : '',
    export_date: '', declare_date: detail.signing_date || '', record_no: '',
    consignee: client.name_en || client.name || '',
    country: client.country || '',
    transport_mode: '海运', vessel_voyage: '', bill_no: '',
    manufacturer: detail.supplier_name || '',
    supervision_mode: '一般贸易', levy_nature: '一般征税', license_no: '',
    contract_no: detail.pi_number || '',
    trade_country: client.country || '',
    dest_country: client.country || '',
    dest_port: detail.destination_port || '',
    exit_port: (detail.loading_port || '').toUpperCase(),
    pack_type: '纸箱', total_packages: totalCtns, gross_weight: totalGw, net_weight: totalNw,
    trade_mode: detail.trade_terms || 'FOB',
    freight: '', insurance: '', misc_fees: '',
    attached_docs_1: '', attached_docs_2: '',
    shipping_marks_notes: 'N/M',
    dest_country_name: client.country || '', origin_source: '', levy: '征税',
    special_relation: '否', price_affect: '否', royalty: '否', self_declare: '是',
    declarer: '', declarer_no: '', declarer_tel: company.tel || '', declare_unit: company.name_cn || '',
    currency: detail.currency || 'USD', origin_country: '中国',
    items: flatDecl
  }

  return { detail, company, client, totals, customs, decl }
}

/**
 * 合并 items：用实时 flat 作为基准（保证订单所有产品都进来），
 * 如果已保存的 saved 里能按位置或 hs_code 对上，保留用户编辑过的字段。
 * 订单里删掉的产品自动消失，新增的产品自动出现。
 */
function mergeItems(savedItems, flat, kind) {
  const saved = Array.isArray(savedItems) ? savedItems : []

  // 简单策略：按位置对齐（flat[i] 对 saved[i]），同时保留 saved[i] 的用户编辑值
  return flat.map((g, i) => {
    const savedMatch = saved[i]

    if (!savedMatch) {
      // 新增的产品，用实时 flat 值
      if (kind === 'decl') {
        return { hs_code: g.hs_code, name: g.name, qty: g.qty, unit: g.unit, price: g.price, total: g.total, currency: 'USD', origin_country: '中国', dest_country: '', origin_source: '', levy: '征税', elements: g.elements || '' }
      }
      return { product: g.product, qty: g.qty, ctn: g.ctn, nw: g.nw, gw: g.gw, cbm: g.cbm, price: g.price, total: g.total, unit: g.unit }
    }

    // 有匹配：保留用户编辑字段（非空非零），基础信息用实时值
    if (kind === 'decl') {
      return {
        ...savedMatch,
        hs_code: g.hs_code,
        name: g.name,
        qty: savedMatch.qty !== undefined && savedMatch.qty !== '' && Number(savedMatch.qty) > 0 ? savedMatch.qty : g.qty,
        unit: savedMatch.unit || g.unit,
        price: savedMatch.price !== undefined && savedMatch.price !== '' && Number(savedMatch.price) > 0 ? savedMatch.price : g.price,
        total: savedMatch.total !== undefined && savedMatch.total !== '' && Number(savedMatch.total) > 0 ? savedMatch.total : g.total,
        // 申报要素优先用户编辑值，为空则回退到 HS 编码库实时值
        elements: (savedMatch.elements && savedMatch.elements.trim()) ? savedMatch.elements : (g.elements || '')
      }
    }
    return {
      ...savedMatch,
      product: g.product,
      qty: savedMatch.qty !== undefined && savedMatch.qty !== '' && Number(savedMatch.qty) > 0 ? savedMatch.qty : g.qty,
      ctn: g.ctn, nw: g.nw, gw: g.gw, cbm: g.cbm,
      price: savedMatch.price !== undefined && savedMatch.price !== '' && Number(savedMatch.price) > 0 ? savedMatch.price : g.price,
      total: savedMatch.total !== undefined && savedMatch.total !== '' && Number(savedMatch.total) > 0 ? savedMatch.total : g.total,
      unit: savedMatch.unit || g.unit
    }
  })
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

function markBoxHtml(customs) {
  const mark = (customs.shipping_mark && String(customs.shipping_mark).trim())
    ? customs.shipping_mark
    : 'N/M'
  return `
    <table class="mark-box">
      <tr>
        <td style="width:22%; font-weight:bold; text-align:center; vertical-align:middle;">Shipping Mark</td>
        <td style="white-space:pre-wrap; text-align:left; vertical-align:middle;">${mark}</td>
      </tr>
    </table>`
}

/** 右下角电子签章：仅当 company.seal_img 存在时输出 */
function sealBlock(company) {
  if (!company || !company.seal_img) return ''
  return `
    <div style="margin-top:24px; display:flex; justify-content:flex-end; position:relative;">
      <div style="position:relative; width:220px; height:110px;">
        <img src="${company.seal_img}" style="position:absolute; right:0; bottom:0; max-width:220px; max-height:110px; transform:rotate(-5deg); opacity:0.95;" alt="SEAL" />
      </div>
    </div>`
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
          <td style="width:60%;"><strong>BUYER:</strong><br><strong>${client.name_en || client.name || ''}</strong><br>${buyerAddr}</td>
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
      ${markBoxHtml(customs)}
      <div class="say-total">${sayTotalText(customs, t, detail.currency)}</div>
      ${sealBlock(company)}
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
          <td style="width:60%;"><strong>Buyer:</strong><br><strong>${client.name_en || client.name || ''}</strong><br>${buyerAddr}</td>
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
      ${markBoxHtml(customs)}
      <div class="say-total">${sayTotalText(customs, t, detail.currency)}</div>
      ${sealBlock(company)}
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
          <td style="width:60%;"><strong>Buyer:</strong><br><strong>${client.name_en || client.name || ''}</strong><br>${buyerAddr}</td>
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
      ${markBoxHtml(customs)}
      ${sealBlock(company)}
    </div>`
}

/* ---------- 出口报关草单（中华人民共和国海关出口货物报关单，严格仿 PDF 13 列版式） ----------
   列宽来自 PDF 实测 800pt 宽表格（841.85pt A4 横向页面）：
   c0 8.35%  c1 9.94%  c2 13.56%  c3 7.58%  c4 7.48%  c5 7.87%
   c6 7.09%  c7 7.37%  c8 5.61%   c9 5.12%  c10 6.79% c11 6.60% c12 6.65%
*/
function buildDeclHtml(docs) {
  const { decl, company } = docs
  const items = decl.items || []

  // 辅助：带标签的单元格（标签 + 值在同一个 td 内，标签灰底加粗显示）
  const labeledCell = (label, value, span = 1) => {
    const v = (value ?? '').toString().trim()
    const inner = v ? `<div class="val">${v}</div>` : ''
    return `<td${span > 1 ? ` colspan="${span}"` : ''}><div class="lbl">${label}</div>${inner}</td>`
  }
  const singleVal = (value, span = 1, cls = '') => {
    const v = value ?? ''
    return `<td${span > 1 ? ` colspan="${span}"` : ''}${cls ? ` class="${cls}"` : ''}>${v}</td>`
  }

  // ===== 商品表 =====
  // 商品表：海关标准格式，申报要素为商品名称列下方的独立子行（跨 c1+c2+c3 三列）
  const MIN_ITEM_ROWS = 6
  const itemMainRow = (it, i) => {
    const cur = it.currency || decl.currency || 'USD'
    const oc = it.origin_country || decl.origin_country || '中国'
    const dc = it.dest_country || decl.dest_country_name || decl.country || ''
    const os = it.origin_source || decl.origin_source || ''
    const lv = it.levy || decl.levy || '征税'
    const hasElements = it.elements && it.elements.trim()
    const itemCell = hasElements
      ? `<td class="ctr" rowspan="2">${i + 1}</td>`
      : `<td class="ctr">${i + 1}</td>`
    return `<tr>
      ${itemCell}
      <td>${it.hs_code || ''}</td>
      <td colspan="2">${it.name || ''}</td>
      <td>${it.qty || 0}</td>
      <td>${it.unit || ''}</td>
      <td class="num">${Number(it.price || 0).toFixed(2)}</td>
      <td class="num">${Number(it.total || 0).toFixed(2)}</td>
      <td class="ctr">${cur}</td>
      <td class="ctr">${oc}</td>
      <td class="ctr">${dc}</td>
      <td class="ctr">${os}</td>
      <td class="ctr">${lv}</td>
    </tr>`
  }
  const itemSubRow = (elements) => {
    const text = (elements || '').trim()
    if (!text) return ''
    // c0(项号) 已由主行 rowspan=2 合并；子行从 c1(商品编号) 铺到 c12(征免)，整行无分割线
    return `<tr><td colspan="12" class="decl-el-elem">${text}</td></tr>`
  }
  const itemRowsHtml = (() => {
    const count = Math.max(items.length, MIN_ITEM_ROWS)
    let html = ''
    for (let i = 0; i < count; i++) {
      const it = items[i]
      if (it) {
        html += itemMainRow(it, i)
        html += itemSubRow(it.elements || '')
      } else {
        html += `<tr><td class="ctr">${i + 1}</td><td></td><td colspan="2"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`
      }
    }
    return html
  })()

  return `
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      .decl-doc { font-family: 'SimSun','宋体',serif; color:#000; font-size:9pt; line-height:1.2; }
      .decl-doc table { border-collapse:collapse; width:100%; table-layout:fixed; }
      .decl-doc td { border:1px solid #000; padding:2px 3px; vertical-align:middle; font-size:9pt; word-break:break-all; overflow-wrap:break-word; }
      .decl-doc .lbl { font-weight:bold; font-size:8.5pt; color:#333; margin-bottom:2px; }
      .decl-doc .val { font-size:9pt; }
      .decl-doc .ctr { text-align:center; }
      .decl-doc .num { text-align:right; padding-right:4px; white-space:nowrap; }
      .decl-doc .decl-el-elem { font-size:8pt; color:#333; padding:1px 4px; white-space:pre-wrap; }
      .decl-doc .hdr-row td { background:#f0f0f0; font-weight:bold; text-align:center; font-size:8.5pt; line-height:1.15; }
      .decl-doc .top-area { text-align:center; margin-bottom:6px; }
      .decl-doc .form-title { font-size:16pt; font-weight:bold; letter-spacing:6px; }
      .decl-doc .broker-line { font-size:10pt; margin-top:4px; }
      .decl-doc .entry-line { font-size:9pt; margin-top:2px; }
      .decl-doc .entry-line .lbl2 { color:#555; }
      .decl-doc .entry-line .val2 { margin-right:30px; }
    </style>
    <div class="decl-doc">
      <!-- ====== 表格上方区：标题 + 报关行 + 预录入/海关编号 ====== -->
      <div class="top-area">
        <div class="form-title">中华人民共和国海关出口货物报关单</div>
        <div class="broker-line">报关行：${decl.broker || ''}</div>
        <div class="entry-line">
          <span class="lbl2">预录入编号：</span><span class="val2">${decl.pre_entry_no || ''}</span>
          <span class="lbl2">海关编号：</span><span>${decl.customs_no || ''}</span>
        </div>
      </div>

      <!-- ====== 13 列主表 ====== -->
      <table>
        <colgroup>
          <col style="width:8.35%"><col style="width:9.94%"><col style="width:13.56%"><col style="width:7.58%"><col style="width:7.48%"><col style="width:7.87%"><col style="width:7.09%"><col style="width:7.37%"><col style="width:5.61%"><col style="width:5.12%"><col style="width:6.79%"><col style="width:6.60%"><col style="width:6.65%">
        </colgroup>

        <!-- Row0 c0×3 c3×2 c5×2 c7×3 c10×3 -->
        <tr>
          ${labeledCell('境内发货人', decl.shipper, 3)}
          ${labeledCell('出境关别', decl.exit_customs, 2)}
          ${labeledCell('出口日期', decl.export_date, 2)}
          ${labeledCell('申报日期', decl.declare_date, 3)}
          ${labeledCell('备案号', decl.record_no, 3)}
        </tr>

        <!-- Row1 c0×3 c3×2 c5×2 c7×6 -->
        <tr>
          ${labeledCell('境外收货人', decl.consignee, 3)}
          ${labeledCell('运输方式', decl.transport_mode || '海运', 2)}
          ${labeledCell('运输工具名称及航次号', decl.vessel_voyage, 2)}
          ${labeledCell('提运单号', decl.bill_no, 6)}
        </tr>

        <!-- Row2 same as Row1 -->
        <tr>
          ${labeledCell('生产销售单位', decl.manufacturer, 3)}
          ${labeledCell('监管方式', decl.supervision_mode || '一般贸易', 2)}
          ${labeledCell('征免性质', decl.levy_nature || '一般征税', 2)}
          ${labeledCell('许可证号', decl.license_no, 6)}
        </tr>

        <!-- Row3 c0×3 c3×2 c5×5 c10×3 -->
        <tr>
          ${labeledCell('合同协议号', decl.contract_no, 3)}
          ${labeledCell('贸易国（地区）', decl.trade_country, 2)}
          ${labeledCell('运抵国（地区）', decl.dest_country_name || decl.dest_country, 2)}
          ${labeledCell('指运港', decl.dest_port, 3)}
          ${labeledCell('离境口岸', decl.exit_port, 3)}
        </tr>

        <!-- Row4 c0×3 c3×1 c4×1 c5×1 c6×1 c7×2 c9×2 c11×2 -->
        <tr>
          ${labeledCell('包装种类', decl.pack_type, 3)}
          ${labeledCell('件数', decl.total_packages, 1)}
          ${labeledCell('毛重（千克）', decl.gross_weight, 1)}
          ${labeledCell('净重（千克）', decl.net_weight, 1)}
          ${labeledCell('成交方式', decl.trade_mode || 'FOB', 1)}
          ${labeledCell('运费', decl.freight, 2)}
          ${labeledCell('保费', decl.insurance, 2)}
          ${labeledCell('杂费', decl.misc_fees, 2)}
        </tr>

        <!-- Row5 c0×13 随附单证 -->
        <tr>
          <td colspan="13">
            <div class="lbl">随附单证</div>
            随附单证 1：${decl.attached_docs_1 || ''}　
            随附单证 2：${decl.attached_docs_2 || ''}
          </td>
        </tr>

        <!-- Row6 c0×13 标记唛码及备注 -->
        <tr>
          <td colspan="13" style="padding:4px 6px;">
            <div class="lbl">标记唛码及备注</div>
            <div style="white-space:pre-wrap;">${decl.shipping_marks_notes || ''}</div>
          </td>
        </tr>

        <!-- Row7 表头 c0×1 c1×1 c2×2 c4×2 c6~c12 各 1 -->
        <tr class="hdr-row">
          <td>项号</td>
          <td>商品编号</td>
          <td colspan="2">商品名称及规格型号</td>
          <td colspan="2">数量及单位</td>
          <td>单价</td>
          <td>总价</td>
          <td>币制</td>
          <td>原产国（地区）</td>
          <td>最终目的国</td>
          <td>境内货源地</td>
          <td>征免</td>
        </tr>

        <!-- Row8~19 商品 6 组 主+子 -->
        ${itemRowsHtml}

        <!-- Row20 c0×13 特殊关系等 -->
        <tr>
          <td colspan="13" style="text-align:center; padding:3px 6px;">
            特殊关系确认：${decl.special_relation || '否'}　
            价格影响确认：${decl.price_affect || '否'}　
            支付特许权使用费确认：${decl.royalty || '否'}　
            自报自缴：${decl.self_declare || '是'}
          </td>
        </tr>

        <!-- Row21 c0×10 c10×3 申报人员/声明/海关批注 -->
        <tr>
          <td colspan="10" style="padding:3px 6px; vertical-align:top;">
            申报人员：${decl.declarer || ''}　
            申报人员证号：${decl.declarer_no || ''}　
            电话：${decl.declarer_tel || ''}<br/>
            兹申明以上内容承担如实申报、依法纳税之法律责任
          </td>
          <td colspan="3" style="vertical-align:top; text-align:center;">海关批注及签章</td>
        </tr>

        <!-- Row22 c0×10 c10×3 申报单位 (tall row 54pt) -->
        <tr style="height:54px;">
          <td colspan="10" style="vertical-align:bottom; padding-bottom:4px;">
            申报单位：${decl.declare_unit || company.name_cn || ''}　
            申报单位(签章)：_______________
          </td>
          <td colspan="3" style="vertical-align:bottom; padding-bottom:4px;"></td>
        </tr>
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
.order-summary-bar { margin-top: 12px; padding: 8px 12px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; font-size: 13px; color: #0f172a; display: flex; gap: 24px; justify-content: flex-end; align-items: center; }
.order-summary-bar b { color: #0369a1; font-size: 14px; }
.summary-title { color: #475569; font-weight: 600; }
.row-total { font-weight: 700; color: #dc2626; }

@media print {
  :deep(.no-print) { display: none !important; }
  :deep(.el-dialog__header), :deep(.el-dialog__footer) { display: none !important; }
}
</style>
