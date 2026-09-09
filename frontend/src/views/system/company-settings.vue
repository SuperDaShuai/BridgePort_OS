<template>
  <div class="company-settings">
    <!-- 1 & 2：企业抬头 + 财务参数（同一单行表，分区保存） -->
    <el-row :gutter="16">
      <el-col :span="12">
        <el-card shadow="never" class="page-card">
          <template #header>
            <span class="card-title">🏢 企业抬头与联系方式</span>
          </template>
          <el-form ref="companyFormRef" :model="companyForm" :rules="companyRules" label-width="120px">
            <el-form-item label="企业中文名称" prop="name_cn">
              <el-input v-model="companyForm.name_cn" placeholder="如：宁波某某进出口有限公司" />
            </el-form-item>
            <el-form-item label="企业英文名称" prop="name_en">
              <el-input v-model="companyForm.name_en" placeholder="SELLER，如：Ningbo XXX Imp. & Exp. Co., Ltd." />
            </el-form-item>
            <el-form-item label="中文注册地址">
              <el-input v-model="companyForm.address_cn" />
            </el-form-item>
            <el-form-item label="英文地址">
              <el-input v-model="companyForm.address_en" placeholder="Address（用于单据抬头）" />
            </el-form-item>
            <el-form-item label="联系电话">
              <el-input v-model="companyForm.tel" placeholder="86-574-XXXXXXX" />
            </el-form-item>
            <el-form-item label="企业邮箱">
              <el-input v-model="companyForm.email" />
            </el-form-item>
            <el-form-item label="开户银行">
              <el-input v-model="companyForm.bank_name" placeholder="用于购销合同需方盖章区" />
            </el-form-item>
            <el-form-item label="银行账号">
              <el-input v-model="companyForm.bank_account" placeholder="用于购销合同需方盖章区" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="savingCompany" @click="onSaveCompany">保存企业资料</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card shadow="never" class="page-card">
          <template #header>
            <span class="card-title">🧮 财务参数 & 外贸条款模板</span>
          </template>
          <el-form ref="financeFormRef" :model="financeForm" :rules="financeRules" label-width="150px">
            <el-form-item label="美元结汇汇率" prop="default_usd_rate">
              <el-input-number
                v-model="financeForm.default_usd_rate"
                :precision="4" :step="0.01" :min="0"
                controls-position="right"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item label="出口退税率 (%)" prop="default_tax_refund_rate">
              <el-input-number
                v-model="financeForm.default_tax_refund_rate"
                :precision="2" :step="0.5" :min="0" :max="100"
                controls-position="right"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item label="默认付款方式">
              <el-input
                v-model="financeForm.payment_terms_template"
                type="textarea" :rows="3"
                placeholder="Payment Terms 多梯度模板，如：30% T/T 定金，70% 见提单副本"
              />
            </el-form-item>
            <el-form-item label="国际仲裁与理赔">
              <el-input
                v-model="financeForm.arbitration_clause"
                type="textarea" :rows="4"
                placeholder="Arbitration 条款文本，将默认填入合同/PI 模板"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="savingFinance" @click="onSaveFinance">保存参数与模板</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>

    <!-- 3：多币种银行账户与收款路线库（bank_accounts 表） -->
    <el-card shadow="never" class="page-card bank-card">
      <template #header>
        <div class="bank-header">
          <span class="card-title">🏦 多币种银行账户与收款路线库 (USD / RMB / LC)</span>
          <el-button type="primary" :icon="Plus" @click="openBankCreate">添加收款路线</el-button>
        </div>
      </template>

      <el-table v-loading="bankLoading" :data="bankList" border stripe>
        <el-table-column prop="route_type" label="路线类型" width="200" show-overflow-tooltip />
        <el-table-column prop="bank_name" label="银行名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="account_number" label="账号 (Account)" width="200" show-overflow-tooltip />
        <el-table-column label="Swift / 备注" min-width="200">
          <template #default="{ row }">
            <div v-if="row.swift_code">{{ row.swift_code }}</div>
            <div class="note-text">{{ row.routing_note }}</div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openBankEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="onBankDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 收款路线新增/编辑弹窗 -->
    <el-dialog v-model="bankDialogVisible" :title="bankForm.id ? '编辑收款路线' : '添加收款路线'" width="560px" destroy-on-close>
      <el-form ref="bankFormRef" :model="bankForm" :rules="bankRules" label-width="120px">
        <el-form-item label="路线类型" prop="route_type">
          <el-select v-model="bankForm.route_type" style="width: 100%">
            <el-option label="USD 美元付款路线 (T/T)" value="USD 美元付款路线" />
            <el-option label="RMB 人民币付款路线" value="RMB 人民币付款路线" />
            <el-option label="LC 信用证付款路线 (L/C)" value="LC 信用证付款路线" />
            <el-option label="第三方平台 (PingPong 等)" value="第三方平台" />
          </el-select>
        </el-form-item>
        <el-form-item label="银行名称" prop="bank_name">
          <el-input v-model="bankForm.bank_name" placeholder="Bank Name" />
        </el-form-item>
        <el-form-item label="银行账号" prop="account_number">
          <el-input v-model="bankForm.account_number" placeholder="Account No." />
        </el-form-item>
        <el-form-item label="Swift Code" prop="swift_code">
          <el-input v-model="bankForm.swift_code" placeholder="BKCHCNBJ920 / 行号" />
        </el-form-item>
        <el-form-item label="路由备注">
          <el-input
            v-model="bankForm.routing_note"
            type="textarea" :rows="2"
            placeholder="收款人名称、银行地址、中转行等补充信息"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bankDialogVisible = false">取 消</el-button>
        <el-button type="primary" :loading="savingBank" @click="onBankSave">保 存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { getCompanySettings, updateCompanySettings } from '@/api/companySettings'
