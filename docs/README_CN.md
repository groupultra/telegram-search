![preview](./assets/preview.png)

<h1 align="center">Telegram Search</h1>

<p align="center">
  <a href="https://trendshift.io/repositories/13868" target="_blank"><img src="https://trendshift.io/api/badge/repositories/13868" alt="groupultra%2Ftelegram-search | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
</p>

<p align="center">
  [<a href="https://search.lingogram.app">立即体验</a>] [<a href="https://discord.gg/NzYsmJSgCT">Join Discord Server</a>] [<a href="../README.md">English</a>] [<a href="./README_JA.md">日本語</a>]
</p>

<p align="center">
  <a href="https://app.netlify.com/projects/tgsearch/deploys"><img src="https://api.netlify.com/api/v1/badges/89bfbfd2-0f73-41b0-8db4-4ab6b6512f6e/deploy-status"></a>
  <a href="https://deepwiki.com/GramSearch/telegram-search"><img src="https://deepwiki.com/badge.svg"></a>
  <a href="https://github.com/GramSearch/telegram-search/blob/main/LICENSE"><img src="https://img.shields.io/github/license/GramSearch/telegram-search.svg?style=flat&colorA=080f12&colorB=1fa669"></a>
    <a href="https://discord.gg/NzYsmJSgCT"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fdiscord.com%2Fapi%2Finvites%2FNzYsmJSgCT%3Fwith_counts%3Dtrue&query=%24.approximate_member_count&suffix=%20members&logo=discord&logoColor=white&label=%20&color=7389D8&labelColor=6A7EC2"></a>
  <a href="https://t.me/+Gs3SH2qAPeFhYmU9"><img src="https://img.shields.io/badge/Telegram-%235AA9E6?logo=telegram&labelColor=FFFFFF"></a>
</p>

> 我们未发行任何虚拟货币，请勿上当受骗。
>
> 本软件仅可导出您自己的聊天记录以便搜索，请勿用于非法用途。

一个功能强大的 Telegram 聊天记录搜索工具，支持向量搜索和语义匹配。基于 OpenAI 的语义向量技术，让你的 Telegram 消息检索更智能、更精准。

## 💖 赞助者

