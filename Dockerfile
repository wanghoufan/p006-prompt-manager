# syntax=docker/dockerfile:1

# 此镜像仅运行 Prompt Manager Web 服务；Supabase 仍是云端数据库，
# MCP 仍由各设备本机的 stdio 进程运行。
FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app

# NEXT_PUBLIC_* 会在 next build 时进入浏览器 bundle，因此必须作为 build arg
# 传入。它们只能是 URL 与 Supabase publishable key，不能是 Secret。
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3100
ENV HOSTNAME=0.0.0.0

# standalone/server.js 需要 static 资源与同目录 .next/static。
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# /app/data 会在正式部署时绑定到 DockerData/prompt-manager/legacy-store。
# 这只服务于尚未下线的 JSON/SSE 兼容链路，绝不作为 Supabase 数据库。
RUN mkdir -p /app/data

EXPOSE 3100
CMD ["node", "server.js"]
