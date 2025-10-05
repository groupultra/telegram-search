![preview](./assets/preview.png)

---

<p align="center">
  <a href="https://trendshift.io/repositories/13868" target="_blank"><img src="https://trendshift.io/api/badge/repositories/13868" alt="groupultra%2Ftelegram-search | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
</p>

<p align="center">
  [<a href="https://search.lingogram.app">すぐに使用</a>] [<a href="https://discord.gg/NzYsmJSgCT">Discord サーバーに参加</a>] [<a href="../README.md">English</a>] [<a href="./README_CN.md">简体中文</a>]
</p>

<p align="center">
  <a href="https://app.netlify.com/projects/tgsearch/deploys"><img src="https://api.netlify.com/api/v1/badges/89bfbfd2-0f73-41b0-8db4-4ab6b6512f6e/deploy-status"></a>
  <a href="https://deepwiki.com/GramSearch/telegram-search"><img src="https://deepwiki.com/badge.svg"></a>
  <a href="https://github.com/GramSearch/telegram-search/blob/main/LICENSE"><img src="https://img.shields.io/github/license/GramSearch/telegram-search.svg?style=flat&colorA=080f12&colorB=1fa669"></a>
    <a href="https://discord.gg/NzYsmJSgCT"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fdiscord.com%2Fapi%2Finvites%2FNzYsmJSgCT%3Fwith_counts%3Dtrue&query=%24.approximate_member_count&suffix=%20members&logo=discord&logoColor=white&label=%20&color=7389D8&labelColor=6A7EC2"></a>
  <a href="https://t.me/+Gs3SH2qAPeFhYmU9"><img src="https://img.shields.io/badge/Telegram-%235AA9E6?logo=telegram&labelColor=FFFFFF"></a>
</p>

> [!WARNING]
> 仮想通貨は一切発行していません。詐欺にご注意ください。

> [!CAUTION]
> このソフトウェアは自分のチャット履歴をエクスポートして検索するためのものです。違法な目的で使用しないでください。

ベクトル検索とセマンティックマッチングをサポートする強力な Telegram チャット履歴検索ツール。OpenAI のセマンティックベクトル技術に基づいて、Telegram メッセージの検索をよりスマートで正確にします。

## 💖 スポンサー

