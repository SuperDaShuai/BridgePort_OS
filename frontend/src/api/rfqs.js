import request from './request'

export const listRfqs = (params) => request.get('/rfqs', { params })
export const getRfq = (id) => request.get(`/rfqs/${id}`)
export const createRfq = (data) => request.post('/rfqs', data)
export const updateRfq = (id, data) => request.put(`/rfqs/${id}`, data)
export const deleteRfq = (id) => request.delete(`/rfqs/${id}`)
