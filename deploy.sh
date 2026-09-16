#!/bin/bash
# ============================================================
# BridgePort OS · 服务器一键部署脚本
# 用法: 在服务器上执行  bash deploy.sh
# 前提: /var/www/bridgeport-os 已关联 GitHub 仓库, backend/.env 已配置
# 步骤: 备份数据库 → git pull → 后端依赖 → 数据库迁移 → 前端构建 → 重启服务
# ============================================================
set -e

APP_DIR="/var/www/bridgeport-os"
BACKUP_DIR="$APP_DIR/backups"
PM2_APP="bridgeport-api"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
step() { echo -e "\n${GREEN}==> $1${NC}"; }
warn() { echo -e "${YELLOW}!  $1${NC}"; }
fail() { echo -e "${RED}x $1${NC}"; exit 1; }

[ -d "$APP_DIR" ] || fail "目录不存在: $APP_DIR"

# 读取 backend/.env 中的数据库配置（用于备份与健康检查端口）
set -a; source "$APP_DIR/backend/.env" 2>/dev/null || warn "未找到 backend/.env，跳过环境变量注入"; set +a
DB_NAME="${DB_NAME:-trade_system}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
PORT="${PORT:-3000}"

# ---------- 1/6 备份数据库 ----------
step "1/6 备份数据库（老数据保护）"
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_backup_${STAMP}.sql"
if command -v mysqldump >/dev/null 2>&1; then
  # --single-transaction: InnoDB 一致性快照，不锁表不影响线上
  MYSQL_PWD="$DB_PASSWORD" mysqldump -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" \
    --single-transaction --triggers --routines "$DB_NAME" > "$BACKUP_FILE" \
    && echo "   备份完成: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))" \
    || fail "数据库备份失败，中止部署（未动任何代码）"
else
  warn "未找到 mysqldump，跳过备份（不建议）"
fi
# 只保留最近 10 份备份
ls -1t "$BACKUP_DIR"/${DB_NAME}_backup_*.sql 2>/dev/null | tail -n +11 | xargs -r rm -f

# ---------- 2/6 拉取最新代码 ----------
step "2/6 拉取最新代码 (git pull)"
cd "$APP_DIR"
git pull || fail "git pull 失败（若提示本地文件冲突，先处理冲突再重跑本脚本）"

# ---------- 3/6 后端依赖 ----------
step "3/6 安装后端生产依赖"
cd "$APP_DIR/backend"
npm install --omit=dev

# ---------- 4/6 数据库迁移 ----------
step "4/6 数据库结构迁移（幂等，重复执行安全，老数据只增不改不删）"
node migrate.js

# ---------- 5/6 前端构建 ----------
step "5/6 构建前端"
cd "$APP_DIR/frontend"
npm install
npm run build

# ---------- 6/6 重启服务 ----------
step "6/6 重启服务"
cd "$APP_DIR/backend"
pm2 restart "$PM2_APP" 2>/dev/null || pm2 start app.js --name "$PM2_APP"
nginx -s reload 2>/dev/null || warn "nginx 重载失败（若前端未变更可忽略）"

# 健康检查
sleep 2
HEALTH=$(curl -s -m 5 "http://127.0.0.1:${PORT}/api/health" || true)
if echo "$HEALTH" | grep -q '"code":200'; then
  echo -e "\n${GREEN}OK 部署成功，健康检查通过: $HEALTH${NC}"
else
  echo -e "\n${RED}x 健康检查未通过: ${HEALTH:-无响应}${NC}"
  echo "   排查: pm2 logs $PM2_APP --lines 30"
  exit 1
fi
