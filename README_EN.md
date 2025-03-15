# Telegram Search

[CN](./README.md) | [TODO](https://github.com/GramSearch/telegram-search/issues/23)

A powerful Telegram chat history search tool that supports vector search and semantic matching. Based on OpenAI's semantic vector technology, it makes your Telegram message retrieval smarter and more precise.

## ⚠️ **Note**

- Using UserBot comes with the risk of account suspension, please use with caution.
- Due to the project being in a rapid iteration phase, database incompatibility may occur. It's recommended to back up your data regularly.

## 🎯 Main Features

### Message Management

- **Real-time Monitoring**: Monitor messages from specified conversations in real-time using the watch command
- **Conversation Synchronization**: Sync folders and conversation information using the sync command
- **History Import**: Support importing HTML format history exported from Telegram
- **Data Export**: Export message records for backup and migration

### Semantic Search

- **Vector Search**: Implement semantic search based on OpenAI's text embedding model
- **Multi-dimensional Filtering**: Filter by time range, message type, conversation, and other dimensions
- **Similarity Ranking**: Sort search results based on semantic similarity

### Media Management

- **Multimedia Support**: Support for various media types including text, images, videos, documents, stickers, etc.
- **Media Preview**: Preview media content directly in search results

## 🚀 Quick Start

### Requirements

- Node.js >= 20
- PostgreSQL >= 15 (with pgvector extension)
- OpenAI API Key
- Telegram API credentials (API ID and API Hash)

### Installation Steps

1. Clone the repository:

```bash
git clone https://github.com/luoling8192/telegram-search.git
cd telegram-search
```

2. Install dependencies:

```bash
pnpm install
pnpm run stub
```

3. Configure environment:

```bash
cp config/config.example.yaml config/config.yaml
```

4. Start the database container:

```bash
docker compose up -d
```

5. Initialize the database:

```bash
pnpm run db:migrate
```

6. Start services:

```bash
# Start backend service
pnpm run dev:server

# Start frontend interface
pnpm run dev:frontend
```

Visit `http://localhost:3333` to open the search interface.

## 📖 User Guide

### Message Collection

```bash
# Sync folders and conversation information
pnpm run dev:cli sync

# Monitor specified conversations
pnpm run dev:cli watch
```

### Data Import and Export

1. Import history:

```bash
# Import HTML format message records
pnpm run dev:cli import -p <path_to_html_files>

# Skip vector embedding
pnpm run dev:cli import -p <path_to_html_files> --no-embedding
```

2. Export messages:

```bash
# Export messages (supports database format)
pnpm run dev:cli export
```

### Vector Processing

```bash
# Process vector embeddings for all messages
pnpm run dev:cli embed
```

### Search Service

```bash
# Start the search service
pnpm run dev:cli search
```

## 🔍 Implementation Principles

### Vector Search

This project uses OpenAI's text-embedding-3-small model to convert text into 1536-dimensional vectors and calculates semantic similarity using cosine similarity. The main implementation process:

1. Convert message text to vector representations via the EmbeddingService
2. Store and retrieve vector data using PostgreSQL's pgvector extension
3. Calculate cosine similarity between input queries and stored messages during queries
4. Sort results based on similarity and return the most relevant messages

```typescript
// Vector search example
const queryEmbedding = await embedding.generateEmbeddings([query])
const results = await findSimilarMessages(queryEmbedding[0], options)
```

### Data Synchronization

Use gram.js to interact with the Telegram API to collect and synchronize messages:

1. Get conversation lists and message history using the Telegram API
2. Process and format message content
3. Generate vector representations of messages and save to the database
4. Periodically sync and update message content changes

### Data Storage

PostgreSQL database is used for storage with the following main table structures:

- `messages`: Store message content, metadata, and vector representations
- `chats`: Store conversation information
- `folders`: Store folder information and configurations

Utilize partitioned tables and appropriate indexes to optimize query performance:

- Partition by chat_id to improve query performance
- Use ivfflat index to accelerate vector search
- Use full-text index to optimize keyword search

## 🔮 Future Plans

### Multi-Agent Integration Framework

We plan to develop a flexible Agent framework that supports:

- **Multi-model Integration**: Connect to various LLM models, including OpenAI, Claude, locally deployed models, etc.
- **Agent Pipeline**: Build complex Agent collaboration processes to split and process complex tasks
- **Custom Agent Capabilities**: Allow users to define specialized Agents for specific tasks

### Intelligent Chat Record Analysis

Provide deeper chat record analysis capabilities based on vector databases and large language models:

- **Conversation Summary Generation**: Automatically summarize long conversations and extract key information
- **Topic Clustering**: Identify and categorize main topics and discussion points in conversations
- **Knowledge Graph Construction**: Extract entities and relationships from conversations to build knowledge networks

### Personalization and Deep Insights

- **User Personality Analysis**: Analyze users' expression styles, emotional tendencies, and interest preferences based on message content
- **Social Relationship Network**: Visualize interaction relationships and intimacy between users in groups
- **Emotional Trend Tracking**: Analyze emotional change trends in conversations and identify important emotional turning points

### Interactive Visualization

- **Timeline View**: Display conversation development in a timeline
- **Topic Heat Map**: Visualize changes in discussion topic heat over different periods
- **Keyword Cloud**: Dynamically display high-frequency keywords in conversations

These plans will be implemented gradually and continuously optimized based on user feedback. We look forward to developing Telegram Search into a powerful tool that integrates data mining, knowledge management, and social analysis.

## 📚 Development Documentation

- [Development Guide](docs/development-guide.md)
- [Database Design](docs/database-design.md)
- [Contribution Guidelines](CONTRIBUTING.md)

## 🚀 Activity

[![Star History Chart](https://api.star-history.com/svg?repos=luoling8192/telegram-search&type=Date)](https://star-history.com/#luoling8192/telegram-search&Date)

![Alt](https://repobeats.axiom.co/api/embed/c0fe5f057a33ce830a632c6ae421433f50e9083f.svg "Repobeats analytics image")

## 📝 License

MIT License © 2025
