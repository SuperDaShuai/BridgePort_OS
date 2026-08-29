<template>
  <div class="login-page">
    <el-card class="login-card" shadow="always">
      <div class="login-logo">
        <span class="logo-mark">BP</span>
        <div>
          <div class="logo-title">BridgePort OS</div>
          <div class="logo-sub">外贸全生命周期管理系统</div>
        </div>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" size="large" @keyup.enter="onLogin">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" :prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="密码"
            :prefix-icon="Lock"
          />
        </el-form-item>
        <el-button
          class="login-btn"
          type="primary"
          size="large"
          :loading="loading"
          @click="onLogin"
        >
          登 录
        </el-button>
      </el-form>

      <p class="login-tip">初始管理员：admin / admin123，首次登录后请及时修改密码</p>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Lock, User } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const formRef = ref()
const loading = ref(false)
const form = reactive({ username: '', password: '' })
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function onLogin() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    await userStore.login(form.username, form.password)
    ElMessage.success('登录成功')
    router.push('/dashboard')
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: linear-gradient(135deg, #16222f 0%, #1f2d3d 45%, #2b4a6b 100%);
}
.login-card {
  width: 400px;
  border-radius: 10px;
  padding: 8px 12px 4px;
}
.login-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 26px;
}
.logo-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: linear-gradient(135deg, #409eff, #2f6fbf);
  color: #fff;
  font-size: 18px;
  font-weight: 700;
}
.logo-title {
  font-size: 20px;
  font-weight: 700;
  color: #303133;
}
.logo-sub {
  margin-top: 2px;
  font-size: 12px;
  color: #909399;
}
.login-btn {
  width: 100%;
  margin-top: 4px;
}
.login-tip {
  margin: 14px 0 4px;
  font-size: 12px;
  color: #909399;
  text-align: center;
}
</style>
