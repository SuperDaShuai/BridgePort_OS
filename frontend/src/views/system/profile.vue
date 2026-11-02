<template>
  <el-card shadow="never" class="page-card">
    <h2 class="page-title">个人中心</h2>

    <el-row :gutter="16">
      <!-- 左：账户信息 -->
      <el-col :span="10">
        <el-card shadow="never">
          <template #header><b>账户信息</b></template>
          <el-descriptions :column="1" border v-loading="loading">
            <el-descriptions-item label="登录账号">{{ profile.username || '—' }}</el-descriptions-item>
            <el-descriptions-item label="姓名">{{ profile.display_name || '—' }}</el-descriptions-item>
            <el-descriptions-item label="角色">{{ profile.role || '—' }}</el-descriptions-item>
            <el-descriptions-item label="手机号">{{ profile.phone || '—' }}</el-descriptions-item>
            <el-descriptions-item label="邮箱">{{ profile.email || '—' }}</el-descriptions-item>
            <el-descriptions-item label="权限等级">
              <el-tag :type="levelMap[profile.permission_level]?.type || 'info'" size="small">
                {{ levelMap[profile.permission_level]?.label || `等级${profile.permission_level}` }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ (profile.created_at || '').slice(0, 10) || '—' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>

      <!-- 右：修改密码 / 修改登录账号（直接生效，修改记录超级管理员可查） -->
      <el-col :span="14">
        <el-card shadow="never" class="mb-card">
          <template #header>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <b>修改账户密码</b>
              <span style="font-size:12px; color:#909399;">修改后立即生效，无需审批</span>
            </div>
          </template>
          <el-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" label-width="90px">
            <el-form-item label="旧密码" prop="old_password">
              <el-input v-model="pwdForm.old_password" type="password" show-password autocomplete="off" />
            </el-form-item>
            <el-form-item label="新密码" prop="new_password">
              <el-input v-model="pwdForm.new_password" type="password" show-password autocomplete="off" placeholder="至少 6 位" />
            </el-form-item>
            <el-form-item label="确认新密码" prop="confirm_password">
              <el-input v-model="pwdForm.confirm_password" type="password" show-password autocomplete="off" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="pwdSubmitting" @click="onSubmitPwd">确认修改</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <b>修改登录账号</b>
              <span style="font-size:12px; color:#909399;">修改后立即生效，下次登录使用新账号</span>
            </div>
          </template>
          <el-form ref="unameFormRef" :model="unameForm" :rules="unameRules" label-width="90px">
            <el-form-item label="当前账号">
              <el-input :model-value="profile.username" disabled />
            </el-form-item>
            <el-form-item label="新登录账号" prop="new_username">
              <el-input v-model="unameForm.new_username" placeholder="2-50 位，且不能与已有账号重复" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="unameSubmitting" @click="onSubmitUname">确认修改</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-alert
          title="所有修改即时生效并记录在案，超级管理员可在员工管理中查看修改记录"
          type="info"
          :closable="false"
          show-icon
          style="margin-top: 16px;"
        />
      </el-col>
    </el-row>
  </el-card>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getMyProfile, changeMyPassword, changeMyUsername } from '@/api/operators'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const levelMap = {
  1: { label: '超级管理员', type: 'danger' },
  2: { label: '业务主管', type: 'warning' },
  3: { label: '业务员', type: 'primary' },
  4: { label: '财务跟单', type: 'success' },
  5: { label: '财务/跟单', type: 'info' }
}

const loading = ref(false)
const profile = ref({})

/* ===== 修改密码 ===== */
const pwdSubmitting = ref(false)
const pwdFormRef = ref()
const pwdForm = reactive({ old_password: '', new_password: '', confirm_password: '' })
const pwdRules = {
  old_password: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  new_password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '新密码长度不能少于 6 位', trigger: 'blur' }
  ],
  confirm_password: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== pwdForm.new_password) callback(new Error('两次输入的新密码不一致'))
        else callback()
      },
      trigger: 'blur'
    }
  ]
}

async function onSubmitPwd() {
  const valid = await pwdFormRef.value.validate().catch(() => false)
  if (!valid) return
  if (pwdForm.old_password === pwdForm.new_password) {
    ElMessage.warning('新密码不能与旧密码相同')
    return
  }
  pwdSubmitting.value = true
  try {
    await changeMyPassword({
      old_password: pwdForm.old_password,
      new_password: pwdForm.new_password
    })
    ElMessage.success('密码已修改，下次登录请使用新密码')
    pwdForm.old_password = ''
    pwdForm.new_password = ''
    pwdForm.confirm_password = ''
  } catch { /* 拦截器已提示 */ }
  finally { pwdSubmitting.value = false }
}

/* ===== 修改登录账号 ===== */
const unameSubmitting = ref(false)
const unameFormRef = ref()
const unameForm = reactive({ new_username: '' })
const unameRules = {
  new_username: [
    { required: true, message: '请输入新登录账号', trigger: 'blur' },
    { min: 2, max: 50, message: '登录账号长度需在 2-50 位之间', trigger: 'blur' }
  ]
}

async function onSubmitUname() {
  const valid = await unameFormRef.value.validate().catch(() => false)
  if (!valid) return
  if (unameForm.new_username.trim() === profile.value.username) {
    ElMessage.warning('新登录账号与当前账号相同')
    return
  }
  unameSubmitting.value = true
  try {
    const d = await changeMyUsername({
      new_username: unameForm.new_username
    })
    ElMessage.success('登录账号已修改，下次登录请使用新账号')
    if (d?.username) {
      profile.value.username = d.username
      // 同步本地缓存，避免侧边栏/头部显示旧账号
      if (userStore.profile) userStore.profile.username = d.username
    }
    unameForm.new_username = ''
  } catch { /* 拦截器已提示 */ }
  finally { unameSubmitting.value = false }
}

onMounted(async () => {
  loading.value = true
  try {
    profile.value = (await getMyProfile()) || {}
  } catch { /* 拦截器已提示 */ }
  finally { loading.value = false }
})
</script>

<style scoped>
.mb-card {
  margin-bottom: 16px;
}
</style>
