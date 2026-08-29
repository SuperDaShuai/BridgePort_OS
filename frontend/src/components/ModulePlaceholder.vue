<template>
  <el-card shadow="never" class="module-placeholder">
    <template #header>
      <div class="module-header">
        <span class="module-title">{{ title }}</span>
        <el-tag type="info" size="small">开发中</el-tag>
      </div>
    </template>
    <el-empty :image-size="140">
      <template #description>
        <p class="module-name">{{ title }}</p>
        <p class="module-desc">{{ desc }}</p>
      </template>
    </el-empty>
  </el-card>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  desc: { type: String, default: '' }
})
</script>

<style scoped>
.module-placeholder {
  min-height: calc(100vh - 140px);
}
.module-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.module-title {
  font-size: 16px;
  font-weight: 600;
}
.module-name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.module-desc {
  margin: 8px 0 0;
  font-size: 13px;
  color: #909399;
}
</style>
