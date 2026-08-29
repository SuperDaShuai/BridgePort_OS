-- 002_auth_permission.sql
-- 员工权限体系：权限等级 + 基础资料列，并种入默认管理员

ALTER TABLE operators
  ADD COLUMN display_name VARCHAR(100) DEFAULT NULL AFTER username,
  ADD COLUMN phone VARCHAR(50) DEFAULT NULL AFTER role,
  ADD COLUMN email VARCHAR(100) DEFAULT NULL AFTER phone,
  ADD COLUMN permission_level TINYINT NOT NULL DEFAULT 3 COMMENT '权限等级 1=超级管理员 2=业务主管 3=业务员 4=财务跟单' AFTER email,
  ADD COLUMN status TINYINT NOT NULL DEFAULT 1 COMMENT '1=启用 0=禁用' AFTER permission_level;

-- 默认管理员：admin / admin123（bcrypt, cost=10）
INSERT INTO operators (username, display_name, role, permission_level, password_hash, status)
VALUES ('admin', '系统管理员', '超级管理员', 1, '$2b$10$8p4OTrJUMIFJFoZDo4ja1ecCL6VeIQknWqvU//8G/WYCg.B27UUxK', 1);
