import request from './request'

export const listQuotations = (params) => request.get('/quotations', { params })
export const getQuotation = (id) => request.get(`/quotations/${id}`)
export const createQuotation = (data) => request.post('/quotations', data)
export const updateQuotation = (id, data) => request.put(`/quotations/${id}`, data)
export const deleteQuotation = (id) => request.delete(`/quotations/${id}`)
