# Multi-stage: the build stage carries the toolchain needed to compile
# better-sqlite3; the runtime stage does not ship it.
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src

# Never run as root, and give the app a writable home for the SQLite file.
RUN mkdir -p /data && chown -R node:node /data /app
USER node
ENV DATABASE_PATH=/data/toolshed.db
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
