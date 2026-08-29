import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import Layout from '@/layout/index.vue'

// 页面路由：meta.permission 为允许访问的最高权限等级（数字越小权限越大），未标注则全员可见
const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      // ── 工作台 ──
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '控制中心 Dashboard' }
      },
      {
        path: 'workbench',
        name: 'Workbench',
        component: () => import('@/views/workbench/index.vue'),
        meta: { title: '订单工作台 (进度追踪)' }
      },
      // ── 商机管理 ──
      {
        path: 'rfq',
        name: 'Rfq',
        component: () => import('@/views/rfq/index.vue'),
        meta: { title: '商机管理 (RFQs)' }
      },
      {
        path: 'quotations',
        name: 'Quotations',
        component: () => import('@/views/quotations/index.vue'),
        meta: { title: '商务报价单 (Quotations)' }
      },
      {
        path: 'samples',
        name: 'Samples',
        component: () => import('@/views/samples/index.vue'),
        meta: { title: '样品管理 (Samples)' }
      },
      // ── 订单 ──
      {
        path: 'orders',
        name: 'Orders',
        component: () => import('@/views/orders/index.vue'),
        meta: { title: '外销订单 (Proforma Invoice)' }
      },
      // ── 供应链采购 ──
      {
        path: 'purchase/contracts',
        name: 'PurchaseContracts',
        component: () => import('@/views/purchase/contracts.vue'),
        meta: { title: '购销合同' }
      },
      {
        path: 'purchase/production-orders',
        name: 'ProductionOrders',
        component: () => import('@/views/purchase/production-orders.vue'),
        meta: { title: '生产任务单 (PO)' }
      },
      // ── 物流与品控 ──
      {
        path: 'shipping',
        name: 'Shipping',
        component: () => import('@/views/shipping/index.vue'),
        meta: { title: '订舱委托书 (Shipping Order)' }
      },
      {
        path: 'qc',
        name: 'Qc',
        component: () => import('@/views/qc/index.vue'),
        meta: { title: '质量检验 (QC质检)' }
      },
      {
        path: 'loadmaster',
        name: 'Loadmaster',
        component: () => import('@/views/loadmaster/index.vue'),
        meta: { title: 'LoadMaster (装柜测算)' }
      },
      // ── 关务单证 ──
      {
        path: 'customs/customs-declaration',
        name: 'CustomsDeclaration',
        component: () => import('@/views/customs/customs-declaration.vue'),
        meta: { title: '出口报关单要素' }
      },
      {
        path: 'customs/clearance-docs',
        name: 'ClearanceDocs',
        component: () => import('@/views/customs/clearance-docs.vue'),
        meta: { title: '目的港清关资料' }
      },
      // ── 财务与分析 ──
      {
        path: 'finance/ledgers',
        name: 'FinanceLedgers',
        component: () => import('@/views/finance/ledgers.vue'),
        meta: { title: '财务核算台账' }
      },
      {
        path: 'analytics',
        name: 'Analytics',
        component: () => import('@/views/analytics/index.vue'),
        meta: { title: 'BI 多维数据分析' }
      },
      // ── 基础母库 ──
      {
        path: 'master/clients',
        name: 'MasterClients',
        component: () => import('@/views/master/clients.vue'),
        meta: { title: '客户管理' }
      },
      {
        path: 'master/products',
        name: 'MasterProducts',
        component: () => import('@/views/master/products.vue'),
        meta: { title: '产品数据库' }
      },
      {
        path: 'master/suppliers',
        name: 'MasterSuppliers',
        component: () => import('@/views/master/suppliers.vue'),
        meta: { title: '供应商管理' }
      },
      {
        path: 'master/bank-accounts',
        name: 'MasterBankAccounts',
        component: () => import('@/views/master/bank-accounts.vue'),
        meta: { title: '银行账户库' }
      },
      // ── 系统管理 ──
      {
        path: 'system/operators',
        name: 'SystemOperators',
        component: () => import('@/views/system/operators.vue'),
        meta: { title: '员工管理', permission: 1 }
      }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 全局路由守卫：未登录跳登录页；权限不足跳回工作台
router.beforeEach((to) => {
  const userStore = useUserStore()
  if (to.path !== '/login' && !userStore.isLoggedIn) return '/login'
  if (to.path === '/login' && userStore.isLoggedIn) return '/dashboard'
  if (to.meta.permission !== undefined && !userStore.canSee(to.meta.permission)) return '/dashboard'
  return true
})

export default router
