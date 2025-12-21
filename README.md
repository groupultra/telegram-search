![preview](./docs/assets/preview.png)

---

<p align="center">
  <a href="https://trendshift.io/repositories/13868" target="_blank"><img src="https://trendshift.io/api/badge/repositories/13868" alt="groupultra%2Ftelegram-search | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
</p>

<p align="center">
  [<a href="https://search.lingogram.app">立即体验</a>] [<a href="./docs/README_EN.md">English</a>] [<a href="./docs/README_JA.md">日本語</a>]
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
> 您是否曾因 Telegram 无法搜索中文聊天记录而苦恼？
> 
> 或者想查找一条重要消息，却因消息过多而难以定位？
>
> 现在，使用 Telegram Search，您可以轻松查找和导出自己的 Telegram 消息。强大的语义搜索支持所有语言，完美应对无分词句子的检索场景。
> 
> 同时支持向量搜索，实现句子级别的模糊匹配，让查找更智能、更准确。

## 💖 赞助者

![Sponsors](https://github.com/luoling8192/luoling8192/raw/master/sponsorkit/sponsors.svg)

## ✅ 功能特性

### 📦 导出与备份
- [x] 支持多种数据库导出聊天记录：PGlite、PostgreSQL
- [x] 媒体资源可自动导出至 MinIO 对象存储
- [x] 消息导出时自动完成向量嵌入和分词处理
- [x] 实时同步，自动拉取最新对话内容

### 🔍 聊天记录搜索
- [x] 智能分词精准检索，支持多语言
- [x] 支持模糊匹配与向量语义搜索，查找更高效
- [x] RAG 智能问答：直接与 AI 对话，基于历史上下文实时解答

## 🛣️ 未来规划

### 🧠 AI 赋能
- [ ] 自动生成会话总结
- [ ] 超级大脑：基于历史消息自动抽取人物与事件知识图谱

### 🔗 媒体与链接功能
- [ ] 智能整理“已保存消息”收藏夹，更高效管理重要内容
- [ ] 链接与图片深度索引：实现网页智能摘要、图片 OCR 文字识别与智能描述，赋能搜索与内容整理

### 🌐 多平台扩展
- [ ] 增加 Telegram Bot 支持，满足更多消息管理需求
- [ ] 支持扩展至 Discord 及其他社交/通讯平台，实现跨平台统一检索与备份

## 🎉 立即使用

我们提供了一个在线体验版，无需自行部署，即可体验 Telegram Search 的全部功能。

访问以下网址开始使用：https://search.lingogram.app

> [!WARNING]
> 本项目未发行任何虚拟货币，请警惕相关诈骗风险。
>
> 本软件仅供您导出和检索个人聊天记录使用，切勿将其用于任何违法用途。

## 🚀 快速开始

默认使用 PGlite 作为消息数据库，整体内存占用可能会偏高，如果需要使用更高性能的 PostgreSQL 数据库以及提供的 MinIO 作为媒体存储引擎，请参考下文自定义环境变量或者使用 `docker compose up -d` 启动全部服务。

镜像提供 latest 和 nightly 版本，请自行选择。

```bash
docker run -d --name telegram-search \
  -p 3333:3333 \
  -v telegram-search-data:/app/data \
  ghcr.io/groupultra/telegram-search:latest
```

然后打开 **http://localhost:3333** 即可使用 🎉

### 自定义环境变量

> [!IMPORTANT]
> AI Embedding & LLM 设置现在在应用内**按账户**配置（设置 → API）。

| 环境变量                      | 说明                                                                         | 示例值                                                |
| ----------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| `TELEGRAM_API_ID`             | 从 [my.telegram.org](https://my.telegram.org/apps) 获取的 Telegram 应用 ID   |                                                       |
| `TELEGRAM_API_HASH`           | 从 [my.telegram.org](https://my.telegram.org/apps) 获取的 Telegram 应用 Hash |                                                       |
| `DATABASE_TYPE`               | 数据库类型，可选 `postgres` 或 `pglite`                                      | `pglite`                                              |
| `DATABASE_URL`                | PostgreSQL 连接字符串（仅在 `DATABASE_TYPE=postgres` 时填写）                | `postgresql://postgres:123456@pgvector:5432/postgres` |
| `PROXY_URL`                   | 代理地址（支持如 `socks5://user:pass@host:port` 等格式）                     | `socks5://user:pass@host:port`                        |
| `PORT`                        | 后端服务 HTTP/WebSocket 监听端口                                             | `3333`                                                |
| `HOST`                        | 后端服务监听地址                                                             | `0.0.0.0`                                             |
| `BACKEND_URL`                 | Nginx 作为反向代理时用于 `/api` 和 `/ws` 的上游后端地址                      | `http://127.0.0.1:3333`                               |
| `MINIO_URL`                   | MinIO 服务地址                                                               | `http://minio:9000`                                   |
| `MINIO_ACCESS_KEY`            | MinIO 访问密钥                                                               | `minioadmin`                                          |
| `MINIO_SECRET_KEY`            | MinIO 访问密钥对应的密钥                                                     | `minioadmin`                                          |
| `MINIO_BUCKET`                | MinIO 存储桶名称                                                             | `telegram-media`                                      |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry OTLP 日志采集端点                                              | `http://loki:3100/otlp/v1/logs`                       |

**使用 PostgreSQL 的示例：**

```bash
docker run -d --name telegram-search \
  -p 3333:3333 \
  -v telegram-search-data:/app/data \
  -e DATABASE_TYPE=postgres \
  -e DATABASE_URL=postgresql://<host>:5432/postgres \
  ghcr.io/groupultra/telegram-search:latest
```

**代理格式：**
- SOCKS5: `socks5://user:pass@host:port`
- SOCKS4: `socks4://user:pass@host:port`
- HTTP: `http://user:pass@host:port`
- MTProxy: `mtproxy://secret@host:port`

### 使用 Docker Compose 启动

1. 下载 Docker Compose 文件：
```bash
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/docker-compose.yml -o docker-compose.yml
```

2. 启动全部服务（包括数据库、MinIO 等）：

```bash
docker compose -f docker/docker-compose.yml up -d
```

3. 访问 `http://localhost:3333` 打开搜索界面。

## 💻 开发指南

### 纯浏览器模式

```bash
git clone https://github.com/groupultra/telegram-search.git
cd telegram-search
pnpm install
cp .env.example .env
pnpm run dev
```

### 服务器模式

```bash
git clone https://github.com/groupultra/telegram-search.git
cd telegram-search
pnpm install

cp .env.example .env

docker compose -f docker/docker-compose.dev.yml up -d pgvector minio

pnpm run server:dev
pnpm run web:dev
```

📖 **更多开发细节和架构细节：** [CONTRIBUTING.md](./CONTRIBUTING.md)

## 🚀 Activity

![Alt](https://repobeats.axiom.co/api/embed/69d5ef9f5e72cd7901b32ff71b5f359bc7ca42ea.svg "Repobeats analytics image")

[![Star History Chart](https://api.star-history.com/svg?repos=groupultra/telegram-search&type=Date)](https://star-history.com/#groupultra/telegram-search&Date)
