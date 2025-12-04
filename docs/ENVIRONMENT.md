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

> [!IMPORTANT]
> AI Embedding & LLM settings are now configured **per account inside the app** (Settings → API).  
> Environment variables like `EMBEDDING_API_KEY`, `EMBEDDING_MODEL`, etc. are deprecated and will be removed in a future release.

## Compile-Time Environment Variables

These variables must be set **before building** (not at `docker run` time):

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_PREVIEW_ALLOW_ALL_HOSTS` | `false` | Allow all hosts to access preview page |
| `VITE_DISABLE_SETTINGS` | `false` | Disable settings page |

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

For development, you can use `.env` file or `config/config.yaml`:

### Browser Mode (.env)
```bash
cp .env.example .env
# Edit .env with your values
pnpm run dev
```

### Server Mode (config.yaml)
```bash
cp config/config.example.yaml config/config.yaml
# Edit config/config.yaml with your values
pnpm run server:dev
```

## Notes

- **Default Telegram API credentials** are provided for convenience but have rate limits. Get your own from [my.telegram.org](https://my.telegram.org/apps) for better performance.
- **PGlite mode** runs entirely in the browser with no server needed.
- **PostgreSQL mode** requires a PostgreSQL instance with pgvector extension.
