


FROM node:22-alpine AS deps
WORKDIR /app



RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && npm config set fund false \
    && npm config set audit false
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm install && apk del .build-deps


FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build \
    && find dist -name '*.map' -delete


FROM node:22-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache --virtual .build-deps python3 make g++
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm install --omit=dev && apk del .build-deps


FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PM2_HOME=/app/.pm2
WORKDIR /app

RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ecosystem.config.js ./

RUN mkdir -p "$PM2_HOME" && chown -R node:node "$PM2_HOME"

USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get({host:'127.0.0.1',port:process.env.PORT||4000,path:'/health',timeout:4000},res=>process.exit(res.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node_modules/.bin/pm2-runtime", "ecosystem.config.js"]
