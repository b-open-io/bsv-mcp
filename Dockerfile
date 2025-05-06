FROM oven/bun:1.2.12

WORKDIR /app

COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun bun install --frozen-lockfile

COPY . .

USER bun

EXPOSE 3000

CMD ["bun", "run", "index.ts"]