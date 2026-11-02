// accessories.js — 拦截器已剥 res.data，这里直接 return request
import request from './request'

// ========== 分类 ==========
export const listCategories = () => request.get('/accessories/categories')
export const createCategory = (data) => request.post('/accessories/categories', data)
export const updateCategory = (id, data) => request.put(`/accessories/categories/${id}`, data)
export const deleteCategory = (id) => request.delete(`/accessories/categories/${id}`)

// ========== 配件 ==========
export const listAccessories = (params) => request.get('/accessories', { params })
export const createAccessory = (data) => request.post('/accessories', data)
export const updateAccessory = (id, data) => request.put(`/accessories/${id}`, data)
export const deleteAccessory = (id) => request.delete(`/accessories/${id}`)
