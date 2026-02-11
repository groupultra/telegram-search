# ---------------------------------
# --------- Builder Stage ---------
# ---------------------------------
FROM node:24.13.0-alpine AS builder
WORKDIR /app

# Enable pnpm
RUN corepack enable pnpm && \
    corepack prepare pnpm@10.22.0 --activate

# Install build tools
RUN apk add --no-cache git

# Copy dependency manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json ./packages/core/package.json
COPY packages/bot/package.json ./packages/bot/package.json
COPY packages/common/package.json ./packages/common/package.json
COPY packages/schema/package.json ./packages/schema/package.json
COPY packages/client/package.json ./packages/client/package.json
COPY packages/pglite-inspector/package.json ./packages/pglite-inspector/package.json
COPY packages/observability/package.json ./packages/observability/package.json
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web/package.json ./apps/web/package.json

# Install dependencies
RUN CI=true pnpm install --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Build everything
RUN pnpm run packages:build
RUN pnpm run server:build
RUN pnpm run web:build

# ---------------------------------
# --------- Runtime Stage ---------
# ---------------------------------
FROM node:24.13.0-alpine

WORKDIR /app

# Enable pnpm
RUN corepack enable pnpm && \
    corepack prepare pnpm@10.22.0 --activate

# Install runtime dependencies
# libc6-compat for native modules
# nginx for serving frontend
RUN apk add --no-cache libc6-compat nginx envsubst

# Copy workspace config and manifests for prod install
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/packages/core/package.json ./packages/core/package.json
COPY --from=builder /app/packages/bot/package.json ./packages/bot/package.json
COPY --from=builder /app/packages/common/package.json ./packages/common/package.json
COPY --from=builder /app/packages/schema/package.json ./packages/schema/package.json
COPY --from=builder /app/packages/observability/package.json ./packages/observability/package.json
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json
# Client package is dev dependency for web build, not needed for server runtime usually,
# but let's check if server imports it. Typically not.

# Install production dependencies
RUN CI=true pnpm install --frozen-lockfile --ignore-scripts --prod

# Copy built artifacts
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/packages/schema/dist ./packages/schema/dist
COPY --from=builder /app/packages/observability/dist ./packages/observability/dist

# Copy frontend assets
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Configure Nginx
COPY docker/nginx.conf /etc/nginx/nginx.conf.template

# Copy entrypoint
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Env defaults
ENV DATABASE_TYPE="pglite"
ENV TELEGRAM_API_ID="611335"
ENV TELEGRAM_API_HASH="d524b414d21f4d37f08684c1df41ac9c"
ENV PORT="3000"
ENV HOST="0.0.0.0"
ENV BACKEND_URL="http://127.0.0.1:3000"

ENTRYPOINT ["/bin/sh", "-c"]
CMD ["/entrypoint.sh"]
