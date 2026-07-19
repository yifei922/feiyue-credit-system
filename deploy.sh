#!/usr/bin/env bash
#
# 斐越十班班级作业学分管理系统 V2.0 —— 生产一键部署脚本
# 适用：已安装 Docker Engine + docker compose 插件的 Linux 服务器
#
set -euo pipefail

echo "=============================================="
echo " 斐越十班 · 班级作业学分管理系统 生产部署"
echo "=============================================="

# 1. 运行环境检查
if ! command -v docker >/dev/null 2>&1; then
  echo "[错误] 未检测到 docker，请先安装 Docker Engine：https://docs.docker.com/engine/install/"
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "[错误] 未检测到 docker compose 插件，请安装：https://docs.docker.com/compose/install/"
  exit 1
fi

# 2. 生成生产环境变量（根目录 .env，docker compose 会自动读取）
if [ ! -f .env ]; then
  JWT_SECRET=$(openssl rand -hex 32)
  DB_PASSWORD=$(openssl rand -hex 16)
  cat > .env <<EOF
# 生产环境变量（由 deploy.sh 自动生成，请勿提交到代码仓库）
JWT_SECRET=${JWT_SECRET}
MYSQL_ROOT_PASSWORD=${DB_PASSWORD}
CORS_ORIGINS=http://localhost:8080
EOF
  echo "[完成] 已生成 .env（含随机 JWT_SECRET 与数据库密码，请妥善保管）"
else
  echo "[提示] 已存在 .env，将沿用其中的 JWT_SECRET / MYSQL_ROOT_PASSWORD"
fi

# 3. 构建并后台启动
echo "[步骤] 构建镜像并启动服务（首次会拉取 maven/mysql/nginx 基础镜像，耗时几分钟）..."
docker compose up -d --build

echo ""
echo "=============================================="
echo " 部署完成！"
echo " 访问地址： http://<本服务器IP>:8080"
echo " 初始账号： admin / 123456 （教师 teacher01、科代 rep01、学生 student01，口令均 123456）"
echo " 安全提醒： 请尽快修改默认账号口令，并参考 DEPLOY.md 配置域名与 HTTPS"
echo "=============================================="
