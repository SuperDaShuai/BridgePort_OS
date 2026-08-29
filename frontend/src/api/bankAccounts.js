import request from './request'

export const listBankAccounts = (params) => request.get('/bank-accounts', { params })
export const createBankAccount = (data) => request.post('/bank-accounts', data)
export const updateBankAccount = (id, data) => request.put(`/bank-accounts/${id}`, data)
export const deleteBankAccount = (id) => request.delete(`/bank-accounts/${id}`)
