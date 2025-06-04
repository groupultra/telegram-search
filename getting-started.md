# Telegram Search 入门指南

欢迎使用 Telegram Search！这个工具可以帮助你更智能地搜索和检索 Telegram 聊天记录。本指南将帮助你快速上手并开始使用。

## 功能概述

Telegram Search 提供以下核心功能：

- **语义搜索**：不仅可以搜索关键词，还能理解消息的上下文和含义
- **向量匹配**：基于 OpenAI 的嵌入向量技术，实现相似度搜索
- **高效检索**：比 Telegram 原生搜索更精准、更智能的检索体验
- **多平台支持**：提供 Web 界面和桌面应用程序

## 系统要求

- **操作系统**：Windows、macOS 或 Linux
- **Node.js**：20.0 或更高版本
- **Docker**：用于运行数据库（可选，也可使用本地数据库）

## 快速入门流程

使用 Telegram Search 的基本流程如下：

1. **安装与配置**：安装应用程序并配置必要的 API
2. **连接 Telegram 账号**：登录你的 Telegram 账号
3. **同步聊天记录**：选择需要搜索的聊天记录进行同步
4. **开始搜索**：使用语义搜索功能查找消息

## 下一步

- 查看 [安装指南](#安装指南)了解详细的安装步骤
- 参考 [配置指南](#配置指南)了解如何配置 API 密钥
- 阅读 [使用指南](#使用指南)学习如何使用各项功能

如果你在使用过程中遇到任何问题，请查看 [故障排除](#故障排除)章节。

## 安装指南

本文档提供了在不同操作系统上安装 Telegram Search 的详细步骤。

### 安装步骤

<details>
  <summary>
    安装 Node.js 和 pnpm
  </summary>

1. 安装 NodeJS

  #### Windows

  访问 [Node.js 官网](https://nodejs.org/) 下载并安装最新的 LTS 版本

  #### macOS

  ```bash
  brew install node
  ```

  ### Linux

  使用 `nvm` 或者 `asdf` 来安装

2. 安装 pnpm

   ```bash
   corepack enable
   ```

3. 安装 Docker
  [Docker Desktop](https://www.docker.com/products/docker-desktop)

</details>

1. **克隆仓库**：

   ```sh
   git clone https://github.com/GramSearch/telegram-search.git
   cd telegram-search
   ```

2. **安装依赖**：

   ```sh
   pnpm install
   ```

3. **配置环境**：

  #### Windows

   ```sh
   copy config\config.example.yaml config\config.yaml
   ```
  #### macOS

   ```sh
   cp config/config.example.yaml config/config.yaml
   ```

   然后使用文本编辑器编辑 `config\config.yaml` 文件

#### 启动应用

完成安装和配置后，按照以下步骤启动应用：

1. **启动数据库**：

   ```bash
   docker compose up -d
   ```

2. **同步数据库表结构**：

   ```bash
   pnpm run db:migrate
   ```

3. **启动服务**：

   ```bash
   # 启动后端服务
   pnpm run dev:server

   # 另一个终端窗口中启动前端界面
   pnpm run dev:frontend
   ```

4. 打开浏览器访问 `http://localhost:3333` 即可使用应用程序

## 配置指南

### Telegram API 配置

要使用 Telegram Search，你需要获取 Telegram API 凭证：

1. 访问 [https://my.telegram.org/apps](https://my.telegram.org/apps)
2. 登录你的 Telegram 账号
3. 点击"API development tools"
4. 填写应用信息（应用标题和简短名称可以自定义）
5. 创建应用后，你将获得`api_id`和`api_hash`

将获取的 API ID 和哈希填入配置文件：

```yaml
api:
  telegram:
    apiId: 你的 API ID
    apiHash: 你的 API Hash
```

### OpenAI API 配置

语义搜索功能需要使用 OpenAI API：

1. 访问 [OpenAI 平台](https://platform.openai.com/)
2. 注册或登录账号
3. 进入 API Keys 页面：[https://platform.openai.com/account/api-keys](https://platform.openai.com/account/api-keys)
4. 创建新的 API 密钥

将 OpenAI API 密钥填入配置文件：

```yaml
api:
  embedding:
    provider: openai
    model: text-embedding-3-small
    apiKey: 你的 OpenAI API 密钥
    dimension: 1536
```

### 使用 Ollama 作为替代

如果你不想使用 OpenAI API，也可以使用 Ollama 作为替代：

1. 安装 Ollama: [https://ollama.ai/download](https://ollama.ai/download)
2. 启动 Ollama 服务
3. 配置 Telegram Search 使用 Ollama：

```yaml
api:
  embedding:
    provider: ollama
    model: 你选择的模型 # 例如 llama2 或 nomic-embed-text
    dimension: 1536 # 取决于你的模型的维度
```

### 数据库配置

Telegram Search 支持 PostgreSQL 和 PGLite 作为数据库：

```yaml
database:
  type: postgres
  # 使用 URL
  url: postgres://username:password@localhost:5432/database_name

  # 或者使用分离字段配置
  host: localhost
  port: 5433
  user: postgres
  password: '123456'
  database: postgres
```

### 存储路径配置

你可以自定义 Telegram Search 的存储路径：

```yaml
path:
  storage: ~/.telegram-search # 默认路径
```

### 消息导出设置

调整消息导出的性能参数：

```yaml
message:
  export:
    batchSize: 200 # 每次请求获取的消息数量
    concurrent: 3 # 并发请求数
    retryTimes: 3 # 重试次数
```

### 配置文件示例

完整的配置文件示例：

```yaml
# 数据库设置
database:
  type: postgres
  host: localhost
  port: 5433
  user: postgres
  password: '123456'
  database: postgres

# 消息设置
message:
  export:
    batchSize: 200
    concurrent: 3
    retryTimes: 3
    maxTakeoutRetries: 3
  batch:
    size: 100

# 路径设置
path:
  storage: ~/.telegram-search

# API 设置
api:
  telegram:
    apiId: 你的 API ID
    apiHash: 你的 API 哈希
  embedding:
    provider: openai
    model: text-embedding-3-small
    apiKey: 你的 OpenAI API 密钥
    dimension: 1536
```

## 使用指南

### 首次登录

1. 启动应用后，访问 `http://localhost:3333`
2. 点击登录按钮，输入你的 Telegram 手机号码
3. 输入 Telegram 发送给你的验证码
4. 如果你的账号启用了两步验证，还需要输入密码

### 同步聊天记录

1. 登录成功后，在左侧边栏可以看到你的 Telegram 对话列表
2. 打开同步页面，选择你需要同步的会话
3. 在Telegram官方服务通知中同意“⚠️ Data export request.”
4. 等待同步完成，这可能需要一些时间，取决于聊天记录的数量

### 搜索聊天记录

1. 在侧边栏选择你想要搜索的会话
2. 进入之后，点击右上角的搜索按钮
3. 输入关键词即可搜索

## 故障排除

### 常见问题

#### 无法连接到 Telegram

- 如果你的网络环境需要配置代理，去配置文件里面设置代理
- 检查 App ID 和 App Hash 是否正确

#### 数据库连接失败

- 确保 Docker 服务正在运行
- 检查数据库配置是否正确

#### 搜索结果太少

如果你没有同步聊天记录到本地，是无法建立索引的，这样也自然无法搜索到

你可以在 同步 页面里面，把你想搜索的对话的聊天记录拉下来，这样可以建立索引

之所以这么做，是因为 Telegram 官方客户端本身是在云端搜索的，所以要做额外的处理只能把聊天记录都拉下来

#### 应用崩溃或无响应

**解决方案**：

- 检查控制台日志以获取错误信息
- 尝试重新启动应用
- 如果问题持续存在，可以尝试清除数据：删除 `~/.telegram-search` 目录

### 日志查看

如果你遇到问题，查看日志可能会有所帮助：

- **后端日志**：在运行  `pnpm run dev:server` 的终端窗口中
- **前端日志**：在浏览器开发者工具的控制台中
- **数据库日志**：使用 `docker compose logs -f` 查看

## 开发者指南

### 项目结构

```
/telegram-search
├── apps/                   # 应用程序代码
│   ├── electron/          # 桌面应用程序
│   ├── frontend/          # 前端界面
│   └── server/            # 后端服务
├── assets/                # 静态资源
├── config/                # 配置文件
├── drizzle/               # 数据库迁移和管理
├── packages/              # 共享包和模块
├── scripts/               # 脚本工具
└── sql/                   # SQL 相关文件
```

### 开发环境设置

1. 按照安装步骤设置基本环境
2. 启用开发模式：

```bash
# 启动后端服务（开发模式）
LOG_LEVEL=debug pnpm run dev:server

# 启动前端界面（开发模式）
pnpm run dev:frontend
```

### 代码风格

项目使用 ESLint 和 Prettier 来保持代码风格一致。在提交代码前，请确保运行：

```bash
pnpm run lint
```

## 结语

恭喜！你现在已经了解了如何安装、配置和使用 Telegram Search。如果你有任何问题或建议，欢迎在 [Telegram Search GitHub](https://github.com/GramSearch/telegram-search) 上提交 Issue 或 Pull Request。
