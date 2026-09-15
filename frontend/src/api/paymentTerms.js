import request from './request'

export const listPaymentTerms = () => request.get('/payment-terms')
export const createPaymentTerm = (data) => request.post('/payment-terms', data)
export const updatePaymentTerm = (id, data) => request.put(`/payment-terms/${id}`, data)
export const setDefaultPaymentTerm = (id) => request.patch(`/payment-terms/${id}/default`)
export const deletePaymentTerm = (id) => request.delete(`/payment-terms/${id}`)
