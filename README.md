# Telegram Search

[EN](./README_EN.md) | [TODO](https://github.com/GramSearch/telegram-search/issues/23)

一个功能强大的 Telegram 聊天记录搜索工具，支持向量搜索和语义匹配。基于 OpenAI 的语义向量技术，让你的 Telegram 消息检索更智能、更精准。

## ⚠️ **注意**

- 使用 UserBot 可能存在封号风险，请谨慎使用。
- 由于项目处于快速迭代阶段，可能会出现数据库不兼容的情况，建议定期备份数据。

## 🎯 主要功能

### 消息管理
- **实时监听**：通过 watch 命令实时监听指定会话的消息
- **会话同步**：使用 sync 命令同步文件夹和会话信息
- **历史导入**：支持导入 Telegram 导出的 HTML 格式历史记录
- **数据导出**：导出消息记录，方便备份和迁移

### 语义搜索
- **向量搜索**：基于 OpenAI 的文本嵌入模型实现语义搜索
- **多维过滤**：支持按时间范围、消息类型、会话等维度过滤
- **相似度排序**：根据语义相似度对搜索结果进行排序

### 媒体管理
- **多媒体支持**：支持文本、图片、视频、文档、贴纸等多种媒体类型
- **媒体预览**：在搜索结果中直接预览媒体内容

## 🚀 快速开始

### 环境要求

- Node.js >= 20
- PostgreSQL >= 15（需要 pgvector 扩展）
- OpenAI API Key
- Telegram API 凭据（API ID 和 API Hash）

### 安装步骤

1. 克隆仓库：

```bash
git clone https://github.com/GramSearch/telegram-search.git
cd telegram-search
```

2. 安装依赖：

```bash
pnpm install
pnpm run stub
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

## 📖 使用指南

### 消息采集

```bash
# 同步文件夹和会话信息
pnpm run dev:cli sync

# 监听指定会话的消息
pnpm run dev:cli watch
```

### 数据导入导出

1. 导入历史记录：

```bash
# 导入 HTML 格式的消息记录
pnpm run dev:cli import -p <path_to_html_files>

# 跳过向量嵌入
pnpm run dev:cli import -p <path_to_html_files> --no-embedding
```

2. 导出消息：

```bash
# 导出消息（支持 database 格式）
pnpm run dev:cli export
```

### 向量处理

```bash
# 处理所有消息的向量嵌入
pnpm run dev:cli embed
```

### 搜索服务

```bash
# 启动搜索服务
pnpm run dev:cli search
```

## 🔍 实现原理

### 向量搜索
本项目使用 OpenAI 的 text-embedding-3-small 模型将文本转换为 1536 维的向量，并使用余弦相似度计算语义相似度。主要实现流程：

1. 通过 EmbeddingService 将消息文本转换为向量表示
2. 使用 PostgreSQL 的 pgvector 扩展存储和检索向量数据
3. 查询时计算输入查询与存储消息之间的余弦相似度
4. 根据相似度对结果进行排序，返回最相关的消息

```typescript
// 向量搜索示例
const queryEmbedding = await embedding.generateEmbeddings([query])
const results = await findSimilarMessages(queryEmbedding[0], options)
```

### 数据同步
使用 gram.js 与 Telegram API 交互，实现消息的采集和同步：

1. 使用 Telegram API 获取会话列表和消息历史
2. 对消息内容进行处理和格式化
3. 生成消息的向量表示并保存到数据库
4. 定期同步更新消息内容变化

### 数据存储
采用 PostgreSQL 数据库进行存储，主要表结构：

- `messages`：存储消息内容、元数据和向量表示
- `chats`：存储会话信息
- `folders`：存储文件夹信息和配置

使用分区表和适当的索引优化查询性能：
- 按 chat_id 分区提升查询性能
- 使用 ivfflat 索引加速向量搜索
- 使用全文索引优化关键词搜索

## 🔮 未来规划

### 多 Agent 对接框架
我们计划开发一个灵活的 Agent 框架，支持：
- **多模型集成**：对接多种 LLM 模型，包括 OpenAI、Claude、本地部署模型等
- **Agent 管道**：构建复杂的 Agent 协作流程，实现复杂任务的拆分和处理
- **自定义 Agent 能力**：允许用户定义专用 Agent，执行特定任务

### 聊天记录智能分析
基于向量数据库和大语言模型，提供更深入的聊天记录分析能力：
- **对话摘要生成**：自动总结长对话内容，提取关键信息
- **话题聚类**：识别和归类对话中的主要话题和讨论点
- **知识图谱构建**：从对话中提取实体和关系，构建知识网络

### 个性化与深度洞察
- **用户性格分析**：基于消息内容分析用户的表达风格、情绪倾向和兴趣偏好
- **社交关系网络**：可视化群组内用户之间的互动关系和亲密度
- **情感趋势追踪**：分析对话中的情感变化趋势，识别重要情绪转折点

### 交互式可视化
- **时间线视图**：以时间轴方式展示对话发展脉络
- **主题热度图**：可视化不同时期讨论主题的热度变化
- **关键词云**：动态展示对话中的高频关键词

这些规划将逐步实现，并根据用户反馈持续优化和调整。我们期待通过这些功能，将 Telegram Search 打造成为一个集数据挖掘、知识管理和社交分析于一体的强大工具。

## 📚 开发文档

- [开发指南](docs/development-guide.md)
- [数据库设计](docs/database-design.md)
- [贡献指南](CONTRIBUTING.md)

## 🚀 Activity

[![Star History Chart](https://api.star-history.com/svg?repos=luoling8192/telegram-search&type=Date)](https://star-history.com/#luoling8192/telegram-search&Date)

![Alt](https://repobeats.axiom.co/api/embed/c0fe5f057a33ce830a632c6ae421433f50e9083f.svg "Repobeats analytics image")

## 📝 License

MIT License © 2025
