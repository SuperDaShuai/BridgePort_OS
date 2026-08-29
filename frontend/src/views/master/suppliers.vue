<template>
  <el-card shadow="never" class="page-card">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-input
        v-model="query.q"
        placeholder="搜索工厂名 / 城市 / 品类"
        clearable
        style="width: 260px"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <el-button :icon="Search" @click="onSearch">搜索</el-button>
      <div class="toolbar-right">
        <el-button type="primary" :icon="Plus" @click="openCreate">新增供应商</el-button>
      </div>
    </div>

    <!-- 列表 -->
    <el-table v-loading="loading" :data="list" border stripe>
      <el-table-column prop="name" label="供应商名称" min-width="220" show-overflow-tooltip />
      <el-table-column prop="city" label="城市" width="120" show-overflow-tooltip />
      <el-table-column prop="main_category" label="主营品类" min-width="150" show-overflow-tooltip />
      <el-table-column prop="factory_address" label="工厂地址" min-width="180" show-overflow-tooltip />
      <el-table-column prop="bank_name" label="开户银行" min-width="160" show-overflow-tooltip />
      <el-table-column prop="account_number" label="银行账号" width="150" show-overflow-tooltip />
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
      :title="form.id ? '编辑供应商' : '新增供应商'"
      width="760px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="工厂名称" prop="name">
              <el-input v-model="form.name" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="城市">
              <el-input v-model="form.city" placeholder="浙江永康" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="主营品类">
              <el-input v-model="form.main_category" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="开户银行">
              <el-input v-model="form.bank_name" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="银行账号">
              <el-input v-model="form.account_number" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="工厂地址">
              <el-input v-model="form.factory_address" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">联系人</el-divider>
        <ContactsEditor v-model="form.contacts" />
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
import ContactsEditor from '@/components/ContactsEditor.vue'
import { listSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier } from '@/api/suppliers'

const loading = ref(false)
const saving = ref(false)
const list = ref([])
const total = ref(0)
const query = reactive({ q: '', page: 1, pageSize: 10 })

const dialogVisible = ref(false)
const formRef = ref()
const form = ref({})
const rules = {
  name: [{ required: true, message: '请输入供应商名称', trigger: 'blur' }]
}

const blankForm = () => ({
  name: '', city: '', main_category: '', factory_address: '',
  bank_name: '', account_number: '', contacts: []
})

async function loadList() {
  loading.value = true
  try {
    const d = await listSuppliers({ q: query.q, page: query.page, pageSize: query.pageSize })
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
  form.value = blankForm()
  dialogVisible.value = true
}

async function openEdit(row) {
  const detail = await getSupplier(row.id)
  form.value = { ...detail, contacts: detail.contacts || [] }
  dialogVisible.value = true
}

async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    if (form.value.id) {
      await updateSupplier(form.value.id, form.value)
      ElMessage.success('更新成功')
    } else {
      await createSupplier(form.value)
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
    `确认删除供应商「${row.name}」？`,
    '删除确认',
    { type: 'warning' }
  ).catch(() => false)
  if (!ok) return
  try {
    await deleteSupplier(row.id)
    ElMessage.success('删除成功')
  } catch {
    /* 拦截器已提示 */
  }
  loadList()
}

onMounted(loadList)
</script>
