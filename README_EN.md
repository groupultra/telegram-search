# Telegram Search

[简体中文](./README.md) | [Getting Started](./getting-started.md)

[![Telegram](https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/+Gs3SH2qAPeFhYmU9)
[![Discord](https://dcbadge.limes.pink/api/server/NzYsmJSgCT)](https://discord.gg/NzYsmJSgCT)

<a href="https://trendshift.io/repositories/13868" target="_blank"><img src="https://trendshift.io/api/badge/repositories/13868" alt="groupultra%2Ftelegram-search | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>

A powerful Telegram chat history search tool that supports vector search and semantic matching. Based on OpenAI's semantic vector technology, it makes your Telegram message retrieval smarter and more precise.

- PR are welcome!
- Due to the project being in a rapid iteration phase, database incompatibility may occur. It's recommended to back up your data regularly.

![preview](./docs/assets/preview.png)

## 💖 Sponsors

![Sponsors](https://github.com/luoling8192/luoling8192/raw/master/sponsorkit/sponsors.svg)

## 🚀 Quick Start

This is the simplest way to start Telegram Search, which will launch all necessary services (including the database and application server) via Docker.

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/GramSearch/telegram-search.git
    cd telegram-search
    ```

2.  **Configure settings:**
    Modify the settings in `config/config.yaml` as needed.\
    Make sure to change the `database.host` value in the configuration to the database container service name "pgvector".
    ```bash
    cp config/config.example.yaml config/config.yaml
    ```

3.  **Start the services:**

    ```bash
    docker compose up -d
    ```

Access `http://<host>:3333` to open the search interface.

## 💻 Local Run

1.  **Clone the repository**

    ```bash
    git clone https://github.com/GramSearch/telegram-search.git
    cd telegram-search
    ```

2.  **Install dependencies:**

    ```bash
    pnpm install
    ```

3.  **Configure environment**:

    ```bash
    cp config/config.example.yaml config/config.yaml
    ```

4.  **Start the database container:**
    In local development mode, Docker is only used to start the database container.

    ```bash
    docker compose up -d pgvector
    ```

5.  **Synchronize database schema:**

    ```bash
    pnpm run db:migrate
    ```

6.  **Start services:**

    ```bash
    # Start backend service
    pnpm run dev:server

    # Start frontend interface
    pnpm run dev:frontend
    ```

Visit `http://localhost:3333` to open the search interface.

## 🚀 Activity

[![Star History Chart](https://api.star-history.com/svg?repos=luoling8192/telegram-search&type=Date)](https://star-history.com/#luoling8192/telegram-search&Date)

![Alt](https://repobeats.axiom.co/api/embed/c0fe5f057a33ce830a632c6ae421433f50e9083f.svg "Repobeats analytics image")

## 📝 License

MIT License © 2025
