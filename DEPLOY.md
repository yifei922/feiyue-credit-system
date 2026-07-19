# 斐越十班 · 班级作业学分管理系统 V2.0 —— 生产部署手册（方案 B）

本文档说明如何把系统以**全栈容器化**方式部署到一台云服务器，实现多人同时在线、数据持久化。

架构：浏览器 → Nginx(前端静态 + 反代 `/api`) → Spring Boot 后端 → MySQL 8.0，全部由 `docker compose` 编排。

> 本沙箱仅含 Node/Python，无 Docker 与 Java，无法在此实跑；以下流程在你自己的 Linux 服务器（腾讯云/阿里云轻量应用服务器等）执行。

---

## 0. 前置要求

- 一台 Linux 服务器（推荐 2 核 4G 起步，MySQL 较吃内存）。
- 已安装 **Docker Engine + docker compose 插件**（Docker 24+ 自带 compose v2）。
- 如需域名访问：一个已备案域名（国内服务器必需），以及能改 DNS 的权限。

安装 Docker（Ubuntu 示例）：

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # 退出重登后免 sudo
docker compose version          # 确认 compose 插件可用
```

---

## 1. 准备代码

把整个项目目录传到服务器（Git 克隆或压缩包上传均可），进入项目根目录：

```bash
cd feiyue-credit-system   # 项目根（含 docker-compose.yml / backend / frontend / db）
```

---

## 2. 一键部署

直接运行根目录脚本，它会检查环境、自动生成随机密钥与数据库密码（写入根 `.env`），然后构建并启动：

```bash
chmod +x deploy.sh
./deploy.sh
```

脚本完成后，访问 `http://<服务器IP>:8080` 即可。

> 不想用脚本也可手动：
> ```bash
> cp .env.example .env        # 编辑填入 JWT_SECRET / MYSQL_ROOT_PASSWORD
> docker compose up -d --build
> ```

初始账号（口令均为 `123456`，**上线前务必修改**）：
`admin`(管理员) / `teacher01`(教师) / `rep01`(科代表) / `student01`(学生·张三)。

---

## 3. 验证部署

```bash
# 容器状态
docker compose ps

# 后端接口自检（应返回 code=0 且含 token）
curl -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"123456"}'

# 查看日志
docker compose logs -f backend
```

若浏览器登录报「网络错误」：确认前端镜像是用 `VITE_USE_MOCK=false` 构建的（见排错 §6）。

---

## 4. 绑定域名 + 启用 HTTPS

仅用 IP:8080 能用，但正式环境建议走域名与 HTTPS。两种省心方案：

### 方案 A（最省事）：Cloudflare 代理
1. 把域名 DNS 解析到服务器 IP，并开启 Cloudflare 橙色云代理。
2. Cloudflare 自动签发免费证书；在「SSL/TLS」设为 Full。
3. 在 Cloudflare「Origin Rules / 转换规则」中，把到该域名的请求转发到源站 `服务器IP:8080`（Cloudflare 支持自定义源站端口）。
4. 访问 `https://你的域名` 即可，HTTPS 由 Cloudflare 托管。

### 方案 B（自有 Nginx + Let's Encrypt）
在宿主机另装 Nginx（非容器），反代到本机 8080，并用 certbot 申请证书：

```nginx
# /etc/nginx/conf.d/credit.conf
server {
    listen 80;
    server_name credit.your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d credit.your-domain.com   # 自动申请证书并改写 443
```

> 采用方案 B 时，可在 `docker-compose.yml` 把 `frontend.ports` 改为 `"8080:80"` 对外只监听 8080，由宿主机 Nginx 统一接管 80/443。

---

## 5. 数据库备份与恢复

数据位于 `mysql-data` 卷，建议定期导出：

```bash
# 备份
docker exec credit-mysql mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" credit_db \
  > backup_$(date +%F).sql

# 恢复
docker exec -i credit-mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" credit_db < backup_2026-01-01.sql
```

也可直接备份卷目录（停止容器后复制 `/var/lib/docker/volumes/..._mysql-data`）。

---

## 6. 常见排错

| 现象 | 原因 / 处理 |
|------|--------------|
| 所有接口 404（`/api/...`） | 确认 `frontend/nginx.conf` 的 `proxy_pass http://backend:8080;`（**末尾不带 `/`**），以保留 `/api` 前缀匹配后端 `context-path: /api`。 |
| 登录报「网络错误」/ 页面像演示数据 | 前端仍以 Mock 运行：确认 `frontend/.env.production` 存在且 `VITE_USE_MOCK=false`，并重新 `docker compose up -d --build frontend` 使其重新构建。 |
| 端口 8080 被占用 | 改 `docker-compose.yml` 中 `frontend.ports` 为其他宿主机端口（如 `"9090:80"`），或用方案 B 的宿主机 Nginx。 |
| 后端起不来 | `docker compose logs backend` 看是否连不上 MySQL（等 healthcheck 通过后再起）或 JWT_SECRET 缺失。 |
| MySQL 反复重启 | 数据卷损坏：备份后 `docker compose down -v` 重建（会清空数据，仅首次/测试用）。 |

---

## 7. 上线安全清单

- [ ] 修改 `admin / teacher01 / rep01 / student01` 默认口令（后端 `DataInitializer` 初始化，上线前改密码或删初始化逻辑）。
- [ ] `JWT_SECRET` 已是随机长字符串（`.env` 由 `deploy.sh` 生成；勿提交到仓库）。
- [ ] `MYSQL_ROOT_PASSWORD` 改为强密码，且**不要**把 3306 映射到公网（当前 `ports: "3306:3306"` 仅用于排错，生产可删掉该映射，容器间已通过 `credit-net` 互通）。
- [ ] 启用 HTTPS（见 §4）。
- [ ] 定期数据库备份（见 §5）。
- [ ] 升级代码后：`git pull` → `docker compose up -d --build`。

---

## 8. 升级 / 回滚

```bash
# 升级：拉取最新代码并重建
docker compose up -d --build

# 查看某服务日志
docker compose logs -f backend

# 回滚：重新 build 旧版本镜像或 git checkout 旧提交后再次 build
```

## 9. 实战 Runbook（Ubuntu 22.04 从零复制即用）

以下命令在干净的 Ubuntu 22.04 服务器上逐条执行即可上线（其他发行版仅 Docker 安装命令不同）：

```bash
# 1) 安装 Docker（已装可跳过）
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER        # 退出重登后免 sudo
newgrp docker

# 2) 上传/拉取代码到 /opt/feiyue-credit 并进入
cd /opt/feiyue-credit

# 3) 一键部署（自动生成密钥与密码并启动）
chmod +x deploy.sh && ./deploy.sh

# 4) 联调验证（自动检查登录与各核心 API，见 verify.sh）
chmod +x verify.sh && ./verify.sh

# 5) 放行端口（云厂商还需在控制台安全组放行 8080；生产建议走域名+HTTPS 见 §4）
sudo ufw allow 8080/tcp
```

浏览器访问 `http://<服务器IP>:8080` 即可。后续升级：`git pull && docker compose up -d --build`。

相关文件：`docker-compose.yml`、`frontend/Dockerfile`、`frontend/nginx.conf`、`backend/Dockerfile`、`db/schema.sql`、`deploy.sh`、`verify.sh`、`.env.example`。
