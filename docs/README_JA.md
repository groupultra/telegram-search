![preview](./assets/preview.png)

---

<p align="center">
  <a href="https://trendshift.io/repositories/13868" target="_blank"><img src="https://trendshift.io/api/badge/repositories/13868" alt="groupultra%2Ftelegram-search | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
</p>

<p align="center">
  [<a href="https://search.lingogram.app">すぐに使用</a>] [<a href="../README.md">English</a>] [<a href="./README_CN.md">简体中文</a>]
</p>

<p align="center">
  <a href="https://discord.gg/NzYsmJSgCT"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fdiscord.com%2Fapi%2Finvites%2FNzYsmJSgCT%3Fwith_counts%3Dtrue&query=%24.approximate_member_count&suffix=%20members&logo=discord&logoColor=white&label=%20&color=7389D8&labelColor=6A7EC2"></a>
  <a href="https://t.me/+Gs3SH2qAPeFhYmU9"><img src="https://img.shields.io/badge/Telegram-%235AA9E6?logo=telegram&labelColor=FFFFFF"></a>
  <br>
  <a href="https://github.com/groupultra/telegram-search/releases"><img src="https://img.shields.io/github/package-json/v/groupultra/telegram-search?style=flat&colorA=080f12&colorB=1fa669"></a>
  <a href="https://github.com/groupultra/telegram-search/actions"><img src="https://img.shields.io/github/actions/workflow/status/groupultra/telegram-search/ci.yaml?style=flat&colorA=080f12&colorB=1fa669"></a>
  <a href="https://app.netlify.com/projects/tgsearch/deploys"><img src="https://api.netlify.com/api/v1/badges/89bfbfd2-0f73-41b0-8db4-4ab6b6512f6e/deploy-status"></a>
  <a href="https://deepwiki.com/groupultra/telegram-search"><img src="https://deepwiki.com/badge.svg"></a>
</p>

**強力なセマンティック検索で Telegram メッセージを簡単に検索・エクスポート。すべての言語と分かち書きなしの文に対応。**

メッセージ検索を高速、正確、プライバシー重視に — セルフホストまたはオンラインでお試しください。

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
- [ ] スマートフィルター：連絡先/グループ、時間範囲、添付ファイル付きなど

### 🔄 同期とストレージ
- [x] 増分同期：使用中に同期
- [x] ストレージオプション：サーバー（PostgreSQL + pgvector）またはブラウザのみモード（PGlite）
- [ ] 中断からの再開：失敗後に自動的に続行

### 🧠 AI 機能（予定）
- [ ] チャットについて AI に質問：現在のチャットまたは選択範囲を照会
- [ ] AI メッセージ要約：キーポイント、ToDo、結論を自動抽出
- [ ] AI 駆動検索：自然言語クエリで正確な結果を取得
- [ ] AI チャット：チャットコンテキストに基づいて AI と会話
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
| `EMBEDDING_API_KEY` | OpenAI/Ollama の API キー |
| `EMBEDDING_BASE_URL` | カスタム Embedding API ベース URL |
| `EMBEDDING_PROVIDER` | `openai` または `ollama` |
| `EMBEDDING_MODEL` | モデル名 |
| `EMBEDDING_DIMENSION` | Embedding 次元（例：`1536`、`1024`、`768`） |
| `PROXY_URL` | プロキシ URL（例：`socks5://user:pass@host:port`） |

**PostgreSQL と Embeddings を使用する例：**

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
> 開発には **Node.js >= 22.18** と **pnpm** が必要です。インストールされていることを確認してください。

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
cp config/config.example.yaml config/config.yaml

# データベースを起動（Docker）
docker compose up -d pgvector

# バックエンドとフロントエンドを起動
pnpm run server:dev  # ターミナル 1
pnpm run web:dev     # ターミナル 2
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

## ❓ よくある質問

<details>
<summary><b>ユーザーデータを収集しますか？</b></summary>

いいえ。すべてのデータはあなたのマシンまたはサーバーに残ります。ユーザーデータを収集またはアップロードすることはありません。

</details>

<details>
<summary><b>使用するには API キーが必要ですか？</b></summary>

いいえ。アプリケーションはデフォルト設定で動作します。API キーはオプションです：
- Telegram API キー：デフォルトのキーは動作しますが、レート制限があります。より良いパフォーマンスを得るには独自のキーを取得してください。
- Embedding API キー：セマンティック/自然言語検索にのみ必要です。

</details>

<details>
<summary><b>ブラウザモードとサーバーモードの違いは何ですか？</b></summary>

- **ブラウザモード（PGlite）**：完全にブラウザで実行され、サーバーは不要です。個人使用に適しています。
- **サーバーモード（PostgreSQL）**：フル機能でパフォーマンスが向上し、本番デプロイに適しています。

</details>

<details>
<summary><b>独自の Embedding モデルを使用できますか？</b></summary>

はい！`EMBEDDING_PROVIDER` を `ollama` に設定し、`EMBEDDING_BASE_URL` をローカル Ollama インスタンスに向けてください。詳細は [docs/ENVIRONMENT.md](./ENVIRONMENT.md) を参照してください。

</details>

<details>
<summary><b>データをバックアップするにはどうすればよいですか？</b></summary>

データは以下に保存されます：
- **Docker ボリューム**：`telegram-search-data`（`/app/data` にマウント）
- **ブラウザモード**：ブラウザの IndexedDB

UI を通じていつでもメッセージを CSV/JSON にエクスポートできます。

</details>

## 📚 ドキュメント

- **日本語**：[README_JA.md](./README_JA.md)（ここです！）
- **English**：[README.md](../README.md)
- **简体中文**：[README_CN.md](./README_CN.md)
- **技術アーキテクチャ**：[CONTRIBUTING.md](../CONTRIBUTING.md)
- **環境変数**：[docs/ENVIRONMENT.md](./ENVIRONMENT.md)
- **行動規範**：[CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)
- **セキュリティ**：[SECURITY.md](../SECURITY.md)

## 🤝 コミュニティ

- **Discord**：[Discord に参加](https://discord.gg/NzYsmJSgCT)
- **Telegram**：[Telegram グループに参加](https://t.me/+Gs3SH2qAPeFhYmU9)
- **DeepWiki**：[ドキュメントを表示](https://deepwiki.com/groupultra/telegram-search)

## 🚨 警告
> [!WARNING]
> 仮想通貨は一切発行していません。詐欺にご注意ください。

> [!CAUTION]
> このソフトウェアは自分のチャット履歴をエクスポートして検索するためのものです。違法な目的で使用しないでください。

## 🚀 アクティビティ

![Alt](https://repobeats.axiom.co/api/embed/69d5ef9f5e72cd7901b32ff71b5f359bc7ca42ea.svg "Repobeats analytics image")

[![Star History Chart](https://api.star-history.com/svg?repos=groupultra/telegram-search&type=Date)](https://star-history.com/#groupultra/telegram-search&Date)
