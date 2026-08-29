<template>
  <el-card shadow="never" class="page-card">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-input
        v-model="query.q"
        placeholder="搜索账户类型 / 银行 / 账号"
        clearable
        style="width: 260px"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <el-button :icon="Search" @click="onSearch">搜索</el-button>
      <div class="toolbar-right">
        <el-button type="primary" :icon="Plus" @click="openCreate">新增账户</el-button>
      </div>
    </div>

    <!-- 列表 -->
    <el-table v-loading="loading" :data="list" border stripe>
      <el-table-column prop="route_type" label="账户类型" width="160" show-overflow-tooltip />
      <el-table-column prop="bank_name" label="银行名称" min-width="220" show-overflow-tooltip />
      <el-table-column prop="account_number" label="账号" width="200" show-overflow-tooltip />
      <el-table-column prop="swift_code" label="SWIFT" width="160" />
      <el-table-column prop="routing_note" label="路线备注" min-width="160" show-overflow-tooltip />
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
      :title="form.id ? '编辑银行账户' : '新增银行账户'"
      width="640px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="账户类型" prop="route_type">
          <el-input v-model="form.route_type" placeholder="USD 美元公账 / RMB 国内公账" />
        </el-form-item>
        <el-form-item label="银行名称" prop="bank_name">
          <el-input v-model="form.bank_name" />
        </el-form-item>
        <el-form-item label="账号" prop="account_number">
          <el-input v-model="form.account_number" />
        </el-form-item>
        <el-form-item label="SWIFT" prop="swift_code">
          <el-input v-model="form.swift_code" placeholder="BKCHCNBJ920 / 对公付款" />
        </el-form-item>
        <el-form-item label="路线备注">
          <el-input v-model="form.routing_note" type="textarea" :rows="2" />
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
import { listBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount } from '@/api/bankAccounts'

const loading = ref(false)
const saving = ref(false)
const list = ref([])
const total = ref(0)
const query = reactive({ q: '', page: 1, pageSize: 10 })

const dialogVisible = ref(false)
const formRef = ref()
const form = ref({})
const rules = {
  route_type: [{ required: true, message: '请输入账户类型', trigger: 'blur' }],
  bank_name: [{ required: true, message: '请输入银行名称', trigger: 'blur' }],
  account_number: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  swift_code: [{ required: true, message: '请输入SWIFT编码', trigger: 'blur' }]
}

const blankForm = () => ({
  route_type: '', bank_name: '', account_number: '', swift_code: '', routing_note: ''
})

async function loadList() {
  loading.value = true
  try {
    const d = await listBankAccounts({ q: query.q, page: query.page, pageSize: query.pageSize })
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
  form.value = { ...row }
  dialogVisible.value = true
}

async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    if (form.value.id) {
      await updateBankAccount(form.value.id, form.value)
      ElMessage.success('更新成功')
    } else {
      await createBankAccount(form.value)
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
    `确认删除账户「${row.bank_name} ${row.account_number}」？`,
    '删除确认',
    { type: 'warning' }
  ).catch(() => false)
  if (!ok) return
  try {
    await deleteBankAccount(row.id)
    ElMessage.success('删除成功')
  } catch {
    /* 拦截器已提示（被收款流水引用时后端返回 409） */
  }
  loadList()
}

onMounted(loadList)
</script>
