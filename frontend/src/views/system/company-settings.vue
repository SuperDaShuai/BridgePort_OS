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
            <el-form-item label="纳税识别号">
              <el-input v-model="companyForm.tax_number" placeholder="统一社会信用代码" maxlength="50" />
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
            <el-form-item label="国际仲裁与理赔">
              <el-input
                v-model="financeForm.arbitration_clause"
                type="textarea" :rows="4"
                placeholder="Arbitration 条款文本，将默认填入合同/PI 模板"
              />
            </el-form-item>
            <el-form-item label="仲裁条款">
              <el-input
                v-model="financeForm.award_clause"
                type="textarea" :rows="4"
                placeholder="Arbitration Award Clause, placed between Beneficiary Bank Details and Arbitration Clause in PI"
              />
            </el-form-item>
            <el-form-item label="电子签章图片">
              <div style="display:flex; align-items:center; gap:12px;">
                <div v-if="financeForm.seal_img" style="position:relative; display:inline-block;">
                  <img :src="financeForm.seal_img" style="max-width:200px; max-height:100px; border:1px solid #e2e8f0; border-radius:4px;" />
                  <el-button size="small" type="danger" link @click="financeForm.seal_img = ''" style="margin-left:6px;">移除</el-button>
                </div>
                <el-upload
                  v-else
                  :show-file-list="false"
                  :before-upload="handleSealImg"
                  accept="image/*"
                >
                  <el-button size="small" type="primary" plain>选择签章图片</el-button>
                </el-upload>
                <span style="font-size:11px; color:#909399;">建议透明背景 PNG，上传后自动压缩为 base64</span>
              </div>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="savingFinance" @click="onSaveFinance">保存参数与模板</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>

    <!-- 3：付款方式字典（payment_terms_dict 表） -->
    <el-card shadow="never" class="page-card bank-card">
      <template #header>
        <div class="bank-header">
          <span class="card-title">💰 付款方式字典</span>
          <el-button type="primary" :icon="Plus" @click="openTermCreate">添加付款方式</el-button>
        </div>
      </template>

      <el-table v-loading="termLoading" :data="termList" border stripe>
        <el-table-column label="付款方式" min-width="400">
          <template #default="{ row }">
            <div class="note-text">{{ row.term_text }}</div>
          </template>
        </el-table-column>
        <el-table-column label="是否默认" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.is_default" type="success" size="small">默认</el-tag>
            <el-button v-else link type="primary" size="small" @click="onSetDefault(row)">设为默认</el-button>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openTermEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="onTermDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="dict-tip">默认付款方式会在新建报价单 / 外销订单时自动填入；下拉中也可临时输入自定义内容。</div>
    </el-card>

    <!-- 付款方式新增/编辑弹窗 -->
    <el-dialog v-model="termDialogVisible" :title="termForm.id ? '编辑付款方式' : '添加付款方式'" width="560px" destroy-on-close :close-on-click-modal="false">
      <el-form ref="termFormRef" :model="termForm" :rules="termRules" label-width="100px">
        <el-form-item label="付款方式" prop="term_text">
          <el-input
            v-model="termForm.term_text"
            type="textarea" :rows="4"
            placeholder="如：30% T/T 定金，70% 见提单副本付清"
          />
        </el-form-item>
        <el-form-item label="设为默认">
          <el-switch v-model="termForm.is_default" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="termDialogVisible = false">取 消</el-button>
        <el-button type="primary" :loading="savingTerm" @click="onTermSave">保 存</el-button>
      </template>
    </el-dialog>

    <!-- 4：多币种银行账户与收款路线库（bank_accounts 表） -->
    <el-card shadow="never" class="page-card bank-card">
      <template #header>
        <div class="bank-header">
          <span class="card-title">🏦 多币种银行账户与收款路线库 (USD / RMB / LC)</span>
          <el-button type="primary" :icon="Plus" @click="openBankCreate">添加收款路线</el-button>
        </div>
      </template>

      <el-table v-loading="bankLoading" :data="bankList" border stripe>
        <el-table-column prop="route_type" label="路线类型" min-width="240" show-overflow-tooltip />
        <el-table-column label="路由备注" min-width="300">
          <template #default="{ row }">
            <div class="note-text">{{ row.routing_note || '—' }}</div>
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
      <el-form ref="bankFormRef" :model="bankForm" :rules="bankRules" label-width="100px">
        <el-form-item label="路线类型" prop="route_type">
          <el-input v-model="bankForm.route_type" placeholder="如：USD 美元付款路线 / RMB 人民币付款路线" />
        </el-form-item>
        <el-form-item label="路由备注">
          <el-input
            v-model="bankForm.routing_note"
            type="textarea" :rows="4"
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
import {
  listPaymentTerms, createPaymentTerm, updatePaymentTerm,
  setDefaultPaymentTerm, deletePaymentTerm
} from '@/api/paymentTerms'

