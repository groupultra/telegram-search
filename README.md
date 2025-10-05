![preview](./docs/assets/preview.png)

---

<p align="center">
  <a href="https://trendshift.io/repositories/13868" target="_blank"><img src="https://trendshift.io/api/badge/repositories/13868" alt="groupultra%2Ftelegram-search | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
</p>

<p align="center">
   [<a href="https://search.lingogram.app">Try it Now</a>] [<a href="https://discord.gg/NzYsmJSgCT">Join Discord Server</a>] [<a href="./docs/README_CN.md">简体中文</a>] [<a href="./docs/README_JA.md">日本語</a>]
</p>

<p align="center">
  <a href="https://app.netlify.com/projects/tgsearch/deploys"><img src="https://api.netlify.com/api/v1/badges/89bfbfd2-0f73-41b0-8db4-4ab6b6512f6e/deploy-status"></a>
  <a href="https://deepwiki.com/GramSearch/telegram-search"><img src="https://deepwiki.com/badge.svg"></a>
  <a href="https://github.com/GramSearch/telegram-search/blob/main/LICENSE"><img src="https://img.shields.io/github/license/GramSearch/telegram-search.svg?style=flat&colorA=080f12&colorB=1fa669"></a>
    <a href="https://discord.gg/NzYsmJSgCT"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fdiscord.com%2Fapi%2Finvites%2FNzYsmJSgCT%3Fwith_counts%3Dtrue&query=%24.approximate_member_count&suffix=%20members&logo=discord&logoColor=white&label=%20&color=7389D8&labelColor=6A7EC2"></a>
  <a href="https://t.me/+Gs3SH2qAPeFhYmU9"><img src="https://img.shields.io/badge/Telegram-%235AA9E6?logo=telegram&labelColor=FFFFFF"></a>
</p>

> [!WARNING]
> We have not issued any virtual currency, please do not be deceived.

> [!CAUTION]
> This software can only export your own chat records for search, please do not use it for illegal purposes.

A powerful Telegram chat history search tool that supports vector search and semantic matching. Based on OpenAI's semantic vector technology, it makes your Telegram message retrieval smarter and more precise.

## 💖 Sponsors

