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

module.exports = { asyncHandler, parsePagination, pickFields };
