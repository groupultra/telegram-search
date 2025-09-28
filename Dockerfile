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

ENV DATABASE_TYPE="pglite"
ENV DATABASE_URL=""
ENV TELEGRAM_API_ID="611335"
ENV TELEGRAM_API_HASH="d524b414d21f4d37f08684c1df41ac9c"
ENV EMBEDDING_API_KEY="sk-proj-1234567890"
ENV EMBEDDING_BASE_URL="https://api.openai.com/v1"

ENTRYPOINT ["/bin/sh", "-c", "exec pnpm run start"]
