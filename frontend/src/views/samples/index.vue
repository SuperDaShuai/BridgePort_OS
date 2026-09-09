<template>
  <el-card shadow="never" class="page-card">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-input
        v-model="query.q"
        placeholder="搜索单号 / 客户 / 快递单号"
        clearable
        style="width: 270px"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <el-select
        v-model="query.status"
        placeholder="全部状态"
        clearable
        style="width: 140px"
        @change="onSearch"
      >
        <el-option v-for="s in FEEDBACK_STATUSES" :key="s" :label="s" :value="s" />
      </el-select>
      <el-button :icon="Search" @click="onSearch">搜索</el-button>
      <div class="toolbar-right">
        <el-button type="primary" :icon="Plus" @click="openCreate">新增样品单</el-button>
      </div>
    </div>

    <!-- 列表 -->
    <el-table v-loading="loading" :data="list" border stripe>
      <el-table-column prop="sample_number" label="样品单号" width="150" />
      <el-table-column prop="client_name" label="客户" min-width="150" show-overflow-tooltip />
      <el-table-column label="样品明细" min-width="180">
        <template #default="{ row }">
          {{ row.item_count || 0 }} 个品种 (共 {{ row.total_qty || 0 }} PCS)
          <div v-if="row.product_models" class="opt-sub" style="font-size: 11px;">{{ row.product_models }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="courier_name" label="快递" width="80" />
      <el-table-column prop="tracking_number" label="快递单号" width="140" show-overflow-tooltip />
      <el-table-column prop="sent_date" label="寄出日期" width="105" />
      <el-table-column label="样品费" width="80" align="right">
        <template #default="{ row }">{{ formatMoney(row.sample_fee) }}</template>
      </el-table-column>
      <el-table-column label="运费" width="80" align="right">
        <template #default="{ row }">{{ formatMoney(row.freight_cost) }}</template>
      </el-table-column>
      <el-table-column label="反馈状态" width="110" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.feedback_status" :type="feedbackTag[row.feedback_status] || 'info'" size="small">
            {{ row.feedback_status }}
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

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? '编辑样品单' : '新增样品单'"
      width="1100px"
      destroy-on-close
      top="5vh"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <div class="form-grid-4">
          <el-form-item label="样品单号" prop="sample_number">
            <el-input v-model="form.sample_number" placeholder="SMP-YYYY-NNN" />
          </el-form-item>
          <el-form-item label="客户" prop="client_id">
            <el-select v-model="form.client_id" filterable placeholder="选择客户" style="width: 100%">
              <el-option v-for="c in clientOptions" :key="c.id" :label="c.name_en" :value="c.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="来源询盘">
            <el-select v-model="form.rfq_id" filterable clearable style="width: 100%">
              <el-option v-for="r in rfqOptions" :key="r.id" :label="r.rfq_number" :value="r.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="反馈状态">
            <el-select v-model="form.feedback_status" style="width: 100%">
              <el-option v-for="s in FEEDBACK_STATUSES" :key="s" :label="s" :value="s" />
            </el-select>
          </el-form-item>
        </div>

        <el-divider content-position="left">
          <div class="divider-title">
            样品明细清单
            <el-button type="primary" size="small" plain :icon="Plus" @click="addItemRow">+ 添加样品行</el-button>
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
          <el-table-column label="定制型号" width="130">
            <template #default="{ row }">
              <el-input v-model="row.model_custom" size="small" placeholder="打样定制型号" />
            </template>
          </el-table-column>
          <el-table-column label="数量(PCS)" width="110" align="center">
            <template #default="{ row }">
              <el-input-number v-model="row.qty" :min="0" :controls="false" size="small" style="width: 100%" />
            </template>
          </el-table-column>
          <el-table-column label="备注" min-width="150">
            <template #default="{ row }">
              <el-input v-model="row.notes" size="small" placeholder="定制要求/颜色/Logo等" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="50" align="center" fixed="right">
            <template #default="{ $index }">
              <el-button link type="danger" size="small" @click="form.items.splice($index, 1)">✕</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="total-bar">
          <span>样品品种数：</span>
          <span class="total-amount">{{ (form.items || []).length }}</span>
          <span style="margin-left: 20px;">样品总数量：</span>
          <span class="total-amount">{{ sampleTotalQty }} PCS</span>
        </div>

        <el-divider content-position="left">快递与费用信息</el-divider>

        <div class="form-grid-4">
          <el-form-item label="快递公司">
            <el-input v-model="form.courier_name" placeholder="DHL / FedEx / UPS" />
          </el-form-item>
          <el-form-item label="快递单号">
            <el-input v-model="form.tracking_number" />
          </el-form-item>
          <el-form-item label="寄出日期">
            <el-date-picker v-model="form.sent_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
          
        </div>
        <div class="form-grid-4">
          <el-form-item label="样品费">
            <el-input-number v-model="form.sample_fee" :min="0" :controls="false" style="width: 100%" />
          </el-form-item>
          <el-form-item label="快递运费">
            <el-input-number v-model="form.freight_cost" :min="0" :controls="false" style="width: 100%" />
          </el-form-item>
        </div>
        <div class="form-grid-2">
          <el-form-item label="客户评语">
            <el-input v-model="form.client_feedback_note" type="textarea" :rows="2" />
          </el-form-item>
        </div>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取 消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保 存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { onMounted, reactive, ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import {
  listSamples, getSample, createSample, updateSample, deleteSample, getNextSampleNumber
} from '@/api/samples'
import { listClients } from '@/api/clients'
import { listProducts } from '@/api/products'
import { listRfqs } from '@/api/rfqs'

const FEEDBACK_STATUSES = ['准备中', '已寄出', '客户已签收', '确认合格', '需重新打样']
const feedbackTag = {
  准备中: 'info', 已寄出: 'primary', 客户已签收: 'warning', 确认合格: 'success', 需重新打样: 'danger'
}

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
  sample_number: [{ required: true, message: '请输入样品单号', trigger: 'blur' }],
  client_id: [{ required: true, message: '请选择客户', trigger: 'change' }]
}

const blankForm = () => ({
  sample_number: '', client_id: null, rfq_id: null,
  courier_name: '', tracking_number: '', sent_date: '',
  sample_fee: undefined, freight_cost: undefined,
  feedback_status: '准备中', client_feedback_note: '',
  items: []
})
const blankItem = () => ({
  product_id: null, model: '', name_en: '', hs_code: '',
  img_url: '', spec: '', qty: 1, unit: 'PCS',
  model_custom: '', notes: ''
})

const sampleTotalQty = computed(() =>
  (form.value.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0)
)
function formatMoney(v) { return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

async function loadList() {
  loading.value = true
  try {
    const d = await listSamples({ q: query.q, status: query.status, page: query.page, pageSize: query.pageSize })
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
      listClients({ page: 1, pageSize: 500 }),
      listProducts({ page: 1, pageSize: 500 }),
      listRfqs({ page: 1, pageSize: 200 })
    ])
    clientOptions.value = c.list
    productOptions.value = p.list
    rfqOptions.value = r.list
  } catch {
    /* 拦截器已提示 */
  }
}

