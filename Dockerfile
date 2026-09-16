FROM oven/bun:1
WORKDIR /usr/src/app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY . .

RUN mkdir -p /data && chown -R bun:bun /data /usr/src/app
USER bun

WORKDIR /data
CMD ["bun", "run", "/usr/src/app/src/index.ts"]
