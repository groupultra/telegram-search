FROM node:23.11.1-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Build applications
RUN pnpm run build

# Default command (can be overridden by docker-compose)
CMD ["pnpm", "run", "dev:server"]