![Sponsors](https://github.com/luoling8192/luoling8192/raw/master/sponsorkit/sponsors.svg)

## 🌐 すぐに使用

我々はオンラインバージョンを提供しており、Telegram Search のすべての機能を体験できます。

> [!NOTE]
> 我々はあなたのプライバシーを尊重します。

以下の URL から開始してください：https://search.lingogram.app

## 🚀 クイックスタート

### ランタイム環境変数

> [!TIP]
> すべての環境変数は任意です。アプリケーションはデフォルト設定で動作しますが、これらの変数を設定することで動作をカスタマイズできます。

### Docker イメージから起動

> [!IMPORTANT]
> 最も簡単な始め方は、設定なしで Docker イメージを実行することです。すべての機能が合理的なデフォルト設定で動作します。

1. 環境変数なしでデフォルトイメージを実行します。

```bash
docker run -d --name telegram-search \
  -p 3333:3333 \
  -v telegram-search-data:/app/data \
  ghcr.io/groupultra/telegram-search:latest
```

<details>
<summary>環境変数ありの例</summary>

コンテナを起動する前に、以下の環境変数を設定してください。

| 変数 | 必須 | 説明 |
| --- | --- | --- |
| `TELEGRAM_API_ID` | 任意 | [my.telegram.org](https://my.telegram.org/apps) で取得した Telegram アプリ ID。 |
| `TELEGRAM_API_HASH` | 任意 | 同じページで取得できる Telegram アプリ Hash。 |
| `DATABASE_TYPE` | 任意 | データベースタイプ（`postgres` または `pglite`）。 |
| `DATABASE_URL` | 任意 | サーバーとマイグレーションが利用するデータベース接続文字列（`DATABASE_TYPE` が `postgres` の場合のみサポート）。 |
| `EMBEDDING_API_KEY` | 任意 | 埋め込みプロバイダーの API キー（OpenAI、Ollama など）。 |
| `EMBEDDING_BASE_URL` | 任意 | 自前ホストや互換プロバイダー向けの API ベース URL。 |
| `EMBEDDING_PROVIDER` | 任意 | 埋め込みプロバイダーを上書き（`openai` または `ollama`）。 |
| `EMBEDDING_MODEL` | 任意 | 使用する埋め込みモデル名を上書き。 |
| `EMBEDDING_DIMENSION` | 任意 | 埋め込みベクトルの次元数を上書き（`1536`、`1024`、`768` など）。 |
| `PROXY_URL` | 任意 | プロキシ設定URL（例：`socks5://user:pass@host:port`）。(#366) |

以下の環境変数はコンパイル時にのみ有効です（`docker run` 時には無効です）：

| 変数 | 必須 | 説明 |
| --- | --- | --- |
| `VITE_PREVIEW_ALLOW_ALL_HOSTS` | 任意 (`true`) | プレビュー ページへのすべてのホストのアクセスを許可します。(#371) |
| `VITE_DISABLE_SETTINGS` | 任意 (`true`) | 設定ページを無効化。 |

### プロキシURL形式

`PROXY_URL` 環境変数は以下の形式をサポートします：

- **SOCKS4**: `socks4://username:password@host:port?timeout=15`
- **SOCKS5**: `socks5://username:password@host:port?timeout=15`
- **HTTP**: `http://username:password@host:port?timeout=15`
- **MTProxy**: `mtproxy://secret@host:port?timeout=15`

例：
- `PROXY_URL=socks5://myuser:mypass@proxy.example.com:1080`
- `PROXY_URL=mtproxy://secret123@mtproxy.example.com:443`
- `PROXY_URL=socks5://proxy.example.com:1080?timeout=30` （認証なし）

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

`<postgres-host>` には利用したい PostgreSQL のホスト名または IP アドレスを指定してください。

</details>

2. http://localhost:3333 にアクセスして検索インターフェースを開きます。

### Docker Compose で起動

1. リポジトリをクローンします。

2. docker compose を実行してすべてのサービスを起動します。

```bash
docker compose up -d
```

3. http://localhost:3333 にアクセスして検索インターフェースを開きます。

## 💻 開発ガイド

> [!CAUTION]
> 開発モードには Node.js >= 22.18 と pnpm が必要です。続行する前に正しいバージョンがインストールされていることを確認してください。

### ウェブモード

1. リポジトリをクローン

2. 依存関係をインストール

```bash
pnpm install
```

3. 環境を設定

```bash
cp .env.example .env
```

4. 開発サーバーを起動：

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

4. データベースコンテナを起動：

```bash
# ローカル開発では、Docker はデータベースコンテナのみに使用されます。
docker compose up -d pgvector
```

5. サービスを起動：

```bash
# バックエンドを起動
pnpm run server:dev

# フロントエンドを起動
pnpm run web:dev
```

## 🏗️ アーキテクチャ

### パッケージ構造

このプロジェクトは monorepo として構成されており、以下のパッケージが含まれます：

- **`apps/web`**: Vue 3、Pinia、Vue Router で構築されたフロントエンドアプリケーション
- **`apps/server`**: リアルタイム通信用のバックエンド WebSocket サーバー
- **`packages/client`**: クライアント側アダプター、イベントハンドラー、ストア
- **`packages/core`**: コアイベントシステム、サービス、データベースモデル、ビジネスロジック
- **`packages/common`**: 共有ユーティリティとロガー設定

```mermaid
graph TB
    subgraph "🖥️ フロントエンドレイヤー (apps/web)"
        Frontend["Web アプリケーション<br/>(Vue 3 + Pinia + Vue Router)"]
    end

    subgraph "📦 Client パッケージ (packages/client)"
        subgraph "クライアントアダプター"
            WsAdapter["WebSocket アダプター"]
            CoreBridge["Core Bridge アダプター"]
        end
        
        subgraph "クライアントイベントハンドラー"
            ClientAuth["認証ハンドラー"]
            ClientMessage["メッセージハンドラー"] 
            ClientStorage["ストレージハンドラー"]
            ClientEntity["エンティティハンドラー"]
            ClientDialog["ダイアログハンドラー"]
            ClientConfig["設定ハンドラー"]
            ClientServer["サーバーハンドラー"]
        end
        
        subgraph "クライアントストア"
            AuthStore["認証ストア"]
            ChatStore["チャットストア"]
            MessageStore["メッセージストア"]
            SettingsStore["設定ストア"]
            SyncTaskStore["同期タスクストア"]
        end
    end

    subgraph "🌐 通信レイヤー"
        WS["WebSocket サーバー<br/>(apps/server)<br/>リアルタイム双方向通信<br/>• イベント登録<br/>• イベント転送<br/>• セッション管理"]
    end

    subgraph "🎯 Core パッケージ (packages/core)"
        Context["CoreContext<br/>🔥 中央イベントバス<br/>(EventEmitter3)<br/>• ToCoreEvent<br/>• FromCoreEvent<br/>• イベントラッパー<br/>• エラーハンドリング"]
        
        subgraph "コアイベントハンドラー"
            AuthHandler["🔐 認証ハンドラー"]
            MessageHandler["📝 メッセージハンドラー"]
            DialogHandler["💬 ダイアログハンドラー"]
            StorageHandler["📦 ストレージハンドラー"]
            ConfigHandler["⚙️ 設定ハンドラー"]
            EntityHandler["👤 エンティティハンドラー"]
            SessionHandler["🔑 セッションハンドラー"]
            GramEventsHandler["📡 Gram イベントハンドラー"]
            MessageResolverHandler["🔄 メッセージリゾルバーハンドラー"]
            TakeoutHandler["📤 テイクアウトハンドラー"]
        end
        
        subgraph "コアサービス"
            AuthService["認証サービス"]
            MessageService["メッセージサービス"]
            DialogService["ダイアログサービス"]
            StorageService["ストレージサービス"]
            ConfigService["設定サービス"]
            EntityService["エンティティサービス"]
            SessionService["セッションサービス"]
            ConnectionService["接続サービス"]
            TakeoutService["テイクアウトサービス"]
        end
        
        subgraph "メッセージ処理パイプライン"
            MsgResolverService["メッセージリゾルバーサービス"]
            
            subgraph "メッセージリゾルバー"
                EmbeddingResolver["🤖 埋め込みリゾルバー<br/>(OpenAI/Ollama)"]
                JiebaResolver["📚 Jieba リゾルバー<br/>（中国語分割）"]
                LinkResolver["🔗 リンクリゾルバー"]
                MediaResolver["📸 メディアリゾルバー"]
                UserResolver["👤 ユーザーリゾルバー"]
            end
        end
        
        subgraph "データベースレイヤー"
            Models["データベースモデル"]
            Schemas["Drizzle スキーマ"]
        end
    end

    subgraph "🗄️ データストレージ"
        DB["データベース<br/>(PostgreSQL + pgvector)<br/>または (PGlite)"]
    end

    subgraph "📡 外部 API"
        TelegramAPI["Telegram API<br/>(gram.js)"]
        EmbeddingAPI["埋め込み API<br/>(OpenAI/Ollama)"]
    end

    subgraph "🛠️ Common パッケージ (packages/common)"
        Logger["ロガー (@unbird/logg)"]
        Utils["共有ユーティリティ"]
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

### イベント駆動アーキテクチャの概要

#### 📦 パッケージの責任

- **`packages/core`**: アプリケーションの中核で、以下を含みます：
  - **CoreContext**: EventEmitter3 を使用した中央イベントバス
  - **イベントハンドラー**: イベントバスからのイベントをリッスンして処理
  - **サービス**: ビジネスロジックの実装（認証、メッセージ、ストレージなど）
  - **メッセージリゾルバー**: 各種リゾルバーを通じてメッセージを処理（埋め込み、Jieba、リンク、メディア、ユーザー）
  - **データベースモデルとスキーマ**: Drizzle ORM モデルと PostgreSQL スキーマ

- **`packages/client`**: クライアント側統合レイヤーで、以下を含みます：
  - **アダプター**: 異なるランタイム環境をサポートする WebSocket と Core Bridge アダプター
  - **イベントハンドラー**: バックエンドと通信するクライアント側イベントハンドラー
  - **ストア**: 状態管理のための Pinia ストア（認証、チャット、メッセージ、設定、同期）
  - **コンポーザブル**: 再利用可能な Vue コンポジション関数

- **`packages/common`**: 共有ユーティリティ：
  - **ロガー**: @unbird/logg を使用した集中ロギング
  - **ユーティリティ**: 共通のヘルパー関数

- **`apps/server`**: WebSocket サーバー：
  - WebSocket 接続を管理
  - クライアントと CoreContext インスタンス間でイベントをルーティング
  - セッション管理を処理

- **`apps/web`**: Vue 3 フロントエンドアプリケーション：
  - Vue 3、Pinia、Vue Router で構築されたユーザーインターフェース
  - バックエンド通信のために packages/client と統合
  - ブラウザのみモード（PGlite 使用）とサーバーモード（PostgreSQL 使用）の両方をサポート

#### 🎯 コアイベントシステム

- **CoreContext - 中央イベントバス**: EventEmitter3 を使用してすべてのイベントを管理するシステムの中心
  - **ToCoreEvent**: コアシステムに送信されるイベント（auth:login、message:query など）
  - **FromCoreEvent**: コアシステムから発行されるイベント（message:data、auth:status など）
  - **イベントラッピング**: すべてのイベントの自動エラー処理とロギング
  - **セッション管理**: 各クライアントセッションに独自の CoreContext インスタンス

#### 🌐 通信レイヤー

- **WebSocket サーバー**: リアルタイム双方向通信
  - **イベント登録**: クライアントが受信したい特定のイベントを登録
  - **イベント転送**: フロントエンドと CoreContext 間でイベントをシームレスに転送
  - **セッション永続性**: 接続全体でクライアント状態とイベントリスナーを維持

- **クライアントアダプター**: 複数のランタイム環境をサポート
  - **WebSocket アダプター**: サーバーモード用で、バックエンドとのリアルタイム接続
  - **Core Bridge アダプター**: ブラウザのみモード用で、ブラウザ内データベース（PGlite）を使用

#### 🔄 メッセージ処理パイプライン

複数のリゾルバーを通じたストリームベースのメッセージ処理：
- **埋め込みリゾルバー**: セマンティック検索のために OpenAI/Ollama を使用してベクトル埋め込みを生成
- **Jieba リゾルバー**: より良い検索機能のための中国語単語分割
- **リンクリゾルバー**: メッセージからリンクを抽出して処理
- **メディアリゾルバー**: メディア添付ファイル（写真、ビデオ、ドキュメント）を処理
- **ユーザーリゾルバー**: ユーザーメンションと参照を処理

#### 📡 イベントフロー

1. **フロントエンド** → ユーザーインタラクションが Vue コンポーネントでアクションをトリガー
2. **クライアントストア** → ストアが WebSocket アダプター経由でイベントをディスパッチ
3. **WebSocket** → イベントがバックエンドサーバーに送信
4. **CoreContext** → イベントバスが適切なイベントハンドラーにルーティング
5. **イベントハンドラー** → イベントを処理し、対応するサービスを呼び出す
6. **サービス** → ビジネスロジックを実行（Telegram API またはデータベースを呼び出す場合あり）
7. **サービス** → CoreContext 経由で結果イベントを発行
8. **WebSocket** → イベントをフロントエンドクライアントに転送
9. **クライアントイベントハンドラー** → 新しいデータでクライアントストアを更新
10. **フロントエンド** → Vue コンポーネントがリアクティブに UI を更新

#### 🗄️ データベースサポート

アプリケーションは 2 つのデータベースモードをサポートします：
- **PostgreSQL + pgvector**: 完全なベクトル検索機能を備えた本番デプロイ用
- **PGlite**: ブラウザのみモード用のブラウザ内 PostgreSQL（実験的）

## 🚀 アクティビティ

![Alt](https://repobeats.axiom.co/api/embed/69d5ef9f5e72cd7901b32ff71b5f359bc7ca42ea.svg "Repobeats analytics image")

[![Star History Chart](https://api.star-history.com/svg?repos=luoling8192/telegram-search&type=Date)](https://star-history.com/#luoling8192/telegram-search&Date)
