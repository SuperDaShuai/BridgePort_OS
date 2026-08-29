<template>
  <el-card shadow="never" class="page-card">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-input
        v-model="query.q"
        placeholder="搜索账号 / 姓名 / 角色"
        clearable
        style="width: 260px"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <el-button :icon="Search" @click="onSearch">搜索</el-button>
      <div class="toolbar-right">
        <el-button type="primary" :icon="Plus" @click="openCreate">新增员工</el-button>
      </div>
    </div>

    <!-- 列表 -->
    <el-table v-loading="loading" :data="list" border stripe>
      <el-table-column prop="username" label="登录账号" width="140" />
      <el-table-column prop="display_name" label="姓名" width="130" show-overflow-tooltip />
      <el-table-column prop="role" label="角色" width="130" show-overflow-tooltip />
      <el-table-column label="权限等级" width="120" align="center">
        <template #default="{ row }">
          <el-tag :type="levelMap[row.permission_level]?.type || 'info'" size="small">
            {{ levelMap[row.permission_level]?.label || `等级${row.permission_level}` }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="phone" label="手机号" width="130" />
      <el-table-column prop="email" label="邮箱" min-width="160" show-overflow-tooltip />
      <el-table-column label="字段权限" width="170">
        <template #default="{ row }">
          <el-tag v-if="row.hide_purchase_and_profit" size="small" type="warning">隐成本利润</el-tag>
          <el-tag v-if="row.hide_supplier_info" size="small" type="warning">隐供应商</el-tag>
          <span v-if="!row.hide_purchase_and_profit && !row.hide_supplier_info" class="perm-all">全部可见</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-switch
            v-model="row.status"
            :active-value="1"
            :inactive-value="0"
            :disabled="row.id === userStore.profile?.id"
            @change="onToggleStatus(row)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="130" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button
            link
            type="danger"
            :disabled="row.id === userStore.profile?.id || row.permission_level === 1"
            @click="onDelete(row)"
          >
            删除
          </el-button>
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
      :title="form.id ? '编辑员工' : '新增员工'"
      width="640px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="登录账号" prop="username">
              <el-input v-model="form.username" :disabled="!!form.id" placeholder="登录用户名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="姓名" prop="display_name">
              <el-input v-model="form.display_name" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="角色" prop="role">
              <el-input v-model="form.role" placeholder="业务员 / 跟单员..." />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="权限等级" prop="permission_level">
              <el-select v-model="form.permission_level" style="width: 100%">
                <el-option
                  v-for="(v, k) in levelMap"
                  :key="k"
                  :label="`${k} - ${v.label}`"
                  :value="Number(k)"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="手机号">
              <el-input v-model="form.phone" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邮箱">
              <el-input v-model="form.email" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="登录密码" prop="password">
              <el-input
                v-model="form.password"
                type="password"
                show-password
                :placeholder="form.id ? '留空则不修改密码' : '初始密码'"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="账号状态">
              <el-switch
                v-model="form.status"
                :active-value="1"
                :inactive-value="0"
                active-text="启用"
                inactive-text="禁用"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">数据可见性（字段级权限）</el-divider>
        <el-form-item label="">
          <el-checkbox v-model="form.hide_purchase_and_profit">隐藏采购价与利润字段</el-checkbox>
          <el-checkbox v-model="form.hide_supplier_info">隐藏供应商信息</el-checkbox>
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
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { listOperators, createOperator, updateOperator, deleteOperator } from '@/api/operators'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

// 权限等级：数字越小权限越大
const levelMap = {
  1: { label: '超级管理员', type: 'danger' },
  2: { label: '业务主管', type: 'warning' },
  3: { label: '业务员', type: 'primary' },
  4: { label: '财务跟单', type: 'info' }
}

const loading = ref(false)
const saving = ref(false)
const list = ref([])
const total = ref(0)
const query = reactive({ q: '', page: 1, pageSize: 10 })

const dialogVisible = ref(false)
const formRef = ref()
const form = ref({})
// 新增时初始密码必填，编辑时留空不改
const formRules = computed(() => ({
  username: [{ required: true, message: '请输入登录账号', trigger: 'blur' }],
  permission_level: [{ required: true, message: '请选择权限等级', trigger: 'change' }],
  password: form.value.id
    ? []
    : [{ required: true, message: '请输入初始密码', trigger: 'blur' }]
}))

const blankForm = () => ({
  username: '', display_name: '', role: '', permission_level: 3,
  phone: '', email: '', password: '', status: 1,
  hide_purchase_and_profit: false, hide_supplier_info: false
})

async function loadList() {
  loading.value = true
  try {
    const d = await listOperators({ q: query.q, page: query.page, pageSize: query.pageSize })
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

function openEdit(row) {
  form.value = { ...row, password: '' }
  dialogVisible.value = true
}

async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    if (form.value.id) {
      await updateOperator(form.value.id, form.value)
      ElMessage.success('更新成功')
    } else {
      await createOperator(form.value)
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

async function onToggleStatus(row) {
  try {
    await updateOperator(row.id, { status: row.status })
    ElMessage.success(row.status ? '已启用' : '已禁用（该账号将无法登录）')
  } catch {
    row.status = row.status ? 0 : 1 // 失败回滚开关
  }
}

async function onDelete(row) {
  const ok = await ElMessageBox.confirm(
    `确认删除员工「${row.display_name || row.username}」？`,
    '删除确认',
    { type: 'warning' }
  ).catch(() => false)
  if (!ok) return
  try {
    await deleteOperator(row.id)
    ElMessage.success('删除成功')
  } catch {
    /* 拦截器已提示 */
  }
  loadList()
}

onMounted(loadList)
</script>

<style scoped>
.perm-all {
  font-size: 12px;
  color: #909399;
}
</style>
