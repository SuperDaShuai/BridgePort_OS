import request from './request'

export const listHsCodes = (params) => request.get('/hs-codes', { params })
export const getHsCode = (id) => request.get(`/hs-codes/${id}`)
export const createHsCode = (data) => request.post('/hs-codes', data)
export const updateHsCode = (id, data) => request.put(`/hs-codes/${id}`, data)
export const deleteHsCode = (id) => request.delete(`/hs-codes/${id}`)
