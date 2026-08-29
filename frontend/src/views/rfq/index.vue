<template>
  <el-card shadow="never" class="page-card">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-input
        v-model="query.q"
        placeholder="搜索单号 / 客户 / 意向描述"
        clearable
        style="width: 250px"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <el-select
        v-model="query.stage"
        placeholder="全部阶段"
        clearable
        style="width: 130px"
        @change="onSearch"
      >
        <el-option v-for="s in STAGES" :key="s" :label="s" :value="s" />
      </el-select>
      <el-button :icon="Search" @click="onSearch">搜索</el-button>
      <div class="toolbar-right">
        <el-button type="primary" :icon="Plus" @click="openCreate">新增询盘</el-button>
      </div>
    </div>

    <!-- 列表 -->
    <el-table v-loading="loading" :data="list" border stripe>
      <el-table-column prop="rfq_number" label="询盘单号" width="140" />
      <el-table-column prop="inquiry_date" label="询价日期" width="110" />
      <el-table-column prop="client_name" label="客户" min-width="160" show-overflow-tooltip />
      <el-table-column label="意向产品" min-width="170" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.product_model || row.intended_desc || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="estimated_qty" label="预计数量" width="100" align="right" />
      <el-table-column prop="target_price" label="目标单价($)" width="110" align="right" />
      <el-table-column label="商机阶段" width="100" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.follow_up_stage" :type="stageTag[row.follow_up_stage] || 'info'" size="small">
            {{ row.follow_up_stage }}
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
      :title="form.id ? '编辑询盘' : '新增询盘'"
      width="720px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="询盘单号" prop="rfq_number">
              <el-input v-model="form.rfq_number" placeholder="RFQ-2026-001" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="询价日期" prop="inquiry_date">
              <el-date-picker
                v-model="form.inquiry_date"
                type="date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="询价客户" prop="client_id">
              <el-select v-model="form.client_id" filterable style="width: 100%">
                <el-option
                  v-for="c in clientOptions"
                  :key="c.id"
                  :label="c.name_en"
                  :value="c.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="意向产品">
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
            <el-form-item label="预计数量">
              <el-input-number v-model="form.estimated_qty" :min="0" :controls="false" style="width: 100%" placeholder="PCS" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="目标单价($)">
              <el-input-number v-model="form.target_price" :min="0" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="商机阶段">
              <el-select v-model="form.follow_up_stage" style="width: 100%">
                <el-option v-for="s in STAGES" :key="s" :label="s" :value="s" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="意向描述">
              <el-input v-model="form.intended_desc" type="textarea" :rows="3" placeholder="客户想要的品类、功能、认证要求等" />
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
import { listRfqs, getRfq, createRfq, updateRfq, deleteRfq } from '@/api/rfqs'
import { listClients } from '@/api/clients'
import { listProducts } from '@/api/products'

const STAGES = ['跟进中', '已报价', '闭单']
const stageTag = { 跟进中: 'warning', 已报价: 'primary', 闭单: 'success' }

const loading = ref(false)
const saving = ref(false)
const list = ref([])
const total = ref(0)
const clientOptions = ref([])
const productOptions = ref([])
const query = reactive({ q: '', stage: '', page: 1, pageSize: 10 })

const dialogVisible = ref(false)
const formRef = ref()
const form = ref({})
const rules = {
  rfq_number: [{ required: true, message: '请输入询盘单号', trigger: 'blur' }],
  inquiry_date: [{ required: true, message: '请选择询价日期', trigger: 'change' }],
  client_id: [{ required: true, message: '请选择询价客户', trigger: 'change' }]
}

const blankForm = () => ({
  rfq_number: '', inquiry_date: '', client_id: null, product_id: null,
  intended_desc: '', estimated_qty: undefined, target_price: undefined, follow_up_stage: '跟进中'
})

async function loadList() {
  loading.value = true
  try {
    const d = await listRfqs({ q: query.q, stage: query.stage, page: query.page, pageSize: query.pageSize })
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
    const [c, p] = await Promise.all([
      listClients({ page: 1, pageSize: 200 }),
      listProducts({ page: 1, pageSize: 200 })
    ])
    clientOptions.value = c.list
    productOptions.value = p.list
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
  const detail = await getRfq(row.id)
  form.value = { ...detail }
  dialogVisible.value = true
}

async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    if (form.value.id) {
      await updateRfq(form.value.id, form.value)
      ElMessage.success('更新成功')
    } else {
      await createRfq(form.value)
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
    `确认删除询盘「${row.rfq_number}」？`,
    '删除确认',
    { type: 'warning' }
  ).catch(() => false)
  if (!ok) return
  try {
    await deleteRfq(row.id)
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
