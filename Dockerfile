FROM node:24-slim AS build

RUN apt-get update -qq && \
    apt-get install -y -qq python3 make g++ > /dev/null 2>&1

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts && npm rebuild @discordjs/opus
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:24-slim

RUN apt-get update -qq && \
    apt-get install -y -qq ffmpeg > /dev/null 2>&1 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./

CMD ["node", "dist/index.js"]
