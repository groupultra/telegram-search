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
> Important messages often get lost in the noise — especially when word boundaries aren’t clear.
>
> Telegram Search solves this with advanced semantic search and word segmentation, fully supporting CJK and all languages. 
>
> Vector search enables fuzzy, sentence-level matching, making it easy to find the information you need—even in languages without spaces.

## 💖 Sponsors

![Sponsors](https://github.com/luoling8192/luoling8192/raw/master/sponsorkit/sponsors.svg)

## ✅ Feature Highlights

### 📦 Export & Backup
- [x] Export chat history to multiple database types: supports both PGlite and PostgreSQL
- [x] Media files are automatically backed up to MinIO object storage—no manual steps required
- [x] Automatic vector embedding and tokenization during export for precise future search
- [x] Real-time sync keeps all conversations updated continuously

### 🔍 Chat Record Search
- [x] Intelligent word segmentation for accurate, multilingual retrieval
- [x] Combines fuzzy matching with vector-based semantic search for highly efficient results
- [x] RAG-powered AI Q&A: Chat with AI using your Telegram history as real-time context

### 🚀 Advanced Features
- [x] Smart unread message summaries: Instantly aggregate all unread content with a concise AI-generated summary

## 🛣️ Roadmap

### 🧠 Enhanced AI Capabilities
- [ ] Automatic session summaries
- [ ] "Super Brain": Build knowledge graphs of people and events directly from your chat records

### 🔗 Media & Link Extensions
- [ ] Intelligently organize your "Saved Messages" for efficient content management
- [ ] Deep link and image indexing: web page summarization, OCR for images, AI-driven captions—powerful search & archival

### 🌐 Multi-platform Integration
- [ ] Add Telegram Bot support for versatile message management
- [ ] Expand to Discord and other major social/messaging platforms for unified search and backup


## 🎉 Try It Now

We offer an online experience—no deployment needed. Try all Telegram Search features instantly.

Visit: https://search.lingogram.app

> [!WARNING]
> No cryptocurrency has been issued by us. Please beware of scams.
>
> This tool exports only your own chat history. Do not use it for illegal purposes.

## 🚀 Quick Start

### Deploy with Docker Compose

The recommended way to self-host is with Docker Compose. This launches the UI, backend, database, and media storage in one step.

1. Create an empty folder for your Telegram Search data and config:
```bash
mkdir telegram-search
cd telegram-search
```

2. Download the Docker Compose and default environment files:
```bash
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/docker-compose.yml -o docker-compose.yml
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/.env.example -o .env
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/init.sql -o init.sql
```

3. Start all containers:
```bash
docker compose -f docker-compose.yml up -d
```

4. Open **http://localhost:3333** in your browser to start using Telegram Search! 🎉

### Environment Variables

> [!IMPORTANT]
> AI Embedding & LLM settings are now **per-account** in-app (Settings → API).
> 
> PGLite will be deprecated in the future due to performance reasons. PostgreSQL is recommended.
>
> Please restart the service after modifying the `.env` file by running `docker compose -f docker-compose.yml up -d`.

| Variable                      | Description                                                  | Example                                               |
| ----------------------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| `TELEGRAM_API_ID`             | From [my.telegram.org](https://my.telegram.org/apps)         |                                                       |
| `TELEGRAM_API_HASH`           | From [my.telegram.org](https://my.telegram.org/apps)         |                                                       |
| `DATABASE_TYPE`               | Database type: `postgres` or `pglite`                        | `pglite`                                              |
| `DATABASE_URL`                | PostgreSQL connection string (`DATABASE_TYPE=postgres` only) | `postgresql://postgres:123456@pgvector:5432/postgres` |
| `PROXY_URL`                   | Proxy address (formats like `socks5://user:pass@host:port`)  | `socks5://user:pass@host:port`                        |
| `PORT`                        | Backend HTTP/WebSocket listening port                        | `3333`                                                |
| `HOST`                        | Backend listening address                                    | `0.0.0.0`                                             |
| `BACKEND_URL`                 | Upstream backend for Nginx `/api`/`/ws` proxy                | `http://127.0.0.1:3333`                               |
| `MINIO_URL`                   | MinIO service address                                        | `http://minio:9000`                                   |
| `MINIO_ACCESS_KEY`            | MinIO access key                                             | `minioadmin`                                          |
| `MINIO_SECRET_KEY`            | MinIO secret key                                             | `minioadmin`                                          |
| `MINIO_BUCKET`                | MinIO bucket name                                            | `telegram-media`                                      |

## 💻 Development Guide

### Browser-only Mode

```bash
git clone https://github.com/groupultra/telegram-search.git
cd telegram-search
pnpm install
cp .env.example .env
pnpm run dev
```

### Server Mode

```bash
git clone https://github.com/groupultra/telegram-search.git
cd telegram-search
pnpm install

cp .env.example .env

docker compose up -d pgvector minio

pnpm run server:dev
pnpm run web:dev
```

📖 **More details:** [CONTRIBUTING.md](../docs/CONTRIBUTING.md)

## 🚀 Activity

![Alt](https://repobeats.axiom.co/api/embed/69d5ef9f5e72cd7901b32ff71b5f359bc7ca42ea.svg "Repobeats analytics image")

[![Star History Chart](https://api.star-history.com/svg?repos=groupultra/telegram-search&type=Date)](https://star-history.com/#groupultra/telegram-search&Date)
