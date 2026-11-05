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
> 有了 Telegram Search，您可以备份并检索自己的 Telegram 消息。消息在本地分词后建立索引，中文等不以空格分词的语言也能按词命中。
>
> 支持向量搜索，按句子语义模糊匹配。还支持未读消息 AI 摘要、AI 助手对话等功能。
>
> 推荐使用 `tgs` CLI：本地登录一次，就能在终端检索，也可以交给 Claude Code、Codex 等 AI Agent 调用。

## 💖 赞助者

![Sponsors](https://github.com/luoling8192/luoling8192/raw/master/sponsorkit/sponsors.svg)

> [!WARNING]
> 本项目未发行任何虚拟货币，请警惕诈骗。本软件仅供导出和检索个人聊天记录，切勿用于违法用途。

## 🚀 快速开始：CLI

```bash
# 安装（macOS / Linux）。命令为 tgs，旧命令 tg-search 仍可用
brew tap groupultra/telegram-search https://github.com/groupultra/telegram-search
brew install groupultra/telegram-search/tg-search

# 登录（已内置 API ID / Hash，无需到 my.telegram.org 申请）
tgs auth login

# 后台常驻，实时保存新消息（以当前用户运行，不要 sudo）
brew services start groupultra/telegram-search/tg-search

# 同步历史并搜索
tgs chats list
tgs sync --takeout --chat 123456 --from 2026-01-01
tgs search "项目进展"
```

`sync --takeout` 如返回 `TAKEOUT_AUTHORIZATION_REQUIRED`，在其他 Telegram 设备上批准导出请求后重试。

### 常用命令

| 命令 | 作用 | 连接 Telegram |
| --- | --- | --- |
| `auth login` | 登录 | 是 |
| `chats list` / `messages list --chat <id>` | 读取会话和消息，不写入本地 | 是 |
| `sync --takeout --chat <id>` / `--all` | 同步历史到本地 | 是 |
| `search` / `context` / `messages query` / `stats` | 本地检索、上下文、查询、统计 | 否 |
| `export --from --to --output <dir>` | 导出按月 JSONL | 否 |
| `daemon run` / `status` / `stop` | 管理 daemon | 是 |
| `profile inspect` / `doctor` | 检查配置和 daemon 状态 | 否 |

`--profile <name>` 隔离多个账号，`--json` 输出 JSON。完整说明见 [CLI 文档](./packages/cli/README.md)。

### 🤖 交给 AI Agent

用户本地 `auth login` 一次后，Agent 即可用 `--json` 调用命令：stdout 只有结构化结果，日志和进度写入 stderr。可直接加载仓库内的 [Agent skill](./.agents/skills/telegram-search-cli/SKILL.md)。

Agent 只有在用户同意后才能使用 `sync --takeout`。

### 自定义 API 凭据（可选）

```bash
tgs profile configure --apiId YOUR_API_ID --apiHash YOUR_API_HASH   # 写入 profile
export TELEGRAM_API_ID=YOUR_API_ID TELEGRAM_API_HASH=YOUR_API_HASH          # 或用环境变量
```

两项须成对提供，profile 优先。不带参数运行 `profile configure` 恢复内置凭据。

### 远程只读模式

```bash
export TG_SEARCH_REMOTE_TOKEN=...
tgs --profile cloud profile remote https://tgs.example.com
tgs --profile cloud search "项目进展"
```

### 从源码构建

```bash
pnpm install && pnpm run build:packages && pnpm -F @tg-search/cli build
pnpm cli auth login
```

## ✅ 功能

- [x] Takeout 批量同步历史，daemon 实时保存新消息、编辑和删除
- [x] 分词检索；服务端另支持向量语义检索和以文搜图
- [x] 按月 JSONL 导出，附 SHA-256 校验清单
- [x] RAG 问答、未读消息 AI 汇总
- [x] Telegram Bot 搜索与导出
- [x] 服务端媒体可备份至 MinIO

## 🛣️ 路线展望

- [ ] 自动生成会话总结
- [ ] 「超级大脑」：根据历史消息构建人物与事件的知识图谱
- [ ] 自动整理「已保存消息」
- [ ] 链接与图片索引：网页摘要、OCR、图片描述
- [ ] 支持 Discord 等其他平台

## 🖥️ 网页界面（可选）

在线体验：[search.lingogram.app](https://search.lingogram.app)。自行部署：

```bash
mkdir telegram-search && cd telegram-search
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/docker-compose.yml -o docker-compose.yml
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/.env.example -o .env
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/init.sql -o init.sql
docker compose -f docker-compose.yml up -d
```

然后打开 [localhost:3333](http://localhost:3333)。也可以只运行镜像（未配置 MinIO 时媒体存于 `data/media`）：

```bash
docker run -d -p 3333:3333 ghcr.io/groupultra/telegram-search:latest
```

### 环境变量

均为可选。AI Embedding / LLM 在应用内按账户配置（设置 → API）。

| 环境变量            | 说明                                                                         | 示例值                                                |
| ------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| `TELEGRAM_API_ID`   | 自定义 Telegram 应用 ID，不填则使用内置凭据                                  | `611335`                                              |
| `TELEGRAM_API_HASH` | 自定义 Telegram 应用 Hash，需与 ID 成对填写                                  | `d524b414d21f4d37f08684c1df41ac9c`                    |
| `DATABASE_TYPE`     | 数据库类型，可选 `postgres` 或 `pglite`                                      | `pglite`                                              |
| `DATABASE_URL`      | PostgreSQL 连接字符串（仅在 `DATABASE_TYPE=postgres` 时填写）                | `postgresql://postgres:123456@pgvector:5432/postgres` |
| `TELEGRAM_BOT_TOKEN`| 通过 [@BotFather](https://t.me/BotFather) 创建的 Telegram Bot Token          | `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`           |
| `PROXY_URL`         | 代理地址（支持如 `socks5://user:pass@host:port` 等格式）                     | `socks5://user:pass@host:port`                        |
| `PORT`              | 后端服务 HTTP/WebSocket 监听端口                                             | `3333`                                                |
| `HOST`              | 后端服务监听地址                                                             | `0.0.0.0`                                             |
| `BACKEND_URL`       | Nginx 作为反向代理时用于 `/api` 和 `/ws` 的上游后端地址                      | `http://127.0.0.1:3333`                               |
| `MINIO_URL`         | MinIO 服务地址                                                               | `http://minio:9000`                                   |
| `MINIO_ACCESS_KEY`  | MinIO 访问密钥                                                               | `minioadmin`                                          |
| `MINIO_SECRET_KEY`  | MinIO 访问密钥对应的密钥                                                     | `minioadmin`                                          |
| `MINIO_BUCKET`      | MinIO 存储桶名称                                                             | `telegram-media`                                      |

## 💻 开发指南

```bash
pnpm install && cp .env.example .env
pnpm run dev                                                    # 纯浏览器模式
docker compose -f docker/docker-compose.dev.yml up -d pgvector minio
pnpm run server:dev                                             # 服务器模式，另开终端运行 web:dev
pnpm run web:dev
```

更多见 [CONTRIBUTING.md](./docs/CONTRIBUTING.md)。

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
