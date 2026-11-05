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
> Telegram 搜不到中文聊天记录？重要消息被海量对话淹没？
>
> Telegram Search 把你的聊天记录备份到本地，并提供可靠的多语言分词检索。主推的 `tg-search` CLI 让你只需在本地登录一次，之后无论是自己在终端里查，还是交给 Claude Code、Codex 等 AI Agent 自动检索、整理、总结，都不必把数据交给任何第三方。

## 💖 赞助者

![Sponsors](https://github.com/luoling8192/luoling8192/raw/master/sponsorkit/sponsors.svg)

> [!WARNING]
> 本项目未发行任何虚拟货币，请警惕相关诈骗风险。
>
> 本软件仅供您导出和检索个人聊天记录使用，切勿将其用于任何违法用途。

## 🚀 快速开始：CLI

`tg-search` 是本地优先的命令行工具：登录 session、消息和索引都保存在本机的 profile 目录（PGlite 数据库）中，不需要部署数据库、Docker 或网页服务。

### 1. 安装

通过 Homebrew 安装（macOS / Linux），会一并安装 Node.js 运行时：

```bash
brew tap groupultra/telegram-search https://github.com/groupultra/telegram-search
brew install groupultra/telegram-search/tg-search
```

### 2. 登录

```bash
tg-search auth login
```

按提示输入手机号、验证码（以及两步验证密码）即可。CLI 内置了 Telegram Search 的 API ID 和 API Hash，**无需再去 my.telegram.org 申请**；如需使用自己的应用凭据，见 [自定义 API 凭据](#自定义-api-凭据可选)。

### 3. 启动后台服务（推荐）

```bash
brew services start groupultra/telegram-search/tg-search
tg-search daemon status
```

daemon 在后台保持 Telegram 连接，登录系统后自动启动，并持续保存新消息及其编辑、删除。请以当前用户运行 `brew services`，不要使用 `sudo`。升级会保留 profile 数据：

```bash
brew upgrade groupultra/telegram-search/tg-search
brew services restart groupultra/telegram-search/tg-search
```

### 4. 同步并搜索历史消息

```bash
# 查看会话列表（只读远端，不落库）
tg-search chats list

# 通过 Telegram Takeout 把选定会话的历史同步到本地
tg-search sync --takeout --chat 123456 --from 2026-01-01

# 在本地数据库中搜索，不连接 Telegram
tg-search search "项目进展"
tg-search context --chat 123456 --message 42 --before 20 --after 20
```

若 Telegram 要求确认数据导出请求（`TAKEOUT_AUTHORIZATION_REQUIRED`），请在你的其他 Telegram 设备上批准后重新运行。

### 常用命令

| 命令 | 作用 | 是否连接 Telegram |
| --- | --- | --- |
| `auth login` | 交互式登录当前 profile | 是 |
| `chats list` | 列出会话 | 是，不落库 |
| `messages list --chat <id>` | 分页读取某个会话，可加 `--query` 在 Telegram 端搜索 | 是，不落库 |
| `sync --takeout --chat <id>` / `--all` | 通过 Takeout 批量同步历史到本地 | 是 |
| `search <query>` | 本地分词检索 | 否 |
| `messages query` / `context` / `stats` | 本地查询、上下文、统计 | 否 |
| `export --from --to --output <dir>` | 导出按月 JSONL 与校验清单 | 否 |
| `daemon run` / `status` / `stop` | 前台运行或管理常驻 daemon | 是 |
| `profile inspect` / `doctor` | 检查配置和 daemon 健康状态，不输出任何密钥 | 否 |

所有命令都支持 `--profile <name>` 隔离多个账号，`--json` 输出稳定的 JSON envelope。完整命令、分页、媒体读取和隐私边界见 [CLI 文档](./packages/cli/README.md)。

### 🤖 交给 AI Agent

CLI 为 Agent 设计：人只需在本地完成一次 `auth login`，之后 Agent 自行组合命令，决定读哪些会话、何时同步。

- 加 `--json` 后，stdout 只包含 `{ ok, data, next_cursor, meta }` 结构化结果；日志、提示与进度写入 stderr，失败时返回结构化 `error` 并以非零码退出。
- 大结果可用 `--output-file ./private/page.jsonl` 写入文件，终端只输出回执。
- 仓库内置 Agent skill：[`.agents/skills/telegram-search-cli`](./.agents/skills/telegram-search-cli/SKILL.md)，可直接给 Claude Code / Codex 等使用。
- **隐私边界**：`sync --takeout` 必须先征得用户同意，Agent 才能加上 `--takeout`；未授权、用户拒绝或 Takeout 初始化失败都会停止，不会退回普通 `GetHistory`。导出不包含媒体二进制、登录 session、向量或密钥，CLI 本身也不做 AI 总结。

```bash
tg-search --profile work chats list --limit 200 --json
tg-search --profile work search "项目进展" --chat 123456 --json
tg-search --profile work export --from 2026-01-01 --to 2026-12-31 --timezone Asia/Singapore --output ./telegram-2026 --json
```

### 自定义 API 凭据（可选）

默认使用内置的 Telegram Search 应用凭据。若想使用自己在 [my.telegram.org](https://my.telegram.org/apps) 申请的应用，可任选一种方式，优先级从高到低：

```bash
# 1. 写入 profile 配置（brew services 启动的 daemon 也会读取）
tg-search profile configure --apiId YOUR_API_ID --apiHash YOUR_API_HASH

# 2. 通过环境变量（仅对当前 shell 生效）
export TELEGRAM_API_ID=YOUR_API_ID TELEGRAM_API_HASH=YOUR_API_HASH
```

API ID 与 API Hash 必须成对提供。运行不带参数的 `tg-search profile configure` 可清除 profile 中的自定义凭据、恢复内置默认值。

### 远程只读模式

连接已部署的 Telegram Search 服务端，不下载其数据库和 Telegram session：

```bash
export TG_SEARCH_REMOTE_TOKEN=...   # 服务端访问令牌，不接受写在 URL 或参数中
tg-search --profile cloud profile remote https://tgs.example.com
tg-search --profile cloud search "项目进展"
```

### 从源码构建

```bash
git clone https://github.com/groupultra/telegram-search.git
cd telegram-search
pnpm install
pnpm run build:packages
pnpm -F @tg-search/cli build

pnpm cli auth login
pnpm cli chats list
```

## ✅ 功能亮点

### 📦 导出与备份
- [x] 本地 CLI 使用独立 PGlite；服务端兼容 PGlite 与 PostgreSQL
- [x] 通过 Telegram Takeout 批量同步历史，daemon 实时保存新消息、编辑和删除
- [x] 按月 JSONL 导出，附带时区与 SHA-256 校验清单
- [x] 服务端媒体资源可自动备份至 MinIO 对象存储

### 🔍 聊天记录搜索
- [x] 自动智能分词，支持多语言精准检索
- [x] 服务端融合模糊匹配与向量语义搜索，支持以文搜图
- [x] RAG 智能问答：直接与 AI 聊天，基于历史上下文获得实时解答
- [x] 日期范围筛选，消息 deep link 跳转原始对话

### 🤖 Agent 与 Bot
- [x] 面向 Agent 的 JSON / JSONL 输出与结构化错误
- [x] 远程只读模式，Agent 可安全查询自托管服务
- [x] 通过 Telegram Bot 搜索和导出消息
- [x] 未读消息智能摘要

## 🛣️ 路线展望

- [ ] 自动生成会话总结
- [ ] “超级大脑”：基于历史消息，自动构建人物与事件的知识图谱
- [ ] 智能整理"已保存消息"收藏夹
- [ ] 链接与图片深度索引：网页摘要、图片 OCR 文字识别及智能描述
- [ ] 跨平台扩展：支持 Discord 及其他主流社交/通讯平台

## 🖥️ 网页界面（可选）

更喜欢图形界面？可以直接使用在线体验版 https://search.lingogram.app ，或自行部署网页版。

### Docker Compose

```bash
mkdir telegram-search && cd telegram-search
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/docker-compose.yml -o docker-compose.yml
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/.env.example -o .env
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/init.sql -o init.sql
docker compose -f docker-compose.yml up -d
```

然后打开 **http://localhost:3333** 🎉

### Docker Image

```bash
docker run -d --name telegram-search -p 3333:3333 ghcr.io/groupultra/telegram-search:latest
```

未配置 MinIO 时，媒体文件默认保存至本地 `data/media` 目录。

### 环境变量

> [!IMPORTANT]
> AI Embedding & LLM 设置在应用内**按账户**配置（设置 → API）。修改 `.env` 后，请再次执行 `docker compose -f docker-compose.yml up -d`。

以下环境变量全部可选。网页版同样内置了 Telegram API 凭据，不填 `TELEGRAM_API_ID`/`TELEGRAM_API_HASH` 也能登录：

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

```bash
docker run -d --name telegram-search \
  -p 3333:3333 \
  -e DATABASE_TYPE=postgres \
  -e DATABASE_URL=postgresql://postgres:123456@localhost:5432/postgres \
  ghcr.io/groupultra/telegram-search:latest
```

## 💻 开发指南

```bash
git clone https://github.com/groupultra/telegram-search.git
cd telegram-search
pnpm install
cp .env.example .env

# 纯浏览器模式
pnpm run dev

# 服务器模式
docker compose -f docker/docker-compose.dev.yml up -d pgvector minio
pnpm run server:dev
pnpm run web:dev
```

📖 **更多开发细节和架构细节：** [CONTRIBUTING.md](./docs/CONTRIBUTING.md)

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