import {
  listBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount
} from '@/api/bankAccounts'

/* ── 企业配置（company_settings 单行表） ── */
const companyFormRef = ref()
const financeFormRef = ref()
const savingCompany = ref(false)
const savingFinance = ref(false)

const companyForm = reactive({
  name_cn: '', name_en: '', address_cn: '', address_en: '', tel: '', email: '',
  bank_name: '', bank_account: ''
})
const financeForm = reactive({
  default_usd_rate: 7.2, default_tax_refund_rate: 13,
  payment_terms_template: '', arbitration_clause: ''
})

const companyRules = {
  name_en: [{ required: true, message: '企业英文名称（SELLER）为必填', trigger: 'blur' }]
}
const financeRules = {
  default_usd_rate: [{ required: true, message: '请填写美元结汇汇率', trigger: 'blur' }],
  default_tax_refund_rate: [{ required: true, message: '请填写出口退税率', trigger: 'blur' }]
}

async function loadSettings() {
  const d = await getCompanySettings()
  Object.keys(companyForm).forEach((k) => { companyForm[k] = d[k] || '' })
  financeForm.default_usd_rate = d.default_usd_rate != null ? Number(d.default_usd_rate) : 7.2
  financeForm.default_tax_refund_rate = d.default_tax_refund_rate != null ? Number(d.default_tax_refund_rate) : 13
  financeForm.payment_terms_template = d.payment_terms_template || ''
  financeForm.arbitration_clause = d.arbitration_clause || ''
}

async function onSaveCompany() {
  const valid = await companyFormRef.value.validate().catch(() => false)
  if (!valid) return
  savingCompany.value = true
  try {
    await updateCompanySettings({ ...companyForm })
    ElMessage.success('企业基础资料已保存')
  } catch {
    /* 拦截器已提示 */
  } finally {
    savingCompany.value = false
  }
}

async function onSaveFinance() {
  const valid = await financeFormRef.value.validate().catch(() => false)
  if (!valid) return
  savingFinance.value = true
  try {
    await updateCompanySettings({ ...financeForm })
    ElMessage.success('财务参数与默认外贸条款已保存')
  } catch {
    /* 拦截器已提示 */
  } finally {
    savingFinance.value = false
  }
}

/* ── 收款路线库（bank_accounts 表） ── */
const bankLoading = ref(false)
const savingBank = ref(false)
const bankList = ref([])
const bankDialogVisible = ref(false)
const bankFormRef = ref()
const bankForm = ref({})

const bankRules = {
  route_type: [{ required: true, message: '请选择路线类型', trigger: 'change' }],
  bank_name: [{ required: true, message: '请输入银行名称', trigger: 'blur' }],
  account_number: [{ required: true, message: '请输入银行账号', trigger: 'blur' }]
}

const blankBankForm = () => ({
  route_type: 'USD 美元付款路线', bank_name: '', account_number: '', swift_code: '', routing_note: ''
})

async function loadBanks() {
  bankLoading.value = true
  try {
    const d = await listBankAccounts({ page: 1, pageSize: 200 })
    bankList.value = d.list
  } catch {
    /* 拦截器已提示 */
  } finally {
    bankLoading.value = false
  }
}

function openBankCreate() {
  bankForm.value = blankBankForm()
  bankDialogVisible.value = true
}

function openBankEdit(row) {
  bankForm.value = { ...row }
  bankDialogVisible.value = true
}

async function onBankSave() {
  const valid = await bankFormRef.value.validate().catch(() => false)
  if (!valid) return
  savingBank.value = true
  try {
    if (bankForm.value.id) {
      await updateBankAccount(bankForm.value.id, bankForm.value)
      ElMessage.success('更新成功')
    } else {
      await createBankAccount(bankForm.value)
      ElMessage.success('创建成功')
    }
    bankDialogVisible.value = false
    loadBanks()
  } catch {
    /* 拦截器已提示 */
  } finally {
    savingBank.value = false
  }
}

async function onBankDelete(row) {
  const ok = await ElMessageBox.confirm(
    `确认删除收款路线「${row.bank_name} ${row.account_number}」？`,
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
  loadBanks()
}

onMounted(() => {
  loadSettings()
  loadBanks()
})
</script>

<style scoped>
.card-title {
  font-weight: 600;
}
.bank-card {
  margin-top: 16px;
}
.bank-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.note-text {
  font-size: 12px;
  color: #909399;
  white-space: pre-wrap;
}
</style>
