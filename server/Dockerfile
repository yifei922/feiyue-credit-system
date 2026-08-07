# 微信云托管 · 学分管理系统后端
FROM node:22-slim

WORKDIR /app

# 先拷依赖清单安装（利用层缓存，改代码不必重装依赖）
COPY package*.json ./
RUN npm install --omit=dev

# 再拷源码（node_modules / data / .env 已被 .dockerignore 排除）
COPY . .

# 运行时由云托管 / compose 注入 PORT（默认 80），index.js 已用 process.env.PORT 监听
ENV NODE_ENV=production
ENV PORT=80
EXPOSE 80

CMD ["node", "src/index.js"]
