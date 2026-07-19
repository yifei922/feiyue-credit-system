#!/usr/bin/env bash
#
# 斐越十班班级作业学分管理系统 V2.0 —— 部署后联调验证脚本
# 在运行着 docker compose 的服务器上执行，自动校验登录与各核心 API 是否可用。
#
# 可选环境变量覆盖：
#   CREDIT_BASE=http://localhost:8080  访问地址
#   CREDIT_USER=admin                 账号
#   CREDIT_PASS=123456                口令
#
set -uo pipefail

BASE="${CREDIT_BASE:-http://localhost:8080}"
USERNAME="${CREDIT_USER:-admin}"
PASSWORD="${CREDIT_PASS:-123456}"

pass=0; fail=0
check() {
  local name="$1"; local code="$2"
  if [ "$code" -ge 200 ] && [ "$code" -lt 300 ]; then
    echo "  [PASS] $name (HTTP $code)"; pass=$((pass+1))
  else
    echo "  [FAIL] $name (HTTP $code)"; fail=$((fail+1))
  fi
}

echo "== 联调验证： $BASE =="
echo "[1] 登录 $USERNAME"
LOGIN=$(curl -s -o /tmp/credit_login.json -w '%{http_code}' -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")
check "POST /api/auth/login" "$LOGIN"

TOKEN=$(grep -o '"token":"[^"]*' /tmp/credit_login.json | sed 's/"token":"//')
if [ -z "$TOKEN" ]; then
  echo "  无法获取 token，请确认服务已启动、账号口令正确，并查看： docker compose logs backend"
  exit 1
fi

echo "[2] 核心 API（携带 JWT）"
for path in \
  "/api/dashboard/stats" \
  "/api/tasks" \
  "/api/students" \
  "/api/credit-flows" \
  "/api/alerts" \
  "/api/operate-logs" ; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path" -H "Authorization: Bearer $TOKEN")
  check "GET $path" "$code"
done

echo ""
echo "结果： PASS=$pass  FAIL=$fail"
if [ "$fail" -eq 0 ]; then
  echo "全部通过，系统联调正常。"
else
  echo "存在失败项，请查看上方明细与： docker compose logs -f backend"
fi
