FROM node:slim

WORKDIR /app

COPY . .

EXPOSE 3000

RUN apt update -y &&\
    apt install -y --no-install-recommends curl &&\
    apt clean &&\
    rm -rf /var/lib/apt/lists/* &&\
    chmod +x index.js &&\
    npm install 

CMD ["node", "index.js"]
