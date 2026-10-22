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
        <el-button v-if="canEdit" type="primary" :icon="Plus" @click="openCreate">新增客户</el-button>
      </div>
    </div>

    <!-- 列表 -->
    <el-table v-loading="loading" :data="list" border stripe @selection-change="onSelectionChange">
      <el-table-column v-if="isAdmin" type="selection" width="44" />
      <el-table-column prop="name_en" label="客户英文名" min-width="230" show-overflow-tooltip />
      <el-table-column prop="short_name" label="客户简称" width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ row.short_name || '—' }}</template>
      </el-table-column>
      <el-table-column label="负责人" width="110" show-overflow-tooltip>
        <template #default="{ row }">{{ row.owner_name || '—' }}</template>
      </el-table-column>
      <el-table-column prop="country" label="国家/地区" width="150" show-overflow-tooltip />
      <el-table-column prop="destination_port" label="目的港" width="140" show-overflow-tooltip />
      <el-table-column prop="main_products" label="主营产品" min-width="150" show-overflow-tooltip />
      <el-table-column prop="website_url" label="网站" min-width="140" show-overflow-tooltip />
      <el-table-column label="操作" width="200" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="info" @click="openView(row)">查看</el-button>
          <el-button v-if="canEdit" link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button v-if="isAdmin" link type="warning" @click="openAssign(row)">分配</el-button>
          <el-button v-if="canEdit" link type="danger" @click="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 批量分配栏（超级管理员选中行后显示） -->
    <div v-if="isAdmin && selectedIds.length > 0" class="batch-bar">
      <span>已选 <strong>{{ selectedIds.length }}</strong> 位客户</span>
      <el-button type="warning" size="small" @click="openBatchAssign">批量分配给业务员</el-button>
      <el-button size="small" @click="selectedIds = []">取消选择</el-button>
    </div>

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
      v-model="dialogVisible" :close-on-click-modal="false"
      :title="readonly ? '查看客户' : (form.id ? '编辑客户' : '新增客户')"
      width="1080px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" :disabled="readonly" label-width="90px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="英文名称" prop="name_en">
              <el-input v-model="form.name_en" placeholder="GLOBAL ... LLC" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户简称">
              <el-input v-model="form.short_name" placeholder="用于采购订货单等单据的客户简称" />
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
        <el-button @click="dialogVisible = false">{{ readonly ? '关 闭' : '取 消' }}</el-button>
        <el-button v-if="!readonly" type="primary" :loading="saving" @click="onSave">保 存</el-button>
      </template>
    </el-dialog>

    <!-- 分配客户弹窗 -->
    <el-dialog
      v-model="assignVisible" :close-on-click-modal="false"
      :title="assignMode === 'single' ? `分配客户「${currentClient?.name_en || ''}」给业务员` : `批量分配 ${selectedIds.length} 位客户给业务员`"
      width="440px"
      destroy-on-close
    >
      <el-form :model="{ owner_id: assignTargetId }" label-width="90px">
        <el-form-item label="目标业务员" required>
          <el-select v-model="assignTargetId" filterable placeholder="请选择业务员" style="width: 100%">
            <el-option
              v-for="s in salesPeople"
              :key="s.id"
              :label="`${s.display_name || s.username}（${s.role || '业务员'}）`"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-alert type="info" :closable="false" show-icon>
          <template #title>
            分配后关联的外销订单、样品单、报价单、询价单负责人将一并变更（仅更新当前负责人为该客户旧负责人的单据）。
          </template>
        </el-alert>
      </el-form>
      <template #footer>
        <el-button @click="assignVisible = false">取 消</el-button>
        <el-button type="primary" :loading="saving" @click="onAssignConfirm">确认分配</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import ContactsEditor from '@/components/ContactsEditor.vue'
import { listClients, getClient, createClient, updateClient, deleteClient, listSalesPeople, assignClient, batchAssignClients } from '@/api/clients'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
// 管理员/主管/业务员可增删改客户（业务员仅能操作自己添加的，由后端归属校验）；财务跟单只读
const canEdit = userStore.permissionLevel <= 3
// 仅超级管理员（level=1）可分配客户
const isAdmin = userStore.permissionLevel === 1

// 分配相关状态
const selectedIds = ref([])
const salesPeople = ref([])
const assignVisible = ref(false)
const assignTargetId = ref(null)
const assignMode = ref('single') // 'single' | 'batch'
const currentClient = ref(null)

function onSelectionChange(rows) {
  selectedIds.value = rows.map(r => r.id)
}

async function loadSalesPeople() {
  if (!salesPeople.value.length) {
    try { salesPeople.value = await listSalesPeople() } catch { /* 已由拦截器提示 */ }
  }
}

async function openAssign(row) {
  currentClient.value = row
  assignMode.value = 'single'
  assignTargetId.value = null
  await loadSalesPeople()
  assignVisible.value = true
}

async function openBatchAssign() {
  assignMode.value = 'batch'
  assignTargetId.value = null
  await loadSalesPeople()
  assignVisible.value = true
}

async function onAssignConfirm() {
  if (!assignTargetId.value) {
    ElMessage.warning('请选择目标业务员')
    return
  }
  try {
    if (assignMode.value === 'single' && currentClient.value) {
      await assignClient(currentClient.value.id, assignTargetId.value)
      ElMessage.success(`已将客户「${currentClient.value.name_en}」分配给 ${salesPeople.value.find(s => s.id === assignTargetId.value)?.display_name || ''}`)
    } else {
      const count = selectedIds.value.length
      await batchAssignClients(selectedIds.value, assignTargetId.value)
      ElMessage.success(`已将 ${count} 位客户批量分配给 ${salesPeople.value.find(s => s.id === assignTargetId.value)?.display_name || ''}`)
      selectedIds.value = []
    }
    assignVisible.value = false
    await loadList()
  } catch { /* 拦截器已提示 */ }
}

const loading = ref(false)
const saving = ref(false)
const list = ref([])
const total = ref(0)
const query = reactive({ q: '', page: 1, pageSize: 20 })

const dialogVisible = ref(false)
const readonly = ref(false)
const formRef = ref()
const form = ref({})
const rules = {
  name_en: [{ required: true, message: '请输入客户英文名', trigger: 'blur' }],
  country: [{ required: true, message: '请输入国家/地区', trigger: 'blur' }],
  address_en: [{ required: true, message: '请输入英文地址', trigger: 'blur' }]
}

const blankForm = () => ({
  name_en: '', short_name: '', country: '', destination_port: '', main_products: '',
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
  readonly.value = false
  form.value = blankForm()
  dialogVisible.value = true
}

async function openView(row) {
  readonly.value = true
  const detail = await getClient(row.id)
  form.value = { ...detail, contacts: detail.contacts || [] }
  dialogVisible.value = true
}

async function openEdit(row) {
  readonly.value = false
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
