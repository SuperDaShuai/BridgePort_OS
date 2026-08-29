<template>
  <el-card shadow="never" class="page-card">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-input
        v-model="query.q"
        placeholder="搜索单号 / 客户 / 型号 / 快递单号"
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
      <el-table-column label="产品型号" width="130" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.product_model || row.model_custom || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="qty" label="数量" width="70" align="right" />
      <el-table-column prop="courier_name" label="快递" width="80" />
      <el-table-column prop="tracking_number" label="快递单号" width="140" show-overflow-tooltip />
      <el-table-column prop="sent_date" label="寄出日期" width="105" />
      <el-table-column prop="sample_fee" label="样品费" width="80" align="right" />
      <el-table-column prop="freight_cost" label="运费" width="80" align="right" />
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
      width="780px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="样品单号" prop="sample_number">
              <el-input v-model="form.sample_number" placeholder="BP-SMP-2026-001" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户" prop="client_id">
              <el-select v-model="form.client_id" filterable style="width: 100%">
                <el-option v-for="c in clientOptions" :key="c.id" :label="c.name_en" :value="c.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="已有产品">
              <el-select v-model="form.product_id" filterable clearable style="width: 100%">
                <el-option
                  v-for="p in productOptions"
                  :key="p.id"
                  :label="`${p.model} - ${p.name_cn}`"
                  :value="p.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="定制型号">
              <el-input v-model="form.model_custom" placeholder="全新定制打样时手工录入" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="数量(PCS)">
              <el-input-number v-model="form.qty" :min="0" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="来源询盘">
              <el-select v-model="form.rfq_id" filterable clearable style="width: 100%">
                <el-option v-for="r in rfqOptions" :key="r.id" :label="r.rfq_number" :value="r.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="规格要求">
              <el-input v-model="form.spec_desc" type="textarea" :rows="2" placeholder="样品规格与打样要求" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="快递公司">
              <el-input v-model="form.courier_name" placeholder="DHL / FedEx / UPS" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="快递单号">
              <el-input v-model="form.tracking_number" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="寄出日期">
              <el-date-picker v-model="form.sent_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="样品费">
              <el-input-number v-model="form.sample_fee" :min="0" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="快递运费">
              <el-input-number v-model="form.freight_cost" :min="0" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="反馈状态">
              <el-select v-model="form.feedback_status" style="width: 100%">
                <el-option v-for="s in FEEDBACK_STATUSES" :key="s" :label="s" :value="s" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="客户评语">
              <el-input v-model="form.client_feedback_note" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
        </el-row>
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
import { listSamples, getSample, createSample, updateSample, deleteSample } from '@/api/samples'
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
  sample_number: '', client_id: null, product_id: null, model_custom: '', spec_desc: '',
  qty: undefined, courier_name: '', tracking_number: '', sent_date: '',
  sample_fee: undefined, freight_cost: undefined,
  feedback_status: '准备中', client_feedback_note: '', rfq_id: null
})

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

function onSearch() {
  query.page = 1
  loadList()
}

function openCreate() {
  form.value = blankForm()
  dialogVisible.value = true
}

async function openEdit(row) {
  const detail = await getSample(row.id)
  form.value = { ...detail }
  dialogVisible.value = true
}

async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    if (form.value.id) {
      await updateSample(form.value.id, form.value)
      ElMessage.success('更新成功')
    } else {
      await createSample(form.value)
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
