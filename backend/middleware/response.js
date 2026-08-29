// 统一 JSON 返回格式：{ code, data, msg }
// 成功: res.success(data)  失败: res.fail(msg, code)
function responseMiddleware(req, res, next) {
  res.success = (data = null, msg = 'success', code = 200) => {
    res.json({ code, data, msg });
  };
  res.fail = (msg = '服务器内部错误', code = 500, data = null) => {
    res.json({ code, data, msg });
  };
  next();
}

module.exports = responseMiddleware;
