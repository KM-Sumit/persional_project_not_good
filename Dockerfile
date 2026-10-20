# Production image: build with Bun, run the SvelteKit node server under Bun (auth uses Bun.password).
FROM oven/bun:1.3 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
RUN bun run build

FROM oven/bun:1.3-slim
WORKDIR /app
# BODY_SIZE_LIMIT: PDF uploads (40 MB) for notes and AI question generation. ADDRESS_HEADER/XFF_DEPTH: real client IP behind Dokploy's Traefik (rate limits).
# ORIGIN has no default on purpose: server.js refuses to boot in production without it.
ENV NODE_ENV=production PORT=3000 BODY_SIZE_LIMIT=45M ADDRESS_HEADER=X-Forwarded-For XFF_DEPTH=1
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts
COPY --from=build /app/build ./build
COPY server.js ./server.js
COPY drizzle ./drizzle
COPY scripts/migrate.ts scripts/seed.ts ./scripts/
COPY src ./src
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=120s --retries=3 CMD bun -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["sh", "-c", "bun scripts/migrate.ts && bun scripts/seed.ts && bun server.js"]
