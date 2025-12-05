![preview](./docs/assets/preview.png)

---

<p align="center">
  <a href="https://trendshift.io/repositories/13868" target="_blank"><img src="https://trendshift.io/api/badge/repositories/13868" alt="groupultra%2Ftelegram-search | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
</p>

<p align="center">
   [<a href="https://search.lingogram.app">Try it Now</a>] [<a href="./docs/README_CN.md">简体中文</a>] [<a href="./docs/README_JA.md">日本語</a>]
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
  <a href="https://app.netlify.com/sites/tgsearch/deploys">
    <img alt="Netlify Status" src="https://api.netlify.com/api/v1/badges/89bfbfd2-0f73-41b0-8db4-4ab6b6512f6e/deploy-status" />
  </a>
</p>

**Easily find and export your Telegram messages with powerful semantic search, supporting all languages and unsegmented sentences.**

Make message retrieval fast, accurate, and privacy-friendly — self-host or try online.

## 💖 Sponsors

![Sponsors](https://github.com/luoling8192/luoling8192/raw/master/sponsorkit/sponsors.svg)

## ✅ What Can It Do

### 📦 Export & Backup
- [x] Export to PostgreSQL or in-browser database (PGlite)
- [x] Universal export format for easy import to any database
- [ ] One-click export to CSV / JSON

### 🔍 Search Your Chat History
- [x] Keyword search: multi-language support (Chinese, English, etc.)
- [x] Natural language search: find messages like asking a question
- [x] Smart filters: by contact/group, time range, with attachments, etc.

### 🔄 Sync & Storage
- [x] Incremental sync: sync while using
- [x] Storage options: server (PostgreSQL + pgvector) or browser-only mode (PGlite)
- [ ] Resume from breakpoint: auto-continue after failure

### 🧠 AI Capabilities
- [x] Ask AI about your chats: query current chat or selected range
- [ ] AI message summary: auto-extract key points, todos, conclusions
- [x] AI-powered search: natural language queries with pinpointed results
- [x] AI chat: converse with AI based on your chat context
- [ ] AI analysis: trends, sentiment, keywords, insights from links & files
- [ ] Local model support: local Embedding / inference (no cloud required)

### 🔗 Media & Links (Planned)
- [ ] Deep indexing for links & images: web summaries, image OCR/descriptions
- [ ] Attachment content extraction: PDFs, images, audio/video key frames & text

### 🌐 More Platforms (Planned)
- [ ] Multi-client support: Discord, etc.

## 🌐 Try it Now

We provide an online version where you can experience all features of Telegram Search without self-deployment.

> [!NOTE]
> We promise not to collect any user privacy data, you can use it with confidence

Visit: https://search.lingogram.app

## 🚀 Quick Start (Self-Hosted)

### 1-Minute Start with Docker

> [!IMPORTANT]
> The simplest way to get started — no configuration needed. All features work with sensible defaults.

```bash
docker run -d --name telegram-search \
  -p 3333:3333 \
  -v telegram-search-data:/app/data \
  ghcr.io/groupultra/telegram-search:latest
```

Then open **http://localhost:3333** 🎉

### Advanced Setup (Optional, Environment Variables)

<details>
<summary>🔧 Environment Variables</summary>

> [!TIP]
> All environment variables are optional. Customize only if needed.

| Variable | Description |
| --- | --- |
| `TELEGRAM_API_ID` | Telegram app ID from [my.telegram.org](https://my.telegram.org/apps) |
| `TELEGRAM_API_HASH` | Telegram app hash |
| `DATABASE_TYPE` | `postgres` or `pglite` (default: `pglite`) |
| `DATABASE_URL` | PostgreSQL connection string (only when `DATABASE_TYPE=postgres`) |
| `PROXY_URL` | Proxy URL (e.g. `socks5://user:pass@host:port`) |

> [!IMPORTANT]
> AI Embedding & LLM settings are now configured **per account inside the app** (Settings → API).  
> Environment variables like `EMBEDDING_API_KEY`, `EMBEDDING_MODEL`, etc. are deprecated and will be removed in a future release.

**Example with PostgreSQL:**

```bash
docker run -d --name telegram-search \
  -p 3333:3333 \
  -v telegram-search-data:/app/data \
  -e TELEGRAM_API_ID=611335 \
  -e TELEGRAM_API_HASH=d524b414d21f4d37f08684c1df41ac9c \
  -e DATABASE_TYPE=postgres \
  -e DATABASE_URL=postgresql://<postgres-host>:5432/postgres \
  ghcr.io/groupultra/telegram-search:latest
```

**Proxy formats:**
- SOCKS5: `socks5://user:pass@host:port`
- SOCKS4: `socks4://user:pass@host:port`
- HTTP: `http://user:pass@host:port`
- MTProxy: `mtproxy://secret@host:port`

📖 **Full environment variable reference:** [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md)

</details>

### Start with Docker Compose

1. Clone repository.

2. Run docker compose to start all services including the database:

```bash
docker compose up -d
```

3. Access `http://localhost:3333` to open the search interface.

## 💻 Development Guide

> [!CAUTION]
> Development requires **Node.js >= 24.11** and **pnpm**. Make sure you have them installed.

### Browser-Only Mode

```bash
git clone https://github.com/groupultra/telegram-search.git
cd telegram-search
pnpm install
cp .env.example .env
pnpm run dev
```

### Server Mode (with Backend)

```bash
git clone https://github.com/groupultra/telegram-search.git
cd telegram-search
pnpm install

# Copy and adjust environment variables (Telegram keys, DB type/URL, proxy, etc.)
cp .env.example .env
# Optionally override in .env.local (ignored by Git)

# Start PostgreSQL with pgvector (or point DATABASE_URL to your own DB)
docker compose up -d pgvector

# Start backend & frontend (two terminals)
pnpm run server:dev  # Terminal 1: WebSocket server (uses .env/.env.local via dotenvx)
pnpm run web:dev     # Terminal 2: Vue frontend
```

📖 **More development details:** [CONTRIBUTING.md](./CONTRIBUTING.md)

## 🏗️ Architecture

This project is a **monorepo** with event-driven architecture:

- **`apps/web`**: Vue 3 frontend
- **`apps/server`**: WebSocket server
- **`packages/client`**: Client adapters & stores (Pinia)
- **`packages/core`**: Event bus (EventEmitter3), services, database models (Drizzle ORM)
- **`packages/common`**: Logger & utilities

**Key Technologies:**
- Event-driven with `CoreContext` (EventEmitter3)
- Real-time communication via WebSocket
- PostgreSQL + pgvector OR PGlite (in-browser)
- Message processing pipeline: Embedding, Jieba, Link, Media, User resolvers

📖 **Full architecture details, event flow, and diagrams:** [CONTRIBUTING.md](./CONTRIBUTING.md)

## 🚨 Warnings
> [!WARNING]
> We have not issued any virtual currency, please do not be deceived.

> [!CAUTION]
> This software can only export your own chat records for search, please do not use it for illegal purposes.

## 🚀 Activity

![Alt](https://repobeats.axiom.co/api/embed/69d5ef9f5e72cd7901b32ff71b5f359bc7ca42ea.svg "Repobeats analytics image")

[![Star History Chart](https://api.star-history.com/svg?repos=groupultra/telegram-search&type=Date)](https://star-history.com/#groupultra/telegram-search&Date)

