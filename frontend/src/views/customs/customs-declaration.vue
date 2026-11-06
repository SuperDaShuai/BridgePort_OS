﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿<template>
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
      <el-table-column label="申报海关口岸" width="180">
        <template #default="{ row }">
          {{ exitPortText(row) }}
        </template>
      </el-table-column>
      <el-table-column label="预计离港时间" width="120" align="center">
        <template #default="{ row }">{{ customsMeta(row, 'etd') }}</template>
      </el-table-column>
      <el-table-column label="预计到港时间" width="120" align="center">
        <template #default="{ row }">{{ customsMeta(row, 'eta') }}</template>
      </el-table-column>
      <el-table-column label="Declaration Draft" width="180" align="center">
        <template #default="{ row }">
          <el-button size="small" @click="openPreview(row, 'decl')">Declaration Draft</el-button>
        </template>
      </el-table-column>
      <el-table-column label="Sales Contract" width="170" align="center">
        <template #default="{ row }">
          <el-button size="small" @click="openPreview(row, 'sc')">Sales Contract</el-button>
        </template>
      </el-table-column>
      <el-table-column label="Commercial Invoice" width="190" align="center">
        <template #default="{ row }">
          <el-button size="small" @click="openPreview(row, 'ci')">Commercial Invoice</el-button>
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
      width="1100px"
      destroy-on-close
      top="3vh"
    >
      <div class="decl-edit">

        <!-- Section 1: 主体标识（黄色高亮） -->
        <div class="decl-section decl-section--yellow">
          <div class="decl-sec-title">主体标识</div>
          <div class="decl-fields">
            <div class="decl-field"><span class="decl-label">报关行</span><el-input v-model="declForm.broker" size="small" placeholder="港捷（中国）国际 3101980062" /></div>
            <div class="decl-field"><span class="decl-label">出境关别</span><el-input v-model="declForm.exit_customs" size="small" placeholder="上海海关 / 宁波海关" /></div>
            <div class="decl-field"><span class="decl-label">境内发货人</span><el-input v-model="declForm.shipper" size="small" /></div>
            <div class="decl-field"><span class="decl-label">境外收货人</span><el-input v-model="declForm.consignee" size="small" /></div>
            <div class="decl-field"><span class="decl-label">生产销售单位</span><el-input v-model="declForm.manufacturer" size="small" /></div>
            <div class="decl-field"><span class="decl-label">监管方式</span><el-input v-model="declForm.supervision_mode" size="small" /></div>
            <div class="decl-field"><span class="decl-label">征免性质</span><el-input v-model="declForm.levy_nature" size="small" /></div>
            <div class="decl-field"><span class="decl-label">申报单位</span><el-input v-model="declForm.declare_unit" size="small" /></div>
          </div>
        </div>

        <!-- Section 2: 编号 / 日期 -->
        <div class="decl-section decl-section--beige">
          <div class="decl-sec-title">编号 / 日期</div>
          <div class="decl-fields">
            <div class="decl-field"><span class="decl-label">预录入编号</span><el-input v-model="declForm.pre_entry_no" size="small" /></div>
            <div class="decl-field"><span class="decl-label">海关编号</span><el-input v-model="declForm.customs_no" size="small" /></div>
            <div class="decl-field"><span class="decl-label">备案号</span><el-input v-model="declForm.record_no" size="small" /></div>
            <div class="decl-field"><span class="decl-label">许可证号</span><el-input v-model="declForm.license_no" size="small" /></div>
            <div class="decl-field"><span class="decl-label">合同协议号</span><el-input v-model="declForm.contract_no" size="small" /></div>
            <div class="decl-field"><span class="decl-label">出口日期</span><el-date-picker v-model="declForm.export_date" type="date" value-format="YYYY-MM-DD" size="small" style="width:100%" /></div>
            <div class="decl-field"><span class="decl-label">申报日期</span><el-date-picker v-model="declForm.declare_date" type="date" value-format="YYYY-MM-DD" size="small" style="width:100%" /></div>
            <div class="decl-field"><span class="decl-label">申报联系电话</span><el-input v-model="declForm.declarer_tel" size="small" /></div>
          </div>
        </div>

        <!-- Section 3: 运输信息 -->
        <div class="decl-section">
          <div class="decl-sec-title">运输信息</div>
          <div class="decl-fields">
            <div class="decl-field"><span class="decl-label">运输方式</span><el-select v-model="declForm.transport_mode" size="small" style="width:100%"><el-option label="海运" value="海运" /><el-option label="陆运" value="陆运" /><el-option label="空运" value="空运" /><el-option label="快递" value="快递" /></el-select></div>
            <div class="decl-field"><span class="decl-label">运输工具及航次</span><el-input v-model="declForm.vessel_voyage" size="small" /></div>
            <div class="decl-field"><span class="decl-label">提运单号</span><el-input v-model="declForm.bill_no" size="small" /></div>
            <div class="decl-field"><span class="decl-label">离境口岸</span><el-input v-model="declForm.exit_port" size="small" /></div>
            <div class="decl-field"><span class="decl-label">指运港</span><el-input v-model="declForm.dest_port" size="small" /></div>
            <div class="decl-field"><span class="decl-label">成交方式</span><el-input v-model="declForm.trade_mode" size="small" /></div>
          </div>
        </div>

        <!-- Section 4: 国别 / 货源地 -->
        <div class="decl-section">
          <div class="decl-sec-title">国别 / 货源地 / 征免</div>
          <div class="decl-fields">
            <div class="decl-field"><span class="decl-label">贸易国(地区)</span><el-input v-model="declForm.trade_country" size="small" /></div>
            <div class="decl-field"><span class="decl-label">运抵国(地区)</span><el-input v-model="declForm.dest_country" size="small" /></div>
            <div class="decl-field"><span class="decl-label">目的国</span><el-input v-model="declForm.country" size="small" placeholder="如：Philippines" /></div>
            <div class="decl-field"><span class="decl-label">成交方式(旧)</span><el-input v-model="declForm.trade_terms" size="small" /></div>
            <div class="decl-field"><span class="decl-label">境内货源地</span><el-input v-model="declForm.origin_source" size="small" placeholder="如：金华、浙江" /></div>
            <div class="decl-field"><span class="decl-label">征免</span><el-input v-model="declForm.levy" size="small" placeholder="如：照章征税" /></div>
          </div>
        </div>

        <!-- Section 5: 数量 / 重量 / 费用 -->
        <div class="decl-section decl-section--beige">
          <div class="decl-sec-title">数量 / 重量 / 费用</div>
          <div class="decl-fields">
            <div class="decl-field"><span class="decl-label">包装种类</span><el-input v-model="declForm.pack_type" size="small" placeholder="纸箱" /></div>
            <div class="decl-field"><span class="decl-label">件数</span><el-input-number v-model="declForm.total_packages" :min="0" :controls="false" size="small" style="width:100%" /></div>
            <div class="decl-field"><span class="decl-label">毛重(千克)</span><el-input-number v-model="declForm.gross_weight" :min="0" :precision="2" :controls="false" size="small" style="width:100%" /></div>
            <div class="decl-field"><span class="decl-label">净重(千克)</span><el-input-number v-model="declForm.net_weight" :min="0" :precision="2" :controls="false" size="small" style="width:100%" /></div>
            <div class="decl-field"><span class="decl-label">运费</span><el-input v-model="declForm.freight" size="small" /></div>
            <div class="decl-field"><span class="decl-label">保费</span><el-input v-model="declForm.insurance" size="small" /></div>
            <div class="decl-field"><span class="decl-label">杂费</span><el-input v-model="declForm.misc_fees" size="small" /></div>
          </div>
        </div>

        <!-- Section 6: 大字段区 -->
        <div class="decl-section">
          <div class="decl-sec-title">随附单证 / 标记唛码 / 备注</div>
          <div class="decl-fields decl-fields--wide">
            <div class="decl-field"><span class="decl-label">随附单证 1</span><el-input v-model="declForm.attached_docs_1" size="small" /></div>
            <div class="decl-field"><span class="decl-label">随附单证 2</span><el-input v-model="declForm.attached_docs_2" size="small" /></div>
          </div>
          <div class="decl-big-fields">
            <div class="decl-big-field">
              <span class="decl-label">标记唛码及备注</span>
              <el-input v-model="declForm.shipping_marks_notes" type="textarea" :rows="2" placeholder="支持多行换行" />
            </div>
          </div>
        </div>

        <!-- Section 8: 报关商品要素清单（保持表格） -->
        <div class="decl-section">
          <div class="items-section-head">
            <strong>报关商品要素清单（每条订单产品单独一行）</strong>
            <el-button type="primary" size="small" :icon="Plus" @click="addDeclRow">添加申报行</el-button>
          </div>
          <el-table :data="declForm.items" border size="small">
            <el-table-column type="index" label="项号" width="50" align="center" />
            <el-table-column label="HS 编码" width="130">
              <template #default="{ row }"><el-input v-model="row.hs_code" size="small" /></template>
            </el-table-column>
            <el-table-column label="商品品名 & 申报要素" min-width="260">
              <template #default="{ row }">
                <el-input v-model="row.name" size="small" placeholder="商品品名（可编辑）" />
                <el-input v-model="row.elements" size="small" type="textarea" :autosize="{ minRows: 1, maxRows: 4 }" placeholder="申报要素（对应 PDF 模板商品名称下方的子行）" style="margin-top:4px" />
              </template>
            </el-table-column>
            <el-table-column label="数量及单位" width="150">
              <template #default="{ row }">
                <div class="qty-unit-cell">
                  <el-input-number v-model="row.qty" :min="0" :controls="false" size="small" style="width:70%" @change="calcDeclRow(row)" />
                  <el-input v-model="row.unit" size="small" style="width:55px;margin-left:4px" />
                </div>
                <div class="nw-line">净重：{{ Number(row.nw || 0).toFixed(2) }} kg</div>
              </template>
            </el-table-column>
            <el-table-column :label="`单价 (${custForm.currency === 'RMB' ? '¥' : '$'})`" width="120">
              <template #default="{ row }"><el-input-number v-model="row.price" :min="0" :precision="2" :controls="false" size="small" style="width:100%" @change="calcDeclRow(row)" /></template>
            </el-table-column>
            <el-table-column :label="`总价 (${custForm.currency === 'RMB' ? '¥' : '$'})`" width="130">
              <template #default="{ row }"><span class="row-total">{{ custForm.currency === 'RMB' ? '¥' : '$' }}{{ formatMoney(row.total) }}</span></template>
            </el-table-column>
            <el-table-column label="原产国" width="90">
              <template #default="{ row }"><el-input v-model="row.origin_country" size="small" placeholder="中国" /></template>
            </el-table-column>
            <el-table-column label="最终目的国" width="110">
              <template #default="{ row }"><el-input v-model="row.dest_country" size="small" placeholder="如 Philippines" /></template>
            </el-table-column>
            <el-table-column label="境内货源地" width="100">
              <template #default="{ row }"><el-input v-model="row.origin_source" size="small" placeholder="如 金华" /></template>
            </el-table-column>
            <el-table-column label="操作" width="60" align="center">
              <template #default="{ $index }"><el-button link type="danger" size="small" @click="declForm.items.splice($index, 1)">删</el-button></template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <template #footer>
        <el-button @click="declEditVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveDecl">保存报关单信息</el-button>
      </template>
    </el-dialog>

    <!-- ========== 编辑：清关外销三单共享 (Invoice / Contract / Packing List) ========== -->
    <el-dialog
      v-model="custEditVisible" :close-on-click-modal="false"
      title="编辑外销与清关单据 (Sales Contract / Invoice / Packing List)"
      width="1500px"
      destroy-on-close
      top="3vh"
    >
      <el-form :model="custForm" label-position="top">
        <el-row :gutter="12">
          <el-col :span="6"><el-form-item label="客户 (Customer)"><el-select v-model="custForm.client_id" filterable style="width:100%"><el-option v-for="c in clientOptions" :key="c.id" :label="c.name_en || c.name" :value="c.id" /></el-select></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="销售合同号 (S/C No.)"><el-input v-model="custForm.sc_no" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="发票号码 (Invoice No.)"><el-input v-model="custForm.inv_no" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="币种 (Currency)"><el-select v-model="custForm.currency" style="width:100%"><el-option label="USD 美元" value="USD" /><el-option label="RMB 人民币" value="RMB" /></el-select></el-form-item></el-col>

          <el-col :span="6"><el-form-item label="单据时间 (Date)"><el-date-picker v-model="custForm.date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>

          <el-col :span="6"><el-form-item label="付款方式 (Payment Terms)"><el-input v-model="custForm.payment_terms" placeholder="如：T/T" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="价格条款 (Price Terms)"><el-input v-model="custForm.price_terms" placeholder="如：FOB Shanghai" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="装运方式 (Shipping Method)"><el-input v-model="custForm.shipping_method" placeholder="如：By sea" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="装货时间 (Lead Time)"><el-input v-model="custForm.loading_time" placeholder="如：30-45days after confirmation" /></el-form-item></el-col>

          <el-col :span="6"><el-form-item label="出运港 (Loading Port)"><el-input v-model="custForm.loading_port" placeholder="如：SHANGHAI" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="目的港 (Discharge Port)"><el-input v-model="custForm.dest_port" placeholder="如：Manila" /></el-form-item></el-col>

          <el-col :span="6"><el-form-item label="预计离港时间 (ETD)"><el-date-picker v-model="custForm.etd" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="预计到港时间 (ETA)"><el-date-picker v-model="custForm.eta" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
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
            <el-table-column label="数量 (pcs)" width="90">
              <template #default="{ row }"><el-input-number v-model="row.qty" :min="0" :controls="false" size="small" style="width:100%" :disabled="true" /></template>
            </el-table-column>
            <el-table-column label="箱数 CTN" width="80">
              <template #default="{ row }"><el-input-number v-model="row.ctn" :min="0" :controls="false" size="small" style="width:100%" @change="calcCustRow(row)" /></template>
            </el-table-column>
            <el-table-column label="件数/箱" width="80">
              <template #default="{ row }"><el-input-number v-model="row._pcs" :min="0" :controls="false" size="small" style="width:100%" @change="calcCustRow(row)" /></template>
            </el-table-column>
            <el-table-column label="纸箱尺寸 (cm)" align="center">
              <el-table-column label="L" width="70">
                <template #default="{ row }"><el-input-number v-model="row._l" :min="0" :precision="1" :controls="false" size="small" style="width:100%" @change="recalcCustMetrics(row)" /></template>
              </el-table-column>
              <el-table-column label="W" width="70">
                <template #default="{ row }"><el-input-number v-model="row._w" :min="0" :precision="1" :controls="false" size="small" style="width:100%" @change="recalcCustMetrics(row)" /></template>
              </el-table-column>
              <el-table-column label="H" width="70">
                <template #default="{ row }"><el-input-number v-model="row._h" :min="0" :precision="1" :controls="false" size="small" style="width:100%" @change="recalcCustMetrics(row)" /></template>
              </el-table-column>
            </el-table-column>
            <el-table-column label="单箱重量 (KG)" align="center">
              <el-table-column label="N.W." width="80">
                <template #default="{ row }"><el-input-number v-model="row._nw" :min="0" :precision="2" :controls="false" size="small" style="width:100%" @change="recalcCustMetrics(row)" /></template>
              </el-table-column>
              <el-table-column label="G.W." width="80">
                <template #default="{ row }"><el-input-number v-model="row._gw" :min="0" :precision="2" :controls="false" size="small" style="width:100%" @change="recalcCustMetrics(row)" /></template>
              </el-table-column>
            </el-table-column>
            <el-table-column label="总N.W. (KG)" width="95">
              <template #default="{ row }"><el-input-number v-model="row.nw" :min="0" :precision="2" :controls="false" size="small" style="width:100%" /></template>
            </el-table-column>
            <el-table-column label="总G.W. (KG)" width="95">
              <template #default="{ row }"><el-input-number v-model="row.gw" :min="0" :precision="2" :controls="false" size="small" style="width:100%" /></template>
            </el-table-column>
            <el-table-column label="CBM" width="90">
              <template #default="{ row }"><el-input-number v-model="row.cbm" :min="0" :precision="3" :step="0.001" :controls="false" size="small" style="width:100%" /></template>
            </el-table-column>
            <el-table-column :label="`单价 (${custForm.currency === 'RMB' ? '¥' : '$'})`" width="110">
              <template #default="{ row }"><el-input-number v-model="row.price" :min="0" :precision="2" :controls="false" size="small" style="width:100%" @change="calcCustRow(row)" /></template>
            </el-table-column>
            <el-table-column :label="`总价 (${custForm.currency === 'RMB' ? '¥' : '$'})`" width="120">
              <template #default="{ row }"><span class="row-total">{{ custForm.currency === 'RMB' ? '¥' : '$' }}{{ formatMoney(row.total) }}</span></template>
            </el-table-column>
            <el-table-column label="删" width="50" align="center">
              <template #default="{ $index }"><el-button link type="danger" size="small" @click="custForm.items.splice($index, 1)">✕</el-button></template>
            </el-table-column>
          </el-table>

          <!-- 订单实时汇总 -->
          <div class="order-summary-bar">
            <span>总数量 <b>{{ totals.qty || 0 }} pcs</b></span>
            <span>总箱数 <b>{{ totals.ctn || 0 }} CTN</b></span>
            <span>总CBM <b>{{ (totals.cbm || 0).toFixed(3) }}</b></span>
            <span>总毛重 <b>{{ (totals.gw || 0).toFixed(1) }} kg</b></span>
            <span>总净重 <b>{{ (totals.nw || 0).toFixed(1) }} kg</b></span>
            <span>总金额 <b>{{ custForm.currency === 'RMB' ? '¥' : '$' }}{{ formatMoney(totals.amount || 0) }}</b></span>
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
import { computed, onMounted, ref, watch } from 'vue'
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
const lastBaseCurrency = ref('USD')  // 记录订单原始币种，供转换锚定

