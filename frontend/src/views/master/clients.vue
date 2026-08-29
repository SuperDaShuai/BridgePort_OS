<template>
  <el-card shadow="never" class="page-card">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-input
        v-model="query.q"
        placeholder="搜索客户名 / 国家 / 主营产品"
        clearable
        style="width: 260px"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <el-button :icon="Search" @click="onSearch">搜索</el-button>
      <div class="toolbar-right">
        <el-button type="primary" :icon="Plus" @click="openCreate">新增客户</el-button>
      </div>
    </div>

    <!-- 列表 -->
    <el-table v-loading="loading" :data="list" border stripe>
      <el-table-column prop="name_en" label="客户英文名" min-width="230" show-overflow-tooltip />
      <el-table-column prop="country" label="国家/地区" width="150" show-overflow-tooltip />
      <el-table-column prop="destination_port" label="目的港" width="140" show-overflow-tooltip />
      <el-table-column prop="main_products" label="主营产品" min-width="150" show-overflow-tooltip />
      <el-table-column prop="website_url" label="网站" min-width="140" show-overflow-tooltip />
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
      :title="form.id ? '编辑客户' : '新增客户'"
      width="760px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="英文名称" prop="name_en">
              <el-input v-model="form.name_en" placeholder="GLOBAL ... LLC" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="国家/地区" prop="country">
              <el-input v-model="form.country" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="目的港">
              <el-input v-model="form.destination_port" placeholder="Jebel Ali, Dubai" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="主营产品">
              <el-input v-model="form.main_products" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="网站">
              <el-input v-model="form.website_url" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="英文地址" prop="address_en">
              <el-input v-model="form.address_en" type="textarea" :rows="2" />
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
import { listClients, getClient, createClient, updateClient, deleteClient } from '@/api/clients'

const loading = ref(false)
const saving = ref(false)
const list = ref([])
const total = ref(0)
const query = reactive({ q: '', page: 1, pageSize: 10 })

const dialogVisible = ref(false)
const formRef = ref()
const form = ref({})
const rules = {
  name_en: [{ required: true, message: '请输入客户英文名', trigger: 'blur' }],
  country: [{ required: true, message: '请输入国家/地区', trigger: 'blur' }],
  address_en: [{ required: true, message: '请输入英文地址', trigger: 'blur' }]
}

const blankForm = () => ({
  name_en: '', country: '', destination_port: '', main_products: '',
  website_url: '', address_en: '', contacts: []
})

async function loadList() {
  loading.value = true
  try {
    const d = await listClients({ q: query.q, page: query.page, pageSize: query.pageSize })
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
  // 详情接口带出联系人列表
  const detail = await getClient(row.id)
  form.value = { ...detail, contacts: detail.contacts || [] }
  dialogVisible.value = true
}

async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    if (form.value.id) {
      await updateClient(form.value.id, form.value)
      ElMessage.success('更新成功')
    } else {
      await createClient(form.value)
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
    `确认删除客户「${row.name_en}」？`,
    '删除确认',
    { type: 'warning' }
  ).catch(() => false)
  if (!ok) return
  try {
    await deleteClient(row.id)
    ElMessage.success('删除成功')
  } catch {
    /* 拦截器已提示 */
  }
  loadList()
}

onMounted(loadList)
</script>
