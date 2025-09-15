![preview](./docs/assets/preview.png)

<h1 align="center">Telegram Search</h1>

<p align="center">
  <a href="https://trendshift.io/repositories/13868" target="_blank"><img src="https://trendshift.io/api/badge/repositories/13868" alt="groupultra%2Ftelegram-search | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
</p>

<p align="center">
   [<a href="https://tgsearch.netlify.app">Try it Now</a>] [<a href="https://discord.gg/NzYsmJSgCT">Join Discord Server</a>] [<a href="./docs/README_CN.md">简体中文</a>] [<a href="./docs/README_JA.md">日本語</a>]
</p>

<p align="center">
  <a href="https://deepwiki.com/GramSearch/telegram-search"><img src="https://deepwiki.com/badge.svg"></a>
  <a href="https://github.com/GramSearch/telegram-search/blob/main/LICENSE"><img src="https://img.shields.io/github/license/GramSearch/telegram-search.svg?style=flat&colorA=080f12&colorB=1fa669"></a>
    <a href="https://discord.gg/NzYsmJSgCT"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fdiscord.com%2Fapi%2Finvites%2FNzYsmJSgCT%3Fwith_counts%3Dtrue&query=%24.approximate_member_count&suffix=%20members&logo=discord&logoColor=white&label=%20&color=7389D8&labelColor=6A7EC2"></a>
  <a href="https://t.me/+Gs3SH2qAPeFhYmU9"><img src="https://img.shields.io/badge/Telegram-%235AA9E6?logo=telegram&labelColor=FFFFFF"></a>
</p>

> The only official website is `intentchat.app`, all other websites are scams.
>
> We have not issued any virtual currency, please do not be deceived.
>
> This software can only export your own chat records for search, please do not use it for illegal purposes.

A powerful Telegram chat history search tool that supports vector search and semantic matching. Based on OpenAI's semantic vector technology, it makes your Telegram message retrieval smarter and more precise.

## 💖 Sponsors

![Sponsors](https://github.com/luoling8192/luoling8192/raw/master/sponsorkit/sponsors.svg)
## 🌐 Try it Now

We provide an online version where you can experience all features of Telegram Search without self-deployment. Visit:
> We promise not to collect any user privacy data, you can use it with confidence

https://tgsearch.netlify.app

## 🚀 Quick Start

### Docker

1. Clone the repository:

```bash
git clone https://github.com/GramSearch/telegram-search.git
cd telegram-search

# Switch to release branch
git switch release
```

2. Configure settings:

```bash
# Modify settings in config/config.yaml as needed.
# Make sure to change database.host value to "pgvector" in the configuration.

cp config/config.example.yaml config/config.yaml
```

3. Start services:

```bash
docker compose up -d
```

Access http://localhost:3333 to open the search interface.

## 💻 Development Guide

### Browser Only

1. Clone repository

2. Install dependencies

```bash
pnpm install
```

3. Start development server:

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

4. Start database container:

```bash
# Docker is only used for database container in local development.
docker compose up -d pgvector
```

5. Sync database schema:

```bash
pnpm run db:migrate
```

6. Start services:

```bash
# Start backend
pnpm run dev:server

# Start frontend
pnpm run dev:frontend
```

## 🏗️ Architecture

```mermaid
graph TB
    subgraph "🖥️ Frontend Layer"
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

    subgraph "🌐 Communication Layer"
        WS["WebSocket Event Bridge<br/>Real-time Bidirectional<br/>• Event Registration<br/>• Event Forwarding<br/>• Session Management"]
    end

    subgraph "🚀 Backend Service Layer"
        Server["Backend Server<br/>(REST API)"]
        
        subgraph "Session Management"
            SessionMgr["Session Manager<br/>• Client State<br/>• CoreContext Instance<br/>• Event Listeners"]
        end
    end

    subgraph "🎯 Core Event System"
        Context["CoreContext<br/>🔥 Central Event Bus<br/>(EventEmitter3)<br/>• ToCoreEvent<br/>• FromCoreEvent<br/>• Event Wrappers<br/>• Error Handling"]
        
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

    subgraph "🔧 Business Service Layer"
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
        
        subgraph "Message Processing Pipeline"
            MsgResolverService["Message Resolver<br/>Service"]
            
            subgraph "Message Resolvers"
                EmbeddingResolver["🤖 Embedding<br/>Resolver<br/>(OpenAI)"]
                JiebaResolver["📚 Jieba<br/>Resolver<br/>(Chinese Segmentation)"]
                LinkResolver["🔗 Link<br/>Resolver"]
                MediaResolver["📸 Media<br/>Resolver"]
                UserResolver["👤 User<br/>Resolver"]
            end
        end
    end

    subgraph "🗄️ Data Layer"
        DB["PostgreSQL<br/>+ pgvector"]
        Drizzle["Drizzle ORM"]
    end

    subgraph "📡 External APIs"
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

    %% Core Event System (Key Architecture Highlight)
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

### Event-Driven Architecture Overview

- **🎯 CoreContext - Central Event Bus**: The heart of the system using EventEmitter3 for managing all events
  - **ToCoreEvent**: Events sent to the core system (auth:login, message:query, etc.)
  - **FromCoreEvent**: Events emitted from core system (message:data, auth:status, etc.)
  - **Event Wrapping**: Automatic error handling and logging for all events
  - **Session Management**: Each client session gets its own CoreContext instance

- **🌐 WebSocket Event Bridge**: Real-time bidirectional communication layer
  - **Event Registration**: Clients register for specific events they want to receive
  - **Event Forwarding**: Seamlessly forwards events between frontend and CoreContext
  - **Session Persistence**: Maintains client state and event listeners across connections

- **🔄 Message Processing Pipeline**: Stream-based message processing through multiple resolvers
  - **Embedding Resolver**: Generates vector embeddings using OpenAI for semantic search
  - **Jieba Resolver**: Chinese word segmentation for better search capabilities
  - **Link/Media/User Resolvers**: Extract and process various message content types

- **📡 Event Flow**:
  1. Frontend emits events via WebSocket (e.g., `auth:login`, `message:query`)
  2. Server forwards events to appropriate CoreContext instance
  3. Event handlers process events and call corresponding services
  4. Services emit result events back through CoreContext
  5. WebSocket forwards events to frontend for real-time updates

## 🚀 Activity

[![Star History Chart](https://api.star-history.com/svg?repos=luoling8192/telegram-search&type=Date)](https://star-history.com/#luoling8192/telegram-search&Date)
