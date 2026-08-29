<template>
  <!-- 暗色侧边导航：与 19 个页面路由一一对应 -->
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
      <el-menu-item index="/dashboard">
        <el-icon><Odometer /></el-icon>
        <span>控制中心 Dashboard</span>
      </el-menu-item>
      <el-menu-item index="/workbench">
        <el-icon><Monitor /></el-icon>
        <span>订单工作台 (进度追踪)</span>
      </el-menu-item>

      <el-sub-menu index="g-business">
        <template #title>
          <el-icon><Suitcase /></el-icon>
          <span>商机管理</span>
        </template>
        <el-menu-item index="/rfq">商机管理 (RFQs)</el-menu-item>
        <el-menu-item index="/quotations">商务报价单 (Quotations)</el-menu-item>
        <el-menu-item index="/samples">样品管理 (Samples)</el-menu-item>
      </el-sub-menu>

      <el-menu-item index="/orders">
        <el-icon><Document /></el-icon>
        <span>外销订单 (Proforma Invoice)</span>
      </el-menu-item>

      <el-sub-menu index="g-purchase">
        <template #title>
          <el-icon><ShoppingCart /></el-icon>
          <span>供应链采购</span>
        </template>
        <el-menu-item index="/purchase/contracts">购销合同</el-menu-item>
        <el-menu-item index="/purchase/production-orders">生产任务单 (PO)</el-menu-item>
      </el-sub-menu>

      <el-sub-menu index="g-logistics">
        <template #title>
          <el-icon><Van /></el-icon>
          <span>物流与品控</span>
        </template>
        <el-menu-item index="/shipping">订舱委托书 (Shipping Order)</el-menu-item>
        <el-menu-item index="/qc">质量检验 (QC质检)</el-menu-item>
        <el-menu-item index="/loadmaster">LoadMaster (装柜测算)</el-menu-item>
      </el-sub-menu>

      <el-sub-menu index="g-customs">
        <template #title>
          <el-icon><Stamp /></el-icon>
          <span>关务单证套件</span>
        </template>
        <el-menu-item index="/customs/customs-declaration">出口报关单要素</el-menu-item>
        <el-menu-item index="/customs/clearance-docs">目的港清关资料</el-menu-item>
      </el-sub-menu>

      <el-sub-menu index="g-finance">
        <template #title>
          <el-icon><Coin /></el-icon>
          <span>财务与数据</span>
        </template>
        <el-menu-item index="/finance/ledgers">财务核算台账</el-menu-item>
        <el-menu-item index="/analytics">BI 多维数据分析</el-menu-item>
      </el-sub-menu>

      <el-sub-menu index="g-master">
        <template #title>
          <el-icon><Grid /></el-icon>
          <span>基础母库</span>
        </template>
        <el-menu-item index="/master/clients">客户管理</el-menu-item>
        <el-menu-item index="/master/products">产品数据库</el-menu-item>
        <el-menu-item index="/master/suppliers">供应商管理</el-menu-item>
        <el-menu-item index="/master/bank-accounts">银行账户库</el-menu-item>
      </el-sub-menu>

      <!-- 系统管理：仅超级管理员可见（meta.permission=1） -->
      <el-sub-menu v-if="userStore.canSee(1)" index="g-system">
        <template #title>
          <el-icon><Setting /></el-icon>
          <span>系统管理</span>
        </template>
        <el-menu-item index="/system/operators">员工管理</el-menu-item>
      </el-sub-menu>
    </el-menu>
  </el-scrollbar>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const userStore = useUserStore()

// 默认展开所有分组
const openeds = ['g-business', 'g-purchase', 'g-logistics', 'g-customs', 'g-finance', 'g-master', 'g-system']
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
