![preview](./assets/preview.png)

---

<p align="center">
  <a href="https://trendshift.io/repositories/13868" target="_blank"><img src="https://trendshift.io/api/badge/repositories/13868" alt="groupultra%2Ftelegram-search | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
</p>

<p align="center">
  [<a href="https://search.lingogram.app">すぐに使用</a>] [<a href="../README.md">English</a>] [<a href="./README_CN.md">简体中文</a>]
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

**強力なセマンティック検索で Telegram メッセージを簡単に検索・エクスポート。すべての言語と分かち書きなしの文に対応。**

メッセージ検索を高速・正確かつプライバシー重視に — Docker でローカル実行するか、オンラインで試せます。

## 💖 スポンサー

![Sponsors](https://github.com/luoling8192/luoling8192/raw/master/sponsorkit/sponsors.svg)

## ✅ できること

### 📦 エクスポートとバックアップ
- [x] PostgreSQL またはブラウザ内データベース（PGlite）にエクスポート
- [x] あらゆるデータベースへの簡単なインポート用の汎用エクスポート形式
- [ ] CSV / JSON への1クリックエクスポート

### 🔍 チャット履歴の検索
- [x] キーワード検索：多言語対応（中国語、英語など）
- [x] 自然言語検索：質問するようにメッセージを検索
- [x] スマートフィルター：連絡先/グループ、時間範囲、添付ファイル付きなど

### 🔄 同期とストレージ
- [x] 増分同期：使用中に同期
- [x] ストレージオプション：サーバー（PostgreSQL + pgvector）またはブラウザのみモード（PGlite）
- [ ] 中断からの再開：失敗後に自動的に続行

### 🧠 AI 機能
- [x] チャットについて AI に質問：現在のチャットまたは選択範囲を照会
- [ ] AI メッセージ要約：キーポイント、ToDo、結論を自動抽出
- [x] AI 駆動検索：自然言語クエリで正確な結果を取得
- [x] AI チャット：チャットコンテキストに基づいて AI と会話
- [ ] AI 分析：トレンド、感情、キーワード、リンクとファイルからの洞察
- [ ] ローカルモデルサポート：ローカル Embedding / 推論（クラウド不要）

### 🔗 メディアとリンク（予定）
- [ ] リンクと画像の深いインデックス：Web 要約、画像 OCR/説明
- [ ] 添付ファイルコンテンツ抽出：PDF、画像、音声/ビデオのキーフレームとテキスト

### 🌐 その他のプラットフォーム（予定）
- [ ] マルチクライアントサポート：Discord など

## 🌐 すぐに使用

我々はオンラインバージョンを提供しており、Telegram Search のすべての機能を体験できます。

> [!NOTE]
> 我々はあなたのプライバシーを尊重します。

以下の URL から開始してください：https://search.lingogram.app

## 🚀 クイックスタート

### 1分で起動（Docker）

> [!IMPORTANT]
> 最も簡単な始め方 — 設定不要。すべての機能が合理的なデフォルト設定で動作します。

```bash
docker run -d --name telegram-search \
  -p 3333:3333 \
  -v telegram-search-data:/app/data \
  ghcr.io/groupultra/telegram-search:latest
```

**http://localhost:3333** を開いてください 🎉

### 高度な設定（オプション）

<details>
<summary>🔧 環境変数</summary>

> [!TIP]
> すべての環境変数は任意です。必要な場合のみカスタマイズしてください。

| 変数 | 説明 |
| --- | --- |
| `TELEGRAM_API_ID` | [my.telegram.org](https://my.telegram.org/apps) の Telegram アプリ ID |
| `TELEGRAM_API_HASH` | Telegram アプリ Hash |
| `DATABASE_TYPE` | `postgres` または `pglite`（デフォルト：`pglite`） |
| `DATABASE_URL` | PostgreSQL 接続文字列（`DATABASE_TYPE=postgres` の場合のみ） |
| `PROXY_URL` | プロキシ URL（例：`socks5://user:pass@host:port`） |

> [!IMPORTANT]
> AI Embedding & LLM 設定は現在アプリ内で**アカウントごとに設定**されています（設定 → API）。  
> 環境変数 like `EMBEDDING_API_KEY`, `EMBEDDING_MODEL`, etc. は廃止され、将来のリリースで削除されます。

**PostgreSQL を使用する例：**

```bash
docker run -d --name telegram-search \
  -p 3333:3333 \
  -v telegram-search-data:/app/data \
  -e TELEGRAM_API_ID=611335 \
  -e TELEGRAM_API_HASH=d524b414d21f4d37f08684c1df41ac9c \
  -e DATABASE_TYPE=postgres \
  -e DATABASE_URL=postgresql://<postgres-host>:5432/postgres \
  ghcr.io/groupultra/telegram-search:latest
```

**プロキシ形式：**
- SOCKS5: `socks5://user:pass@host:port`
- SOCKS4: `socks4://user:pass@host:port`
- HTTP: `http://user:pass@host:port`
- MTProxy: `mtproxy://secret@host:port`

📖 **完全な環境変数リファレンス：** [docs/ENVIRONMENT.md](./ENVIRONMENT.md)

</details>

### Docker Compose で起動

1. リポジトリをクローンします。

2. docker compose を実行してデータベースを含むすべてのサービスを起動します。

```bash
docker compose up -d
```

3. `http://localhost:3333` にアクセスして検索インターフェースを開きます。

## 💻 開発ガイド

> [!CAUTION]
> 開発には **Node.js >= 24.11** と **pnpm** が必要です。インストールされていることを確認してください。

### ブラウザのみモード

```bash
git clone https://github.com/groupultra/telegram-search.git
cd telegram-search
pnpm install
cp .env.example .env
pnpm run dev
```

### サーバーモード（バックエンド付き）

```bash
git clone https://github.com/groupultra/telegram-search.git
cd telegram-search
pnpm install

# 環境変数をコピーして編集（Telegram キー、DB タイプ/URL、プロキシなど）
cp .env.example .env
# 任意: .env.local で上書き（Git には含めない）

# PostgreSQL + pgvector を起動（または DATABASE_URL を自前の DB に向ける）
docker compose up -d pgvector

# バックエンドとフロントエンドを起動（2つのターミナル）
pnpm run server:dev  # ターミナル 1: WebSocket バックエンド（dotenvx 経由で .env/.env.local を読み込み）
pnpm run web:dev     # ターミナル 2: Vue フロントエンド
```

📖 **開発の詳細：** [CONTRIBUTING.md](../CONTRIBUTING.md)

## 🏗️ アーキテクチャ

このプロジェクトは**イベント駆動アーキテクチャ**の **monorepo** です：

- **`apps/web`**: Vue 3 フロントエンド
- **`apps/server`**: WebSocket サーバー
- **`packages/client`**: クライアントアダプターと stores（Pinia）
- **`packages/core`**: イベントバス（EventEmitter3）、サービス、データベースモデル（Drizzle ORM）
- **`packages/common`**: ロガーとユーティリティ

**主要技術：**
- イベント駆動：`CoreContext`（EventEmitter3）
- リアルタイム通信：WebSocket
- データベース：PostgreSQL + pgvector または PGlite（ブラウザ内）
- メッセージ処理パイプライン：Embedding、Jieba、Link、Media、User resolvers

📖 **完全なアーキテクチャの詳細、イベントフロー、図：** [CONTRIBUTING.md](../CONTRIBUTING.md)

## 🚨 警告
> [!WARNING]
> 仮想通貨は一切発行していません。詐欺にご注意ください。

> [!CAUTION]
> このソフトウェアは自分のチャット履歴をエクスポートして検索するためのものです。違法な目的で使用しないでください。

## 🚀 アクティビティ

![Alt](https://repobeats.axiom.co/api/embed/69d5ef9f5e72cd7901b32ff71b5f359bc7ca42ea.svg "Repobeats analytics image")

[![Star History Chart](https://api.star-history.com/svg?repos=groupultra/telegram-search&type=Date)](https://star-history.com/#groupultra/telegram-search&Date)
