FROM node:20-alpine AS builder
WORKDIR /app

# 配置 npm 镜像源
RUN npm config set registry https://registry.npmmirror.com

# 先复制依赖文件，利用层缓存
COPY package.json package-lock.json* ./

# 安装依赖（使用缓存挂载加速）
RUN --mount=type=cache,target=/root/.npm \
    npm ci --frozen-lockfile

# 复制代码并构建
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start"]