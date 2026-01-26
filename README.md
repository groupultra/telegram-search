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
> 是否曾因 Telegram 无法搜索中文聊天记录而困扰？
>
> 或者想查找一条重要消息，却被海量消息淹没，难以定位？
>
> 有了 Telegram Search，您可以便捷地备份并检索自己的 Telegram 消息。无论任何语言，强大的本地分词能力都能准确命中。
>
> 支持向量搜索，实现句子智能模糊匹配，查找信息更快速精准。
>
> 更多 AI 驱动场景，支持未读消息智能摘要、AI 助手对话等丰富功能体验。

## 💖 赞助者

![Sponsors](https://github.com/luoling8192/luoling8192/raw/master/sponsorkit/sponsors.svg)

## ✅ 功能亮点

### 📦 导出与备份
- [x] 支持多种数据库导出聊天记录：兼容 PGlite 与 PostgreSQL
- [x] 媒体资源可自动备份至 MinIO 对象存储，无需手动干预
- [x] 消息导出时自动完成向量嵌入与分词处理，助力后续精准检索
- [x] 实时同步，自动拉取并更新最新对话内容

### 🔍 聊天记录搜索
- [x] 自动智能分词，支持多语言精准检索
- [x] 融合模糊匹配与向量语义搜索，查找效率更高
- [x] RAG 智能问答：直接与 AI 聊天，基于历史上下文获得实时解答

### 🚀 高级功能
- [x] 未读消息智能摘要：一键汇总全部未读消息，自动生成精炼摘要，重点内容一目了然

## 🛣️ 路线展望

### 🧠 AI 能力增强
- [ ] 自动生成会话总结
- [ ] “超级大脑”：基于历史消息，自动构建人物与事件的知识图谱

### 🔗 媒体与链接拓展
- [ ] 智能整理“已保存消息”收藏夹，提升内容管理效率
- [ ] 链接与图片深度索引：网页摘要、图片 OCR 文字识别及智能描述，助力搜索与归档

### 🌐 多平台融合
- [ ] 新增 Telegram Bot 支持，满足多元消息管理需求
- [ ] 跨平台扩展：支持 Discord 及其他主流社交/通讯平台，实现统一检索与备份

## 🎉 立即使用

我们提供了一个在线体验版，无需自行部署，即可体验 Telegram Search 的全部功能。

访问以下网址开始使用：https://search.lingogram.app

> [!WARNING]
> 本项目未发行任何虚拟货币，请警惕相关诈骗风险。
>
> 本软件仅供您导出和检索个人聊天记录使用，切勿将其用于任何违法用途。

## 🚀 快速开始

### 使用 Docker Compose

1. 新建一个空目录，用于存放 Telegram Search 的配置和数据：
```bash
mkdir telegram-search
cd telegram-search
```

2. 下载 Docker Compose 文件并启动全部服务（包括数据库、MinIO 等）：
```bash
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/docker-compose.yml -o docker-compose.yml
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/.env.example -o .env
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/init.sql -o init.sql
docker compose -f docker-compose.yml up -d
```

3. 然后打开 **http://localhost:3333** 即可使用 🎉

### 使用 Docker Image

若未配置 MinIO 相关参数，媒体文件将默认保存至本地的 `data/media` 目录。

```bash
docker run -d --name telegram-search -p 3333:3333 ghcr.io/groupultra/telegram-search:latest
```

### 自定义环境变量

> [!IMPORTANT]
> AI Embedding & LLM 设置现在在应用内**按账户**配置（设置 → API）。
>
> 请在修改完成 `.env` 文件后，再次执行 `docker compose -f docker-compose.yml up -d` 启动服务。

以下环境变量全部为可选，如果不填写，则会使用默认值。

| 环境变量            | 说明                                                                         | 示例值                                                |
| ------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| `TELEGRAM_API_ID`   | 从 [my.telegram.org](https://my.telegram.org/apps) 获取的 Telegram 应用 ID   | `611335`                                              |
| `TELEGRAM_API_HASH` | 从 [my.telegram.org](https://my.telegram.org/apps) 获取的 Telegram 应用 Hash | `d524b414d21f4d37f08684c1df41ac9c`                    |
| `DATABASE_TYPE`     | 数据库类型，可选 `postgres` 或 `pglite`                                      | `pglite`                                              |
| `DATABASE_URL`      | PostgreSQL 连接字符串（仅在 `DATABASE_TYPE=postgres` 时填写）                | `postgresql://postgres:123456@pgvector:5432/postgres` |
| `PROXY_URL`         | 代理地址（支持如 `socks5://user:pass@host:port` 等格式）                     | `socks5://user:pass@host:port`                        |
| `PORT`              | 后端服务 HTTP/WebSocket 监听端口                                             | `3333`                                                |
| `HOST`              | 后端服务监听地址                                                             | `0.0.0.0`                                             |
| `BACKEND_URL`       | Nginx 作为反向代理时用于 `/api` 和 `/ws` 的上游后端地址                      | `http://127.0.0.1:3333`                               |
| `MINIO_URL`         | MinIO 服务地址                                                               | `http://minio:9000`                                   |
| `MINIO_ACCESS_KEY`  | MinIO 访问密钥                                                               | `minioadmin`                                          |
| `MINIO_SECRET_KEY`  | MinIO 访问密钥对应的密钥                                                     | `minioadmin`                                          |
| `MINIO_BUCKET`      | MinIO 存储桶名称                                                             | `telegram-media`                                      |

#### 使用 Docker Image 环境变量

请根据自己的需要自行修改环境变量。

```bash
docker run -d --name telegram-search \
  -p 3333:3333 \
  -e DATABASE_TYPE=postgres \
  -e DATABASE_URL=postgresql://postgres:123456@localhost:5432/postgres \
  ghcr.io/groupultra/telegram-search:latest
```

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

📖 **更多开发细节和架构细节：** [CONTRIBUTING.md](./docs/CONTRIBUTING.md)

## 🚀 Activity

![Alt](https://repobeats.axiom.co/api/embed/69d5ef9f5e72cd7901b32ff71b5f359bc7ca42ea.svg "Repobeats analytics image")

[![Star History Chart](https://api.star-history.com/svg?repos=groupultra/telegram-search&type=Date)](https://star-history.com/#groupultra/telegram-search&Date)
