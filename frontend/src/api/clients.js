import request from './request'

export const listClients = (params) => request.get('/clients', { params })
export const getClient = (id) => request.get(`/clients/${id}`)
export const createClient = (data) => request.post('/clients', data)
export const updateClient = (id, data) => request.put(`/clients/${id}`, data)
export const deleteClient = (id) => request.delete(`/clients/${id}`)