/* ── 企业配置（company_settings 单行表） ── */
const companyFormRef = ref()
const financeFormRef = ref()
const savingCompany = ref(false)
const savingFinance = ref(false)

const companyForm = reactive({
  name_cn: '', name_en: '', address_cn: '', address_en: '', tel: '', email: '', tax_number: '',
  bank_name: '', bank_account: ''
})
const financeForm = reactive({
  default_usd_rate: 7.2, default_tax_refund_rate: 13,
  arbitration_clause: '', award_clause: '', seal_img: ''
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
  financeForm.arbitration_clause = d.arbitration_clause || ''
  financeForm.award_clause = d.award_clause || ''
  financeForm.seal_img = d.seal_img || ''
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

// 电子签章图片上传：压缩为 600px 宽 base64（保持透明 PNG 格式，质量 0.9）
function handleSealImg(file) {
  const MAX_WIDTH = 600
  const reader = new FileReader()
  reader.onload = (evt) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, MAX_WIDTH / img.width)
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      // 保留 PNG 格式以支持透明背景；非 PNG 则回退 JPEG
      const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
      financeForm.seal_img = canvas.toDataURL(outType, 0.9)
      ElMessage.success('签章图片已预览，请点击"保存参数与模板"落库')
    }
    img.src = evt.target.result
  }
  reader.readAsDataURL(file)
  return false // 阻止自动上传，只做本地压缩
}

/* ── 收款路线库（bank_accounts 表） ── */
const bankLoading = ref(false)
const savingBank = ref(false)
const bankList = ref([])
const bankDialogVisible = ref(false)
const bankFormRef = ref()
const bankForm = ref({})

const bankRules = {
  route_type: [{ required: true, message: '请输入路线类型', trigger: 'blur' }]
}

const blankBankForm = () => ({
  route_type: '', routing_note: ''
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
    `确认删除收款路线「${row.route_type}」？`,
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

/* ── 付款方式字典（payment_terms_dict 表） ── */
const termLoading = ref(false)
const savingTerm = ref(false)
const termList = ref([])
const termDialogVisible = ref(false)
const termFormRef = ref()
const termForm = ref({})

const termRules = {
  term_text: [{ required: true, message: '请输入付款方式内容', trigger: 'blur' }]
}

const blankTermForm = () => ({
  term_text: '', is_default: false
})

async function loadTerms() {
  termLoading.value = true
  try {
    const d = await listPaymentTerms()
    termList.value = d.list || []
  } catch {
    /* 拦截器已提示 */
  } finally {
    termLoading.value = false
  }
}

function openTermCreate() {
  termForm.value = blankTermForm()
  termDialogVisible.value = true
}

function openTermEdit(row) {
  termForm.value = { ...row, is_default: !!row.is_default }
  termDialogVisible.value = true
}

async function onTermSave() {
  const valid = await termFormRef.value.validate().catch(() => false)
  if (!valid) return
  savingTerm.value = true
  try {
    if (termForm.value.id) {
      await updatePaymentTerm(termForm.value.id, termForm.value)
      ElMessage.success('更新成功')
    } else {
      await createPaymentTerm(termForm.value)
      ElMessage.success('创建成功')
    }
    termDialogVisible.value = false
    loadTerms()
    loadSettings()
  } catch {
    /* 拦截器已提示 */
  } finally {
    savingTerm.value = false
  }
}

async function onSetDefault(row) {
  try {
    await setDefaultPaymentTerm(row.id)
    ElMessage.success('已设为默认付款方式')
    loadTerms()
    loadSettings()
  } catch {
    /* 拦截器已提示 */
  }
}

async function onTermDelete(row) {
  const ok = await ElMessageBox.confirm(
    `确认删除付款方式「${row.term_text}」？`,
    '删除确认',
    { type: 'warning' }
  ).catch(() => false)
  if (!ok) return
  try {
    await deletePaymentTerm(row.id)
    ElMessage.success('删除成功')
    loadTerms()
    loadSettings()
  } catch {
    /* 拦截器已提示 */
  }
}

onMounted(() => {
  loadSettings()
  loadBanks()
  loadTerms()
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
  color: #606266;
  white-space: pre-wrap;
  line-height: 1.6;
}
.dict-tip {
  margin-top: 10px;
  font-size: 12px;
  color: #909399;
}
</style>
