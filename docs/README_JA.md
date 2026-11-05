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
> Telegram のチャット履歴をお使いのマシンに同期し、分かち書きでインデックス化します。日本語や中国語も単語単位で検索できます。`tg-search` CLI を自分で使うことも、AI エージェントから呼び出すこともでき、データはローカルにのみ保存されます。

## 💖 スポンサー

![Sponsors](https://github.com/luoling8192/luoling8192/raw/master/sponsorkit/sponsors.svg)

> [!WARNING]
> 本プロジェクトは暗号資産を発行していません。詐欺にご注意ください。個人のチャット履歴のエクスポートと検索にのみ使用し、違法な用途には使わないでください。

## 🚀 クイックスタート：CLI

```bash
# インストール（macOS / Linux）
brew tap groupultra/telegram-search https://github.com/groupultra/telegram-search
brew install groupultra/telegram-search/tg-search

# ログイン（API ID / Hash は組み込み済み。my.telegram.org での登録は不要）
tg-search auth login

# バックグラウンドで常駐し新着を保存（sudo なしで現在のユーザーとして実行）
brew services start groupultra/telegram-search/tg-search

# 履歴を同期して検索
tg-search chats list
tg-search sync --takeout --chat 123456 --from 2026-01-01
tg-search search "プロジェクトの進捗"
```

`sync --takeout` が `TAKEOUT_AUTHORIZATION_REQUIRED` を返した場合は、他の Telegram 端末でエクスポート要求を承認してから再実行してください。

### よく使うコマンド

| コマンド | 用途 | Telegram 接続 |
| --- | --- | --- |
| `auth login` | ログイン | あり |
| `chats list` / `messages list --chat <id>` | チャットとメッセージの読み取り（ローカルに書き込まない） | あり |
| `sync --takeout --chat <id>` / `--all` | 履歴をローカルに同期 | あり |
| `search` / `context` / `messages query` / `stats` | ローカル検索・文脈・クエリ・統計 | なし |
| `export --from --to --output <dir>` | 月別 JSONL を出力 | なし |
| `daemon run` / `status` / `stop` | daemon の管理 | あり |
| `profile inspect` / `doctor` | 設定と daemon の状態を確認 | なし |

`--profile <name>` でアカウントを分離し、`--json` で JSON を出力します。詳細は [CLI ドキュメント](../packages/cli/README.md) を参照してください。

### 🤖 AI エージェントと使う

ユーザーが一度 `auth login` すれば、エージェントは `--json` 付きでコマンドを呼び出せます。stdout には構造化された結果のみが出力され、ログと進捗は stderr に出ます。同梱の [エージェント skill](../.agents/skills/telegram-search-cli/SKILL.md) を読み込めます。

エージェントが `sync --takeout` を使えるのは、ユーザーが同意した後だけです。

### カスタム API 認証情報（任意）

```bash
tg-search profile configure --apiId YOUR_API_ID --apiHash YOUR_API_HASH   # profile に保存
export TELEGRAM_API_ID=YOUR_API_ID TELEGRAM_API_HASH=YOUR_API_HASH          # または環境変数
```

2 つはセットで指定し、profile が優先されます。引数なしの `profile configure` で組み込みの認証情報に戻ります。

### リモート読み取り専用モード

```bash
export TG_SEARCH_REMOTE_TOKEN=...
tg-search --profile cloud profile remote https://tgs.example.com
tg-search --profile cloud search "プロジェクトの進捗"
```

### ソースからビルド

```bash
pnpm install && pnpm run build:packages && pnpm -F @tg-search/cli build
pnpm cli auth login
```

## ✅ 機能

- [x] Takeout による履歴の一括同期。daemon が新着・編集・削除を保存
- [x] 分かち書き検索。サーバーではベクトル意味検索とテキストによる画像検索も利用可能
- [x] SHA-256 マニフェスト付きの月別 JSONL エクスポート
- [x] RAG Q&A、未読メッセージの AI 要約
- [x] Telegram Bot による検索とエクスポート
- [x] サーバーのメディアを MinIO にバックアップ

## 🛣️ ロードマップ展望

- [ ] 会話の自動要約
- [ ] 「スーパーブレイン」：履歴から人物と出来事のナレッジグラフを構築
- [ ] 「保存済みメッセージ」の自動整理
- [ ] リンクと画像のインデックス：Web ページ要約、OCR、画像説明
- [ ] Discord など他プラットフォームへの対応

## 🖥️ Web インターフェース（任意）

デモ：https://search.lingogram.app 。セルフホストする場合：

```bash
mkdir telegram-search && cd telegram-search
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/docker-compose.yml -o docker-compose.yml
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/.env.example -o .env
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/init.sql -o init.sql
docker compose -f docker-compose.yml up -d
```

**http://localhost:3333** を開いてください。イメージ単体でも動きます：`docker run -d -p 3333:3333 ghcr.io/groupultra/telegram-search:latest`（MinIO 未設定時、メディアは `data/media` に保存）。

### 環境変数

すべて任意です。AI Embedding / LLM はアプリ内でアカウントごとに設定します（設定 → API）。

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

## 💻 開発ガイド

```bash
pnpm install && cp .env.example .env
pnpm run dev                                                    # ブラウザ専用モード
docker compose -f docker/docker-compose.dev.yml up -d pgvector minio
pnpm run server:dev                                             # サーバーモード。web:dev は別ターミナルで実行
pnpm run web:dev
```

詳細は [CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。

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
