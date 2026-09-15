<template>
  <el-card shadow="never" class="page-card">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-input
        v-model="query.q"
        placeholder="搜索 HS编码 / 产品名称"
        clearable
        style="width: 240px"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <el-button :icon="Search" @click="onSearch">搜索</el-button>
      <div class="toolbar-right">
        <el-button v-if="canEdit" type="primary" :icon="Plus" @click="openCreate">新增 HS 编码</el-button>
      </div>
    </div>

    <!-- 列表 -->
    <el-table v-loading="loading" :data="list" border stripe>
      <el-table-column prop="hs_code" label="HS编码" width="140" />
      <el-table-column prop="product_name" label="HS产品名称" min-width="220" show-overflow-tooltip />
      <el-table-column label="申报要素" min-width="300">
        <template #default="{ row }">
          <div class="decl-text">{{ row.declaration_elements || '—' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="info" @click="openView(row)">查看</el-button>
          <el-button v-if="canEdit" link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button v-if="canEdit" link type="danger" @click="onDelete(row)">删除</el-button>
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
      :title="readonly ? '查看 HS 编码' : (form.id ? '编辑 HS 编码' : '新增 HS 编码')"
      width="680px"
      destroy-on-close
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="rules" :disabled="readonly" label-width="100px">
        <el-form-item label="HS编码" prop="hs_code">
          <el-input v-model="form.hs_code" placeholder="如：85437099" maxlength="20" />
        </el-form-item>
        <el-form-item label="HS产品名称" prop="product_name">
          <el-input v-model="form.product_name" placeholder="如：其他电气信号装置" />
        </el-form-item>
        <el-form-item label="申报要素" prop="declaration_elements">
          <el-input
            v-model="form.declaration_elements"
            type="textarea"
            :rows="8"
            placeholder="1. 品名：&#10;2. 用途：&#10;3. 材质：&#10;4. 型号：&#10;5. 工作原理：&#10;6. 是否带电源装置："
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">{{ readonly ? '关 闭' : '取 消' }}</el-button>
        <el-button v-if="!readonly" type="primary" :loading="saving" @click="onSave">保 存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { listHsCodes, getHsCode, createHsCode, updateHsCode, deleteHsCode } from '@/api/hsCodes'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const canEdit = userStore.canEdit

const loading = ref(false)
const saving = ref(false)
const list = ref([])
const total = ref(0)
const query = reactive({ q: '', page: 1, pageSize: 10 })

const dialogVisible = ref(false)
const readonly = ref(false)
const formRef = ref()
const form = ref({})
const rules = {
  hs_code: [{ required: true, message: '请输入HS编码', trigger: 'blur' }],
  product_name: [{ required: true, message: '请输入HS产品名称', trigger: 'blur' }]
}

const blankForm = () => ({
  hs_code: '', product_name: '', declaration_elements: ''
})

async function loadList() {
  loading.value = true
  try {
    const d = await listHsCodes({ q: query.q, page: query.page, pageSize: query.pageSize })
    list.value = d.list
    total.value = d.total
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false
  }
}

function onSearch() {
  query.page = 1
  loadList()
}

function openCreate() {
  readonly.value = false
  form.value = blankForm()
  dialogVisible.value = true
}

async function openView(row) {
  readonly.value = true
  form.value = { ...await getHsCode(row.id) }
  dialogVisible.value = true
}

async function openEdit(row) {
  readonly.value = false
  form.value = { ...await getHsCode(row.id) }
  dialogVisible.value = true
}

async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    if (form.value.id) {
      await updateHsCode(form.value.id, form.value)
      ElMessage.success('更新成功')
    } else {
      await createHsCode(form.value)
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
    `确认删除 HS编码「${row.hs_code}」？`,
    '删除确认',
    { type: 'warning' }
  ).catch(() => false)
  if (!ok) return
  try {
    await deleteHsCode(row.id)
    ElMessage.success('删除成功')
  } catch {
    /* 拦截器已提示 */
  }
  loadList()
}

onMounted(loadList)
</script>

<style scoped>
.decl-text {
  font-size: 12px;
  color: #606266;
  white-space: pre-wrap;
  line-height: 1.6;
}
</style>
