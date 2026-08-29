import request from './request'

export const listOperators = (params) => request.get('/operators', { params })
export const createOperator = (data) => request.post('/operators', data)
export const updateOperator = (id, data) => request.put(`/operators/${id}`, data)
export const deleteOperator = (id) => request.delete(`/operators/${id}`)
