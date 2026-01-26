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
> Telegram で日本語のチャット履歴を検索できずに困ったことはありませんか？
> 
> 重要なメッセージを探しているのに大量の履歴の中から見つけ出せず、悩んだ経験はありませんか？
>
> Telegram Search なら、日本語メッセージも含めて簡単に検索・エクスポートできます。高度なセマンティック検索で言語を問わず、単語の区切りがなくてもスムーズに検索可能です。
> 
> また、ベクトル検索による文レベルのあいまい検索で、必要な情報をより素早く・正確に見つけ出せます。

## 💖 スポンサー

![Sponsors](https://github.com/luoling8192/luoling8192/raw/master/sponsorkit/sponsors.svg)

## ✅ 機能ハイライト

### 📦 エクスポート & バックアップ
- [x] 複数のデータベースエクスポートに対応：PGlite および PostgreSQL をサポート
- [x] メディアリソースを MinIO オブジェクトストレージへ自動バックアップ、手動操作不要
- [x] メッセージのエクスポート時に、ベクトル埋め込み生成＆分かち書きを自動実行し、後の検索性を向上
- [x] リアルタイム同期で最新のチャット内容を自動的に取得・更新

### 🔍 チャット履歴検索
- [x] 自動インテリジェント分かち書きで多言語チャットも精度高く検索
- [x] あいまい一致とベクトルセマンティック検索の両方を統合し、高効率な探索を実現
- [x] RAG AI 質問応答：AI との直接対話で、履歴の文脈に基づきすぐに解答

### 🚀 高度な機能
- [x] 未読メッセージの自動要約：全未読メッセージをワンクリックでまとめ、重要ポイントを抽出

## 🛣️ ロードマップ展望

### 🧠 AI 能力の強化
- [ ] 会話まとめの自動生成
- [ ] 「スーパー・ブレイン」：履歴メッセージから人物・イベントの知識グラフを自動構築

### 🔗 メディア・リンク連携拡張
- [ ] 「保存済みメッセージ」フォルダをインテリジェントに整理、コンテンツ管理性を向上
- [ ] リンク・画像の深いインデックス化（ウェブ要約、画像 OCR 文字認識、キャプション生成など）

### 🌐 マルチプラットフォーム対応
- [ ] Telegram Bot 対応で多様なメッセージ管理を実現
- [ ] Discord 等他の主要チャット・ SNS への拡張で統合検索＆バックアップに対応

## 🎉 今すぐお試し

オンラインデモを用意しています。デプロイ不要で Telegram Search の全機能をすぐ体験できます。

アクセス：https://search.lingogram.app

> [!WARNING]
> 暗号通貨等の発行はしていません。詐欺にご注意ください。
>
> このツールはご自身のチャット履歴を検索・エクスポートする用途限定です。違法目的での利用は禁止します。

## 🚀 クイックスタート

1. Telegram Search 用のディレクトリを作成：
```bash
mkdir telegram-search
cd telegram-search
```

2. Docker Compose ファイルと環境ファイルをダウンロードし、全サービス（DB ・ MinIO 等）を起動：
```bash
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/docker-compose.yml -o docker-compose.yml
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/.env.example -o .env
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/init.sql -o init.sql
docker compose -f docker-compose.yml up -d
```

3. ブラウザで **http://localhost:3333** にアクセスしてすぐ使い始められます 🎉

### Docker Image を使用してデプロイ

MinIO の関連パラメータが未設定の場合、メディアファイルはデフォルトでローカルの `data/media` ディレクトリに保存されます。

```bash
docker run -d --name telegram-search -p 3333:3333 ghcr.io/groupultra/telegram-search:latest
```

### 環境変数のカスタマイズ

> [!IMPORTANT]
> AI 埋め込み & LLM の設定は現在「アカウントごとに」アプリ内で設定します（設定 → API）。
>
> 変更が完了した `.env` ファイルを再度 `docker compose -f docker-compose.yml up -d` で起動してください。

すべての環境変数は省略可能です。指定しない場合、デフォルト値が使用されます。

| 環境変数            | 説明                                                                            | サンプル値                                            |
| ------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `TELEGRAM_API_ID`   | [my.telegram.org](https://my.telegram.org/apps) で取得した Telegram アプリ ID   | `611335`                                              |
| `TELEGRAM_API_HASH` | [my.telegram.org](https://my.telegram.org/apps) で取得した Telegram アプリ Hash | `d524b414d21f4d37f08684c1df41ac9c`                    |
| `DATABASE_TYPE`     | データベース種別。`postgres` または `pglite` を指定                             | `pglite`                                              |
| `DATABASE_URL`      | PostgreSQL 用接続文字列（`DATABASE_TYPE=postgres`の場合のみ記入）               | `postgresql://postgres:123456@pgvector:5432/postgres` |
| `PROXY_URL`         | 利用可能なプロキシ URL（例：`socks5://user:pass@host:port` など）               | `socks5://user:pass@host:port`                        |
| `PORT`              | サーバー HTTP/WebSocket のリッスンポート                                        | `3333`                                                |
| `HOST`              | サーバーのバインドアドレス                                                      | `0.0.0.0`                                             |
| `BACKEND_URL`       | Nginx 等でリバースプロキシを使う場合の上流サーバー URL                          | `http://127.0.0.1:3333`                               |
| `MINIO_URL`         | MinIO サービスホスト名または IP                                                 | `minio`                                               |
| `MINIO_ACCESS_KEY`  | MinIO アクセスキー                                                              | `minioadmin`                                          |
| `MINIO_SECRET_KEY`  | MinIO シークレットキー                                                          | `minioadmin`                                          |
| `MINIO_BUCKET`      | MinIO のバケット名                                                              | `telegram-media`                                      |

### Docker Image を使用してデプロイ

必要に応じて環境変数を編集してください。

```bash
docker run -d --name telegram-search \
  -p 3333:3333 \
  -e DATABASE_TYPE=postgres \
  -e DATABASE_URL=postgresql://postgres:123456@localhost:5432/postgres \
  ghcr.io/groupultra/telegram-search:latest
```

## 💻 開発ガイド

### ブラウザ専用モード

```bash
git clone https://github.com/groupultra/telegram-search.git
cd telegram-search
pnpm install
cp .env.example .env
pnpm run dev
```

### サーバーモード

```bash
git clone https://github.com/groupultra/telegram-search.git
cd telegram-search
pnpm install

cp .env.example .env

docker compose up -d pgvector minio

pnpm run server:dev
pnpm run web:dev
```

📖 **さらに詳しい開発やアーキテクチャ情報：** [CONTRIBUTING.md](../docs/CONTRIBUTING.md)

## 🚀 活動状況

![Alt](https://repobeats.axiom.co/api/embed/69d5ef9f5e72cd7901b32ff71b5f359bc7ca42ea.svg "Repobeats analytics image")

[![Star History Chart](https://api.star-history.com/svg?repos=groupultra/telegram-search&type=Date)](https://star-history.com/#groupultra/telegram-search&Date)
