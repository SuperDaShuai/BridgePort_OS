<template>
  <el-card shadow="never" class="page-card">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-input
        v-model="query.q"
        placeholder="搜索单号 / 客户"
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
        <el-button type="primary" :icon="Plus" @click="openCreate">新增报价单</el-button>
      </div>
    </div>

    <!-- 列表 -->
    <el-table v-loading="loading" :data="list" border stripe>
      <el-table-column prop="quotation_number" label="报价单号" width="160" />
      <el-table-column prop="quotation_date" label="报价日期" width="110" />
      <el-table-column prop="client_name" label="客户" min-width="170" show-overflow-tooltip />
      <el-table-column prop="currency" label="币种" width="90" />
      <el-table-column prop="price_terms" label="价格条款" width="90" />
      <el-table-column prop="item_count" label="产品数" width="80" align="center" />
      <el-table-column prop="total_amount" label="总金额" width="110" align="right" />
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.status" :type="statusTag[row.status] || 'info'" size="small">
            {{ row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="130" align="center" fixed="right">
        <template #default="{ row }">
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

    <!-- 新增/编辑弹窗（主子表） -->
    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? '编辑报价单' : '新增报价单'"
      width="1000px"
      destroy-on-close
      top="6vh"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="报价单号" prop="quotation_number">
              <el-input v-model="form.quotation_number" placeholder="BP-QT-2026-001" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="报价日期" prop="quotation_date">
              <el-date-picker v-model="form.quotation_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="有效期至">
              <el-date-picker v-model="form.valid_until" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="客户" prop="client_id">
              <el-select v-model="form.client_id" filterable style="width: 100%">
                <el-option v-for="c in clientOptions" :key="c.id" :label="c.name_en" :value="c.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="来源询盘">
              <el-select v-model="form.rfq_id" filterable clearable style="width: 100%">
                <el-option v-for="r in rfqOptions" :key="r.id" :label="r.rfq_number" :value="r.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="状态">
              <el-select v-model="form.status" style="width: 100%">
                <el-option v-for="s in STATUSES" :key="s" :label="s" :value="s" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="币种">
              <el-input v-model="form.currency" placeholder="USD ($)" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="价格条款">
              <el-input v-model="form.price_terms" placeholder="FOB / CIF / EXW" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="总金额">
              <el-input-number v-model="form.total_amount" :min="0" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="装运港">
              <el-input v-model="form.loading_port" placeholder="Ningbo / Shanghai" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="目的港">
              <el-input v-model="form.destination_port" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="交货周期">
              <el-input v-model="form.lead_time" placeholder="25-30 days after deposit" />
            </el-form-item>
          </el-col>
          <el-col :span="16">
            <el-form-item label="付款方式">
              <el-input v-model="form.payment_terms" placeholder="30% T/T deposit, 70% against B/L copy" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">产品明细</el-divider>
        <el-table :data="form.items" border size="small">
          <el-table-column label="选择产品" min-width="180">
            <template #default="{ row }">
              <el-select
                :model-value="row.product_id"
                filterable
                clearable
                placeholder="从产品库选择"
                size="small"
                @update:model-value="onProductPick(row, $event)"
              >
                <el-option
                  v-for="p in productOptions"
                  :key="p.id"
                  :label="`${p.model} - ${p.name_cn}`"
                  :value="p.id"
                />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="Art No." min-width="130">
            <template #default="{ row }">
              <el-input v-model="row.model" size="small" placeholder="型号" />
            </template>
          </el-table-column>
          <el-table-column label="单价" width="110">
            <template #default="{ row }">
              <el-input-number v-model="row.price" :min="0" :controls="false" size="small" style="width: 100%" />
            </template>
          </el-table-column>
          <el-table-column label="MOQ" width="100">
            <template #default="{ row }">
              <el-input-number v-model="row.moq" :min="0" :controls="false" size="small" style="width: 100%" />
            </template>
          </el-table-column>
          <el-table-column prop="spec" label="规格" min-width="140" show-overflow-tooltip />
          <el-table-column prop="packing_desc" label="包装" min-width="150" show-overflow-tooltip />
          <el-table-column prop="load_quantity_desc" label="装载量" min-width="160" show-overflow-tooltip />
          <el-table-column label="操作" width="60" align="center">
            <template #default="{ $index }">
              <el-button link type="danger" size="small" @click="form.items.splice($index, 1)">删</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-button class="add-item-btn" type="primary" plain size="small" @click="addItemRow">
          + 添加产品行
        </el-button>

        <el-form-item class="remark-item" label="备注条款">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="REMARK：贸易条款补充说明" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取 消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保 存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { listQuotations, getQuotation, createQuotation, updateQuotation, deleteQuotation } from '@/api/quotations'
import { listClients } from '@/api/clients'
import { listProducts } from '@/api/products'
import { listRfqs } from '@/api/rfqs'

const STATUSES = ['草稿', '已发送', '已接受', '已失效']
const statusTag = { 草稿: 'info', 已发送: 'primary', 已接受: 'success', 已失效: 'danger' }

const loading = ref(false)
const saving = ref(false)
const list = ref([])
const total = ref(0)
const clientOptions = ref([])
const productOptions = ref([])
const rfqOptions = ref([])
const query = reactive({ q: '', status: '', page: 1, pageSize: 10 })

const dialogVisible = ref(false)
const formRef = ref()
const form = ref({})
const rules = {
  quotation_number: [{ required: true, message: '请输入报价单号', trigger: 'blur' }],
  quotation_date: [{ required: true, message: '请选择报价日期', trigger: 'change' }],
  client_id: [{ required: true, message: '请选择客户', trigger: 'change' }]
}

const blankForm = () => ({
  quotation_number: '', quotation_date: '', valid_until: '', client_id: null, rfq_id: null,
  currency: 'USD ($)', price_terms: 'FOB', lead_time: '', payment_terms: '',
  loading_port: '', destination_port: '', total_amount: undefined, status: '草稿',
  remark: '', items: []
})

const blankItem = () => ({
  product_id: null, model: '', img_url: null, spec: '', packing_desc: '',
  price: undefined, moq: undefined, load_quantity_desc: ''
})

async function loadList() {
  loading.value = true
  try {
    const d = await listQuotations({ q: query.q, status: query.status, page: query.page, pageSize: query.pageSize })
    list.value = d.list
    total.value = d.total
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false
  }
}

async function loadOptions() {
  try {
    const [c, p, r] = await Promise.all([
      listClients({ page: 1, pageSize: 200 }),
      listProducts({ page: 1, pageSize: 200 }),
      listRfqs({ page: 1, pageSize: 200 })
    ])
    clientOptions.value = c.list
    productOptions.value = p.list
    rfqOptions.value = r.list
  } catch {
    /* 拦截器已提示 */
  }
}

// 选择产品 → 自动带入快照（型号/规格/包装/装载量/默认外销价）
function onProductPick(row, productId) {
  row.product_id = productId
  const p = productOptions.value.find((x) => x.id === productId)
  if (!p) return
  row.model = p.model
  row.spec = p.spec || ''
  row.packing_desc = [p.pcs_per_ctn && `${p.pcs_per_ctn} PCS/CTN`, p.net_weight_kg && `N.W. ${p.net_weight_kg}kg`, p.gross_weight_kg && `G.W. ${p.gross_weight_kg}kg`]
    .filter(Boolean)
    .join(', ')
  row.load_quantity_desc = [p.est_qty_20gp && `20GP: ${p.est_qty_20gp}`, p.est_qty_40gp && `40GP: ${p.est_qty_40gp}`, p.est_qty_40hq && `40HQ: ${p.est_qty_40hq}`]
    .filter(Boolean)
    .join(' / ')
  if (p.export_price_usd) row.price = p.export_price_usd
}

function addItemRow() {
  form.value.items.push(blankItem())
}

function onSearch() {
  query.page = 1
  loadList()
}

function openCreate() {
  form.value = blankForm()
  dialogVisible.value = true
}

async function openEdit(row) {
  const detail = await getQuotation(row.id)
  form.value = { ...detail, items: detail.items || [] }
  dialogVisible.value = true
}

async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  // 明细行校验：至少一行且有型号与单价
  const items = (form.value.items || []).filter((it) => it.model || it.price != null)
  if (items.length === 0) {
    ElMessage.warning('请至少添加一行产品明细（需填写型号与单价）')
    return
  }
  saving.value = true
  try {
    if (form.value.id) {
      await updateQuotation(form.value.id, { ...form.value, items })
      ElMessage.success('更新成功')
    } else {
      await createQuotation({ ...form.value, items })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadList()
  } catch {
    /* 拦截器已提示 */
  } finally {
    saving.value = false
  }
}

async function onDelete(row) {
  const ok = await ElMessageBox.confirm(
    `确认删除报价单「${row.quotation_number}」？明细将一并删除`,
    '删除确认',
    { type: 'warning' }
  ).catch(() => false)
  if (!ok) return
  try {
    await deleteQuotation(row.id)
    ElMessage.success('删除成功')
  } catch {
    /* 拦截器已提示 */
  }
  loadList()
}

onMounted(() => {
  loadList()
  loadOptions()
})
</script>

<style scoped>
.add-item-btn {
  margin-top: 8px;
}
.remark-item {
  margin-top: 16px;
}
</style>
