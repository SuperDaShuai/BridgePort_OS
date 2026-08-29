import request from './request'

export const listSamples = (params) => request.get('/samples', { params })
export const getSample = (id) => request.get(`/samples/${id}`)
export const createSample = (data) => request.post('/samples', data)
export const updateSample = (id, data) => request.put(`/samples/${id}`, data)
export const deleteSample = (id) => request.delete(`/samples/${id}`)
