# syntax=docker/dockerfile:1

# 此镜像运行 Prompt Manager Web 服务；本地 SQLite 为唯一主存储（data/prompt-manager.db，
# bind mount 到宿主机 DockerData）。MCP 由各设备本机 stdio 进程运行，经本机 HTTP API 访问。
# node:24 提供内置 node:sqlite（零原生依赖），并满足 zod 等依赖的 Node 版本要求。
FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app

# NEXT_PUBLIC_* 会在 next build 时进入浏览器 bundle。SQLite 本地模式下不再需要 Supabase 配置，
# 但保留 build arg 以便回退路径（重新启用云端时无需改 Dockerfile）。
# 留空 = 不启用云端模式（本地模式）。
ARG NEXT_PUBLIC_SUPABASE_URL=
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
ARG NEXT_PUBLIC_APP_URL=
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3100
ENV HOSTNAME=0.0.0.0

# standalone/server.js 需要 static 资源与同目录 .next/static。
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# SQLite Migration 是运行时代码（serverStore 启动时按序执行），必须进镜像。
COPY --from=builder /app/db ./db

# /app/data 是 SQLite 主库与旧 JSON 兼容副本的运行目录，
# 正式部署时 bind mount 到 DockerData/prompt-manager/legacy-store（宿主机持久化）。
RUN mkdir -p /app/data

EXPOSE 3100
CMD ["node", "server.js"]