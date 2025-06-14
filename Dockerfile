FROM node:23.11.1-alpine AS builder

# Install pnpm and basic tools
RUN apk add --no-cache git python3 make build-base
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm -r install

# RUN pnpm run build

# ---------------------------------
# --------- Runtime Stage ---------
# ---------------------------------
FROM alpine:latest

RUN apk add --no-cache nodejs pnpm

WORKDIR /app

COPY --from=builder /app /app

ENTRYPOINT ["/bin/sh", "-c", "pnpm run db:migrate && pnpm run dev:frontend --host 0.0.0.0 & pnpm run dev:server"]