// 监听 custForm.currency 变化 → 实时重算 custForm.items + declForm.items 的 price/total
watch(
  () => custForm.value.currency,
  (newCur, oldCur) => {
    if (!newCur || !oldCur || newCur === oldCur) return
    const fromCur = lastBaseCurrency.value || 'USD'
    const rate = Number((companySettings.value || {}).default_usd_rate) || 7.2
    const applyConvert = (items) => {
      for (const it of items) {
        const p = convertPrice(it.price, oldCur, newCur, rate)
        const t = convertPrice(it.total, oldCur, newCur, rate)
        it.price = Number(p.toFixed(2))
        it.total = Number(t.toFixed(2))
        it.currency = newCur
      }
    }
    applyConvert(custForm.value.items || [])
    applyConvert(declForm.value.items || [])
  }
)

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

/* 展平：每条订单 item 单独一行，不按 HS 编码归并
   fromCurrency: 订单原始币种
   toCurrency:   目标显示币种（custForm.currency）
   rate:         RMB per 1 USD（default_usd_rate，默认 7.2）
*/
function convertPrice(price, fromCurrency, toCurrency, rate) {
  if (!price) return 0
  if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) return Number(price) || 0
  const r = Number(rate) || 7.2
  if (fromCurrency === 'RMB' && toCurrency === 'USD') return Number((Number(price) / r).toFixed(2))
  if (fromCurrency === 'USD' && toCurrency === 'RMB') return Number((Number(price) * r).toFixed(2))
  return Number(price) || 0
}

