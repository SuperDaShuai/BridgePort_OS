import request from './request'

export const listQuotations = (params) => request.get('/quotations', { params })
export const getQuotation = (id) => request.get(`/quotations/${id}`)
export const createQuotation = (data) => request.post('/quotations', data)
export const updateQuotation = (id, data) => request.put(`/quotations/${id}`, data)
export const deleteQuotation = (id) => request.delete(`/quotations/${id}`)
export const getNextQuotationNumber = () => request.get('/quotations/next-number')
// 转 PI：报价单转为正式外贸订单（事务接口），data 携带报关责任 customs_responsibility
export const convertQuotationToOrder = (id, data) =>
  request.post(`/quotations/${id}/convert-to-order`, data || {})
