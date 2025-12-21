# ---------------------------------
# --------- Builder Stage ---------
# ---------------------------------
FROM node:24.12.0-alpine AS builder
WORKDIR /app

# Enable pnpm
RUN corepack enable pnpm && \
    corepack prepare pnpm@10.22.0 --activate

# Install build tools
RUN apk add --no-cache git

# Copy dependency manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json ./packages/core/package.json
COPY packages/common/package.json ./packages/common/package.json
COPY packages/client/package.json ./packages/client/package.json
COPY packages/pglite-inspector/package.json ./packages/pglite-inspector/package.json
COPY packages/schema/package.json ./packages/schema/package.json
COPY apps/web/package.json ./apps/web/package.json

# Install dependencies
RUN CI=true pnpm install --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Build packages and web
RUN pnpm run packages:build
RUN pnpm run web:build

# ---------------------------------
# --------- Nginx Stage -----------
# ---------------------------------
FROM nginx:alpine

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Copy built frontend
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy nginx config template
COPY apps/web/nginx.conf /etc/nginx/nginx.conf.template

# Copy entrypoint script
COPY apps/web/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Default env
ENV BACKEND_URL="http://server:3000"

EXPOSE 3333

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