![Sponsors](https://github.com/luoling8192/luoling8192/raw/master/sponsorkit/sponsors.svg)

## 🌐 立即使用

我们提供了一个在线版本，无需自行部署，即可体验 Telegram Search 的全部功能。

> 我们承诺不会收集任何用户隐私数据，您可以放心使用

访问以下网址开始使用: https://search.lingogram.app

## 🚀 快速开始

### 运行时环境变量

启动容器前请准备以下环境变量：

| 变量 | 是否必填 | 说明 |
| --- | --- | --- |
| `TELEGRAM_API_ID` | ✅ | 来自 [my.telegram.org](https://my.telegram.org/apps) 的 Telegram 应用 ID。 |
| `TELEGRAM_API_HASH` | ✅ | 来自同一页面的 Telegram 应用 Hash。 |
| `DATABASE_URL` | ✅ | 后端及迁移脚本使用的 PostgreSQL 连接串。 |
| `EMBEDDING_API_KEY` | ✅ | 向量嵌入提供商的 API Key（OpenAI、Ollama 等）。 |
| `EMBEDDING_BASE_URL` | 选填 | 自建或兼容服务的 API Base URL。 |
| `EMBEDDING_PROVIDER` | 选填 | 指定嵌入服务提供商（`openai` 或 `ollama`）。 |
| `EMBEDDING_MODEL` | 选填 | 覆盖默认的嵌入模型名称。 |
| `EMBEDDING_DIMENSION` | 选填 | 覆盖嵌入向量维度（如 `1536`、`1024`、`768`）。 |
| `PGVECTOR_HOST_PORT` | 选填 | 需要向外暴露数据库时使用的宿主机端口（例如 `15432`）。 |
| `PGVECTOR_HOST_IP` | 选填 | 暴露端口时绑定的宿主机 IP（例如仅监听本地的 `127.0.0.1`）。 |

### 使用 Docker 镜像

1. 携带必要环境变量运行镜像：

```bash
docker run -d --name telegram-search \
  -p 3333:3333 \
  -e TELEGRAM_API_ID=123456 \
  -e TELEGRAM_API_HASH=0123456789abcdef0123456789abcdef \
  -e DATABASE_URL=postgresql://postgres:123456@<postgres-host>:5432/postgres \
  -e EMBEDDING_API_KEY=sk-xxxx \
  -e EMBEDDING_BASE_URL=https://api.openai.com/v1 \
  ghcr.io/groupultra/telegram-search:latest
```

请将 `<postgres-host>` 替换为实际的 PostgreSQL 主机名或 IP 地址。

2. 浏览器访问 `http://localhost:3333` 打开搜索界面。

### 使用 Docker Compose

1. 克隆仓库。

2. 在仓库根目录创建 `.env` 文件，写入上表中的环境变量（仅保留实际需要的条目）。

3. 运行 docker compose 启动包括数据库在内的全部服务：

```bash
docker compose up -d
```

4. 浏览器访问 `http://localhost:3333` 打开搜索界面。

5. 如需向外暴露 pgvector 端口，可在启动时设置 `PGVECTOR_HOST_PORT`：

```bash
PGVECTOR_HOST_PORT=15432 docker compose up -d
```

   如果只想监听本机，可额外设置 `PGVECTOR_HOST_IP=127.0.0.1`。

## 💻 开发教程

### 网页模式

1. 克隆仓库

2. 安装依赖

```bash
pnpm install
```

3. 启动开发服务器：

```bash
pnpm run dev
```

### 后端模式

1. 克隆仓库

2. 安装依赖

```bash
pnpm install
```

3. 修改配置文件

```bash
cp config/config.example.yaml config/config.yaml
```

4. 启动数据库容器：

```bash
# 在本地开发模式下， Docker 只用来启动数据库容器
docker compose up -d pgvector
```

5. 同步数据库表结构：

```bash
pnpm run db:migrate
```

6. 启动服务：

```bash
# 启动后端服务
pnpm run server:dev

# 启动前端界面
pnpm run web:dev
```

## 🏗️ 系统架构

```mermaid
graph TB
    subgraph "🖥️ 前端层"
        Frontend["Web Frontend<br/>(Vue 3 + Pinia)"]
        Electron["Electron Desktop"]
        
        subgraph "Client Event Handlers"
            ClientAuth["Auth Handler"]
            ClientMessage["Message Handler"] 
            ClientStorage["Storage Handler"]
            ClientEntity["Entity Handler"]
            ClientServer["Server Handler"]
        end
    end

    subgraph "🌐 通信层"
        WS["WebSocket 事件桥接<br/>实时双向通信<br/>• 事件注册<br/>• 事件转发<br/>• 会话管理"]
    end

    subgraph "🚀 后端服务层"
        Server["Backend Server<br/>(REST API)"]
        
        subgraph "Session Management"
            SessionMgr["会话管理器<br/>• 客户端状态<br/>• CoreContext 实例<br/>• 事件监听器"]
        end
    end

    subgraph "🎯 核心事件系统"
        Context["CoreContext<br/>🔥 中央事件总线<br/>(EventEmitter3)<br/>• ToCoreEvent<br/>• FromCoreEvent<br/>• 事件包装器<br/>• 错误处理"]
        
        subgraph "Core Event Handlers"
            AuthHandler["🔐 Auth Handler"]
            MessageHandler["📝 Message Handler"]
            DialogHandler["💬 Dialog Handler"]
            StorageHandler["📦 Storage Handler"]
            ConfigHandler["⚙️ Config Handler"]
            EntityHandler["👤 Entity Handler"]
            GramEventsHandler["📡 Gram Events Handler"]
            MessageResolverHandler["🔄 Message Resolver Handler"]
        end
    end

    subgraph "🔧 业务服务层"
        subgraph "Services"
            AuthService["Authentication<br/>Service"]
            MessageService["Message<br/>Service"]
            DialogService["Dialog<br/>Service"]
            StorageService["Storage<br/>Service"]
            ConfigService["Config<br/>Service"]
            EntityService["Entity<br/>Service"]
            ConnectionService["Connection<br/>Service"]
            TakeoutService["Takeout<br/>Service"]
        end
        
        subgraph "消息处理管道"
            MsgResolverService["Message Resolver<br/>Service"]
            
            subgraph "Message Resolvers"
                EmbeddingResolver["🤖 Embedding<br/>Resolver<br/>(OpenAI)"]
                JiebaResolver["📚 Jieba<br/>Resolver<br/>（中文分词）"]
                LinkResolver["🔗 Link<br/>Resolver"]
                MediaResolver["📸 Media<br/>Resolver"]
                UserResolver["👤 User<br/>Resolver"]
            end
        end
    end

    subgraph "🗄️ 数据层"
        DB["PostgreSQL<br/>+ pgvector"]
        Drizzle["Drizzle ORM"]
    end

    subgraph "📡 外部 API"
        TelegramAPI["Telegram API<br/>(gram.js)"]
        OpenAI["OpenAI API<br/>Vector Embeddings"]
    end

    %% WebSocket Event Flow
    Frontend -.->|"WsEventToServer<br/>• auth:login<br/>• message:query<br/>• dialog:fetch"| WS
    WS -.->|"WsEventToClient<br/>• message:data<br/>• auth:status<br/>• storage:progress"| Frontend
    
    Electron -.->|"WebSocket Events"| WS
    WS -.->|"Real-time Updates"| Electron

    %% Server Layer
    WS <--> Server
    Server --> SessionMgr
    SessionMgr --> Context

    %% Core Event System （主要突出的部分）
    Context <==> AuthHandler
    Context <==> MessageHandler
    Context <==> DialogHandler
    Context <==> StorageHandler
    Context <==> ConfigHandler
    Context <==> EntityHandler
    Context <==> GramEventsHandler
    Context <==> MessageResolverHandler

    %% Event Handlers to Services
    AuthHandler --> AuthService
    MessageHandler --> MessageService
    DialogHandler --> DialogService
    StorageHandler --> StorageService
    ConfigHandler --> ConfigService
    EntityHandler --> EntityService
    GramEventsHandler --> ConnectionService
    MessageResolverHandler --> MsgResolverService

    %% Message Processing Pipeline
    MessageService --> MsgResolverService
    MsgResolverService --> EmbeddingResolver
    MsgResolverService --> JiebaResolver
    MsgResolverService --> LinkResolver
    MsgResolverService --> MediaResolver
    MsgResolverService --> UserResolver

    %% Data Layer
    StorageService --> Drizzle
    Drizzle --> DB

    %% External APIs
    AuthService --> TelegramAPI
    MessageService --> TelegramAPI
    DialogService --> TelegramAPI
    EntityService --> TelegramAPI
    EmbeddingResolver --> OpenAI

    %% Client Event System
    Frontend --> ClientAuth
    Frontend --> ClientMessage
    Frontend --> ClientStorage
    Frontend --> ClientEntity
    Frontend --> ClientServer

    %% Styling
    classDef frontend fill:#4CAF50,stroke:#2E7D32,color:#fff,stroke-width:2px
    classDef websocket fill:#FF9800,stroke:#E65100,color:#fff,stroke-width:3px
    classDef server fill:#2196F3,stroke:#1565C0,color:#fff,stroke-width:2px
    classDef context fill:#E91E63,stroke:#AD1457,color:#fff,stroke-width:4px
    classDef handler fill:#9C27B0,stroke:#6A1B9A,color:#fff,stroke-width:2px
    classDef service fill:#607D8B,stroke:#37474F,color:#fff,stroke-width:2px
    classDef resolver fill:#795548,stroke:#3E2723,color:#fff,stroke-width:2px
    classDef data fill:#3F51B5,stroke:#1A237E,color:#fff,stroke-width:2px
    classDef external fill:#F44336,stroke:#C62828,color:#fff,stroke-width:2px

    class Frontend,Electron,ClientAuth,ClientMessage,ClientStorage,ClientEntity,ClientServer frontend
    class WS websocket
    class Server,SessionMgr server
    class Context context
    class AuthHandler,MessageHandler,DialogHandler,StorageHandler,ConfigHandler,EntityHandler,GramEventsHandler,MessageResolverHandler handler
    class AuthService,MessageService,DialogService,StorageService,ConfigService,EntityService,ConnectionService,TakeoutService,MsgResolverService service
    class EmbeddingResolver,JiebaResolver,LinkResolver,MediaResolver,UserResolver resolver
    class DB,Drizzle data
    class TelegramAPI,OpenAI external
```

### 事件驱动架构概述

- **🎯 CoreContext - 中央事件总线**：系统核心，使用 EventEmitter3 管理所有事件
  - **ToCoreEvent**：发送到核心系统的事件（如 auth:login, message:query 等）
  - **FromCoreEvent**：从核心系统发出的事件（如 message:data, auth:status 等）
  - **事件包装器**：为所有事件提供自动错误处理和日志记录
  - **会话管理**：每个客户端会话都有独立的 CoreContext 实例

- **🌐 WebSocket 事件桥接**：实时双向通信层
  - **事件注册**：客户端注册想要接收的特定事件
  - **事件转发**：在前端和 CoreContext 之间无缝转发事件
  - **会话持久化**：跨连接维护客户端状态和事件监听器

- **🔄 消息处理管道**：通过多个解析器进行基于流的消息处理
  - **Embedding 解析器**：使用 OpenAI 生成向量嵌入，用于语义搜索
  - **Jieba 解析器**：中文分词，提升搜索能力
  - **链接/媒体/用户解析器**：提取和处理各种消息内容类型

- **📡 事件流程**：
  1. 前端通过 WebSocket 发送事件（如 `auth:login`, `message:query`）
  2. 服务器将事件转发到相应的 CoreContext 实例
  3. 事件处理器处理事件并调用相应的服务
  4. 服务通过 CoreContext 发出结果事件
  5. WebSocket 将事件转发到前端进行实时更新

## 🚀 Activity

![Alt](https://repobeats.axiom.co/api/embed/69d5ef9f5e72cd7901b32ff71b5f359bc7ca42ea.svg "Repobeats analytics image")

[![Star History Chart](https://api.star-history.com/svg?repos=luoling8192/telegram-search&type=Date)](https://star-history.com/#luoling8192/telegram-search&Date)
