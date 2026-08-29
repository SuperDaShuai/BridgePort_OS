# BridgePort OS 部署指南（Ubuntu 24.04 + Nginx + PM2）

本指南把项目部署到一台干净的 Ubuntu 24.04 服务器。前提：你已用 `ssh` 登录服务器，并以拥有 `sudo` 权限的普通用户身份执行下列命令。

部署约定：
- 项目目录：`/var/www/bridgeport-os`
- 后端端口：`3000`（仅本机访问，由 Nginx 反代）
- 对外端口：`80`（Nginx）
- 进程守护：PM2（管理 Node 进程，开机自启、崩溃自动重启）

---

## 1. 安装基础环境

### 1.1 更新系统

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 安装 Node.js 20 LTS（NodeSource 官方源）

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v          # 确认输出 v20.x
```

### 1.3 安装 PM2（进程守护）

```bash
sudo npm install -g pm2
pm2 --version
```

### 1.4 安装并配置 MySQL 8

```bash
sudo apt install -y mysql-server
sudo systemctl enable --now mysql
sudo mysql_secure_installation     # 按提示设置 root 密码、移除匿名用户等
```

登录 MySQL 建库（把 `你的密码` 换成真实密码）：

```bash
sudo mysql -u root -p
```

```sql
CREATE DATABASE trade_system CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
-- 用 Navicat 导出本地 22 张表结构为 trade_system.sql，上传后执行：
-- SOURCE /var/www/bridgeport-os/trade_system.sql;
-- 创建业务账号（可选，生产环境不直接用 root）
CREATE USER 'bp_app'@'localhost' IDENTIFIED BY '你的密码';
GRANT ALL PRIVILEGES ON trade_system.* TO 'bp_app'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

> 简化方案：直接用 root 账号，把密码填进 `.env.production` 即可，无需新建业务账号。

---

## 2. 上传项目代码

任选一种方式：

**方式 A：git clone（推荐，便于后续更新）**

```bash
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
cd /var/www
git clone <你的仓库地址> bridgeport-os
```

**方式 B：本地打包后用 scp 上传**

在本机执行（Windows PowerShell）：

```powershell
# 排除 node_modules 和 dist，打包成 tar.gz
cd d:\vue项目
tar -czf bridgeport-os.tar.gz --exclude=node_modules --exclude=dist BridgePort_OS
scp bridgeport-os.tar.gz 你的用户@服务器IP:~
```

在服务器上：

```bash
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
cd /var/www
tar -xzf ~/bridgeport-os.tar.gz
mv BridgePort_OS bridgeport-os
```

---

## 3. 部署后端

```bash
cd /var/www/bridgeport-os/backend
npm install --omit=dev       # 只装运行依赖，不装 devDependencies

# 用生产模板生成 .env 并填入真实密码
cp .env.production .env
nano .env                    # 把 DB_PASSWORD 和 JWT_SECRET 改成真实值
```

`.env` 必填项核对：

| 变量 | 示例值 |
|---|---|
| `PORT` | `3000` |
| `DB_HOST` | `127.0.0.1` |
| `DB_USER` | `root` |
| `DB_PASSWORD` | 服务器 MySQL root 密码 |
| `DB_NAME` | `trade_system` |
| `JWT_SECRET` | 32 位以上随机串（可用 `openssl rand -hex 32` 生成）|

用 PM2 启动并设为开机自启：

```bash
pm2 start app.js --name bridgeport-api
pm2 save
pm2 startup            # 按提示复制返回的命令再执行一次，让 PM2 开机自启
```

验证后端就绪：

```bash
pm2 status                                   # 应显示 bridgeport-api online
curl http://127.0.0.1:3000/api/health         # 返回 MySQL 连接状态 JSON
pm2 logs bridgeport-api --lines 20           # 查看启动日志，确认 [DB] MySQL 连接成功
```

---

## 4. 打包并部署前端

```bash
cd /var/www/bridgeport-os/frontend
npm install
npm run build               # 产物输出到 frontend/dist
ls dist                     # 应看到 index.html 与 assets/ 目录
```

> 前端 axios 的 baseURL 已通过 `import.meta.env` 配置为 `/api`，与下方 Nginx 反代规则一致，无需在构建时改后端地址。

---

## 5. 配置 Nginx

```bash
# 用项目根目录的 nginx.conf 作为站点配置
sudo cp /var/www/bridgeport-os/nginx.conf /etc/nginx/sites-available/bridgeport-os
sudo ln -s /etc/nginx/sites-available/bridgeport-os /etc/nginx/sites-enabled/

# （可选）移除默认站点，避免 80 端口冲突
sudo rm -f /etc/nginx/sites-enabled/default

# 测试配置语法
sudo nginx -t
# 输出 syntax is ok / test is successful 即可

# 重载生效
sudo systemctl reload nginx
sudo systemctl enable nginx
```

---

## 6. 开放防火墙

```bash
sudo ufw allow 80/tcp
sudo ufw allow 22/tcp
sudo ufw enable             # 首次启用会警告断开 SSH，确认 22 已放行后选 y
sudo ufw status
```

---

## 7. 访问验证

浏览器打开 `http://服务器IP`（或绑定的域名），应看到 BridgePort OS 登录页。用 admin / admin123 登录后能进入工作台即部署成功。

如果页面打不开，按顺序排查：

```bash
# 1) 后端是否在线
pm2 status
curl http://127.0.0.1:3000/api/health

# 2) Nginx 是否在跑、配置是否正确
sudo systemctl status nginx
sudo nginx -t

# 3) 80 端口是否放行
sudo ufw status

# 4) 看实时日志
pm2 logs bridgeport-api
sudo tail -f /var/log/nginx/error.log
```

---

## 8. 后续更新流程

代码更新后，重新部署只需：

```bash
# 后端
cd /var/www/bridgeport-os/backend
git pull                       # 或重新 scp 上传
npm install --omit=dev
pm2 restart bridgeport-api

# 前端
cd /var/www/bridgeport-os/frontend
git pull
npm install
npm run build                  # Nginx 直接读 dist，无需 reload
```

---

## 附：常用运维命令

| 命令 | 作用 |
|---|---|
| `pm2 list` | 查看所有进程 |
| `pm2 restart bridgeport-api` | 重启后端 |
| `pm2 logs bridgeport-api --lines 100` | 查看最近 100 行日志 |
| `pm2 monit` | 实时监控面板 |
| `sudo systemctl reload nginx` | 重载 Nginx 配置 |
| `sudo tail -f /var/log/nginx/access.log` | 查看 Nginx 访问日志 |
