import request from './request'

export const listClients = (params) => request.get('/clients', { params })
export const getClient = (id) => request.get(`/clients/${id}`)
export const createClient = (data) => request.post('/clients', data)
export const updateClient = (id, data) => request.put(`/clients/${id}`, data)
export const deleteClient = (id) => request.delete(`/clients/${id}`)
export const listSalesPeople = () => request.get('/clients/sales-people')
export const assignClient = (id, owner_id) => request.put(`/clients/${id}/assign`, { owner_id })
export const batchAssignClients = (ids, owner_id) => request.put('/clients/batch-assign', { ids, owner_id })
