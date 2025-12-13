# Environment Variables Reference

## Overview

All environment variables are **optional**. The application will work with default settings, but you can customize behavior by setting these variables.

## Runtime Environment Variables

These variables can be set when starting the Docker container or during runtime:

| Variable | Default | Description |
| --- | --- | --- |
| `TELEGRAM_API_ID` | `611335` | Telegram app ID from [my.telegram.org](https://my.telegram.org/apps) |
| `TELEGRAM_API_HASH` | `d524b414d21f4d37f08684c1df41ac9c` | Telegram app hash from the same page |
| `DATABASE_TYPE` | `pglite` | Database type: `postgres` or `pglite` |
| `DATABASE_URL` | - | PostgreSQL connection string (only when `DATABASE_TYPE=postgres`) |
| `PROXY_URL` | - | Proxy configuration URL (see formats below) |
| `PORT` | `3000` | Backend HTTP/WebSocket port inside the container |
| `HOST` | `0.0.0.0` | Backend listen host inside the container |
| `BACKEND_URL` | `http://127.0.0.1:3000` | Nginx upstream URL for `/api` and `/ws` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | - | OpenTelemetry OTLP endpoint for sending logs to Loki (e.g., `http://localhost:3100/otlp/v1/logs`) |

> [!IMPORTANT]
> AI Embedding & LLM settings are now configured **per account inside the app** (Settings → API).  
> Environment variables like `EMBEDDING_API_KEY`, `EMBEDDING_MODEL`, etc. are deprecated and will be removed in a future release.

## Proxy URL Formats

The `PROXY_URL` environment variable supports these formats:

### SOCKS5
```
socks5://username:password@host:port?timeout=15
```

### SOCKS4
```
socks4://username:password@host:port?timeout=15
```

### HTTP
```
http://username:password@host:port?timeout=15
```

### MTProxy
```
mtproxy://secret@host:port?timeout=15
```

### Examples

**With authentication:**
```bash
PROXY_URL=socks5://myuser:mypass@proxy.example.com:1080
```

**Without authentication:**
```bash
PROXY_URL=socks5://proxy.example.com:1080?timeout=30
```

**MTProxy:**
```bash
PROXY_URL=mtproxy://secret123@mtproxy.example.com:443
```

## Docker Examples

### Basic (Default Settings)
```bash
docker run -d --name telegram-search \
  -p 3333:3333 \
  -v telegram-search-data:/app/data \
  ghcr.io/groupultra/telegram-search:latest
```

### With PostgreSQL
```bash
docker run -d --name telegram-search \
  -p 3333:3333 \
  -v telegram-search-data:/app/data \
  -e DATABASE_TYPE=postgres \
  -e DATABASE_URL=postgresql://user:pass@postgres-host:5432/telegram \
  ghcr.io/groupultra/telegram-search:latest
```

### With Custom Telegram API Keys
```bash
docker run -d --name telegram-search \
  -p 3333:3333 \
  -v telegram-search-data:/app/data \
  -e TELEGRAM_API_ID=123456 \
  -e TELEGRAM_API_HASH=your_api_hash_here \
  ghcr.io/groupultra/telegram-search:latest
```

### With Proxy
```bash
docker run -d --name telegram-search \
  -p 3333:3333 \
  -v telegram-search-data:/app/data \
  -e PROXY_URL=socks5://myuser:mypass@proxy.example.com:1080 \
  ghcr.io/groupultra/telegram-search:latest
```

### With OpenTelemetry Logging to Loki
```bash
docker run -d --name telegram-search \
  -p 3333:3333 \
  -v telegram-search-data:/app/data \
  -e OTEL_EXPORTER_OTLP_ENDPOINT=http://loki-host:3100/otlp/v1/logs \
  ghcr.io/groupultra/telegram-search:latest
```

### Full Configuration
```bash
docker run -d --name telegram-search \
  -p 3333:3333 \
  -v telegram-search-data:/app/data \
  -e TELEGRAM_API_ID=611335 \
  -e TELEGRAM_API_HASH=d524b414d21f4d37f08684c1df41ac9c \
  -e DATABASE_TYPE=postgres \
  -e DATABASE_URL=postgresql://user:pass@postgres-host:5432/telegram \
  -e PROXY_URL=socks5://user:pass@proxy.example.com:1080 \
  ghcr.io/groupultra/telegram-search:latest
```

## Docker Compose

Example `docker-compose.yml`:

```yaml
version: '3.8'

services:
  telegram-search:
    image: ghcr.io/groupultra/telegram-search:latest
    ports:
      - '3333:3333'
    volumes:
      - telegram-search-data:/app/data
    environment:
      TELEGRAM_API_ID: '611335'
      TELEGRAM_API_HASH: 'd524b414d21f4d37f08684c1df41ac9c'
      DATABASE_TYPE: 'postgres'
      DATABASE_URL: 'postgresql://postgres:postgres@pgvector:5432/postgres'
    depends_on:
      pgvector:
        condition: service_healthy

  pgvector:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    volumes:
      - pgvector-data:/var/lib/postgresql/data
    ports:
      - '5432:5432'
    healthcheck:
      test: ['CMD-SHELL', "psql -U postgres -c 'CREATE EXTENSION IF NOT EXISTS vector; SELECT 1;'"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 10s

volumes:
  telegram-search-data:
  pgvector-data:
```

## Development Mode

For development, you can use `.env` (and optionally `.env.local`) for both browser-only and server mode:

### Browser Mode (.env)
```bash
cp .env.example .env
# Edit .env with your values
pnpm run dev
```

### Server Mode (.env + PostgreSQL)
```bash
cp .env.example .env
# Edit .env with your Telegram keys, DATABASE_TYPE / DATABASE_URL, PROXY_URL, etc.

# Start PostgreSQL + pgvector (or point DATABASE_URL to your own instance)
docker compose up -d pgvector

# In one terminal: start backend (uses .env / .env.local via dotenvx)
pnpm run server:dev

# In another terminal: start frontend
pnpm run web:dev
```

## OpenTelemetry Logging with Loki

The application supports sending logs to Loki (or any OTLP-compatible backend) using OpenTelemetry. This is optional and disabled by default.

### Setup

1. **Deploy Loki** with OTLP receiver enabled. Example docker-compose.yml snippet:

```yaml
version: "3.8"
services:
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    command: -config.file=/etc/loki/local-config.yaml
```

2. **Configure the application** to send logs to Loki:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:3100/otlp/v1/logs
```

3. **Restart the server**. Logs will now be exported to Loki via OTLP HTTP protocol.

### Viewing Logs

Use Grafana with Loki as a data source to view and query logs. The logs will include:
- Service name and version as resource attributes
- Log level (severity)
- Log message (body)
- Additional context fields

### Troubleshooting

- If logs don't appear in Loki, check the server console for initialization messages
- Ensure the OTLP endpoint URL is correct and accessible from the server
- Verify that Loki is configured to accept OTLP logs (requires Loki 2.9+)

## Notes

- **Default Telegram API credentials** are provided for convenience but have rate limits. Get your own from [my.telegram.org](https://my.telegram.org/apps) for better performance.
- **PGlite mode** runs entirely in the browser with no server needed.
- **PostgreSQL mode** requires a PostgreSQL instance with pgvector extension.
- **OpenTelemetry logging** is optional and only available in server mode.
