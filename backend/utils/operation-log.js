const pool = require('../config/db');

/**
 * 操作日志记录：谁(操作员)在什么时间对哪个模块的哪条单据做了新增/修改
 *
 * @param {object|null} conn  事务连接（传入则与业务写入同一事务，业务回滚日志一并回滚）；无事务时传 null 走连接池
 * @param {object} opts
 * @param {string} opts.module    模块标识: rfq / quotation / sample / order
 * @param {string} opts.action    动作: 新增 / 修改
 * @param {number} opts.targetId  业务记录主键 ID
 * @param {string} opts.targetNo  业务编号（询盘号/报价单号/样品单号/PI 号）
 * @param {object} opts.operator  req.operator（JWT 解析出的当前登录人）
 */
async function logOperation(conn, { module, action, targetId, targetNo, operator }) {
  const executor = conn || pool;
  try {
    await executor.query(
      `INSERT INTO operation_logs
       (operator_id, operator_name, operator_display, module, action, target_no, target_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        operator?.id ?? null,
        operator?.username || '未知',
        operator?.display_name || null,
        module,
        action,
        targetNo || null,
        targetId ?? null
      ]
    );
  } catch (e) {
    // 日志失败不阻断业务，仅打印便于排查
    console.error('[operation-log] 写入失败:', e.message);
  }
}

// 创建人姓名：优先显示名，回退账号名（用于业务表 owner_name 自动写入）
function ownerOf(operator) {
  return operator?.display_name || operator?.username || null;
}

module.exports = { logOperation, ownerOf };
