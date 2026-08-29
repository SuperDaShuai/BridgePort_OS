<template>
  <div class="app-header">
    <!-- 面包屑：跟随当前路由 -->
    <el-breadcrumb separator="/" class="breadcrumb">
      <el-breadcrumb-item
        v-for="item in breadcrumbs"
        :key="item.path"
        :to="item.redirect || item.path"
      >
        {{ item.meta.title }}
      </el-breadcrumb-item>
    </el-breadcrumb>

    <!-- 当前登录用户 -->
    <el-dropdown trigger="click">
      <div class="user-box">
        <el-avatar :size="30" class="user-avatar">
          {{ (userStore.displayName || 'U').charAt(0) }}
        </el-avatar>
        <span class="user-name">{{ userStore.displayName }}</span>
        <el-tag v-if="userStore.profile?.role" size="small" type="info" class="user-role">
          {{ userStore.profile.role }}
        </el-tag>
        <el-icon class="user-caret"><ArrowDown /></el-icon>
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item disabled>个人中心</el-dropdown-item>
          <el-dropdown-item divided @click="onLogout">退出登录</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

// 取匹配路由链上的 title 作为面包屑（Layout 提供「首页」层级）
const breadcrumbs = computed(() =>
  route.matched.filter((item) => item.meta && item.meta.title)
)

function onLogout() {
  userStore.logout()
  ElMessage.success('已退出登录')
  router.push('/login')
}
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  padding: 0 20px;
}
.breadcrumb {
  font-size: 14px;
}
.user-box {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background-color 0.2s;
}
.user-box:hover {
  background-color: #f5f7fa;
}
.user-avatar {
  background-color: #409eff;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}
.user-name {
  font-size: 13px;
  color: #303133;
}
.user-caret {
  font-size: 12px;
  color: #909399;
}
</style>
