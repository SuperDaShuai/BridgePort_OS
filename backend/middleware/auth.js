const jwt = require('jsonwebtoken');

// JWT 鉴权中间件：校验 Authorization: Bearer <token>，通过后挂载 req.operator
module.exports = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.fail('未登录', 401);
  try {
    req.operator = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.fail('登录已过期，请重新登录', 401);
  }
};
