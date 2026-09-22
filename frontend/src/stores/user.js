import { defineStore } from 'pinia'
import { login as loginApi } from '@/api/auth'

const TOKEN_KEY = 'bp_token'
const PROFILE_KEY = 'bp_profile'

function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY)) || null
  } catch {
    return null
  }
}

// 登录用户：token + 个人信息持久化到 localStorage
export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) || '',
    profile: loadProfile() // { id, username, display_name, role, permission_level }
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
    displayName: (s) => s.profile?.display_name || s.profile?.username || '',
    permissionLevel: (s) => s.profile?.permission_level ?? 99,
    // 管理员（level <= 1）可编辑/删除，其他员工只读
    canEdit: (s) => (s.profile?.permission_level ?? 99) <= 1,
    // 数据可见性：隐藏采购价与利润字段
    hidePurchaseAndProfit: (s) => !!s.profile?.hide_purchase_and_profit,
    // 数据可见性：隐藏供应商信息
    hideSupplierInfo: (s) => !!s.profile?.hide_supplier_info
  },
  actions: {
    async login(username, password) {
      const d = await loginApi({ username, password })
      this.token = d.token
      this.profile = d.operator
      localStorage.setItem(TOKEN_KEY, d.token)
      localStorage.setItem(PROFILE_KEY, JSON.stringify(d.operator))
    },
    logout() {
      this.token = ''
      this.profile = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(PROFILE_KEY)
    },
    // 权限判断：传数字表示「等级 ≤ 该值」可见；传数组表示「等级在列表内」可见；未传全员可见
    canSee(required) {
      if (required === undefined) return true
      const lvl = this.permissionLevel
      return Array.isArray(required) ? required.includes(lvl) : lvl <= required
    }
  }
})
