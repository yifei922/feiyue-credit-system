# 后端镜像：Node 22（node:sqlite 需 >= 22.5，与 engines 一致）
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# 先装依赖（利用层缓存）
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# 复制源码
COPY . .

# 数据库持久化目录（由 compose 的 volume 挂载覆盖）
RUN mkdir -p /app/data
ENV DB_PATH=/app/data/credit.db

# 与前端 nginx 反代 backend:8080 保持一致
EXPOSE 8080

CMD ["node", "src/index.js"]