function flatItemsFromOrder(items, kind, currency, fromCurrency, rate, destCountry) {
  return (items || []).map((it) => {
    const qty = Number(it.qty || 0)
    const pcsPerCtn = Number(it.pcs_per_ctn) || 0
    const nwPerCtn = Number(it.nw_per_ctn || 0)
    const gwPerCtn = Number(it.gw_per_ctn || 0)
    // 单箱体积缺失但纸箱尺寸齐全时，由尺寸推算（cm³ → m³）
    let cbmPerCtn = Number(it.cbm_per_ctn || 0)
    const dimL = Number(it.ctn_length || 0), dimW = Number(it.ctn_width || 0), dimH = Number(it.ctn_height || 0)
    if (!cbmPerCtn && dimL > 0 && dimW > 0 && dimH > 0) {
      cbmPerCtn = Number((dimL * dimW * dimH / 1000000).toFixed(4))
    }
    const ctns = pcsPerCtn > 0 ? qty / pcsPerCtn : 0
    const hsCode = it.hs_code || it.product_hs_code || ''
    const model = it.model || it.supplier_model || it.product_our_model || ''
    const name = it.name_en || it.name_cn || ''
    const spec = it.spec || ''
    const unit = it.unit || '台'
    const nw = ctns * nwPerCtn
    const gw = ctns * gwPerCtn
    const cbm = ctns * cbmPerCtn
    const priceRaw = Number(it.price || 0) || Number(it.cost_cny || 0)
    // 价格/总额按 custForm.currency 转换
    const price = convertPrice(priceRaw, fromCurrency, currency, rate)
    const total = convertPrice(qty * priceRaw, fromCurrency, currency, rate)

    // 每箱快照（下划线前缀，calcCustRow/calcDeclRow 里用来按 qty 重算）
    // _l/_w/_h：单个纸箱尺寸 cm；齐全时单箱体积由尺寸推算
    const perCtn = {
      _pcs: pcsPerCtn, _nw: nwPerCtn, _gw: gwPerCtn, _cbm: cbmPerCtn,
      _l: Number(it.ctn_length || 0), _w: Number(it.ctn_width || 0), _h: Number(it.ctn_height || 0)
    }

    if (kind === 'decl') {
      // 报关单商品品名 = HS编码库的申报品名（product_name），这是海关认定的标准品名
      const name = it.hs_product_name || it.name_en || it.name_cn || ''
      // 单位优先 HS 编码库，其次产品库，最后默认台（trim 去尾空格）
      const hsUnit = (it.hs_unit || it.unit || '台').trim()
      return {
        hs_code: hsCode,
        name,
        qty, unit: hsUnit,
        ctn: Number(ctns.toFixed(2)),
        nw: Number(nw.toFixed(2)), gw: Number(gw.toFixed(2)), cbm: Number(cbm.toFixed(3)),
        price, total,
        currency: currency || 'USD', origin_country: '中国',
        dest_country: destCountry || '', origin_source: '', levy: '照章征税',
        elements: it.hs_elements || '',
        ...perCtn
      }
    }
    return {
      // 产品名称：仅英文品名（trim 去首尾空格），不拼接型号（对外单据不显示中文内部型号）
      product: String(it.name_en || '').trim(),
      qty, ctn: Number(ctns.toFixed(2)),
      nw: Number(nw.toFixed(2)), gw: Number(gw.toFixed(2)), cbm: Number(cbm.toFixed(3)),
      price, total,
      unit,
      ...perCtn
    }
  })
}

