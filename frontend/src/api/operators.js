import request from './request'

export const listOperators = (params) => request.get('/operators', { params })
export const createOperator = (data) => request.post('/operators', data)
export const updateOperator = (id, data) => request.put(`/operators/${id}`, data)
export const deleteOperator = (id) => request.delete(`/operators/${id}`)

// 个人中心自助（直接修改，立即生效，修改记录超级管理员可查）
export const getMyProfile = () => request.get('/operators/me')
export const changeMyPassword = (data) => request.post('/operators/me/password', data)
export const changeMyUsername = (data) => request.put('/operators/me/username', data)

// 账户修改记录（超级管理员只读查看）
export const listAccountChangeLogs = () => request.get('/operators/change-logs')
