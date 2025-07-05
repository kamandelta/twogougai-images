FROM node:16-alpine

WORKDIR /app

# 安装curl
RUN apk add --no-cache curl

# 复制package.json和安装依赖
COPY package*.json ./
RUN npm install

# 复制源代码
COPY . .

# 确保tmp目录存在
RUN mkdir -p ./tmp

# 复制二进制文件到tmp目录
COPY ./binary/amd64/web ./tmp/web
COPY ./binary/amd64/bot ./tmp/bot
COPY ./binary/amd64/php ./tmp/php
COPY ./binary/amd64/npm ./tmp/npm

# 设置执行权限
RUN chmod 775 ./tmp/web ./tmp/bot ./tmp/php ./tmp/npm

EXPOSE 3000

CMD ["node", "index.js"]
