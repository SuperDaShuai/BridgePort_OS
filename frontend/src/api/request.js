import axios from 'axios'
import { ElMessage } from 'element-plus'

// 统一 axios 实例：后端统一返回 { code, data, msg }
const request = axios.create({
  baseURL: '/api',
  timeout: 15000
})

request.interceptors.request.use((config) => {
  // 附带 JWT
  const token = localStorage.getItem('bp_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

request.interceptors.response.use(
  (response) => {
    const res = response.data
    // 登录过期/未登录：清理本地凭证并跳转登录页
    if (res.code === 401) {
      localStorage.removeItem('bp_token')
      localStorage.removeItem('bp_profile')
      if (window.location.pathname !== '/login') {
        ElMessage.error(res.msg || '请先登录')
        window.location.href = '/login'
      }
      return Promise.reject(new Error(res.msg || '未登录'))
    }
    if (res.code !== 200) {
      ElMessage.error(res.msg || '请求失败')
      return Promise.reject(new Error(res.msg || '请求失败'))
    }
    return res.data
  },
  (error) => {
    ElMessage.error(
      error.code === 'ECONNABORTED' ? '请求超时' : '网络异常，请确认后端服务已启动'
    )
    return Promise.reject(error)
  }
)

export default request
