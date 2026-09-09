import request from './request'

export const getCompanySettings = () => request.get('/company-settings')
export const updateCompanySettings = (data) => request.put('/company-settings', data)
