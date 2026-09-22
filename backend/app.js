require('dotenv').config();
const express = require('express');
const cors = require('cors');
const responseMiddleware = require('./middleware/response');
const auth = require('./middleware/auth');
const pool = require('./config/db');

const app = express();

// 中间件
app.use(cors());
// JSON 请求体上限提升至 10MB（报价单/订单明细含多条 base64 图片快照，默认 100KB 不够用）
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(responseMiddleware);

// 健康检查：验证服务与数据库连通性（保持公开，便于探活）
app.get('/api/health', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.success({ db: 'connected' });
  } catch (err) {
    next(err);
  }
});

// 认证接口（login 公开，profile 内部自带鉴权）
app.use('/api/auth', require('./routes/auth.routes'));

// 以下业务接口统一需要登录
app.use(auth);

// 基础层路由
app.use('/api/clients', require('./routes/clients.routes'));
app.use('/api/suppliers', require('./routes/suppliers.routes'));
app.use('/api/products', require('./routes/products.routes'));
app.use('/api/hs-codes', require('./routes/hs-codes.routes'));
app.use('/api/payment-terms', require('./routes/payment-terms.routes'));
app.use('/api/bank-accounts', require('./routes/bank-accounts.routes'));
app.use('/api/operators', require('./routes/operators.routes'));
app.use('/api/company-settings', require('./routes/company-settings.routes'));

// 商机漏斗层
app.use('/api/rfqs', require('./routes/rfqs.routes'));
app.use('/api/quotations', require('./routes/quotations.routes'));
app.use('/api/samples', require('./routes/samples.routes'));
app.use('/api/orders', require('./routes/orders.routes'));

// 操作日志（只读查询）
app.use('/api/operation-logs', require('./routes/operation-logs.routes'));

// 404 兜底
app.use((req, res) => {
  res.fail(`接口不存在: ${req.method} ${req.originalUrl}`, 404);
});

// 全局错误处理（含 MySQL 错误码友好化映射）
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  // responseMiddleware 挂载在 Express 5 router 层，全局错误链上可能 res.fail 不存在
  // 用 fallback 保证所有错误都能返回结构化 JSON 而不是 HTML
  const send = res.fail
    ? res.fail.bind(res)
    : (msg, code = 500) => res.status(code).json({ code, msg });

  if (err.type === 'entity.too.large' || err.type === 'payload.too.large' || err.code === 'ERR_PAYLOAD_TOO_LARGE') {
    return send('请求体过大：报价单/订单明细含图片时请减少图片数量或压缩图片大小（上限 10MB）', 413);
  }
  if (err.code === 'ER_DUP_ENTRY') {
    return send('唯一性冲突：编号或名称已存在', 409);
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return send('关联记录不存在（外键校验失败）', 400);
  }
  if (err.code === 'ER_NO_DEFAULT_FOR_FIELD' || err.code === 'ER_BAD_NULL_ERROR') {
    return send('缺少必填字段', 400);
  }
  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    return send('该记录已被业务单据引用，无法删除', 409);
  }
  if (err.type === 'entity.parse.failed') {
    return send('请求体格式错误', 400);
  }
  send(err.message || '服务器内部错误', 500);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
