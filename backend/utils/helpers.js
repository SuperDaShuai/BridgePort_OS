// 公共助手：异步包装 / 分页解析 / 字段白名单过滤
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function parsePagination(req) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

// 只保留允许写入的列，防止越权字段注入（如 id/created_at）
function pickFields(body, allowed) {
  const out = {};
  for (const k of allowed) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  return out;
}

// 数据归属过滤：权限等级 3（业务员）只能看到/操作自己创建的记录
// 等级 1(超级管理员)/2(业务主管)/4(财务跟单) 不做隔离
function isScopedOperator(req) {
  return Number(req.operator?.permission_level) === 3;
}

// 归属校验：业务员操作非本人记录时返回 404（不暴露记录存在性）
function checkOwnership(row, req, label) {
  if (isScopedOperator(req) && row?.owner_id !== req.operator.id) {
    return `${label || '记录'}不存在或无权操作`;
  }
  return null;
}

module.exports = { asyncHandler, parsePagination, pickFields, isScopedOperator, checkOwnership };
