![preview](./assets/preview.png)

<h1 align="center">Telegram Search</h1>

<p align="center">
  <a href="https://trendshift.io/repositories/13868" target="_blank"><img src="https://trendshift.io/api/badge/repositories/13868" alt="groupultra%2Ftelegram-search | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
</p>

<p align="center">
  [<a href="https://search.lingogram.app">すぐに使用</a>] [<a href="https://discord.gg/NzYsmJSgCT">Discordサーバーに参加</a>] [<a href="../README.md">English</a>] [<a href="./README_CN.md">简体中文</a>]
</p>

<p align="center">
  <a href="https://app.netlify.com/projects/tgsearch/deploys"><img src="https://api.netlify.com/api/v1/badges/89bfbfd2-0f73-41b0-8db4-4ab6b6512f6e/deploy-status"></a>
  <a href="https://deepwiki.com/GramSearch/telegram-search"><img src="https://deepwiki.com/badge.svg"></a>
  <a href="https://github.com/GramSearch/telegram-search/blob/main/LICENSE"><img src="https://img.shields.io/github/license/GramSearch/telegram-search.svg?style=flat&colorA=080f12&colorB=1fa669"></a>
    <a href="https://discord.gg/NzYsmJSgCT"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fdiscord.com%2Fapi%2Finvites%2FNzYsmJSgCT%3Fwith_counts%3Dtrue&query=%24.approximate_member_count&suffix=%20members&logo=discord&logoColor=white&label=%20&color=7389D8&labelColor=6A7EC2"></a>
  <a href="https://t.me/+Gs3SH2qAPeFhYmU9"><img src="https://img.shields.io/badge/Telegram-%235AA9E6?logo=telegram&labelColor=FFFFFF"></a>
</p>

> 仮想通貨は一切発行していません。詐欺にご注意ください。
>
> このソフトウェアは自分のチャット履歴をエクスポートして検索するためのものです。違法な目的で使用しないでください。

ベクトル検索とセマンティックマッチングをサポートする強力なTelegramチャット履歴検索ツール。OpenAIのセマンティックベクトル技術に基づいて、Telegramメッセージの検索をよりスマートで正確にします。

## 💖 スポンサー

