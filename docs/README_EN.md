![preview](./assets/preview.png)

---

<p align="center">
  <a href="https://trendshift.io/repositories/13868" target="_blank"><img src="https://trendshift.io/api/badge/repositories/13868" alt="groupultra%2Ftelegram-search | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
</p>

<p align="center">
  [<a href="https://search.lingogram.app">Live Demo</a>] [<a href="../README.md">简体中文</a>] [<a href="./README_JA.md">日本語</a>]
</p>

<p align="center">
  <a href="https://discord.gg/NzYsmJSgCT">
    <img alt="Discord" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fdiscord.com%2Fapi%2Finvites%2FNzYsmJSgCT%3Fwith_counts%3Dtrue&query=%24.approximate_member_count&suffix=%20members&logo=discord&logoColor=white&label=%20&color=7389D8&labelColor=6A7EC2" />
  </a>
  <a href="https://t.me/+Gs3SH2qAPeFhYmU9">
    <img alt="Telegram" src="https://img.shields.io/badge/Telegram-%235AA9E6?logo=telegram&labelColor=FFFFFF" />
  </a>
  <a href="https://deepwiki.com/groupultra/telegram-search">
    <img alt="DeepWiki" src="https://deepwiki.com/badge.svg" />
  </a>
  <br>
  <a href="https://github.com/groupultra/telegram-search/releases">
    <img alt="GitHub Package Version" src="https://img.shields.io/github/package-json/v/groupultra/telegram-search?style=flat&colorA=080f12&colorB=1fa669" />
  </a>
  <a href="https://github.com/groupultra/telegram-search/actions/workflows/release-docker.yaml">
    <img alt="Release Docker / OCI" src="https://github.com/groupultra/telegram-search/actions/workflows/release-docker.yaml/badge.svg" />
  </a>
  <a href="https://github.com/groupultra/telegram-search/actions/workflows/ci.yaml">
    <img alt="CI" src="https://github.com/groupultra/telegram-search/actions/workflows/ci.yaml/badge.svg" />
  </a>
</p>

> [!TIP]
> Can't find Chinese, Japanese, or Korean messages with Telegram's built-in search? Important messages buried under endless chats?
>
> Telegram Search backs up your chats locally and gives you reliable multilingual, word-segmented search. The recommended `tg-search` CLI needs one local login; after that you can search from your terminal, or let AI agents such as Claude Code or Codex retrieve, organize, and summarize your history, without handing your data to a third party.

## 💖 Sponsors

