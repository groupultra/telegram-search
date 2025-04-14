# Telegram Search

[EN](./README_EN.md) | [TODO](https://github.com/GramSearch/telegram-search/issues/23)

一个功能强大的 Telegram 聊天记录搜索工具，支持向量搜索和语义匹配。基于 OpenAI 的语义向量技术，让你的 Telegram 消息检索更智能、更精准。

## ⚠️ **注意**

- 使用 UserBot 可能存在封号风险，请谨慎使用。
- 由于项目处于快速迭代阶段，可能会出现数据库不兼容的情况，建议定期备份数据。
- 获取 API key: [#111](https://github.com/GramSearch/telegram-search/issues/111)

## 🚀 快速开始

### 安装步骤

1. 克隆仓库：

```bash
git clone https://github.com/GramSearch/telegram-search.git
cd telegram-search
git checkout release
```

2. 安装依赖：

```bash
pnpm install
```

3. 配置环境：

```bash
cp config/config.example.yaml config/config.yaml
```

4. 启动数据库容器:

```bash
docker compose up -d
```

5. 初始化数据库：

```bash
pnpm run db:migrate
```

6. 启动服务：

```bash
# 启动后端服务
pnpm run dev:server

# 启动前端界面
pnpm run dev:frontend
```

访问 `http://localhost:3333` 即可打开搜索界面。

## 🚀 Activity

[![Star History Chart](https://api.star-history.com/svg?repos=luoling8192/telegram-search&type=Date)](https://star-history.com/#luoling8192/telegram-search&Date)

![Alt](https://repobeats.axiom.co/api/embed/c0fe5f057a33ce830a632c6ae421433f50e9083f.svg "Repobeats analytics image")

## 📝 License

MIT License © 2025
