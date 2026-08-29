<template>
  <el-container class="layout">
    <!-- 左侧暗色侧边栏 -->
    <el-aside width="220px" class="layout-aside">
      <div class="layout-logo">
        <span class="logo-mark">BP</span>
        <span class="logo-text">BridgePort OS</span>
      </div>
      <SideMenu />
    </el-aside>

    <el-container class="layout-body">
      <!-- 顶部：面包屑 + 当前用户 -->
      <el-header class="layout-header" height="56px">
        <AppHeader />
      </el-header>

      <!-- 主内容区 -->
      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import SideMenu from './components/SideMenu.vue'
import AppHeader from './components/AppHeader.vue'
</script>

<style scoped>
.layout {
  height: 100%;
}
.layout-aside {
  display: flex;
  flex-direction: column;
  background-color: #1f2d3d;
  transition: width 0.2s;
}
.layout-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  padding: 0 18px;
  background-color: #16222f;
  flex-shrink: 0;
}
.logo-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  background: linear-gradient(135deg, #409eff, #2f6fbf);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.logo-text {
  color: #e5eaf3;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.3px;
  white-space: nowrap;
}
.layout-body {
  min-width: 0;
}
.layout-header {
  display: flex;
  align-items: center;
  background-color: #fff;
  border-bottom: 1px solid #e6e8eb;
}
.layout-main {
  padding: 16px;
  background-color: #f0f2f5;
  overflow-y: auto;
}
</style>
