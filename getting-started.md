# Telegram Search 入门指南

欢迎使用Telegram Search！这个工具可以帮助你更智能地搜索和检索Telegram聊天记录。本指南将帮助你快速上手并开始使用。

## 功能概述

Telegram Search提供以下核心功能：

- **语义搜索**：不仅可以搜索关键词，还能理解消息的上下文和含义
- **向量匹配**：基于OpenAI的嵌入向量技术，实现相似度搜索
- **高效检索**：比Telegram原生搜索更精准、更智能的检索体验
- **多平台支持**：提供Web界面和桌面应用程序

## 系统要求

- **操作系统**：Windows、macOS或Linux
- **Node.js**：v20.0.0或更高版本
- **PNPM**：v10.0.0或更高版本
- **Docker**：用于运行数据库(可选，也可使用本地数据库)

## 快速入门流程

使用Telegram Search的基本流程如下：

1. **安装与配置**：安装应用程序并配置必要的API
2. **连接Telegram账号**：登录你的Telegram账号
3. **同步聊天记录**：选择需要搜索的聊天记录进行同步
4. **开始搜索**：使用语义搜索功能查找消息

## 下一步

- 查看[安装指南](#安装指南)了解详细的安装步骤
- 参考[配置指南](#配置指南)了解如何配置API密钥
- 阅读[使用指南](#使用指南)学习如何使用各项功能

如果你在使用过程中遇到任何问题，请查看[故障排除](#故障排除)章节。

## 安装指南

本文档提供了在不同操作系统上安装Telegram Search的详细步骤。

### 前置要求

在开始安装之前，请确保你的系统满足以下要求：

- Node.js v16.0.0+
- PNPM v7.0.0+
- Docker (用于运行数据库，可选)
- Git

### 安装步骤

#### Windows

1. **安装Node.js**：
   - 访问 [Node.js官网](https://nodejs.org/) 下载并安装最新的LTS版本

2. **安装PNPM**：

   ```sh
   npm install -g pnpm
   ```

3. **安装Docker** (可选)：
   - 访问 [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop) 下载并安装

4. **克隆仓库**：

   ```sh
   git clone https://github.com/GramSearch/telegram-search.git
   cd telegram-search
   ```

5. **安装依赖**：

   ```sh
   pnpm install
   ```

6. **配置环境**：

   ```sh
   copy config\config.example.yaml config\config.yaml
   ```

   然后使用文本编辑器编辑`config\config.yaml`文件

#### macOS

1. **安装Node.js和PNPM**：

   ```bash
   # 使用Homebrew
   brew install node
   npm install -g pnpm
   ```

2. **安装Docker** (可选)：
   - 访问 [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop) 下载并安装

3. **克隆仓库**：

   ```bash
   git clone https://github.com/GramSearch/telegram-search.git
   cd telegram-search
   ```

4. **安装依赖**：

   ```bash
   pnpm install
   ```

5. **配置环境**：

   ```bash
   cp config/config.example.yaml config/config.yaml
   ```

   然后使用文本编辑器编辑`config/config.yaml`文件

#### Linux

1. **安装Node.js**：

   你都用 Linux 了，就不赘述了。

2. **安装PNPM**：

   ```bash
   corepack enable
   ```

3. **安装Docker** (可选)：

   你都用 Linux 了，就不赘述了。

4. **克隆仓库**：

   ```bash
   git clone https://github.com/GramSearch/telegram-search.git
   cd telegram-search
   ```

5. **安装依赖**：

   ```bash
   pnpm install
   ```

6. **配置环境**：

   ```bash
   cp config/config.example.yaml config/config.yaml
   ```

   然后使用文本编辑器编辑`config/config.yaml`文件

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

### Telegram API配置

要使用Telegram Search，你需要获取Telegram API凭证：

1. 访问 [https://my.telegram.org/apps](https://my.telegram.org/apps)
2. 登录你的Telegram账号
3. 点击"API development tools"
4. 填写应用信息（应用标题和简短名称可以自定义）
5. 创建应用后，你将获得`api_id`和`api_hash`

将获取的API ID和哈希填入配置文件：

```yaml
api:
  telegram:
    apiId: '你的API ID'
    apiHash: '你的API Hash'
```

### OpenAI API配置

语义搜索功能需要使用OpenAI API：

1. 访问 [OpenAI平台](https://platform.openai.com/)
2. 注册或登录账号
3. 进入API Keys页面: [https://platform.openai.com/account/api-keys](https://platform.openai.com/account/api-keys)
4. 创建新的API密钥

将OpenAI API密钥填入配置文件：

```yaml
api:
  embedding:
    provider: openai
    model: text-embedding-3-small
    apiKey: '你的OpenAI API密钥'
```

### 使用Ollama作为替代

如果你不想使用OpenAI API，也可以使用Ollama作为替代：

1. 安装Ollama: [https://ollama.ai/download](https://ollama.ai/download)
2. 启动Ollama服务
3. 配置Telegram Search使用Ollama：

```yaml
api:
  embedding:
    provider: ollama
    model: '你选择的模型'  # 例如 llama2 或 nomic-embed-text
```

### 数据库配置

Telegram Search支持PostgreSQL和PGLite作为数据库：

```yaml
database:
  type: postgres
  # 使用URL
  url: postgres://username:password@localhost:5432/database_name
  
  # 或者使用分离字段配置
  host: localhost
  port: 5433
  user: postgres
  password: '123456'
  database: postgres
```

### 存储路径配置

你可以自定义Telegram Search的存储路径：

```yaml
path:
  storage: ~/.telegram-search  # 默认路径
```

### 消息导出设置

调整消息导出的性能参数：

```yaml
message:
  export:
    batchSize: 200    # 每次请求获取的消息数量
    concurrent: 3     # 并发请求数
    retryTimes: 3     # 重试次数
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

# API设置
api:
  telegram:
    apiId: '你的API ID'
    apiHash: '你的API哈希'
  embedding:
    provider: openai
    model: text-embedding-3-small
    apiKey: '你的OpenAI API密钥'
    dimension: 1536
```

## 使用指南

### 首次登录

1. 启动应用后，访问 `http://localhost:3333`
2. 点击登录按钮，输入你的Telegram手机号码
3. 输入Telegram发送给你的验证码
4. 如果你的账号启用了两步验证，还需要输入密码

### 同步聊天记录

1. 登录成功后，在左侧边栏可以看到你的Telegram对话列表
2. 选择你想要同步的对话，点击同步按钮
3. 等待同步完成，这可能需要一些时间，取决于聊天记录的数量

### 搜索消息

1. 在顶部搜索框中输入你想要搜索的内容
2. 选择搜索模式：
   - **关键词搜索**：传统的文本匹配搜索
   - **语义搜索**：基于上下文和含义的搜索
3. 点击搜索按钮或按Enter键开始搜索
4. 搜索结果将显示在主界面中，按相关性排序

### 高级搜索功能

1. **过滤器**：可以按日期、发送者、媒体类型等过滤搜索结果
2. **排序**：可以按时间、相关性等排序搜索结果
3. **上下文查看**：点击搜索结果可以查看消息的上下文

## 故障排除

### 常见问题

#### 无法连接到Telegram

**问题**：应用无法连接到Telegram API或登录失败

**解决方案**：

- 检查你的API ID和API哈希是否正确
- 确保你的网络连接正常
- 如果你在使用代理，检查代理配置是否正确

#### 数据库连接失败

**问题**：应用无法连接到数据库

**解决方案**：

- 确保Docker服务正在运行
- 检查数据库配置是否正确
- 尝试重新启动数据库容器：`docker compose restart`

#### 搜索结果不准确

**问题**：语义搜索结果不符合预期

**解决方案**：

- 确保OpenAI API配置正确
- 尝试使用不同的搜索关键词
- 确保已经同步了足够的聊天记录

#### 应用崩溃或无响应

**问题**：应用崩溃或无响应

**解决方案**：

- 检查控制台日志以获取错误信息
- 尝试重新启动应用
- 如果问题持续存在，可以尝试清除缓存：删除`~/.telegram-search`目录（注意这将删除所有同步的数据）

### 日志查看

如果你遇到问题，查看日志可能会有所帮助：

- **后端日志**：在运行`pnpm run dev:server`的终端窗口中
- **前端日志**：在浏览器开发者工具的控制台中
- **数据库日志**：使用`docker compose logs -f`查看

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
└── sql/                   # SQL相关文件
```

### 开发环境设置

1. 按照安装步骤设置基本环境
2. 启用开发模式：

```bash
# 启动后端服务（开发模式）
pnpm run dev:server

# 启动前端界面（开发模式）
pnpm run dev:frontend
```

### 代码风格

项目使用ESLint和Prettier来保持代码风格一致。在提交代码前，请确保运行：

```bash
pnpm run lint
```

### 测试

运行测试：

```bash
pnpm run test
```

## 结语

恭喜！你现在已经了解了如何安装、配置和使用Telegram Search。如果你有任何问题或建议，欢迎在 [Telegram Search GitHub](https://github.com/GramSearch/telegram-search) 上提交 Issue 或 Pull Request。
