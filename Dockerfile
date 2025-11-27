# ---------------------------------
# --------- Builder Stage ---------
# ---------------------------------
FROM node:24.11.0-alpine AS builder

WORKDIR /app

# Install build tools (git needed for vite plugins)
RUN apk add --no-cache git

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependency manifests first (for layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json ./packages/core/package.json
COPY packages/common/package.json ./packages/common/package.json
COPY packages/client/package.json ./packages/client/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/server/package.json ./apps/server/package.json

# Install dependencies (cached if package.json files unchanged)
RUN CI=true pnpm install --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Build all artifacts
RUN pnpm run packages:build
RUN pnpm run server:build
RUN pnpm run web:build

# ---------------------------------
# --------- Nginx Stage -----------
# ---------------------------------
FROM nginx:alpine AS web

# Copy built frontend
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 3333

# ---------------------------------
# --------- Runtime Stage ---------
# ---------------------------------
FROM node:24.11.0-alpine

WORKDIR /app

# Install nginx and curl for serving frontend and healthcheck
RUN apk add --no-cache nginx curl ca-certificates

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package.json files from builder (for workspace structure)
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/packages/core/package.json ./packages/core/package.json
COPY --from=builder /app/packages/common/package.json ./packages/common/package.json
COPY --from=builder /app/packages/client/package.json ./packages/client/package.json
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Copy built artifacts from builder
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/common/src ./packages/common/src
COPY --from=builder /app/packages/client/src ./packages/client/src
COPY --from=builder /app/apps/server/dist ./apps/server/dist

# Copy nginx config and frontend
COPY --from=web /etc/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=web /usr/share/nginx/html /usr/share/nginx/html

# Copy essential config files
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/config/config.example.yaml ./config/config.example.yaml

# Copy root configs needed at runtime (including pnpm-workspace.yaml for project root detection)
COPY pnpm-workspace.yaml tsconfig.json drizzle.config.ts ./

# Environment variables with default values
ENV DATABASE_TYPE="pglite"
ENV DATABASE_URL=""
ENV TELEGRAM_API_ID="611335"
ENV TELEGRAM_API_HASH="d524b414d21f4d37f08684c1df41ac9c"
ENV EMBEDDING_API_KEY=""
ENV EMBEDDING_BASE_URL="https://api.openai.com/v1"
ENV PROXY_URL=""

# Declare volumes for data persistence
VOLUME ["/app/config", "/app/data"]

# Start nginx and server
CMD ["sh", "-c", "nginx && exec node apps/server/dist/app.mjs"]