/* ========== 列表 ========== */
function exitPortText(row) {
  const dd = parseDoc(row.decl_data)
  const port = (dd && dd.exit_customs) || (row.loading_port ? row.loading_port + ' 海关' : '—')
  return `${port} | ${row.trade_terms || '—'}`
}

// 清关外销单据里保存的附加字段（ETD/ETA 等）
function customsMeta(row, key) {
  const d = parseDoc(row.customs_data)
  return (d && d[key]) || '—'
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
  const baseCurrency = detail.currency || 'USD'
  lastBaseCurrency.value = baseCurrency
  const usdRate = Number(company.default_usd_rate) || 7.2
  // 目标币种：已保存 custForm 的优先（用户可能改过），否则订单原始币种
  const savedCustoms = parseDoc(detail.customs_data)
  const targetCurrency = (savedCustoms && savedCustoms.currency) || baseCurrency
  // 每条订单 item 单独一行，不按 HS 编码归并（价格按 targetCurrency 转换）
  const destCountry = client.country || detail.destination_port || ''
  const flatDecl = flatItemsFromOrder(detail.items, 'decl', targetCurrency, baseCurrency, usdRate, destCountry)
  const flatCust = flatItemsFromOrder(detail.items, 'cust', targetCurrency, baseCurrency, usdRate)

  // ===== 商业发票/装箱单 =====
  const customs = savedCustoms ? {
    ...savedCustoms,
    currency: savedCustoms.currency || baseCurrency,
    etd: savedCustoms.etd || '',
    eta: savedCustoms.eta || '',
    items: mergeItems(savedCustoms.items, flatCust, 'customs', targetCurrency, usdRate, baseCurrency)
  } : {
    client_id: detail.client_id,
    sc_no: detail.pi_number + 'SC',
    inv_no: detail.pi_number + 'INV',
    date: detail.signing_date || '',
    currency: baseCurrency,
    payment_terms: detail.payment_terms || 'T/T',
    price_terms: (detail.trade_terms || 'FOB') + (detail.loading_port ? ' ' + detail.loading_port : ''),
    loading_time: detail.delivery_date || '',
    loading_port: (detail.loading_port || '').toUpperCase(),
    dest_port: detail.destination_port || '',
    etd: '',
    eta: '',
    shipping_method: 'By sea',
    shipping_mark: detail.shipping_mark && String(detail.shipping_mark).trim() ? String(detail.shipping_mark).trim() : 'N/M',
    total_amount_en: '',
    items: flatCust
  }

  // ===== 出口报关草单 =====
  const savedDecl = parseDoc(detail.decl_data)
  // 总毛/净/件数也从清关外销已保存值来，和 custForm 保持一致
  const sum = (arr, k) => Number(arr.reduce((s, g) => s + (Number(g[k]) || 0), 0).toFixed(2))
  const totalCtns = sum(customs.items, 'ctn')
  const totalNw = sum(customs.items, 'nw')
  const totalGw = sum(customs.items, 'gw')

  // 关联订单/公司的实时字段（每次打开编辑都自动同步，用户清空也会回退）
  const linkedDefaults = {
    shipper: '麦顿商贸（永康）有限公司',
    consignee: client.name_en || client.name || '',
    manufacturer: detail.supplier_name || '',
    contract_no: detail.pi_number || '',
    trade_mode: detail.trade_terms || 'FOB',
    exit_customs: (detail.loading_port || '').toUpperCase().includes('SHANGHAI') ? '上海海关' : (detail.loading_port || '').toUpperCase().includes('NINGBO') ? '宁波海关' : '',
    exit_port: (detail.loading_port || '').toUpperCase(),
    exit_port_lower: (detail.loading_port || '').toUpperCase(),
    country: client.country || '',
    trade_country: client.country || '',
    dest_country: client.country || '',
    dest_country_name: client.country || '',
    dest_port: detail.destination_port || '',
    packing_qty: totalCtns,
    total_packages: totalCtns,
    gross_weight: totalGw,
    net_weight: totalNw,
    shipping_method: '海运',
    supervision_mode: '一般贸易',
    levy_nature: '一般征税',
    pack_type: '纸箱',
    origin_country: '中国',
    declarer_tel: company.tel || '',
    declare_unit: company.name_cn || ''
  }

  const decl = savedDecl ? {
    ...savedDecl,
    currency: savedDecl.currency || customs.currency,
    items: mergeItems(savedDecl.items, flatDecl, 'decl', targetCurrency, usdRate, baseCurrency),
    // 关联字段：用户没填或填空 → 自动用订单/公司实时值
    shipper: savedDecl.shipper?.trim() ? savedDecl.shipper : linkedDefaults.shipper,
    consignee: savedDecl.consignee?.trim() ? savedDecl.consignee : linkedDefaults.consignee,
    manufacturer: savedDecl.manufacturer?.trim() ? savedDecl.manufacturer : linkedDefaults.manufacturer,
    contract_no: savedDecl.contract_no?.trim() ? savedDecl.contract_no : linkedDefaults.contract_no,
    trade_mode: savedDecl.trade_mode?.trim() ? savedDecl.trade_mode : linkedDefaults.trade_mode,
    exit_customs: savedDecl.exit_customs?.trim() ? savedDecl.exit_customs : linkedDefaults.exit_customs,
    exit_port: savedDecl.exit_port?.trim() ? savedDecl.exit_port : linkedDefaults.exit_port,
    country: savedDecl.country?.trim() ? savedDecl.country : linkedDefaults.country,
    trade_country: savedDecl.trade_country?.trim() ? savedDecl.trade_country : linkedDefaults.trade_country,
    dest_country: savedDecl.dest_country?.trim() ? savedDecl.dest_country : linkedDefaults.dest_country,
    dest_country_name: savedDecl.dest_country_name?.trim() ? savedDecl.dest_country_name : linkedDefaults.dest_country_name,
    dest_port: savedDecl.dest_port?.trim() ? savedDecl.dest_port : linkedDefaults.dest_port,
    supervision_mode: savedDecl.supervision_mode?.trim() ? savedDecl.supervision_mode : linkedDefaults.supervision_mode,
    levy_nature: savedDecl.levy_nature?.trim() ? savedDecl.levy_nature : linkedDefaults.levy_nature,
    pack_type: savedDecl.pack_type?.trim() ? savedDecl.pack_type : linkedDefaults.pack_type,
    origin_country: savedDecl.origin_country?.trim() ? savedDecl.origin_country : linkedDefaults.origin_country,
    declarer_tel: savedDecl.declarer_tel?.trim() ? savedDecl.declarer_tel : linkedDefaults.declarer_tel,
    declare_unit: savedDecl.declare_unit?.trim() ? savedDecl.declare_unit : linkedDefaults.declare_unit,
    // 计算字段：总毛净重/件数永远用实时数据（用户无法覆盖）
    total_packages: totalCtns,
    gross_weight: totalGw,
    net_weight: totalNw
  } : {
    broker: '', pre_entry_no: '', customs_no: '',
    shipper: linkedDefaults.shipper,
    exit_customs: linkedDefaults.exit_customs,
    export_date: '', declare_date: detail.signing_date || '', record_no: '',
    consignee: linkedDefaults.consignee,
    country: linkedDefaults.country,
    transport_mode: '海运', vessel_voyage: '', bill_no: '',
    manufacturer: linkedDefaults.manufacturer,
    supervision_mode: linkedDefaults.supervision_mode,
    levy_nature: linkedDefaults.levy_nature,
    license_no: '',
    contract_no: linkedDefaults.contract_no,
    trade_country: linkedDefaults.trade_country,
    dest_country: linkedDefaults.dest_country,
    dest_country_name: linkedDefaults.dest_country_name,
    dest_port: linkedDefaults.dest_port,
    exit_port: linkedDefaults.exit_port,
    pack_type: linkedDefaults.pack_type,
    total_packages: totalCtns, gross_weight: totalGw, net_weight: totalNw,
    trade_mode: linkedDefaults.trade_mode,
    freight: '', insurance: '', misc_fees: '',
    attached_docs_1: '', attached_docs_2: '',
    shipping_marks_notes: 'N/M',
    origin_source: '', levy: '照章征税',
    special_relation: '否', price_affect: '否', royalty: '否', self_declare: '是',
    declarer: '', declarer_no: '', declarer_tel: linkedDefaults.declarer_tel, declare_unit: linkedDefaults.declare_unit,
    currency: customs.currency, origin_country: linkedDefaults.origin_country,
    items: mergeItems([], flatDecl, 'decl', targetCurrency, usdRate, baseCurrency)
  }

  return { detail, company, client, totals, customs, decl }
}