![Sponsors](https://github.com/luoling8192/luoling8192/raw/master/sponsorkit/sponsors.svg)

> [!WARNING]
> This project has not issued any cryptocurrency. Beware of scams.
>
> This software is only for exporting and searching your own chat history. Do not use it for anything illegal.

## 🚀 Quick Start: CLI

`tg-search` is a local-first command-line tool. The login session, messages, and index stay in a profile directory on your machine (a PGlite database). No database server, Docker, or web service is needed.

### 1. Install

Install with Homebrew (macOS / Linux). Homebrew also installs the Node.js runtime:

```bash
brew tap groupultra/telegram-search https://github.com/groupultra/telegram-search
brew install groupultra/telegram-search/tg-search
```

### 2. Log in

```bash
tg-search auth login
```

Enter your phone number, the login code, and your two-step verification password if you have one. The CLI ships with Telegram Search's API ID and API hash, so **you do not need to register an app on my.telegram.org**. To use your own app credentials, see [Custom API credentials](#custom-api-credentials-optional).

### 3. Start the background service (recommended)

```bash
brew services start groupultra/telegram-search/tg-search
tg-search daemon status
```

The daemon keeps a Telegram connection open, starts when you log in to your computer, and saves new messages, edits, and deletions as they happen. Run `brew services` as your user, without `sudo`. Upgrades keep your profile data:

```bash
brew upgrade groupultra/telegram-search/tg-search
brew services restart groupultra/telegram-search/tg-search
```

### 4. Sync and search your history

```bash
# List chats (reads Telegram; nothing is stored)
tg-search chats list

# Sync the history of selected chats to the local database through Telegram Takeout
tg-search sync --takeout --chat 123456 --from 2026-01-01

# Search the local database without connecting to Telegram
tg-search search "project progress"
tg-search context --chat 123456 --message 42 --before 20 --after 20
```

If Telegram asks you to confirm the data export request (`TAKEOUT_AUTHORIZATION_REQUIRED`), approve it on one of your other Telegram devices and run the command again.

### Common commands

| Command | Purpose | Connects to Telegram |
| --- | --- | --- |
| `auth login` | Log in to the current profile interactively | Yes |
| `chats list` | List chats | Yes, nothing stored |
| `messages list --chat <id>` | Page through one chat; add `--query` to search on Telegram | Yes, nothing stored |
| `sync --takeout --chat <id>` / `--all` | Bulk-sync history to the local database through Takeout | Yes |
| `search <query>` | Local word-segmented search | No |
| `messages query` / `context` / `stats` | Local queries, surrounding context, statistics | No |
| `export --from --to --output <dir>` | Export monthly JSONL files with a checksum manifest | No |
| `daemon run` / `status` / `stop` | Run the daemon in the foreground or manage it | Yes |
| `profile inspect` / `doctor` | Check configuration and daemon health without printing secrets | No |

Every command accepts `--profile <name>` to keep accounts separate and `--json` for a stable JSON envelope. See the [CLI documentation](../packages/cli/README.md) for all commands, pagination, media reads, and privacy boundaries.

### 🤖 Use it with AI agents

The CLI is built for agents: a person runs `auth login` once on their machine, and the agent then combines commands to decide which chats to read and when to sync.

- With `--json`, stdout contains only the structured `{ ok, data, next_cursor, meta }` result. Logs, prompts, and progress go to stderr. Failures return a structured `error` and a non-zero exit code.
- Use `--output-file ./private/page.jsonl` to write a large result to a file; the terminal shows only a receipt.
- The repository includes an agent skill, [`.agents/skills/telegram-search-cli`](../.agents/skills/telegram-search-cli/SKILL.md), for Claude Code, Codex, and similar agents.
- **Privacy boundary**: an agent may add `--takeout` to `sync` only after the user agrees. Missing authorization, a refusal, or a failed Takeout initialization stops the sync; it never falls back to ordinary `GetHistory`. Exports contain no media binaries, login sessions, embeddings, or secrets, and the CLI itself performs no AI summarization.

```bash
tg-search --profile work chats list --limit 200 --json
tg-search --profile work search "project progress" --chat 123456 --json
tg-search --profile work export --from 2026-01-01 --to 2026-12-31 --timezone Asia/Singapore --output ./telegram-2026 --json
```

### Custom API credentials (optional)

The built-in Telegram Search app credentials are used by default. To use an app you registered at [my.telegram.org](https://my.telegram.org/apps), use either method; the first takes precedence:

```bash
# 1. Save them in the profile (the brew services daemon reads them too)
tg-search profile configure --apiId YOUR_API_ID --apiHash YOUR_API_HASH

# 2. Set environment variables (current shell only)
export TELEGRAM_API_ID=YOUR_API_ID TELEGRAM_API_HASH=YOUR_API_HASH
```

Provide the API ID and API hash together. Run `tg-search profile configure` with no flags to remove the profile's custom credentials and return to the built-in default.

### Remote read-only mode

Connect to a deployed Telegram Search server without downloading its database or Telegram session:

```bash
export TG_SEARCH_REMOTE_TOKEN=...   # server access token; not accepted in URLs or arguments
tg-search --profile cloud profile remote https://tgs.example.com
tg-search --profile cloud search "project progress"
```

### Build from source

```bash
git clone https://github.com/groupultra/telegram-search.git
cd telegram-search
pnpm install
pnpm run build:packages
pnpm -F @tg-search/cli build

pnpm cli auth login
pnpm cli chats list
```

## ✅ Feature Highlights

### 📦 Export & Backup
- [x] The local CLI uses its own PGlite database; the server supports PGlite and PostgreSQL
- [x] Bulk history sync through Telegram Takeout; the daemon saves new messages, edits, and deletions in real time
- [x] Monthly JSONL export with a time zone and SHA-256 checksum manifest
- [x] Server media can be backed up to MinIO object storage automatically

### 🔍 Chat Search
- [x] Automatic word segmentation for accurate multilingual search
- [x] The server combines fuzzy matching with vector semantic search, including text-to-image search
- [x] RAG chat: ask an AI questions answered from your history
- [x] Date range filters and deep links to the original messages

### 🤖 Agents & Bot
- [x] JSON / JSONL output and structured errors for agents
- [x] Remote read-only mode for agents to query a self-hosted server safely
- [x] Search and export messages through a Telegram bot
- [x] AI summaries of unread messages

## 🛣️ Roadmap

- [ ] Automatic chat summaries
- [ ] "Super brain": build a knowledge graph of people and events from your history
- [ ] Organize "Saved Messages" automatically
- [ ] Deep indexing of links and images: web page summaries, OCR, and image descriptions
- [ ] Support Discord and other messaging platforms

## 🖥️ Web Interface (optional)

Prefer a graphical interface? Use the hosted demo at https://search.lingogram.app, or deploy the web app yourself.

### Docker Compose

```bash
mkdir telegram-search && cd telegram-search
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/docker-compose.yml -o docker-compose.yml
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/.env.example -o .env
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/init.sql -o init.sql
docker compose -f docker-compose.yml up -d
```

Then open **http://localhost:3333** 🎉

### Docker Image

```bash
docker run -d --name telegram-search -p 3333:3333 ghcr.io/groupultra/telegram-search:latest
```

Without MinIO settings, media files are saved to the local `data/media` directory.

### Environment Variables

> [!IMPORTANT]
> AI embedding and LLM settings are configured **per account** in the app (Settings → API). After editing `.env`, run `docker compose -f docker-compose.yml up -d` again.

All environment variables are optional. The web app also ships with built-in Telegram API credentials, so you can log in without setting `TELEGRAM_API_ID`/`TELEGRAM_API_HASH`:

| Variable            | Description                                                                  | Example                                               |
| ------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| `TELEGRAM_API_ID`   | Custom Telegram app ID; the built-in credentials are used when unset          | `611335`                                              |
| `TELEGRAM_API_HASH` | Custom Telegram app hash; set it together with the ID                        | `d524b414d21f4d37f08684c1df41ac9c`                    |
| `DATABASE_TYPE`     | Database type: `postgres` or `pglite`                                        | `pglite`                                              |
| `DATABASE_URL`      | PostgreSQL connection string (only when `DATABASE_TYPE=postgres`)            | `postgresql://postgres:123456@pgvector:5432/postgres` |
| `TELEGRAM_BOT_TOKEN`| Telegram bot token created with [@BotFather](https://t.me/BotFather)         | `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`           |
| `PROXY_URL`         | Proxy URL, such as `socks5://user:pass@host:port`                            | `socks5://user:pass@host:port`                        |
| `PORT`              | Backend HTTP/WebSocket port                                                  | `3333`                                                |
| `HOST`              | Backend listen address                                                       | `0.0.0.0`                                             |
| `BACKEND_URL`       | Upstream backend for `/api` and `/ws` when Nginx is the reverse proxy        | `http://127.0.0.1:3333`                               |
| `MINIO_URL`         | MinIO endpoint                                                               | `http://minio:9000`                                   |
| `MINIO_ACCESS_KEY`  | MinIO access key                                                             | `minioadmin`                                          |
| `MINIO_SECRET_KEY`  | MinIO secret key                                                             | `minioadmin`                                          |
| `MINIO_BUCKET`      | MinIO bucket name                                                            | `telegram-media`                                      |

```bash
docker run -d --name telegram-search \
  -p 3333:3333 \
  -e DATABASE_TYPE=postgres \
  -e DATABASE_URL=postgresql://postgres:123456@localhost:5432/postgres \
  ghcr.io/groupultra/telegram-search:latest
```

## 💻 Development Guide

```bash
git clone https://github.com/groupultra/telegram-search.git
cd telegram-search
pnpm install
cp .env.example .env

# Browser-only mode
pnpm run dev

# Server mode
docker compose -f docker/docker-compose.dev.yml up -d pgvector minio
pnpm run server:dev
pnpm run web:dev
```

📖 **More development and architecture details:** [CONTRIBUTING.md](./CONTRIBUTING.md)

## 🚀 Activity

![Alt](https://repobeats.axiom.co/api/embed/69d5ef9f5e72cd7901b32ff71b5f359bc7ca42ea.svg "Repobeats analytics image")

<a href="https://star-history.dera.page/#groupultra/telegram-search&Date">
  <picture>
    <source
      media="(prefers-color-scheme: dark)"
      srcset="https://star-history.dera.page/svg?repos=groupultra/telegram-search&type=Date&theme=dark"
    />
    <source
      media="(prefers-color-scheme: light)"
      srcset="https://star-history.dera.page/svg?repos=groupultra/telegram-search&type=Date"
    />
    <img
      alt="Star History Chart"
      src="https://star-history.dera.page/svg?repos=groupultra/telegram-search&type=Date"
    />
  </picture>
</a>