![Sponsors](https://github.com/luoling8192/luoling8192/raw/master/sponsorkit/sponsors.svg)
## 🌐 Try it Now

We provide an online version where you can experience all features of Telegram Search without self-deployment.

> [!NOTE]
> We promise not to collect any user privacy data, you can use it with confidence

Visit: https://search.lingogram.app

## 🚀 Quick Start

### Runtime environment variables

> [!TIP]
> All environment variables are optional. The application will work with default settings, but you can customize behavior by setting these variables.

### Start with Docker Image

> [!IMPORTANT]
> The simplest way to get started is to run the Docker image without any configuration. All features will work with sensible defaults.

1. Run docker image default without any environment variables:

```bash
docker run -d --name telegram-search \
  -p 3333:3333 \
  -v telegram-search-data:/app/data \
  ghcr.io/groupultra/telegram-search:latest
```

<details>
<summary>Example with environment variables</summary>

Set the following environment variables before starting the containerized services:

| Variable | Required | Description |
| --- | --- | --- |
| `TELEGRAM_API_ID` | optional | Telegram app ID from [my.telegram.org](https://my.telegram.org/apps). |
| `TELEGRAM_API_HASH` | optional | Telegram app hash from the same page. |
| `DATABASE_TYPE` | optional | Database type (`postgres` or `pglite`). |
| `DATABASE_URL` | optional | Database connection string used by the server and migrations (Only support when `DATABASE_TYPE` is `postgres`). |
| `EMBEDDING_API_KEY` | optional | API key for the embedding provider (OpenAI key, Ollama token, etc.). |
| `EMBEDDING_BASE_URL` | optional | Custom base URL for self-hosted or compatible embedding providers. |
| `EMBEDDING_PROVIDER` | optional | Override embedding provider (`openai` or `ollama`). |
| `EMBEDDING_MODEL` | optional | Override embedding model name. |
| `EMBEDDING_DIMENSION` | optional | Override embedding dimension (e.g. `1536`, `1024`, `768`). |
| `PROXY_URL` | optional | Proxy configuration URL (e.g., `socks5://user:pass@host:port`). (#366) |

The following environment variables can only take effect at compile time (not at `docker run` time):

| `VITE_PREVIEW_ALLOW_ALL_HOSTS` | optional (`true`) | Allow all hosts to access preview page. (#371) |
| `VITE_DISABLE_SETTINGS` | optional (`true`) | Disable settings page. |

### Proxy URL Format

The `PROXY_URL` environment variable supports these formats:

- **SOCKS4**: `socks4://username:password@host:port?timeout=15`
- **SOCKS5**: `socks5://username:password@host:port?timeout=15`
- **HTTP**: `http://username:password@host:port?timeout=15`
- **MTProxy**: `mtproxy://secret@host:port?timeout=15`

Examples:
- `PROXY_URL=socks5://myuser:mypass@proxy.example.com:1080`
- `PROXY_URL=mtproxy://secret123@mtproxy.example.com:443`
- `PROXY_URL=socks5://proxy.example.com:1080?timeout=30` (no auth)

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

Replace `<postgres-host>` with the hostname or IP address of the PostgreSQL instance you want to use.

</details>

2. Access `http://localhost:3333` to open the search interface.

### Start with Docker Compose

1. Clone repository.

2. Run docker compose to start all services including the database:

```bash
docker compose up -d
```

3. Access `http://localhost:3333` to open the search interface.

## 💻 Development Guide

> [!CAUTION]
> Development mode requires Node.js >= 22.18 and pnpm. Make sure you have the correct versions installed before proceeding.

### Browser Only

1. Clone repository

2. Install dependencies

```bash
pnpm install
```

3. Copy environment variables

```bash
cp .env.example .env
```

4. Start development server:

```bash
pnpm run dev
```

### With Backend

1. Clone repository

2. Install dependencies

```bash
pnpm install
```

3. Configure environment

```bash
cp config/config.example.yaml config/config.yaml
```

4. Start database container:

```bash
# Docker is only used for database container in local development.
docker compose up -d pgvector
```

5. Start services:

```bash
# Start backend
pnpm run server:dev

# Start frontend
pnpm run web:dev
```

## 🏗️ Architecture

### Package Structure

The project is organized as a monorepo with the following packages:

- **`apps/web`**: Frontend application built with Vue 3, Pinia, and Vue Router
- **`apps/server`**: Backend WebSocket server for real-time communication
- **`packages/client`**: Client-side adapters, event handlers, and stores
- **`packages/core`**: Core event system, services, database models, and business logic
- **`packages/common`**: Shared utilities and logger configuration

```mermaid
graph TB
    subgraph "🖥️ Frontend Layer (apps/web)"
        Frontend["Web Application<br/>(Vue 3 + Pinia + Vue Router)"]
    end

    subgraph "📦 Client Package (packages/client)"
        subgraph "Client Adapters"
            WsAdapter["WebSocket Adapter"]
            CoreBridge["Core Bridge Adapter"]
        end
        
        subgraph "Client Event Handlers"
            ClientAuth["Auth Handler"]
            ClientMessage["Message Handler"] 
            ClientStorage["Storage Handler"]
            ClientEntity["Entity Handler"]
            ClientDialog["Dialog Handler"]
            ClientConfig["Config Handler"]
            ClientServer["Server Handler"]
        end
        
        subgraph "Client Stores"
            AuthStore["Auth Store"]
            ChatStore["Chat Store"]
            MessageStore["Message Store"]
            SettingsStore["Settings Store"]
            SyncTaskStore["Sync Task Store"]
        end
    end

    subgraph "🌐 Communication Layer"
        WS["WebSocket Server<br/>(apps/server)<br/>Real-time Bidirectional<br/>• Event Registration<br/>• Event Forwarding<br/>• Session Management"]
    end

    subgraph "🎯 Core Package (packages/core)"
        Context["CoreContext<br/>🔥 Central Event Bus<br/>(EventEmitter3)<br/>• ToCoreEvent<br/>• FromCoreEvent<br/>• Event Wrappers<br/>• Error Handling"]
        
        subgraph "Core Event Handlers"
            AuthHandler["🔐 Auth Handler"]
            MessageHandler["📝 Message Handler"]
            DialogHandler["💬 Dialog Handler"]
            StorageHandler["📦 Storage Handler"]
            ConfigHandler["⚙️ Config Handler"]
            EntityHandler["👤 Entity Handler"]
            SessionHandler["🔑 Session Handler"]
            GramEventsHandler["📡 Gram Events Handler"]
            MessageResolverHandler["🔄 Message Resolver Handler"]
            TakeoutHandler["📤 Takeout Handler"]
        end
        
        subgraph "Core Services"
            AuthService["Authentication Service"]
            MessageService["Message Service"]
            DialogService["Dialog Service"]
            StorageService["Storage Service"]
            ConfigService["Config Service"]
            EntityService["Entity Service"]
            SessionService["Session Service"]
            ConnectionService["Connection Service"]
            TakeoutService["Takeout Service"]
        end
        
        subgraph "Message Processing Pipeline"
            MsgResolverService["Message Resolver Service"]
            
            subgraph "Message Resolvers"
                EmbeddingResolver["🤖 Embedding Resolver<br/>(OpenAI/Ollama)"]
                JiebaResolver["📚 Jieba Resolver<br/>(Chinese Segmentation)"]
                LinkResolver["🔗 Link Resolver"]
                MediaResolver["📸 Media Resolver"]
                UserResolver["👤 User Resolver"]
            end
        end
        
        subgraph "Database Layer"
            Models["Database Models"]
            Schemas["Drizzle Schemas"]
        end
    end

    subgraph "🗄️ Data Storage"
        DB["Database<br/>(PostgreSQL + pgvector)<br/>or (PGlite)"]
    end

    subgraph "📡 External APIs"
        TelegramAPI["Telegram API<br/>(gram.js)"]
        EmbeddingAPI["Embedding API<br/>(OpenAI/Ollama)"]
    end

    subgraph "🛠️ Common Package (packages/common)"
        Logger["Logger (@unbird/logg)"]
        Utils["Shared Utilities"]
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

### Event-Driven Architecture Overview

#### 📦 Package Responsibilities

- **`packages/core`**: The heart of the application containing:
  - **CoreContext**: Central event bus using EventEmitter3
  - **Event Handlers**: Listen to and process events from the event bus
  - **Services**: Business logic implementations (Auth, Message, Storage, etc.)
  - **Message Resolvers**: Process messages through various resolvers (Embedding, Jieba, Link, Media, User)
  - **Database Models & Schemas**: Drizzle ORM models and PostgreSQL schemas

- **`packages/client`**: Client-side integration layer containing:
  - **Adapters**: WebSocket and Core Bridge adapters for different runtime environments
  - **Event Handlers**: Client-side event handlers that communicate with the backend
  - **Stores**: Pinia stores for state management (Auth, Chat, Message, Settings, Sync)
  - **Composables**: Reusable Vue composition functions

- **`packages/common`**: Shared utilities:
  - **Logger**: Centralized logging using @unbird/logg
  - **Utilities**: Common helper functions

- **`apps/server`**: WebSocket server:
  - Manages WebSocket connections
  - Routes events between clients and CoreContext instances
  - Handles session management

- **`apps/web`**: Vue 3 frontend application:
  - User interface built with Vue 3, Pinia, and Vue Router
  - Integrates with packages/client for backend communication
  - Supports both browser-only mode (with PGlite) and server mode (with PostgreSQL)

#### 🎯 Core Event System

- **CoreContext - Central Event Bus**: The heart of the system using EventEmitter3 for managing all events
  - **ToCoreEvent**: Events sent to the core system (auth:login, message:query, etc.)
  - **FromCoreEvent**: Events emitted from core system (message:data, auth:status, etc.)
  - **Event Wrapping**: Automatic error handling and logging for all events
  - **Session Management**: Each client session gets its own CoreContext instance

#### 🌐 Communication Layer

- **WebSocket Server**: Real-time bidirectional communication
  - **Event Registration**: Clients register for specific events they want to receive
  - **Event Forwarding**: Seamlessly forwards events between frontend and CoreContext
  - **Session Persistence**: Maintains client state and event listeners across connections

- **Client Adapters**: Support multiple runtime environments
  - **WebSocket Adapter**: For server mode with real-time backend connection
  - **Core Bridge Adapter**: For browser-only mode with in-browser database (PGlite)

#### 🔄 Message Processing Pipeline

Stream-based message processing through multiple resolvers:
- **Embedding Resolver**: Generates vector embeddings using OpenAI/Ollama for semantic search
- **Jieba Resolver**: Chinese word segmentation for better search capabilities
- **Link Resolver**: Extracts and processes links from messages
- **Media Resolver**: Handles media attachments (photos, videos, documents)
- **User Resolver**: Processes user mentions and references

#### 📡 Event Flow

1. **Frontend** → User interaction triggers an action in Vue component
2. **Client Store** → Store dispatches an event via WebSocket Adapter
3. **WebSocket** → Event is sent to backend server
4. **CoreContext** → Event bus routes to appropriate event handler
5. **Event Handler** → Processes event and calls corresponding service
6. **Service** → Executes business logic (may call Telegram API or database)
7. **Service** → Emits result event back through CoreContext
8. **WebSocket** → Forwards event to frontend client
9. **Client Event Handler** → Updates client store with new data
10. **Frontend** → Vue components reactively update UI

#### 🗄️ Database Support

The application supports two database modes:
- **PostgreSQL + pgvector**: For production deployments with full vector search capabilities
- **PGlite**: In-browser PostgreSQL for browser-only mode (experimental)

## 🚀 Activity

![Alt](https://repobeats.axiom.co/api/embed/69d5ef9f5e72cd7901b32ff71b5f359bc7ca42ea.svg "Repobeats analytics image")

[![Star History Chart](https://api.star-history.com/svg?repos=luoling8192/telegram-search&type=Date)](https://star-history.com/#luoling8192/telegram-search&Date)
