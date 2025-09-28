# ---------------------------------
# --------- Builder Stage ---------
# ---------------------------------
FROM node:alpine3.21 AS builder

# Install pnpm and basic tools
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY . .

# Install dependencies
RUN CI=true pnpm install --frozen-lockfile --ignore-scripts

# Build packages first (required by web build)
RUN pnpm run packages:build

# Build web client
RUN pnpm run web:build

# ---------------------------------
# --------- Runtime Stage ---------
# ---------------------------------
FROM alpine:latest

RUN apk add --no-cache nodejs pnpm curl

WORKDIR /app

COPY --from=builder /app /app

ENV DATABASE_URL="postgresql://postgres:123456@pgvector:5432/postgres"
ENV TELEGRAM_API_ID=""
ENV TELEGRAM_API_HASH=""
ENV EMBEDDING_API_KEY=""
ENV EMBEDDING_BASE_URL=""

ENTRYPOINT ["/bin/sh", "-c", "pnpm run db:migrate && exec pnpm run start"]
