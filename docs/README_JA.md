![プレビュー](./assets/preview.png)

---

<p align="center">
  <a href="https://trendshift.io/repositories/13868" target="_blank"><img src="https://trendshift.io/api/badge/repositories/13868" alt="groupultra%2Ftelegram-search | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
</p>

<p align="center">
  [<a href="https://search.lingogram.app">デモを体験</a>] [<a href="../README.md">简体中文</a>] [<a href="./README_EN.md">English</a>]
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
> Telegram の標準検索は、日本語や中国語のように単語をスペースで区切らない言語ではヒットしにくいことがあります。
>
> Telegram Search はチャット履歴をお使いのマシンに同期し、分かち書きしてからインデックスを作成します。推奨は `tg-search` CLI です。ローカルで一度ログインすれば、ターミナルから検索することも、Claude Code や Codex などの AI エージェントにコマンドを実行させてメッセージを読み取り・検索・エクスポートさせることもできます。ログイン session とメッセージはお使いのマシンに保存されます。

## 💖 スポンサー

![Sponsors](https://github.com/luoling8192/luoling8192/raw/master/sponsorkit/sponsors.svg)

> [!WARNING]
> 本プロジェクトは暗号資産を一切発行していません。詐欺にご注意ください。
>
> 本ソフトウェアは個人のチャット履歴のエクスポートと検索のみを目的としています。違法な用途には使用しないでください。

## 🚀 クイックスタート：CLI

`tg-search` はローカルファーストのコマンドラインツールです。ログイン session、メッセージ、インデックスはすべてお使いのマシンの profile ディレクトリ（PGlite データベース）に保存されます。データベースサーバー、Docker、Web サービスは不要です。

### 1. インストール

Homebrew でインストールします（macOS / Linux）。Node.js ランタイムも一緒にインストールされます：

```bash
brew tap groupultra/telegram-search https://github.com/groupultra/telegram-search
brew install groupultra/telegram-search/tg-search
```

### 2. ログイン

```bash
tg-search auth login
```

電話番号、認証コード、（設定している場合は）2 段階認証のパスワードを入力します。CLI には Telegram Search の API ID と API Hash が組み込まれているため、**my.telegram.org でアプリを登録する必要はありません**。独自のアプリ認証情報を使う場合は [カスタム API 認証情報](#カスタム-api-認証情報任意) を参照してください。

### 3. バックグラウンドサービスを起動（推奨）

```bash
brew services start groupultra/telegram-search/tg-search
tg-search daemon status
```

daemon は Telegram との接続を維持し、コンピューターへのログイン時に自動で起動して、新しいメッセージとその編集・削除を随時保存します。`brew services` は `sudo` を付けずに現在のユーザーで実行してください。アップグレードしても profile のデータは保持されます：

```bash
brew upgrade groupultra/telegram-search/tg-search
brew services restart groupultra/telegram-search/tg-search
```

### 4. 履歴を同期して検索

```bash
# チャット一覧（Telegram を読み取り、ローカルには書き込みません）
tg-search chats list

# Telegram Takeout で選択したチャットの履歴をローカルに同期
tg-search sync --takeout --chat 123456 --from 2026-01-01

# Telegram に接続せずローカルデータベースを検索
tg-search search "プロジェクトの進捗"
tg-search context --chat 123456 --message 42 --before 20 --after 20
```

Telegram からデータエクスポートの確認を求められた場合（`TAKEOUT_AUTHORIZATION_REQUIRED`）は、他の Telegram 端末で承認してから再実行してください。

### よく使うコマンド

| コマンド | 用途 | Telegram への接続 |
| --- | --- | --- |
| `auth login` | 現在の profile に対話的にログイン | あり |
| `chats list` | チャット一覧 | あり、ローカルに書き込まない |
| `messages list --chat <id>` | 1 つのチャットをページ単位で読む。`--query` で Telegram 側検索 | あり、ローカルに書き込まない |
| `sync --takeout --chat <id>` / `--all` | Takeout で履歴をローカルに一括同期 | あり |
| `search <query>` | ローカルの分かち書き検索 | なし |
| `messages query` / `context` / `stats` | ローカルのクエリ、前後の文脈、統計 | なし |
| `export --from --to --output <dir>` | 月別 JSONL とチェックサム付きマニフェストを出力 | なし |
| `daemon run` / `status` / `stop` | daemon のフォアグラウンド実行と管理 | あり |
| `profile inspect` / `doctor` | 秘密情報を表示せずに設定と daemon の状態を確認 | なし |

すべてのコマンドで `--profile <name>` によるアカウントの分離と、`--json` による構造が固定された JSON envelope 出力が使えます。全コマンド、ページング、メディアの読み取り、プライバシー境界は [CLI ドキュメント](../packages/cli/README.md) を参照してください。

### 🤖 AI エージェントと使う

CLI のコマンドと出力は、エージェントから呼び出す前提で設計されています。ユーザーがローカルで一度 `auth login` を行えば、エージェントがコマンドを組み合わせて、どのチャットを読むか、いつ同期するかを判断できます。

- `--json` を付けると、stdout には構造化された `{ ok, data, next_cursor, meta }` の結果だけが出力されます。ログ、プロンプト、進捗は stderr に出力され、失敗時は構造化された `error` と 0 以外の終了コードを返します。
- 大きな結果は `--output-file ./private/page.jsonl` でファイルに書き出せます。ターミナルには受領情報だけが表示されます。
- リポジトリには Claude Code や Codex などで使えるエージェント skill [`.agents/skills/telegram-search-cli`](../.agents/skills/telegram-search-cli/SKILL.md) が含まれています。
- **プライバシー境界**：エージェントが `sync` に `--takeout` を付けられるのは、ユーザーが同意した後だけです。未承認、拒否、Takeout の初期化失敗のいずれでも同期は停止し、通常の `GetHistory` には切り替わりません。エクスポートにはメディアのバイナリ、ログイン session、ベクトル、秘密情報は含まれず、CLI 自体は AI 要約を行いません。

```bash
tg-search --profile work chats list --limit 200 --json
tg-search --profile work search "プロジェクトの進捗" --chat 123456 --json
tg-search --profile work export --from 2026-01-01 --to 2026-12-31 --timezone Asia/Tokyo --output ./telegram-2026 --json
```

### カスタム API 認証情報（任意）

既定では組み込みの Telegram Search アプリ認証情報を使います。[my.telegram.org](https://my.telegram.org/apps) で登録した独自のアプリを使う場合は、次のいずれかの方法を使います。上の方法が優先されます：

```bash
# 1. profile に保存（brew services の daemon も読み込みます）
tg-search profile configure --apiId YOUR_API_ID --apiHash YOUR_API_HASH

# 2. 環境変数で指定（現在のシェルのみ）
export TELEGRAM_API_ID=YOUR_API_ID TELEGRAM_API_HASH=YOUR_API_HASH
```

API ID と API Hash は必ずセットで指定してください。引数なしで `tg-search profile configure` を実行すると、profile のカスタム認証情報を削除して組み込みの既定値に戻します。

### リモート読み取り専用モード

デプロイ済みの Telegram Search サーバーに接続します。サーバーのデータベースや Telegram session はダウンロードしません：

```bash
export TG_SEARCH_REMOTE_TOKEN=...   # サーバーのアクセストークン。URL や引数では受け付けません
tg-search --profile cloud profile remote https://tgs.example.com
tg-search --profile cloud search "プロジェクトの進捗"
```

### ソースからビルド

```bash
git clone https://github.com/groupultra/telegram-search.git
cd telegram-search
pnpm install
pnpm run build:packages
pnpm -F @tg-search/cli build

pnpm cli auth login
pnpm cli chats list
```

## ✅ 機能

### 📦 エクスポート & バックアップ
- [x] ローカル CLI は専用の PGlite を使用。サーバーは PGlite と PostgreSQL に対応
- [x] Telegram Takeout による履歴の一括同期。daemon が新着・編集・削除をリアルタイムに保存
- [x] タイムゾーンと SHA-256 チェックサム付きの月別 JSONL エクスポート
- [x] サーバーのメディアを MinIO オブジェクトストレージに自動バックアップ

### 🔍 チャット履歴検索
- [x] メッセージ保存時に自動で分かち書きし、スペースで区切らない言語も単語単位で検索可能
- [x] サーバーではあいまい検索とベクトル意味検索を併用し、テキストで画像も検索可能
- [x] RAG Q&A：検索した履歴メッセージをもとに AI が質問に回答
- [x] 日付範囲フィルターと元メッセージへの deep link

### 🤖 エージェント & Bot
- [x] エージェント向けの JSON / JSONL 出力と構造化エラー
- [x] リモート読み取り専用モード：エージェントがセルフホストのサーバーを参照し、データベースや Telegram session はダウンロードしない
- [x] Telegram Bot によるメッセージの検索とエクスポート
- [x] 未読メッセージの AI 要約

## 🛣️ ロードマップ展望

- [ ] 会話の自動要約
- [ ] 「スーパーブレイン」：履歴から人物と出来事のナレッジグラフを自動構築
- [ ] 「保存済みメッセージ」の自動整理
- [ ] リンクと画像の詳細なインデックス：Web ページ要約、OCR、画像説明
- [ ] Discord など他のメッセージングプラットフォームへの対応

## 🖥️ Web インターフェース（任意）

GUI が必要な場合は、デモ版 https://search.lingogram.app を利用するか、Web 版を自分でデプロイしてください。

### Docker Compose

```bash
mkdir telegram-search && cd telegram-search
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/docker-compose.yml -o docker-compose.yml
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/.env.example -o .env
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/init.sql -o init.sql
docker compose -f docker-compose.yml up -d
```

その後 **http://localhost:3333** を開いてください 🎉

### Docker Image

```bash
docker run -d --name telegram-search -p 3333:3333 ghcr.io/groupultra/telegram-search:latest
```

MinIO を設定しない場合、メディアファイルはローカルの `data/media` ディレクトリに保存されます。

### 環境変数

> [!IMPORTANT]
> AI Embedding と LLM の設定はアプリ内で**アカウントごと**に行います（設定 → API）。`.env` を編集したら、もう一度 `docker compose -f docker-compose.yml up -d` を実行してください。

環境変数はすべて任意です。Web 版にも Telegram API 認証情報が組み込まれているため、`TELEGRAM_API_ID`/`TELEGRAM_API_HASH` を設定しなくてもログインできます：

| 環境変数            | 説明                                                                         | 例                                                    |
| ------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| `TELEGRAM_API_ID`   | 独自の Telegram アプリ ID。未設定の場合は組み込みの認証情報を使用              | `611335`                                              |
| `TELEGRAM_API_HASH` | 独自の Telegram アプリ Hash。ID とセットで設定                                 | `d524b414d21f4d37f08684c1df41ac9c`                    |
| `DATABASE_TYPE`     | データベースの種類：`postgres` または `pglite`                                | `pglite`                                              |
| `DATABASE_URL`      | PostgreSQL 接続文字列（`DATABASE_TYPE=postgres` の場合のみ）                  | `postgresql://postgres:123456@pgvector:5432/postgres` |
| `TELEGRAM_BOT_TOKEN`| [@BotFather](https://t.me/BotFather) で作成した Telegram Bot Token            | `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`           |
| `PROXY_URL`         | プロキシ URL（`socks5://user:pass@host:port` など）                           | `socks5://user:pass@host:port`                        |
| `PORT`              | バックエンドの HTTP/WebSocket ポート                                          | `3333`                                                |
| `HOST`              | バックエンドの待ち受けアドレス                                                | `0.0.0.0`                                             |
| `BACKEND_URL`       | Nginx をリバースプロキシにする場合の `/api` と `/ws` の転送先                  | `http://127.0.0.1:3333`                               |
| `MINIO_URL`         | MinIO のエンドポイント                                                        | `http://minio:9000`                                   |
| `MINIO_ACCESS_KEY`  | MinIO のアクセスキー                                                          | `minioadmin`                                          |
| `MINIO_SECRET_KEY`  | MinIO のシークレットキー                                                      | `minioadmin`                                          |
| `MINIO_BUCKET`      | MinIO のバケット名                                                            | `telegram-media`                                      |

```bash
docker run -d --name telegram-search \
  -p 3333:3333 \
  -e DATABASE_TYPE=postgres \
  -e DATABASE_URL=postgresql://postgres:123456@localhost:5432/postgres \
  ghcr.io/groupultra/telegram-search:latest
```

## 💻 開発ガイド

```bash
git clone https://github.com/groupultra/telegram-search.git
cd telegram-search
pnpm install
cp .env.example .env

# ブラウザ専用モード
pnpm run dev

# サーバーモード
docker compose -f docker/docker-compose.dev.yml up -d pgvector minio
pnpm run server:dev
pnpm run web:dev
```

📖 **さらに詳しい開発やアーキテクチャ情報：** [CONTRIBUTING.md](./CONTRIBUTING.md)

## 🚀 活動状況

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
