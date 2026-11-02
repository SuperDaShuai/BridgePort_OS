-- 052 密码修改申请表（申请-审批制：员工发起申请，超级管理员审批通过后新密码生效）
CREATE TABLE IF NOT EXISTS password_change_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  operator_id INT NOT NULL COMMENT '申请修改密码的操作员ID',
  new_password_hash VARCHAR(255) NOT NULL COMMENT '新密码哈希（审批通过后写入 operators）',
  status ENUM('待审批','已通过','已驳回') NOT NULL DEFAULT '待审批',
  remark VARCHAR(255) NULL DEFAULT NULL COMMENT '审批备注（驳回原因等）',
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '申请时间',
  handled_by INT NULL DEFAULT NULL COMMENT '审批人ID（超级管理员）',
  handled_at DATETIME NULL DEFAULT NULL COMMENT '审批时间',
  KEY idx_pcr_operator (operator_id),
  KEY idx_pcr_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='密码修改申请（超级管理员审批制）';
