# 使用多阶段构建
FROM node:16-alpine AS base

WORKDIR /app

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
FROM ${TARGETARCH}-prep

EXPOSE 3000

CMD ["node", "index.js"]
