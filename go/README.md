# telegram-search — Go rewrite

A high-concurrency Telegram message archive and semantic search system, rewritten in Go.

## Architecture

```
cmd/
  server/   — Webhook server (Echo + Telegram Bot API)
  tui/      — Interactive terminal UI (Bubble Tea)

internal/
  config/   — Viper-based configuration (env vars / YAML)
  db/       — Database layer: ent ORM + pgxpool for pgvector
  embed/    — OpenAI-compatible embedding service
  search/   — Vector (pgvector) + keyword search
  sync/     — Telegram Takeout / message history import (gotd/td MTProto)
  tgclient/ — gotd/td MTProto client with session management
  bot/      — Telegram Bot API handlers (go-telegram/bot)
  server/   — Echo HTTP server
  tui/      — Bubble Tea TUI (search, sync, auth tabs)

ent/
  schema/   — ent ORM schema definitions (Account, Chat, Message, User)
```

## Tech stack

| Concern | Library |
|---------|---------|
| DI / lifecycle | [uber/fx](https://github.com/uber-go/fx) |
| ORM | [entgo/ent](https://entgo.io) |
| HTTP | [labstack/echo](https://github.com/labstack/echo) |
| MTProto | [gotd/td](https://github.com/gotd/td) |
| Bot API | [go-telegram/bot](https://github.com/go-telegram/bot) |
| TUI | [charmbracelet/bubbletea](https://github.com/charmbracelet/bubbletea) |
| Config | [spf13/viper](https://github.com/spf13/viper) |
| Vectors | [pgvector/pgvector-go](https://github.com/pgvector/pgvector-go) |
| Embedding | [sashabaranov/go-openai](https://github.com/sashabaranov/go-openai) |
| Logging | [uber/zap](https://github.com/uber-go/zap) |
| Lint | [golangci-lint](https://golangci-lint.run) |

## Quick start

### Prerequisites
- Go 1.24+
- PostgreSQL 16+ with `pgvector` extension
- (Optional) OpenAI-compatible embedding API

### 1. Generate ent code

```sh
make generate
```

### 2. Configure

Copy the example and fill in your values:

```sh
cp tgsearch.example.yaml tgsearch.yaml
# or use environment variables:
export TGS_DATABASE_DSN=postgres://user:pass@localhost/telegram_search
export TGS_BOT_TOKEN=your_bot_token
export TGS_EMBEDDING_API_KEY=your_openai_key
export TGS_TELEGRAM_APP_ID=12345
export TGS_TELEGRAM_APP_HASH=abc123
```

### 3. Authenticate (first run only)

```sh
make tui
# → navigate to the Auth tab, enter your phone number, then the code
```

### 4. Sync messages

```sh
# via TUI:
make tui  # → Sync tab → press 's'

# via bot:
/sync  # in Telegram
```

### 5. Search

```sh
# via TUI:
make tui  # → Search tab → type query → Enter

# via bot:
/search machine learning
/search golang concurrency --chat -1001234567
```

### 6. Run the server

```sh
make server
# or in Docker:
# docker compose up
```

## Configuration reference

All settings can be set via `tgsearch.yaml` or environment variables (`TGS_` prefix).

| Env var | YAML key | Default | Description |
|---------|----------|---------|-------------|
| `TGS_DATABASE_DSN` | `database.dsn` | — | Full postgres:// URL |
| `TGS_DATABASE_HOST` | `database.host` | `localhost` | |
| `TGS_DATABASE_PORT` | `database.port` | `5432` | |
| `TGS_BOT_TOKEN` | `bot.token` | — | Bot token from @BotFather |
| `TGS_BOT_WEBHOOK_URL` | `bot.webhook_url` | — | Public HTTPS URL (empty → long-poll) |
| `TGS_BOT_WEBHOOK_SECRET` | `bot.webhook_secret` | — | Optional webhook verification secret |
| `TGS_EMBEDDING_API_KEY` | `embedding.api_key` | — | OpenAI-compatible API key |
| `TGS_EMBEDDING_BASE_URL` | `embedding.base_url` | `https://api.openai.com/v1` | |
| `TGS_EMBEDDING_MODEL` | `embedding.model` | `text-embedding-3-small` | |
| `TGS_EMBEDDING_DIMENSION` | `embedding.dimension` | `1536` | 768 / 1024 / 1536 |
| `TGS_TELEGRAM_APP_ID` | `telegram.app_id` | — | From https://my.telegram.org |
| `TGS_TELEGRAM_APP_HASH` | `telegram.app_hash` | — | |
| `TGS_TELEGRAM_SESSION_FILE` | `telegram.session_file` | `./session.json` | |
| `TGS_SERVER_ADDR` | `server.addr` | `:8080` | Listen address |

## Distributed deployment

The server is stateless — all state lives in PostgreSQL.  Run multiple
`server` instances behind a load-balancer for horizontal scaling.  Telegram
sends each webhook update to one instance; concurrency is safe because each
message upsert uses `ON CONFLICT DO NOTHING`.

For sync/takeout, only one node needs the MTProto session file.  Schedule sync
jobs externally (cron / Kubernetes CronJob) and point them at the shared DB.

## Development

```sh
make test     # run tests
make lint     # run golangci-lint
make lint-fix # auto-fix lint issues
```
