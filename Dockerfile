# ---------------------------------
# --------- Builder Stage ---------
# ---------------------------------
FROM node:24-bookworm-slim AS builder
WORKDIR /app

# Enable pnpm
RUN corepack enable pnpm && \
    corepack prepare pnpm@10.22.0 --activate

# Install build tools (git needed for vite plugins)
RUN apt-get update && apt-get install -y git \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests first (for layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json ./packages/core/package.json
COPY packages/common/package.json ./packages/common/package.json
COPY packages/client/package.json ./packages/client/package.json
COPY packages/pglite-inspector/package.json ./packages/pglite-inspector/package.json
COPY packages/schema/package.json ./packages/schema/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/server/package.json ./apps/server/package.json

# Install dependencies (cached if package.json files unchanged)
RUN CI=true pnpm install --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Build packages
RUN pnpm run packages:build

# Build web app
RUN pnpm run web:build

# Build server app
RUN pnpm run server:build

# ---------------------------------
# --------- Nginx Stage -----------
# ---------------------------------
FROM nginx:1.27-bookworm AS web

# Copy built frontend
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 3333

# ---------------------------------
# --------- Runtime Stage ---------
# ---------------------------------
FROM node:24-bookworm-slim

WORKDIR /app

# Enable pnpm
RUN corepack enable pnpm && \
    corepack prepare pnpm@10.22.0 --activate

# Install nginx and curl for serving frontend and healthcheck
# gettext provides envsubst for templating nginx config with env vars
RUN apt-get update && apt-get install -y nginx curl ca-certificates gettext \
    && rm -rf /var/lib/apt/lists/*

# Copy server dist from builder
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Install production dependencies
RUN CI=true pnpm install --frozen-lockfile --ignore-scripts --prod

# Copy nginx config template and frontend
COPY nginx.conf /etc/nginx/nginx.conf.template
COPY --from=web /usr/share/nginx/html /usr/share/nginx/html

# Copy entrypoint script
COPY --chmod=755 scripts/entrypoint.sh ./scripts/entrypoint.sh

# Environment variables with default values
ENV DATABASE_TYPE="pglite"
ENV DATABASE_URL=""
ENV TELEGRAM_API_ID="611335"
ENV TELEGRAM_API_HASH="d524b414d21f4d37f08684c1df41ac9c"
ENV PROXY_URL=""
ENV PORT="3000"
ENV HOST="0.0.0.0"
ENV BACKEND_URL="http://127.0.0.1:3000"

# Declare volumes for data persistence
VOLUME ["/app/data"]

# Start via entrypoint (nginx + server, both env-configurable)
ENTRYPOINT ["/bin/sh", "-c"]
CMD ["./scripts/entrypoint.sh"]