![Sponsors](https://github.com/luoling8192/luoling8192/raw/master/sponsorkit/sponsors.svg)

## 🌐 すぐに使用

我々はオンラインバージョンを提供しており、Telegram Searchのすべての機能を体験できます。
> 我々はあなたのプライバシーを尊重します。

以下のURLから開始してください: https://search.lingogram.app

## 🚀 クイックスタート

### ランタイム環境変数

コンテナを起動する前に、以下の環境変数を設定してください。

| 変数 | 必須 | 説明 |
| --- | --- | --- |
| `TELEGRAM_API_ID` | ✅ | [my.telegram.org](https://my.telegram.org/apps) で取得した Telegram アプリ ID。 |
| `TELEGRAM_API_HASH` | ✅ | 同じページで取得できる Telegram アプリ Hash。 |
| `DATABASE_URL` | ✅ | サーバーとマイグレーションが利用する PostgreSQL 接続文字列。 |
| `EMBEDDING_API_KEY` | ✅ | 埋め込みプロバイダーの API キー（OpenAI、Ollama など）。 |
| `EMBEDDING_BASE_URL` | 任意 | 自前ホストや互換プロバイダー向けの API ベース URL。 |
| `EMBEDDING_PROVIDER` | 任意 | 埋め込みプロバイダーを上書き（`openai` または `ollama`）。 |
| `EMBEDDING_MODEL` | 任意 | 使用する埋め込みモデル名を上書き。 |
| `EMBEDDING_DIMENSION` | 任意 | 埋め込みベクトルの次元数を上書き（`1536`、`1024`、`768` など）。 |
| `PGVECTOR_HOST_PORT` | 任意 | pgvector を外部公開するときのホスト側ポート（例: `15432`）。 |
| `PGVECTOR_HOST_IP` | 任意 | ポート公開時にバインドするホスト IP（例: `127.0.0.1` のみで待ち受け）。 |

### Docker イメージから起動

1. 必要な環境変数を指定してイメージを実行します。

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

`<postgres-host>` には利用したい PostgreSQL のホスト名または IP アドレスを指定してください。

2. http://localhost:3333 にアクセスして検索インターフェースを開きます。

### Docker Compose で起動

1. リポジトリをクローンします。

2. ルートディレクトリに `.env` ファイルを作成し、上記の環境変数（必要なものだけ）を記載します。

3. docker compose を実行してすべてのサービスを起動します。

```bash
docker compose up -d
```

4. http://localhost:3333 にアクセスして検索インターフェースを開きます。

5. pgvector のポートを外部公開したい場合は、起動時に `PGVECTOR_HOST_PORT` を指定してください。

```bash
PGVECTOR_HOST_PORT=15432 docker compose up -d
```

   特定のインターフェースだけで待ち受けたい場合は `PGVECTOR_HOST_IP=127.0.0.1` も併せて指定します。

## 💻 開発ガイド

### ウェブモード

1. リポジトリをクローン

2. 依存関係をインストール

```bash
pnpm install
```

3. 開発サーバーを起動:

```bash
pnpm run dev
```

### バックエンドモード

1. リポジトリをクローン

2. 依存関係をインストール

```bash
pnpm install
```

3. 環境を設定

```bash
cp config/config.example.yaml config/config.yaml
```

4. データベースコンテナを起動:

```bash
# ローカル開発では、Dockerはデータベースコンテナのみに使用されます。
docker compose up -d pgvector
```

5. サービスを起動:

```bash
# バックエンドを起動
pnpm run server:dev

# フロントエンドを起動
pnpm run web:dev
```

## 🏗️ アーキテクチャ

```mermaid
graph TB
    subgraph "🖥️ フロントエンドレイヤー"
        Frontend["Webフロントエンド<br/>(Vue 3 + Pinia)"]
        Electron["Electronデスクトップ"]
        
        subgraph "クライアントイベントハンドラー"
            ClientAuth["認証ハンドラー"]
            ClientMessage["メッセージハンドラー"] 
            ClientStorage["ストレージハンドラー"]
            ClientEntity["エンティティハンドラー"]
            ClientServer["サーバーハンドラー"]
        end
    end

    subgraph "🌐 通信レイヤー"
        WS["WebSocketイベントブリッジ<br/>リアルタイム双方向通信<br/>• イベント登録<br/>• イベント転送<br/>• セッション管理"]
    end

    subgraph "🚀 バックエンドサービスレイヤー"
        Server["バックエンドサーバー<br/>(REST API)"]
        
        subgraph "セッション管理"
            SessionMgr["セッションマネージャー<br/>• クライアント状態<br/>• CoreContextインスタンス<br/>• イベントリスナー"]
        end
    end

    subgraph "🎯 コアイベントシステム"
        Context["CoreContext<br/>🔥 中央イベントバス<br/>(EventEmitter3)<br/>• ToCoreEvent<br/>• FromCoreEvent<br/>• イベントラッパー<br/>• エラーハンドリング"]
        
        subgraph "コアイベントハンドラー"
            AuthHandler["🔐 認証ハンドラー"]
            MessageHandler["📝 メッセージハンドラー"]
            DialogHandler["💬 ダイアログハンドラー"]
            StorageHandler["📦 ストレージハンドラー"]
            ConfigHandler["⚙️ 設定ハンドラー"]
            EntityHandler["👤 エンティティハンドラー"]
            GramEventsHandler["📡 Gramイベントハンドラー"]
            MessageResolverHandler["🔄 メッセージリゾルバーハンドラー"]
        end
    end

    subgraph "🔧 ビジネスサービスレイヤー"
        subgraph "サービス"
            AuthService["認証<br/>サービス"]
            MessageService["メッセージ<br/>サービス"]
            DialogService["ダイアログ<br/>サービス"]
            StorageService["ストレージ<br/>サービス"]
            ConfigService["設定<br/>サービス"]
            EntityService["エンティティ<br/>サービス"]
            ConnectionService["接続<br/>サービス"]
            TakeoutService["テイクアウト<br/>サービス"]
        end
        
        subgraph "メッセージ処理パイプライン"
            MsgResolverService["メッセージリゾルバー<br/>サービス"]
            
            subgraph "メッセージリゾルバー"
                EmbeddingResolver["🤖 埋め込み<br/>リゾルバー<br/>(OpenAI)"]
                JiebaResolver["📚 Jieba<br/>リゾルバー<br/>(中国語分割)"]
                LinkResolver["🔗 リンク<br/>リゾルバー"]
                MediaResolver["📸 メディア<br/>リゾルバー"]
                UserResolver["👤 ユーザー<br/>リゾルバー"]
            end
        end
    end

    subgraph "🗄️ データレイヤー"
        DB["PostgreSQL<br/>+ pgvector"]
        Drizzle["Drizzle ORM"]
    end

    subgraph "📡 外部API"
        TelegramAPI["Telegram API<br/>(gram.js)"]
        OpenAI["OpenAI API<br/>ベクトル埋め込み"]
    end

    %% WebSocketイベントフロー
    Frontend -.->|"WsEventToServer<br/>• auth:login<br/>• message:query<br/>• dialog:fetch"| WS
    WS -.->|"WsEventToClient<br/>• message:data<br/>• auth:status<br/>• storage:progress"| Frontend
    
    Electron -.->|"WebSocketイベント"| WS
    WS -.->|"リアルタイム更新"| Electron

    %% サーバーレイヤー
    WS <--> Server
    Server --> SessionMgr
    SessionMgr --> Context

    %% コアイベントシステム（アーキテクチャの要点）
    Context <==> AuthHandler
    Context <==> MessageHandler
    Context <==> DialogHandler
    Context <==> StorageHandler
    Context <==> ConfigHandler
    Context <==> EntityHandler
    Context <==> GramEventsHandler
    Context <==> MessageResolverHandler

    %% イベントハンドラーからサービスへ
    AuthHandler --> AuthService
    MessageHandler --> MessageService
    DialogHandler --> DialogService
    StorageHandler --> StorageService
    ConfigHandler --> ConfigService
    EntityHandler --> EntityService
    GramEventsHandler --> ConnectionService
    MessageResolverHandler --> MsgResolverService

    %% メッセージ処理パイプライン
    MessageService --> MsgResolverService
    MsgResolverService --> EmbeddingResolver
    MsgResolverService --> JiebaResolver
    MsgResolverService --> LinkResolver
    MsgResolverService --> MediaResolver
    MsgResolverService --> UserResolver

    %% データレイヤー
    StorageService --> Drizzle
    Drizzle --> DB

    %% 外部API
    AuthService --> TelegramAPI
    MessageService --> TelegramAPI
    DialogService --> TelegramAPI
    EntityService --> TelegramAPI
    EmbeddingResolver --> OpenAI

    %% クライアントイベントシステム
    Frontend --> ClientAuth
    Frontend --> ClientMessage
    Frontend --> ClientStorage
    Frontend --> ClientEntity
    Frontend --> ClientServer

    %% スタイリング
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

### イベント駆動アーキテクチャの概要

- **🎯 CoreContext - 中央イベントバス**: EventEmitter3を使用してすべてのイベントを管理するシステムの中心
  - **ToCoreEvent**: コアシステムに送信されるイベント（auth:login、message:queryなど）
  - **FromCoreEvent**: コアシステムから発行されるイベント（message:data、auth:statusなど）
  - **イベントラッピング**: すべてのイベントの自動エラー処理とロギング
  - **セッション管理**: 各クライアントセッションに独自のCoreContextインスタンス

- **🌐 WebSocketイベントブリッジ**: リアルタイム双方向通信レイヤー
  - **イベント登録**: クライアントが受信したい特定のイベントを登録
  - **イベント転送**: フロントエンドとCoreContext間でイベントをシームレスに転送
  - **セッション永続性**: 接続全体でクライアント状態とイベントリスナーを維持

- **🔄 メッセージ処理パイプライン**: 複数のリゾルバーを通じたストリームベースのメッセージ処理
  - **埋め込みリゾルバー**: セマンティック検索のためにOpenAIを使用してベクトル埋め込みを生成
  - **Jiebaリゾルバー**: より良い検索機能のための中国語単語分割
  - **リンク/メディア/ユーザーリゾルバー**: さまざまなメッセージコンテンツタイプを抽出して処理

- **📡 イベントフロー**:
  1. フロントエンドがWebSocket経由でイベントを発行（例: `auth:login`、`message:query`）
  2. サーバーが適切なCoreContextインスタンスにイベントを転送
  3. イベントハンドラーがイベントを処理し、対応するサービスを呼び出す
  4. サービスがCoreContext経由で結果イベントを発行
  5. WebSocketがリアルタイム更新のためにフロントエンドにイベントを転送

## 🚀 アクティビティ

![Alt](https://repobeats.axiom.co/api/embed/69d5ef9f5e72cd7901b32ff71b5f359bc7ca42ea.svg "Repobeats analytics image")

[![Star History Chart](https://api.star-history.com/svg?repos=luoling8192/telegram-search&type=Date)](https://star-history.com/#luoling8192/telegram-search&Date)
