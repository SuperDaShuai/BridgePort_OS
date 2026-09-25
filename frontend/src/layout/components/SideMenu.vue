<template>
  <!-- 暗色侧边导航：按参考项目分组结构重新组织 -->
  <el-scrollbar class="menu-scrollbar">
    <el-menu
      :default-active="route.path"
      :default-openeds="openeds"
      router
      background-color="#1f2d3d"
      text-color="#bfcbd9"
      active-text-color="#409eff"
      class="side-menu"
    >
      <!-- 控制中心（业务员不可见） -->
      <el-menu-item v-if="userStore.canSee([1, 2, 4, 5])" index="/dashboard">
        <el-icon><Odometer /></el-icon>
        <span>控制中心 Dashboard</span>
      </el-menu-item>
      <el-menu-item index="/workbench">
        <el-icon><Monitor /></el-icon>
        <span>订单工作台 (进度追踪)</span>
      </el-menu-item>

      <!-- 报价与商机（跟单不可见） -->
      <el-sub-menu v-if="userStore.canSee([1, 2, 3])" index="g-business">
        <template #title>
          <el-icon><Suitcase /></el-icon>
          <span>报价与商机</span>
        </template>
        <el-menu-item index="/rfq">商机管理 (RFQs)</el-menu-item>
        <el-menu-item index="/quotations">商务报价单 (Quotations)</el-menu-item>
      </el-sub-menu>

      <!-- 履约和业务单据 -->
      <el-sub-menu index="g-fulfillment">
        <template #title>
          <el-icon><Document /></el-icon>
          <span>履约和业务单据</span>
        </template>
        <el-menu-item index="/samples">样品管理 (Samples)</el-menu-item>
        <el-menu-item index="/orders">外销订单 (Proforma Invoice)</el-menu-item>
        <el-menu-item v-if="userStore.canSee([1, 2, 4, 5])" index="/purchase/contracts">购销合同</el-menu-item>
        <el-menu-item v-if="userStore.canSee([1, 2, 5])" index="/purchase/production-orders">生产任务单 (PO)</el-menu-item>
        <el-menu-item v-if="userStore.canSee([1, 2, 5])" index="/shipping">订舱委托书 (Shipping Order)</el-menu-item>
        <el-menu-item v-if="userStore.canSee([1, 2, 5])" index="/customs/customs-declaration">出口报关单要素</el-menu-item>
        <el-menu-item index="/customs/clearance-docs">目的港清关资料</el-menu-item>
      </el-sub-menu>

      <!-- 质量检验（业务员/跟单不可见） -->
      <el-sub-menu v-if="userStore.canSee([1, 2])" index="g-qc">
        <template #title>
          <el-icon><Checked /></el-icon>
          <span>质量检验</span>
        </template>
        <el-menu-item index="/qc">质量检验 (QC质检)</el-menu-item>
      </el-sub-menu>

      <!-- 外贸实用工具（业务员/跟单不可见） -->
      <el-sub-menu v-if="userStore.canSee([1, 2])" index="g-tools">
        <template #title>
          <el-icon><Tools /></el-icon>
          <span>外贸实用工具</span>
        </template>
        <el-menu-item index="/loadmaster">LoadMaster (装柜测算)</el-menu-item>
      </el-sub-menu>

      <!-- 财务与数据分析（业务员/跟单不可见） -->
      <el-sub-menu v-if="userStore.canSee([1, 2, 4])" index="g-finance">
        <template #title>
          <el-icon><Coin /></el-icon>
          <span>财务与数据分析</span>
        </template>
        <el-menu-item index="/finance/ledgers">财务核算台账</el-menu-item>
        <el-menu-item index="/analytics">BI 多维数据分析</el-menu-item>
      </el-sub-menu>

      <!-- 基础母库（跟单不可见） -->
      <el-sub-menu v-if="userStore.canSee([1, 2, 3])" index="g-master">
        <template #title>
          <el-icon><Grid /></el-icon>
          <span>基础母库</span>
        </template>
        <el-menu-item v-if="userStore.canSee([1, 2, 3])" index="/master/clients">客户管理</el-menu-item>
        <el-menu-item v-if="userStore.canSee([1, 2, 3])" index="/master/products">产品数据库</el-menu-item>
        <el-menu-item v-if="userStore.canSee([1, 2, 3])" index="/master/hs-codes">HS编码库</el-menu-item>
        <el-menu-item v-if="userStore.canSee([1, 2, 4])" index="/master/suppliers">供应商管理</el-menu-item>

      </el-sub-menu>

      <!-- 系统管理：仅超级管理员可见（meta.permission=1） -->
      <el-sub-menu v-if="userStore.canSee(1)" index="g-system">
        <template #title>
          <el-icon><Setting /></el-icon>
          <span>系统管理</span>
        </template>
        <el-menu-item index="/system/company-settings">企业配置</el-menu-item>
        <el-menu-item index="/system/operators">员工管理</el-menu-item>
      </el-sub-menu>
    </el-menu>
  </el-scrollbar>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import {
  Odometer, Monitor, Suitcase, Document, Checked,
  Tools, Coin, Grid, Setting
} from '@element-plus/icons-vue'

const route = useRoute()
const userStore = useUserStore()

// 默认展开所有分组
const openeds = ['g-business', 'g-fulfillment', 'g-qc', 'g-tools', 'g-finance', 'g-master', 'g-system']
</script>

<style scoped>
.menu-scrollbar {
  flex: 1;
}
.side-menu {
  border-right: none;
}
/* 子菜单背景加深一档，保持暗色层次 */
.side-menu :deep(.el-menu-item.is-active) {
  background-color: rgba(64, 158, 255, 0.12);
}
</style>
