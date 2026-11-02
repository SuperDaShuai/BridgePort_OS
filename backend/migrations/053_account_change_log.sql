-- 053 账户修改记录表升级：申请-审批制 → 直接修改 + 记录制
-- action: 密码修改 / 登录账号修改；detail: 账号修改前后对照；密码哈希不再需要存储（修改即时生效），放宽为 NULL
ALTER TABLE password_change_requests
  ADD COLUMN action VARCHAR(20) NOT NULL DEFAULT '密码修改' COMMENT '动作: 密码修改/登录账号修改' AFTER operator_id,
  ADD COLUMN detail VARCHAR(255) NULL DEFAULT NULL COMMENT '修改详情(登录账号 xxx → yyy)' AFTER action;

ALTER TABLE password_change_requests
  MODIFY COLUMN new_password_hash VARCHAR(255) NULL DEFAULT NULL COMMENT '新密码哈希（历史申请-审批制遗留，现已不使用）';

-- 历史遗留的待审批申请作废（审批制已取消，改为本人直接修改 + 修改记录制）
UPDATE password_change_requests
  SET status = '已驳回', remark = '系统升级：密码修改已改为本人直接修改，无需审批'
  WHERE status = '待审批';
