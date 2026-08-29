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
    permissionLevel: (s) => s.profile?.permission_level ?? 99
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
    // 权限判断：等级数字越小权限越大；未标注 permission 的路由/菜单全员可见
    canSee(requiredLevel) {
      return requiredLevel === undefined || this.permissionLevel <= requiredLevel
    }
  }
})
