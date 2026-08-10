FROM node:26-slim AS ffmpeg

# 常に最新の ffmpeg を使うため BtbN のポータブルビルド（LGPL 版）を取得する。
# 外部ライブラリは静的リンク済みで、ffmpeg 単体を実行イメージへコピーすれば動く。
RUN apt-get update -qq && \
    apt-get install -y -qq curl xz-utils > /dev/null 2>&1 && \
    curl -fsSL https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-lgpl.tar.xz \
      | tar -xJ --strip-components=2 -C /usr/local/bin ffmpeg-master-latest-linux64-lgpl/bin/ffmpeg

FROM node:26-slim AS build

RUN apt-get update -qq && \
    apt-get install -y -qq python3 make g++ > /dev/null 2>&1

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts && npm rebuild @discordjs/opus
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:26-slim

COPY --from=ffmpeg /usr/local/bin/ffmpeg /usr/local/bin/ffmpeg

WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY data/ ./data/

CMD ["node", "dist/index.js"]
