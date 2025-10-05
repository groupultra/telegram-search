![preview](./assets/preview.png)

---

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

> [!WARNING]
> 我们未发行任何虚拟货币，请勿上当受骗。

> [!CAUTION]
> 本软件仅可导出您自己的聊天记录以便搜索，请勿用于非法用途。

一个功能强大的 Telegram 聊天记录搜索工具，支持向量搜索和语义匹配。基于 OpenAI 的语义向量技术，让你的 Telegram 消息检索更智能、更精准。

## 💖 赞助者

![Sponsors](https://github.com/luoling8192/luoling8192/raw/master/sponsorkit/sponsors.svg)

## 🌐 立即使用

我们提供了一个在线版本，无需自行部署，即可体验 Telegram Search 的全部功能。

> [!NOTE]
> 我们承诺不会收集任何用户隐私数据，您可以放心使用

访问以下网址开始使用: https://search.lingogram.app

## 🚀 快速开始

### 运行时环境变量

> [!TIP]
> 所有环境变量都是可选的。应用程序将使用默认设置运行，但您可以通过设置这些变量来自定义行为。

### 使用 Docker 镜像

> [!IMPORTANT]
> 最简单的开始方式是不带任何配置运行 Docker 镜像。所有功能都将使用合理的默认设置。

1. 不带任何环境变量运行默认镜像：

```bash
docker run -d --name telegram-search \
  -p 3333:3333 \
  -v telegram-search-data:/app/data \
  ghcr.io/groupultra/telegram-search:latest
```

<details>
<summary>带环境变量的示例</summary>

启动容器前请准备以下环境变量：

| 变量 | 是否必填 | 说明 |
| --- | --- | --- |
| `TELEGRAM_API_ID` | 选填 | 来自 [my.telegram.org](https://my.telegram.org/apps) 的 Telegram 应用 ID。 |
| `TELEGRAM_API_HASH` | 选填 | 来自同一页面的 Telegram 应用 Hash。 |
| `DATABASE_TYPE` | 选填 | 数据库类型（`postgres` 或 `pglite`）。 |
| `DATABASE_URL` | 选填 | 后端及迁移脚本使用的数据库连接串（仅当 `DATABASE_TYPE` 为 `postgres` 时支持）。 |
| `EMBEDDING_API_KEY` | 选填 | 向量嵌入提供商的 API Key（OpenAI、Ollama 等）。 |
| `EMBEDDING_BASE_URL` | 选填 | 自建或兼容服务的 API Base URL。 |
| `EMBEDDING_PROVIDER` | 选填 | 指定嵌入服务提供商（`openai` 或 `ollama`）。 |
| `EMBEDDING_MODEL` | 选填 | 覆盖默认的嵌入模型名称。 |
| `EMBEDDING_DIMENSION` | 选填 | 覆盖嵌入向量维度（如 `1536`、`1024`、`768`）。 |
| `PROXY_URL` | 选填 | 代理配置 URL（如 `socks5://user:pass@host:port`）。(#366) |
| `VITE_PREVIEW_ALLOW_ALL_HOSTS` | 选填 | 允许所有主机访问预览页面。(#371) |
| `VITE_DISABLE_SETTINGS` | 选填 | 禁用设置页面。 |

### 代理 URL 格式

`PROXY_URL` 环境变量支持以下格式：

- **SOCKS4**: `socks4://username:password@host:port?timeout=15`
- **SOCKS5**: `socks5://username:password@host:port?timeout=15`
- **HTTP**: `http://username:password@host:port?timeout=15`
- **MTProxy**: `mtproxy://secret@host:port?timeout=15`

示例：
- `PROXY_URL=socks5://myuser:mypass@proxy.example.com:1080`
- `PROXY_URL=mtproxy://secret123@mtproxy.example.com:443`
- `PROXY_URL=socks5://proxy.example.com:1080?timeout=30` （无认证）

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

请将 `<postgres-host>` 替换为实际的 PostgreSQL 主机名或 IP 地址。

</details>

2. 浏览器访问 `http://localhost:3333` 打开搜索界面。

### 使用 Docker Compose

1. 克隆仓库。

2. 运行 docker compose 启动包括数据库在内的全部服务：

```bash
docker compose up -d
```

3. 浏览器访问 `http://localhost:3333` 打开搜索界面。

## 💻 开发教程

> [!CAUTION]
> 开发模式需要 Node.js >= 22.18 和 pnpm。请确保在继续之前安装了正确的版本。

### 网页模式

1. 克隆仓库

2. 安装依赖

```bash
pnpm install
```

3. 复制环境变量文件

```bash
cp .env.example .env
```

4. 启动开发服务器：

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

5. 启动服务：

```bash
# 启动后端服务
pnpm run server:dev

# 启动前端界面
pnpm run web:dev
```

## 🏗️ 系统架构

### 包结构

本项目采用 monorepo 结构，包含以下包：

- **`apps/web`**：前端应用，使用 Vue 3、Pinia 和 Vue Router 构建
- **`apps/server`**：后端 WebSocket 服务器，用于实时通信
- **`packages/client`**：客户端适配器、事件处理器和状态存储
- **`packages/core`**：核心事件系统、服务、数据库模型和业务逻辑
- **`packages/common`**：共享工具和日志配置

```mermaid
graph TB
    subgraph "🖥️ 前端层 (apps/web)"
        Frontend["Web 应用<br/>(Vue 3 + Pinia + Vue Router)"]
    end

    subgraph "📦 Client 包 (packages/client)"
        subgraph "客户端适配器"
            WsAdapter["WebSocket 适配器"]
            CoreBridge["Core Bridge 适配器"]
        end
        
        subgraph "客户端事件处理器"
            ClientAuth["认证处理器"]
            ClientMessage["消息处理器"] 
            ClientStorage["存储处理器"]
            ClientEntity["实体处理器"]
            ClientDialog["对话处理器"]
            ClientConfig["配置处理器"]
            ClientServer["服务器处理器"]
        end
        
        subgraph "客户端状态存储"
            AuthStore["认证 Store"]
            ChatStore["聊天 Store"]
            MessageStore["消息 Store"]
            SettingsStore["设置 Store"]
            SyncTaskStore["同步任务 Store"]
        end
    end

    subgraph "🌐 通信层"
        WS["WebSocket 服务器<br/>(apps/server)<br/>实时双向通信<br/>• 事件注册<br/>• 事件转发<br/>• 会话管理"]
    end

    subgraph "🎯 Core 包 (packages/core)"
        Context["CoreContext<br/>🔥 中央事件总线<br/>(EventEmitter3)<br/>• ToCoreEvent<br/>• FromCoreEvent<br/>• 事件包装器<br/>• 错误处理"]
        
        subgraph "核心事件处理器"
            AuthHandler["🔐 认证处理器"]
            MessageHandler["📝 消息处理器"]
            DialogHandler["💬 对话处理器"]
            StorageHandler["📦 存储处理器"]
            ConfigHandler["⚙️ 配置处理器"]
            EntityHandler["👤 实体处理器"]
            SessionHandler["🔑 会话处理器"]
            GramEventsHandler["📡 Gram 事件处理器"]
            MessageResolverHandler["🔄 消息解析器处理器"]
            TakeoutHandler["📤 Takeout 处理器"]
        end
        
        subgraph "核心服务"
            AuthService["认证服务"]
            MessageService["消息服务"]
            DialogService["对话服务"]
            StorageService["存储服务"]
            ConfigService["配置服务"]
            EntityService["实体服务"]
            SessionService["会话服务"]
            ConnectionService["连接服务"]
            TakeoutService["Takeout 服务"]
        end
        
        subgraph "消息处理管道"
            MsgResolverService["消息解析器服务"]
            
            subgraph "消息解析器"
                EmbeddingResolver["🤖 向量嵌入解析器<br/>(OpenAI/Ollama)"]
                JiebaResolver["📚 Jieba 解析器<br/>（中文分词）"]
                LinkResolver["🔗 链接解析器"]
                MediaResolver["📸 媒体解析器"]
                UserResolver["👤 用户解析器"]
            end
        end
        
        subgraph "数据库层"
            Models["数据库模型"]
            Schemas["Drizzle Schemas"]
        end
    end

    subgraph "🗄️ 数据存储"
        DB["数据库<br/>(PostgreSQL + pgvector)<br/>或 (PGlite)"]
    end

    subgraph "📡 外部 API"
        TelegramAPI["Telegram API<br/>(gram.js)"]
        EmbeddingAPI["向量嵌入 API<br/>(OpenAI/Ollama)"]
    end

    subgraph "🛠️ Common 包 (packages/common)"
        Logger["日志工具 (@unbird/logg)"]
        Utils["共享工具"]
    end

    %% Frontend to Client Package
    Frontend --> WsAdapter
    Frontend --> CoreBridge
    Frontend --> AuthStore
    Frontend --> ChatStore
    Frontend --> MessageStore
    Frontend --> SettingsStore
    Frontend --> SyncTaskStore

    %% Client Package Internal
    WsAdapter --> ClientAuth
    WsAdapter --> ClientMessage
    WsAdapter --> ClientStorage
    WsAdapter --> ClientEntity
    WsAdapter --> ClientDialog
    WsAdapter --> ClientConfig
    WsAdapter --> ClientServer
    
    ClientAuth --> AuthStore
    ClientMessage --> MessageStore
    ClientStorage --> SyncTaskStore
    ClientEntity --> ChatStore
    ClientDialog --> ChatStore

    %% WebSocket Event Flow
    WsAdapter -.->|"WsEventToServer<br/>• auth:login<br/>• message:query<br/>• dialog:fetch<br/>• storage:sync"| WS
    WS -.->|"WsEventToClient<br/>• message:data<br/>• auth:status<br/>• storage:progress<br/>• dialog:list"| WsAdapter

    %% Server to Core
    WS <--> Context

    %% Core Event System
    Context <==> AuthHandler
    Context <==> MessageHandler
    Context <==> DialogHandler
    Context <==> StorageHandler
    Context <==> ConfigHandler
    Context <==> EntityHandler
    Context <==> SessionHandler
    Context <==> GramEventsHandler
    Context <==> MessageResolverHandler
    Context <==> TakeoutHandler

    %% Event Handlers to Services
    AuthHandler --> AuthService
    MessageHandler --> MessageService
    DialogHandler --> DialogService
    StorageHandler --> StorageService
    ConfigHandler --> ConfigService
    EntityHandler --> EntityService
    SessionHandler --> SessionService
    GramEventsHandler --> ConnectionService
    MessageResolverHandler --> MsgResolverService
    TakeoutHandler --> TakeoutService

    %% Message Processing Pipeline
    MessageService --> MsgResolverService
    MsgResolverService --> EmbeddingResolver
    MsgResolverService --> JiebaResolver
    MsgResolverService --> LinkResolver
    MsgResolverService --> MediaResolver
    MsgResolverService --> UserResolver

    %% Data Layer
    StorageService --> Models
    Models --> Schemas
    Schemas --> DB

    %% External APIs
    AuthService --> TelegramAPI
    MessageService --> TelegramAPI
    DialogService --> TelegramAPI
    EntityService --> TelegramAPI
    ConnectionService --> TelegramAPI
    SessionService --> TelegramAPI
    EmbeddingResolver --> EmbeddingAPI

    %% Common Package Usage
    Context --> Logger
    AuthService --> Logger
    MessageService --> Logger
    StorageService --> Logger

    %% Styling
    classDef frontend fill:#4CAF50,stroke:#2E7D32,color:#fff,stroke-width:2px
    classDef client fill:#8BC34A,stroke:#558B2F,color:#fff,stroke-width:2px
    classDef websocket fill:#FF9800,stroke:#E65100,color:#fff,stroke-width:3px
    classDef context fill:#E91E63,stroke:#AD1457,color:#fff,stroke-width:4px
    classDef handler fill:#9C27B0,stroke:#6A1B9A,color:#fff,stroke-width:2px
    classDef service fill:#607D8B,stroke:#37474F,color:#fff,stroke-width:2px
    classDef resolver fill:#795548,stroke:#3E2723,color:#fff,stroke-width:2px
    classDef data fill:#3F51B5,stroke:#1A237E,color:#fff,stroke-width:2px
    classDef external fill:#F44336,stroke:#C62828,color:#fff,stroke-width:2px
    classDef common fill:#00BCD4,stroke:#006064,color:#fff,stroke-width:2px

    class Frontend frontend
    class WsAdapter,CoreBridge,ClientAuth,ClientMessage,ClientStorage,ClientEntity,ClientDialog,ClientConfig,ClientServer,AuthStore,ChatStore,MessageStore,SettingsStore,SyncTaskStore client
    class WS websocket
    class Context context
    class AuthHandler,MessageHandler,DialogHandler,StorageHandler,ConfigHandler,EntityHandler,SessionHandler,GramEventsHandler,MessageResolverHandler,TakeoutHandler handler
    class AuthService,MessageService,DialogService,StorageService,ConfigService,EntityService,SessionService,ConnectionService,TakeoutService,MsgResolverService service
    class EmbeddingResolver,JiebaResolver,LinkResolver,MediaResolver,UserResolver resolver
    class DB,Models,Schemas data
    class TelegramAPI,EmbeddingAPI external
    class Logger,Utils common
```

### 事件驱动架构概述

#### 📦 包职责

- **`packages/core`**：应用程序的核心，包含：
  - **CoreContext**：使用 EventEmitter3 的中央事件总线
  - **事件处理器**：监听和处理来自事件总线的事件
  - **服务**：业务逻辑实现（认证、消息、存储等）
  - **消息解析器**：通过各种解析器处理消息（向量嵌入、Jieba、链接、媒体、用户）
  - **数据库模型和 Schemas**：Drizzle ORM 模型和 PostgreSQL schemas

- **`packages/client`**：客户端集成层，包含：
  - **适配器**：支持不同运行环境的 WebSocket 和 Core Bridge 适配器
  - **事件处理器**：与后端通信的客户端事件处理器
  - **状态存储**：用于状态管理的 Pinia stores（认证、聊天、消息、设置、同步）
  - **组合式函数**：可复用的 Vue composition functions

- **`packages/common`**：共享工具：
  - **日志工具**：使用 @unbird/logg 的集中式日志
  - **工具函数**：通用辅助函数

- **`apps/server`**：WebSocket 服务器：
  - 管理 WebSocket 连接
  - 在客户端和 CoreContext 实例之间路由事件
  - 处理会话管理

- **`apps/web`**：Vue 3 前端应用：
  - 使用 Vue 3、Pinia 和 Vue Router 构建的用户界面
  - 集成 packages/client 进行后端通信
  - 支持纯浏览器模式（使用 PGlite）和服务器模式（使用 PostgreSQL）

#### 🎯 核心事件系统

- **CoreContext - 中央事件总线**：系统核心，使用 EventEmitter3 管理所有事件
  - **ToCoreEvent**：发送到核心系统的事件（如 auth:login、message:query 等）
  - **FromCoreEvent**：从核心系统发出的事件（如 message:data、auth:status 等）
  - **事件包装器**：为所有事件提供自动错误处理和日志记录
  - **会话管理**：每个客户端会话都有独立的 CoreContext 实例

#### 🌐 通信层

- **WebSocket 服务器**：实时双向通信
  - **事件注册**：客户端注册想要接收的特定事件
  - **事件转发**：在前端和 CoreContext 之间无缝转发事件
  - **会话持久化**：跨连接维护客户端状态和事件监听器

- **客户端适配器**：支持多种运行环境
  - **WebSocket 适配器**：用于服务器模式，实现与后端的实时连接
  - **Core Bridge 适配器**：用于纯浏览器模式，使用浏览器内数据库（PGlite）

#### 🔄 消息处理管道

基于流的消息处理，通过多个解析器：
- **向量嵌入解析器**：使用 OpenAI/Ollama 生成向量嵌入，用于语义搜索
- **Jieba 解析器**：中文分词，提升搜索能力
- **链接解析器**：从消息中提取和处理链接
- **媒体解析器**：处理媒体附件（照片、视频、文档）
- **用户解析器**：处理用户提及和引用

#### 📡 事件流程

1. **前端** → 用户交互触发 Vue 组件中的操作
2. **客户端 Store** → Store 通过 WebSocket 适配器分发事件
3. **WebSocket** → 事件发送到后端服务器
4. **CoreContext** → 事件总线路由到适当的事件处理器
5. **事件处理器** → 处理事件并调用相应的服务
6. **服务** → 执行业务逻辑（可能调用 Telegram API 或数据库）
7. **服务** → 通过 CoreContext 发出结果事件
8. **WebSocket** → 将事件转发到前端客户端
9. **客户端事件处理器** → 使用新数据更新客户端 store
10. **前端** → Vue 组件响应式更新 UI

#### 🗄️ 数据库支持

应用程序支持两种数据库模式：
- **PostgreSQL + pgvector**：用于生产部署，具有完整的向量搜索功能
- **PGlite**：用于纯浏览器模式的浏览器内 PostgreSQL（实验性）

## 🚀 Activity

![Alt](https://repobeats.axiom.co/api/embed/69d5ef9f5e72cd7901b32ff71b5f359bc7ca42ea.svg "Repobeats analytics image")

[![Star History Chart](https://api.star-history.com/svg?repos=luoling8192/telegram-search&type=Date)](https://star-history.com/#luoling8192/telegram-search&Date)
