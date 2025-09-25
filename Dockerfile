FROM node:alpine3.21 AS builder

# Install pnpm and basic tools
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY . .

# Install dependencies
RUN CI=true pnpm install --frozen-lockfile --ignore-scripts

# Build web client
ENTRYPOINT ["/bin/sh", "-c", "pnpm run web:build"]

# ---------------------------------
# --------- Runtime Stage ---------
# ---------------------------------
FROM alpine:latest

RUN apk add --no-cache nodejs pnpm

WORKDIR /app

COPY --from=builder /app /app

ENTRYPOINT ["/bin/sh", "-c", "pnpm run db:migrate && DATABASE_URL=postgresql://postgres:123456@pgvector:5432/postgres pnpm run start"]
