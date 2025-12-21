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

## ✅ 主な特徴

### 📦 エクスポート & バックアップ
- [x] 複数のデータベース形式（PGlite、PostgreSQL）へのチャット履歴エクスポート対応
- [x] メディアファイルの MinIO オブジェクトストレージ自動エクスポート
- [x] メッセージのエクスポート時にベクトル埋め込み・分かち書き処理を自動実行
- [x] リアルタイム同期で常に最新のチャット内容を取得

### 🔍 チャット履歴検索
- [x] インテリジェントな分かち書きと精度の高い検索、多言語対応
- [x] あいまい検索とベクトルセマンティック検索でより高速に検索
- [x] RAG による AI 質問応答：AI と直接会話し、チャット履歴の文脈を活用して即座に回答

## 🛣️ 今後のロードマップ

### 🧠 AI 機能強化
- [ ] 会話サマリーの自動生成
- [ ] スーパー・ブレイン：履歴メッセージから人物やイベントの知識グラフを自動抽出

### 🔗 メディア & リンク機能
- [ ] 「保存済みメッセージ」フォルダを賢く整理し、重要な内容をより効率的に管理
- [ ] リンクや画像の高度なインデックス作成：ウェブ要約、画像 OCR/キャプション解析などで検索力・整理力を強化

### 🌐 マルチプラットフォーム対応
- [ ] Telegram Bot 対応でさらに多様なメッセージ管理需要に対応
- [ ] Discord 等他のソーシャル／チャットサービス対応で、クロスプラットフォームな統合検索＆バックアップを実現

## 🎉 今すぐお試し

オンラインデモを用意しています。デプロイ不要で Telegram Search の全機能をすぐ体験できます。

アクセス：https://search.lingogram.app

> [!WARNING]
> 暗号通貨等の発行はしていません。詐欺にご注意ください。
>
> このツールはご自身のチャット履歴を検索・エクスポートする用途限定です。違法目的での利用は禁止します。

## 🚀 クイックスタート

1. Telegram Search 用のディレクトリを作成:
```bash
mkdir telegram-search
cd telegram-search
```

2. Docker Compose ファイルと環境ファイルをダウンロードし、全サービス（DB・MinIO等）を起動:
```bash
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/docker/docker-compose.yml -o docker-compose.yml
curl -L https://raw.githubusercontent.com/groupultra/telegram-search/refs/heads/main/.env.example -o .env
docker compose -f docker-compose.yml up -d
```

3. ブラウザで **http://localhost:3333** にアクセスしてすぐ使い始められます 🎉

### 環境変数のカスタマイズ

> [!IMPORTANT]
> AI 埋め込み & LLM の設定は現在「アカウントごとに」アプリ内で設定します（設定 → API）。

| 環境変数                      | 説明                                                                            | サンプル値                                            |
| ----------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `TELEGRAM_API_ID`             | [my.telegram.org](https://my.telegram.org/apps) で取得した Telegram アプリ ID   |                                                       |
| `TELEGRAM_API_HASH`           | [my.telegram.org](https://my.telegram.org/apps) で取得した Telegram アプリ Hash |                                                       |
| `DATABASE_TYPE`               | データベース種別。`postgres` または `pglite` を指定                             | `pglite`                                              |
| `DATABASE_URL`                | PostgreSQL 用接続文字列（`DATABASE_TYPE=postgres`の場合のみ記入）               | `postgresql://postgres:123456@pgvector:5432/postgres` |
| `PROXY_URL`                   | 利用可能なプロキシ URL（例：`socks5://user:pass@host:port` など）               | `socks5://user:pass@host:port`                        |
| `PORT`                        | サーバー HTTP/WebSocket のリッスンポート                                        | `3333`                                                |
| `HOST`                        | サーバーのバインドアドレス                                                      | `0.0.0.0`                                             |
| `BACKEND_URL`                 | Nginx 等でリバースプロキシを使う場合の上流サーバー URL                          | `http://127.0.0.1:3333`                               |
| `MINIO_URL`                   | MinIO サービスホスト名または IP                                                 | `minio`                                               |
| `MINIO_ACCESS_KEY`            | MinIO アクセスキー                                                              | `minioadmin`                                          |
| `MINIO_SECRET_KEY`            | MinIO シークレットキー                                                          | `minioadmin`                                          |
| `MINIO_BUCKET`                | MinIO のバケット名                                                              | `telegram-media`                                      |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry OTLP ログ送信エンドポイント                                       | `http://loki:3100/otlp/v1/logs`                       |

**PostgreSQL 利用例：**

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

**プロキシ形式サンプル：**
- SOCKS5: `socks5://user:pass@host:port`
- SOCKS4: `socks4://user:pass@host:port`
- HTTP: `http://user:pass@host:port`
- MTProxy: `mtproxy://secret@host:port`

### Docker Compose での起動

1. リポジトリをクローンします。

2. docker compose でデータベースや MinIO 等すべてのサービス起動：

```bash
docker compose up -d
```

3. `http://localhost:3333` へアクセスし、検索画面を開きます。

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

📖 **さらに詳しい開発やアーキテクチャ情報：** [CONTRIBUTING.md](../CONTRIBUTING.md)

## 🚀 活動状況

![Alt](https://repobeats.axiom.co/api/embed/69d5ef9f5e72cd7901b32ff71b5f359bc7ca42ea.svg "Repobeats analytics image")

[![Star History Chart](https://api.star-history.com/svg?repos=groupultra/telegram-search&type=Date)](https://star-history.com/#groupultra/telegram-search&Date)