/**
 * 合并 items：以实时 flat 为基准（永远以外销订单为准），
 * qty/price/total 永远用 flat 值（后端 normalizeItems 已回填产品库快照）。
 * customs 分支例外：每箱装箱参数（_pcs/_nw/_gw/_cbm/_l/_w/_h）优先用 saved 值
 * （用户可能在清关编辑弹窗里按实际装箱调整过），ctn/nw/gw/cbm 由 qty+快照重算。
 */
/* 按每箱快照重算一行的 数量/总净重/总毛重/总体积
   规则：箱数 (ctn) 是主输入（用户填"我订了多少箱"），
   数量 = 箱数 × 件数/箱；总量 = 箱数 × 单箱值；
   纸箱 L/W/H 齐全时，单箱体积由尺寸推算（cm³ → m³） */
function recalcCustMetrics(row) {
  const ctns = Number(row.ctn) || 0
  const pcs = Number(row._pcs) || 0
  const qty = ctns * pcs
  const l = Number(row._l) || 0, w = Number(row._w) || 0, h = Number(row._h) || 0
  if (l > 0 && w > 0 && h > 0) row._cbm = Number((l * w * h / 1000000).toFixed(3))
  row.qty = Number(qty.toFixed(0))
  row.nw  = Number((ctns * (Number(row._nw) || 0)).toFixed(2))
  row.gw  = Number((ctns * (Number(row._gw) || 0)).toFixed(2))
  row.cbm = Number((ctns * (Number(row._cbm) || 0)).toFixed(3))
}