function onSearch() {
  query.page = 1
  loadList()
}

/* ========== 明细行交互 ========== */
function onProductPick(row, productId) {
  row.product_id = productId
  const p = productOptions.value.find(x => x.id === productId)
  if (!p) return
  row.model = p.model
  row.name_en = p.name_en || ''
  row.hs_code = p.hs_code || ''
  row.img_url = p.img_url || ''
  row.unit = p.unit || 'PCS'
  // 组装规格描述（品名 + HS编码）
  const specLines = []
  specLines.push(p.name_en || p.model)
  if (p.spec) specLines.push(p.spec)
  if (p.hs_code) specLines.push('HS: ' + p.hs_code)
  row.spec = specLines.join('\n')
}
function addItemRow() { form.value.items.push(blankItem()) }

async function openCreate() {
  form.value = blankForm()
  try { form.value.sample_number = await getNextSampleNumber() } catch {}
  form.value.sent_date = new Date().toISOString().slice(0, 10)
  addItemRow()
  dialogVisible.value = true
}

async function openEdit(row) {
  const detail = await getSample(row.id)
  detail.items = (detail.items || []).map(it => ({ ...it, qty: Number(it.qty) || 0 }))
  form.value = detail
  dialogVisible.value = true
}

async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  const items = (form.value.items || []).filter(it => it.model)
  if (items.length === 0) { ElMessage.warning('请至少添加一行样品明细'); return }
  const payload = { ...form.value, items }
  saving.value = true
  try {
    if (form.value.id) {
      await updateSample(form.value.id, payload)
      ElMessage.success('更新成功')
    } else {
      await createSample(payload)
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
    `确认删除样品单「${row.sample_number}」？`,
    '删除确认',
    { type: 'warning' }
  ).catch(() => false)
  if (!ok) return
  try {
    await deleteSample(row.id)
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
.divider-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: bold;
}
.items-table {
  margin-bottom: 12px;
}
.no-photo {
  color: #c0c4cc;
  text-align: center;
}
.total-bar {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background: #f8fafc;
  border-radius: 4px;
  font-size: 14px;
  color: #475569;
}
.total-amount {
  font-size: 18px;
  font-weight: bold;
  color: #059669;
}
.opt-sub {
  color: #94a3b8;
  font-size: 12px;
}
.form-grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0 16px;
}
.form-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0 16px;
}
</style>
