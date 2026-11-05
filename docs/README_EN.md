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
> Struggling to search Chinese, Japanese, or Korean (CJK) messages in Telegram?
>
> Important messages often get lost in the noise, especially when word boundaries aren't clear.
>
> Telegram Search backs up your messages and indexes them with word segmentation, so CJK and other languages without spaces can be searched by word.
>
> Vector search adds fuzzy, sentence-level matching, and AI features include unread-message summaries and an AI assistant.
>
> We recommend the `tgs` CLI: log in once on your machine, then search from the terminal or let AI agents such as Claude Code or Codex call it.

## 💖 Sponsors

![Sponsors](https://github.com/luoling8192/luoling8192/raw/master/sponsorkit/sponsors.svg)

> [!WARNING]
> This project has issued no cryptocurrency; beware of scams. Use it only to export and search your own chats, never for anything illegal.

## 🚀 Quick Start: CLI

```bash
# Install (macOS / Linux). The command is tgs; the old tg-search still works
brew tap groupultra/telegram-search https://github.com/groupultra/telegram-search
brew install groupultra/telegram-search/tg-search

# Log in (API ID / hash are built in; no my.telegram.org app needed)
tgs auth login

# Run in the background and save new messages (as your user, no sudo)
brew services start groupultra/telegram-search/tg-search

# Sync history and search
tgs chats list
tgs sync --takeout --chat 123456 --from 2026-01-01
tgs search "project progress"
```

If `sync --takeout` returns `TAKEOUT_AUTHORIZATION_REQUIRED`, approve the export request on another Telegram device and retry.

### Common commands

| Command | Purpose | Telegram |
| --- | --- | --- |
| `auth login` | Log in | Yes |
| `chats list` / `messages list --chat <id>` | Read chats and messages; writes nothing locally | Yes |
| `sync --takeout --chat <id>` / `--all` | Sync history locally | Yes |
| `search` / `context` / `messages query` / `stats` | Local search, context, queries, statistics | No |
| `export --from --to --output <dir>` | Export monthly JSONL | No |
| `daemon run` / `status` / `stop` | Manage the daemon | Yes |
| `profile inspect` / `doctor` | Check configuration and daemon health | No |

`--profile <name>` separates accounts; `--json` prints JSON. See the [CLI documentation](../packages/cli/README.md).

### 🤖 Use with AI agents

After the user runs `auth login` once, an agent can call commands with `--json`: stdout carries only the structured result, and logs and progress go to stderr. Load the bundled [agent skill](../.agents/skills/telegram-search-cli/SKILL.md).

An agent may use `sync --takeout` only after the user agrees.

### Custom API credentials (optional)

```bash
tgs profile configure --apiId YOUR_API_ID --apiHash YOUR_API_HASH   # save in the profile
export TELEGRAM_API_ID=YOUR_API_ID TELEGRAM_API_HASH=YOUR_API_HASH          # or use the environment
```

Set both together; the profile wins. Run `profile configure` with no flags to return to the built-in credentials.

### Remote read-only mode

```bash
export TG_SEARCH_REMOTE_TOKEN=...
tgs --profile cloud profile remote https://tgs.example.com
tgs --profile cloud search "project progress"
```

### Build from source

```bash
pnpm install && pnpm run build:packages && pnpm -F @tg-search/cli build
pnpm cli auth login
```

## ✅ Features

- [x] Bulk history sync via Takeout; the daemon saves new messages, edits, and deletions
- [x] Word-segmented search; the server adds vector semantic search and text-to-image search
- [x] Monthly JSONL export with a SHA-256 manifest
- [x] RAG Q&A and AI summaries of unread messages
- [x] Search and export through a Telegram bot
- [x] Server media backup to MinIO

## 🛣️ Roadmap

- [ ] Automatic chat summaries
- [ ] "Super brain": a knowledge graph of people and events from your history
- [ ] Automatic organization of Saved Messages
- [ ] Link and image indexing: page summaries, OCR, image descriptions
- [ ] Discord and other platforms

## 🖥️ Web Interface (optional)

Demo: [search.lingogram.app](https://search.lingogram.app). To self-host:

```bash
mkdir telegram-search && cd telegram-search
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/docker-compose.yml -o docker-compose.yml
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/.env.example -o .env
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/init.sql -o init.sql
docker compose -f docker-compose.yml up -d
```

Then open [localhost:3333](http://localhost:3333). Or run the image alone (without MinIO, media goes to `data/media`):

```bash
docker run -d -p 3333:3333 ghcr.io/groupultra/telegram-search:latest
```

### Environment Variables

All optional. AI embedding / LLM settings are per account in the app (Settings → API).

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

## 💻 Development Guide

```bash
pnpm install && cp .env.example .env
pnpm run dev                                                    # browser-only mode
docker compose -f docker/docker-compose.dev.yml up -d pgvector minio
pnpm run server:dev                                             # server mode; run web:dev in another terminal
pnpm run web:dev
```

More in [CONTRIBUTING.md](./CONTRIBUTING.md).

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
