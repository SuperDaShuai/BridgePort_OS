import request from './request'

export const listProducts = (params) => request.get('/products', { params })
export const getProduct = (id) => request.get(`/products/${id}`)
export const createProduct = (data) => request.post('/products', data)
export const updateProduct = (id, data) => request.put(`/products/${id}`, data)
export const deleteProduct = (id) => request.delete(`/products/${id}`)

// 产品多图
export const listProductPhotos = (productId) => request.get(`/products/${productId}/photos`)
export const addProductPhoto = (productId, data) => request.post(`/products/${productId}/photos`, data)
export const deleteProductPhoto = (productId, photoId) => request.delete(`/products/${productId}/photos/${photoId}`)
export const sortProductPhotos = (productId, list) => request.put(`/products/${productId}/photos/sort`, list)
