# 使用多阶段构建
FROM node:16-alpine AS base

WORKDIR /app

# 安装curl
RUN apk add --no-cache curl

# 复制package.json和安装依赖
COPY package*.json ./
RUN npm install

# 复制源代码
COPY . .
RUN mkdir -p ./tmp

# 为amd64架构准备文件
FROM base AS amd64-prep
COPY ./binary/amd64/web ./tmp/web
COPY ./binary/amd64/bot ./tmp/bot
COPY ./binary/amd64/php ./tmp/php
COPY ./binary/amd64/npm ./tmp/npm
RUN chmod 775 ./tmp/web ./tmp/bot ./tmp/php ./tmp/npm

# 为arm64架构准备文件
FROM base AS arm64-prep
COPY ./binary/arm64/web ./tmp/web
COPY ./binary/arm64/bot ./tmp/bot
COPY ./binary/arm64/php ./tmp/php
COPY ./binary/arm64/npm ./tmp/npm
RUN chmod 775 ./tmp/web ./tmp/bot ./tmp/php ./tmp/npm

# 选择最终镜像
FROM base AS final
ARG TARGETARCH
COPY --from=amd64-prep /app/tmp/web /app/tmp/web
COPY --from=amd64-prep /app/tmp/bot /app/tmp/bot
COPY --from=amd64-prep /app/tmp/php /app/tmp/php
COPY --from=amd64-prep /app/tmp/npm /app/tmp/npm
RUN chmod 775 /app/tmp/web /app/tmp/bot /app/tmp/php /app/tmp/npm

EXPOSE 3000

CMD ["node", "index.js"]
