import request from './request'

export const listSuppliers = (params) => request.get('/suppliers', { params })
export const getSupplier = (id) => request.get(`/suppliers/${id}`)
export const createSupplier = (data) => request.post('/suppliers', data)
export const updateSupplier = (id, data) => request.put(`/suppliers/${id}`, data)
export const deleteSupplier = (id) => request.delete(`/suppliers/${id}`)
