---
name: telegram-search-cli
description: 通过已授权的 profile 使用 Telegram Search CLI。用于发现聊天、有界读取消息、经用户批准执行 Takeout 同步、查询和分析本地数据、导出 JSONL、获取临时媒体 URL 或运行真实 CLI 验收。不得发送或修改 Telegram 消息。
---

# Telegram Search CLI

把 CLI 作为本地优先的数据工具。组合原子命令完成任务，不要求启动 Web UI 或 daemon。

## 契约

- 每个 `tg-search` 命令传入 `--json`，stdout 只读取一个 JSON envelope。诊断、交互提示、迁移输出和进度从 stderr 读取。
- 用 `chats list` 和 `messages list` 执行不落库的有界远程读取。
- 用本地 `messages query`、`search`、`context`、`stats` 和 `export` 分析已存数据，不连接 Telegram。
- 用 `sync --takeout` 持久化消息和批量历史。只有用户明确批准聊天、时间范围和数据范围后，才能加入 `--takeout`。
- 缺少授权，或 Telegram 延迟、拒绝 Takeout 时停止。不得改用普通历史读取完成批量同步。
- 把 `TAKEOUT_AUTHORIZATION_REQUIRED` 当作必须由用户完成的授权操作。请用户在 Telegram 设备上批准待处理的数据导出请求；用户确认且 Telegram 允许后才恢复 `sync --takeout`。不得睡眠后自动重试。
- 不索要或在报告中暴露 API hash、登录码、2FA 密码、StringSession、私有聊天名称或消息正文。
- 不发送消息，不修改 Telegram 数据。

## 常用流程

在包含 CLI 的工作树内运行，或使用已安装的 `tg-search`。`packages/cli/dist/index.mjs` 不存在或过期时构建：

```bash
pnpm -F @tg-search/cli build
```

列出 profile 并发现聊天：

```bash
pnpm cli profile list --json
pnpm cli --profile=<profile> chats list --limit 200 --json
```

读取有界远程时间范围，不落库：

```bash
pnpm cli --profile=<profile> messages list \
  --chat <chat-id> --from <ISO-time> --to <ISO-time> --limit 100 --json
```

得到用户明确批准后，通过 Takeout 持久化已批准范围：

```bash
pnpm cli --profile=<profile> sync --takeout \
  --chat <chat-id> --from <ISO-time> --to <ISO-time> --limit 100000 --json
```

分析本地数据库：

```bash
pnpm cli --profile=<profile> messages query --chat <chat-id> --sender <user-id> --from <ISO-time> --to <ISO-time> --json
pnpm cli --profile=<profile> search '<query>' --chat <chat-id> --json
pnpm cli --profile=<profile> context --chat <chat-id> --message <message-id> --before 20 --after 20 --json
pnpm cli --profile=<profile> stats --group-by month --timezone Asia/Singapore --chat <chat-id> --json
pnpm cli --profile=<profile> export --timezone Asia/Singapore --chat <chat-id> --output <directory> --json
```

远程 `total` 只供参考。Telegram 不保证该值应用了发送者和日期过滤。精确过滤计数应来自已授权的本地数据集。

## 读取媒体供模型使用

只有远程服务支持临时媒体 URL。通过 `--remote`、`TG_SEARCH_REMOTE_URL` 或 profile 的远程端点配置选择服务：

```bash
pnpm cli --remote https://tgs.example.invalid media url \
  --chat CHAT_ID --message MESSAGE_ID --source local --index 0 \
  --max-bytes 10485760 --json
```

- `--source local` 指该远程服务已经存储的媒体，不是 CLI 所在电脑的文件。`--source telegram` 显式让该服务从 Telegram 读取。不得自动切换来源。
- 读取 `data.url`、`data.expiresAt` 和 `data.media`。有效期固定为五分钟，时间戳单位为 Unix 毫秒；默认整文件上限为 10 MiB。未配置远程端点时，命令返回 `REMOTE_OPERATION_UNSUPPORTED`，不会启动本地 daemon 或 Telegram 连接。
- PNG/JPEG 图片的 `data.url` 必须放进模型提供方的图片输入字段。只把 URL 放进文本提示词不等于模型已经看见图片。没有传入图片内容前，不声称已理解图片。
- 云模型必须能访问配置的远程端点。localhost 或私网 URL 对云模型通常不可达；生成 URL 不会自动公开本机或私网服务。
- Telegram 的 document 封装也包括音视频和贴纸。链接返回原文件，不转码 animated sticker；不要把任意 document 或动态贴纸当成 PNG/JPEG。文档仅在模型支持对应文件输入时传入。
- URL 本身是临时凭证，下载不需要另加 Authorization。只传给本次授权使用的模型或消费者，不写进日志、报告、截图或共享聊天。

## 登录门槛

缺少凭证或授权时，请用户在本地完成登录：

```bash
pnpm cli --profile=<profile> profile configure --apiId <id> --apiHash <hash> --json
pnpm cli --profile=<profile> auth login --phone <phone> --json
```

不要请用户把认证密钥粘贴到聊天。用户确认登录后才继续。

## 可选的真实端到端验收

需要验证真实 CLI 边界时才运行附带的 canary。Mock、离线 smoke test 和进程内 handler 测试不能证明真实端到端行为。

发现候选聊天，不落库：

```bash
node .agents/skills/telegram-search-cli/scripts/run-canary.mjs \
  --profile <profile> --discover
```

选择尽量小的聊天和时间范围，得到明确 Takeout 批准后运行：

```bash
node .agents/skills/telegram-search-cli/scripts/run-canary.mjs \
  --profile <profile> \
  --chat <chat-id> \
  --from <ISO-time> \
  --to <ISO-time> \
  --takeout
```

Canary 必须验证远程发现和读取、已批准的 Takeout 同步、本地 query/context/search/stats，以及确定性导出。检查 `summary.json`；报告只包含各阶段计数和本地证据目录。证据目录权限用 `0700`，文件用 `0600`。

缺少授权、明确 Takeout 批准或非空的有界范围时，报告 `blocked`。只有实际执行的阶段违反契约或证据不一致时，才报告 `failed`。