function mergeItems(savedItems, flat, kind, currency, rate, baseCurrency) {
  const saved = Array.isArray(savedItems) ? savedItems : []

  return flat.map((g, i) => {
    const savedMatch = saved[i]
    // 每箱快照（从 flat 带过来，让 calc 函数能按 qty 重算）
    const perCtn = { _pcs: g._pcs || 0, _nw: g._nw || 0, _gw: g._gw || 0, _cbm: g._cbm || 0 }

    if (kind === 'decl') {
      if (!savedMatch) {
        // 新建：全部用订单实时值
        return {
          hs_code: g.hs_code,
          name: g.name,
          unit: g.unit,
          currency: currency || g.currency,
          qty: g.qty, ctn: g.ctn, nw: g.nw, gw: g.gw, cbm: g.cbm,
          price: g.price, total: g.total,
          origin_country: g.origin_country || '中国',
          dest_country: g.dest_country || '',
          origin_source: '',
          levy: '照章征税',
          elements: g.elements || '',
          ...perCtn
        }
      }
      // 有 savedMatch：hs_code/unit/name 全部实时（订单权威数据），saved 只保留用户手动编辑的字段
      return {
        // 订单权威数据，永远实时
        hs_code: g.hs_code,
        currency: currency || savedMatch.currency || g.currency,
        unit: g.unit,
        // name 也是订单推导值（name_en + model），用户不应该在报关单里改
        name: g.name,
        qty: g.qty, ctn: g.ctn, nw: g.nw, gw: g.gw, cbm: g.cbm,
        price: g.price, total: g.total,
        // 用户编辑过申报要素就保留，为空就回退 HS 库实时值
        elements: (savedMatch.elements && savedMatch.elements.trim()) ? savedMatch.elements : (g.elements || ''),
        // 用户编辑过原产国/目的国/境内货源地/征免就保留，否则默认值
        origin_country: savedMatch.origin_country || g.origin_country || '中国',
        dest_country: savedMatch.dest_country || g.dest_country || '',
        origin_source: savedMatch.origin_source || '',
        levy: savedMatch.levy || '照章征税',
        ...perCtn
      }
    }

    // customs 分支（清关外销自己的 merge）：
    // ctn 是主输入字段——saved 优先（用户可能在编辑弹窗调过实际装箱箱数），没有就用订单实时值；
    // 每箱装箱参数（_pcs/_nw/_gw/_l/_w/_h）也优先用 saved 值；
    // qty/nw/gw/cbm 是派生值，由 recalcCustMetrics 用 ctn × 快照算出来。
    const pickSnap = (k) => {
      const sv = savedMatch ? Number(savedMatch[k]) : 0
      return sv > 0 ? sv : (Number(g[k]) || 0)
    }
    // ctn：saved 优先，否则用订单实时值（= qty / pcs_per_ctn）
    const savedCtn = savedMatch ? Number(savedMatch.ctn) : 0
    const initCtn = savedCtn > 0 ? savedCtn : (Number(g.ctn) || 0)
    // 单价/总重/总体积：saved 优先（用户在编辑弹窗里改过），否则用订单实时值
    const savedPrice = savedMatch ? Number(savedMatch.price) : 0
    const savedNw = savedMatch ? Number(savedMatch.nw) : 0
    const savedGw = savedMatch ? Number(savedMatch.gw) : 0
    const savedCbm = savedMatch ? Number(savedMatch.cbm) : 0
    const row = {
      // 产品名称：saved 有值用 saved（用户在编辑弹窗里改过名），否则用订单实时值
      product: (savedMatch && savedMatch.product) ? savedMatch.product : g.product,
      unit: g.unit,
      price: savedPrice > 0 ? savedPrice : (Number(g.price) || 0),
      ctn: initCtn,
      _pcs: pickSnap('_pcs'), _nw: pickSnap('_nw'), _gw: pickSnap('_gw'),
      _l: pickSnap('_l'), _w: pickSnap('_w'), _h: pickSnap('_h'),
      // 总净重/总毛重/总体积：saved 有值用 saved（用户在编辑弹窗里改过），否则用订单实时值
      nw: savedNw > 0 ? savedNw : (Number(g.nw) || 0),
      gw: savedGw > 0 ? savedGw : (Number(g.gw) || 0),
      cbm: savedCbm > 0 ? savedCbm : (Number(g.cbm) || 0)
    }
    // _cbm 单独处理：saved 有值用 saved，否则用订单值；尺寸齐全时 recalc 会覆盖
    const savedCbmPerCtn = savedMatch ? Number(savedMatch._cbm) : 0
    row._cbm = savedCbmPerCtn > 0 ? savedCbmPerCtn : (Number(g._cbm) || 0)
    // 总价 = 数量 × 单价（数量由 recalc 算出，单价上面已取 saved）
    const qty = (Number(row.ctn) || 0) * (Number(row._pcs) || 0)
    row.qty = qty
    row.total = Number((qty * row.price).toFixed(2))
    return row
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
  declForm.value.items.push({
    hs_code: '', name: '', qty: 0, unit: '台', price: 0, total: 0,
    ctn: 0, nw: 0, gw: 0, cbm: 0,
    origin_country: '中国', dest_country: '', origin_source: '', levy: '照章征税',
    elements: '', currency: custForm.value.currency || 'USD',
    _pcs: 0, _nw: 0, _gw: 0, _cbm: 0
  })
}
function calcDeclRow(row) {
  const qty = Number(row.qty) || 0
  row.total = Number((qty * (Number(row.price) || 0)).toFixed(2))
  // 按每箱快照重算 ctn / nw / gw / cbm
  const pcs = Number(row._pcs) || 0
  const ctns = pcs > 0 ? qty / pcs : 0
  row.ctn = Number(ctns.toFixed(2))
  row.nw = Number((ctns * (Number(row._nw) || 0)).toFixed(2))
  row.gw = Number((ctns * (Number(row._gw) || 0)).toFixed(2))
  row.cbm = Number((ctns * (Number(row._cbm) || 0)).toFixed(3))
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
  custForm.value.items.push({ product: '', qty: 0, ctn: 0, nw: 0, gw: 0, cbm: 0, shipping_mark: 'N/M', price: 0, total: 0, _pcs: 0, _nw: 0, _gw: 0, _cbm: 0, _l: 0, _w: 0, _h: 0 })
}
function calcCustRow(row) {
  // 先按箱数重算数量/总重/体积（qty 是派生值），再算总金额
  recalcCustMetrics(row)
  row.total = Number((row.qty * (Number(row.price) || 0)).toFixed(2))
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
  const buyerAddr = client.address_en || client.address || ''
  // S/C NO. = 外销订单编码（与 Sales Contract 一致）；INVOICE No. = S/C NO. + "IN"
  const scNo = detail.pi_number || ''
  const invNo = scNo ? `${scNo}IN` : ''
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
          <td style="width:60%;" rowspan="2"><strong>BUYER:</strong><br><strong>${client.name_en || client.name || ''}</strong>${buyerAddr ? `<br>${buyerAddr}` : ''}</td>
          <td><strong>S/C NO.:</strong> ${scNo}<br><strong>INVOICE No.:</strong> ${invNo}<br><strong>Date:</strong> ${customs.date || ''}<br><strong>Payment term:</strong> ${customs.payment_terms || 'T/T'}</td>
        </tr>
        <tr>
          <td><strong>Shipment:</strong> ${customs.shipping_method || 'By sea'}<br><strong>Shipping port:</strong> ${customs.loading_port || ''}<br><strong>Discharging port:</strong> ${customs.dest_port || ''}</td>
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
      <div class="say-total">${sayTotalText(customs, t, customs.currency)}</div>
      ${sealBlock(company)}
    </div>`
}

/* ---------- Sales Contract ---------- */
function buildScHtml(docs) {
  const { company, client, customs, detail } = docs
  const t = custTotals(customs)
  const buyerAddr = client.address_en || client.address || ''
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
          <td style="width:60%;" rowspan="2"><strong>Buyer:</strong><br><strong>${client.name_en || client.name || ''}</strong>${buyerAddr ? `<br>${buyerAddr}` : ''}</td>
          <td><strong>S/C NO.:</strong> ${detail.pi_number || ''}<br><strong>Date:</strong> ${customs.date || ''}<br><strong>Payment Term:</strong> ${customs.payment_terms || 'T/T'}</td>
        </tr>
        <tr>
          <td><strong>Price Term:</strong> ${customs.price_terms || ''}<br><strong>Lead Time:</strong> ${customs.loading_time || ''}<br><strong>Shipping port:</strong> ${customs.loading_port || ''}<br><strong>Discharging Port:</strong> ${customs.dest_port || ''}<br><strong>Shipping Method:</strong> ${customs.shipping_method || 'By sea'}</td>
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
      <div class="say-total">${sayTotalText(customs, t, customs.currency)}</div>
      ${sealBlock(company)}
    </div>`
}

/* ---------- Packing List ---------- */
function buildPlHtml(docs) {
  const { company, client, customs, detail } = docs
  const t = custTotals(customs)
  const buyerAddr = client.address_en || client.address || ''
  // INVOICE No. 关联 Commercial Invoice（S/C NO. + "IN"）
  const scNo = detail.pi_number || ''
  const invNo = scNo ? `${scNo}IN` : ''
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
          <td style="width:60%;" rowspan="2"><strong>Buyer:</strong><br><strong>${client.name_en || client.name || ''}</strong>${buyerAddr ? `<br>${buyerAddr}` : ''}</td>
          <td><strong>INVOICE NO.:</strong> ${invNo}<br><strong>DATE:</strong> ${customs.date || ''}</td>
        </tr>
        <tr>
          <td><strong>Shipping port:</strong> ${customs.loading_port || ''}<br><strong>Discharging Port:</strong> ${customs.dest_port || ''}</td>
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
  const { decl, customs, company } = docs

  // 装箱参数以 custForm（customs.items）为准；申报专用字段（hs_code / elements /
  // origin_country 等）保留 decl.items 的值。以 custItems 为基准循环（行数变化也能跟上）。
  const custItems = customs?.items || []
  let items = custItems.length ? custItems : (decl.items || [])
  if (custItems.length && decl.items?.length) {
    const declItems = decl.items
    items = custItems.map((c, i) => {
      const d = declItems[i] || {}
      return {
        ...c,
        // 申报专用字段优先保留 decl 里的值（custForm 里没有）
        hs_code:       d.hs_code       || c.hs_code,
        elements:      d.elements      || c.elements,
        origin_country:d.origin_country|| c.origin_country,
        dest_country:  d.dest_country  || c.dest_country,
        dest_country_name: d.dest_country_name || c.dest_country_name,
        origin_source: d.origin_source || c.origin_source,
        levy:          d.levy          || c.levy,
        name:          d.name          || c.product,
        currency:      d.currency      || c.currency
      }
    })
  }

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
    const dc = it.dest_country || decl.dest_country || decl.dest_country_name || decl.country || ''
    const os = it.origin_source || decl.origin_source || ''
    const rawLv = it.levy || decl.levy || ''
    const lv = (!rawLv || rawLv === '征税') ? '照章征税' : rawLv
    const hasElements = it.elements && it.elements.trim()
    const itemCell = hasElements
      ? `<td class="ctr" rowspan="2">${i + 1}</td>`
      : `<td class="ctr">${i + 1}</td>`
    return `<tr>
      ${itemCell}
      <td>${it.hs_code || ''}</td>
      <td colspan="2">${it.name || ''}</td>
      <td class="num v-middle" colspan="2">
        <div>${it.qty || 0} ${it.unit || ''}</div>
        <div class="nw-sub">${Number(it.nw || 0).toFixed(2)} kg</div>
      </td>
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
        html += `<tr><td class="ctr">${i + 1}</td><td></td><td colspan="2"></td><td colspan="2"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`
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
      .decl-doc .v-middle { vertical-align:middle; }
      .decl-doc .nw-sub { font-size:7.5pt; color:#555; margin-top:2px; white-space:nowrap; }
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
          ${labeledCell('运抵国（地区）', decl.dest_country || decl.dest_country_name, 2)}
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

.decl-edit { display: flex; flex-direction: column; gap: 8px; }
.decl-section { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; background: #fff; }
.decl-section--yellow { background: #fffde7; border-color: #fcd34d; }
.decl-section--beige { background: #fef9e7; border-color: #d4a94a; }
.decl-sec-title { font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px dashed #cbd5e1; letter-spacing: 0.5px; }
.decl-section--yellow .decl-sec-title { color: #92400e; border-bottom-color: #fcd34d; }
.decl-section--beige .decl-sec-title { color: #854d0e; border-bottom-color: #d4a94a; }
.decl-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 6px 14px; }
.decl-fields--wide { grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); }
.decl-field { display: flex; align-items: center; gap: 6px; }
.decl-field .decl-label { flex-shrink: 0; width: 82px; font-size: 12px; color: #64748b; text-align: right; }
.decl-field :deep(.el-input),
.decl-field :deep(.el-date-editor),
.decl-field :deep(.el-input-number) { flex: 1; min-width: 0; }
.decl-big-fields { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
.decl-big-field { display: flex; flex-direction: column; gap: 3px; }
.decl-big-field .decl-label { font-size: 12px; color: #475569; font-weight: 600; }
.qty-unit-cell { display: flex; align-items: center; }
.nw-line { font-size: 11px; color: #64748b; margin-top: 2px; }
.item-name-cell { font-size: 12.5px; font-weight: 600; color: #1e293b; line-height: 1.4; margin-bottom: 4px; white-space: pre-wrap; word-break: break-all; }
.decl-checks { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12px; color: #475569; margin-bottom: 6px; }
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
