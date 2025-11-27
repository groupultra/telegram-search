![preview](./assets/preview.png)

---

<p align="center">
  <a href="https://trendshift.io/repositories/13868" target="_blank"><img src="https://trendshift.io/api/badge/repositories/13868" alt="groupultra%2Ftelegram-search | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
</p>

<p align="center">
  [<a href="https://search.lingogram.app">立即体验</a>] [<a href="../README.md">English</a>] [<a href="./README_JA.md">日本語</a>]
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

**轻松查找和导出您的 Telegram 消息，强大的语义搜索支持所有语言和无分词句子。**

让消息检索更快速、更准确、更注重隐私 — 自托管或在线试用。

## 💖 赞助者

![Sponsors](https://github.com/luoling8192/luoling8192/raw/master/sponsorkit/sponsors.svg)

## ✅ 功能特性

### 📦 导出与备份
- [x] 导出到 PostgreSQL 或浏览器数据库（PGlite）
- [x] 通用导出格式，便于导入任何数据库
- [ ] 一键导出为 CSV / JSON

### 🔍 搜索聊天历史
- [x] 关键词搜索：多语言支持（中文、英文等）
- [x] 自然语言搜索：像提问一样查找消息
- [x] 智能过滤：按联系人/群组、时间范围、包含附件等

### 🔄 同步与存储
- [x] 增量同步：边使用边同步
- [x] 存储选项：服务器模式（PostgreSQL + pgvector）或纯浏览器模式（PGlite）
- [ ] 断点续传：失败后自动继续

### 🧠 AI 能力
- [x] 向 AI 询问聊天内容：查询当前聊天或选定范围
- [ ] AI 消息摘要：自动提取关键点、待办事项、结论
- [x] AI 驱动搜索：自然语言查询并精确定位结果
- [x] AI 聊天：基于聊天上下文与 AI 对话
- [ ] AI 分析：趋势、情感、关键词、链接和文件洞察
- [ ] 本地模型支持：本地 Embedding / 推理（无需云服务）

### 🔗 媒体与链接（规划中）
- [ ] 链接和图片深度索引：网页摘要、图片 OCR/描述
- [ ] 附件内容提取：PDF、图片、音视频关键帧和文本

### 🌐 更多平台（规划中）
- [ ] 多客户端支持：Discord 等

## 🌐 立即使用

我们提供了一个在线版本，无需自行部署，即可体验 Telegram Search 的全部功能。

> [!NOTE]
> 我们承诺不会收集任何用户隐私数据，您可以放心使用

访问以下网址开始使用：https://search.lingogram.app

## 🚀 快速开始

### 1 分钟启动（Docker）

> [!IMPORTANT]
> 最简单的开始方式 — 无需任何配置。所有功能都使用合理的默认设置。

```bash
docker run -d --name telegram-search \
  -p 3333:3333 \
  -v telegram-search-data:/app/data \
  ghcr.io/groupultra/telegram-search:latest
```

然后打开 **http://localhost:3333** 🎉

### 高级配置（可选）

<details>
<summary>🔧 环境变量</summary>

> [!TIP]
> 所有环境变量都是可选的。仅在需要时自定义。

| 变量 | 说明 |
| --- | --- |
| `TELEGRAM_API_ID` | 来自 [my.telegram.org](https://my.telegram.org/apps) 的 Telegram 应用 ID |
| `TELEGRAM_API_HASH` | Telegram 应用 Hash |
| `DATABASE_TYPE` | `postgres` 或 `pglite`（默认：`pglite`） |
| `DATABASE_URL` | PostgreSQL 连接字符串（仅当 `DATABASE_TYPE=postgres` 时） |
| `EMBEDDING_API_KEY` | OpenAI/Ollama 的 API 密钥 |
| `EMBEDDING_BASE_URL` | 自定义 Embedding API 基础 URL |
| `EMBEDDING_PROVIDER` | `openai` 或 `ollama` |
| `EMBEDDING_MODEL` | 模型名称 |
| `EMBEDDING_DIMENSION` | Embedding 维度（如 `1536`、`1024`、`768`） |
| `PROXY_URL` | 代理 URL（如 `socks5://user:pass@host:port`） |

**使用 PostgreSQL 和 Embeddings 的示例：**

```bash
docker run -d --name telegram-search \
  -p 3333:3333 \
  -v telegram-search-data:/app/data \
  -e TELEGRAM_API_ID=611335 \
  -e TELEGRAM_API_HASH=d524b414d21f4d37f08684c1df41ac9c \
  -e DATABASE_TYPE=postgres \
  -e DATABASE_URL=postgresql://<postgres-host>:5432/postgres \
  -e EMBEDDING_API_KEY=sk-xxxx \
  -e EMBEDDING_BASE_URL=https://api.openai.com/v1 \
  ghcr.io/groupultra/telegram-search:latest
```

**代理格式：**
- SOCKS5: `socks5://user:pass@host:port`
- SOCKS4: `socks4://user:pass@host:port`
- HTTP: `http://user:pass@host:port`
- MTProxy: `mtproxy://secret@host:port`

📖 **完整环境变量参考：** [docs/ENVIRONMENT.md](./ENVIRONMENT.md)

</details>

### 使用 Docker Compose 启动

1. 克隆仓库。

2. 运行 docker compose 启动包括数据库在内的全部服务：

```bash
docker compose up -d
```

3. 访问 `http://localhost:3333` 打开搜索界面。

## 💻 开发指南

> [!CAUTION]
> 开发需要 **Node.js >= 22.18** 和 **pnpm**。请确保已安装。

### 纯浏览器模式

```bash
git clone https://github.com/groupultra/telegram-search.git
cd telegram-search
pnpm install
cp .env.example .env
pnpm run dev
```

### 服务器模式（带后端）

```bash
git clone https://github.com/groupultra/telegram-search.git
cd telegram-search
pnpm install
cp config/config.example.yaml config/config.yaml

# 启动数据库（Docker）
docker compose up -d pgvector

# 启动后端和前端
pnpm run server:dev  # 终端 1
pnpm run web:dev     # 终端 2
```

📖 **更多开发细节：** [CONTRIBUTING.md](../CONTRIBUTING.md)

## 🏗️ 架构

本项目采用**事件驱动架构**的 **monorepo** 结构：

- **`apps/web`**: Vue 3 前端
- **`apps/server`**: WebSocket 服务器
- **`packages/client`**: 客户端适配器和 stores（Pinia）
- **`packages/core`**: 事件总线（EventEmitter3）、服务、数据库模型（Drizzle ORM）
- **`packages/common`**: 日志和工具

**核心技术：**
- 事件驱动：`CoreContext`（EventEmitter3）
- 实时通信：WebSocket
- 数据库：PostgreSQL + pgvector 或 PGlite（浏览器内）
- 消息处理管道：Embedding、Jieba、Link、Media、User resolvers

📖 **完整架构细节、事件流和图表：** [CONTRIBUTING.md](../CONTRIBUTING.md)

## 🚨 警告
> [!WARNING]
> 我们未发行任何虚拟货币，请勿上当受骗。

> [!CAUTION]
> 本软件仅可导出您自己的聊天记录以便搜索，请勿用于非法用途。

## 🚀 Activity

![Alt](https://repobeats.axiom.co/api/embed/69d5ef9f5e72cd7901b32ff71b5f359bc7ca42ea.svg "Repobeats analytics image")

[![Star History Chart](https://api.star-history.com/svg?repos=groupultra/telegram-search&type=Date)](https://star-history.com/#groupultra/telegram-search&Date)
