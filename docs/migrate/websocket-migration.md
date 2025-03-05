# WebSocket 迁移方案

## 1. 迁移目标

### 1.1 技术目标
- 统一使用 WebSocket 作为实时通信方案
- 提供可靠的状态管理和错误处理
- 实现优雅的降级和恢复机制
- 保持与现有功能的兼容性

### 1.2 业务目标
- 提供实时的同步状态反馈
- 确保同步过程的可靠性
- 优化资源使用效率
- 改善用户体验

## 2. WebSocket 基础设施

### 2.1 WebSocket 客户端
```typescript
interface WSOptions {
  url: string
  reconnect?: boolean
  maxReconnectAttempts?: number
  reconnectDelay?: number
  heartbeatInterval?: number
  timeout?: number
}

interface WSMessage<T = any> {
  id: string
  channel: string
  type: string
  payload: T
}

class WSClient {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private messageQueue = new Map<string, {
    resolve: (value: any) => void
    reject: (error: any) => void
    timeout: NodeJS.Timeout
  }>()
  private subscriptions = new Map<string, Set<(data: any) => void>>()

  constructor(private options: WSOptions) {
    this.connect()
  }

  // ... 实现连接、重连、消息处理等基础功能
}
```

### 2.2 同步管理器
```typescript
interface SyncOptions {
  messageTypes?: string[]
  incremental?: boolean
  batchSize?: number
}

class SyncManager {
  private activeSyncs = new Map<number, {
    status: string
    progress: number
    error?: string
  }>()

  constructor(private ws: WSClient) {
    this.setupEventHandlers()
  }

  async startSync(chatId: number, options: SyncOptions) {
    return this.ws.request('sync:start', { chatId, options })
  }

  // ... 实现同步控制、状态管理等功能
}
```

## 3. 迁移步骤

### 3.1 准备阶段
1. 部署 WebSocket 服务
```bash
# 配置 WebSocket 端点
WS_ENDPOINT=ws://localhost:3000/ws

# 启动服务
pnpm run dev:server
```

2. 添加特性开关
```typescript
// config/features.ts
export const features = {
  useNewWSSync: process.env.USE_NEW_WS_SYNC === 'true',
}
```

### 3.2 功能迁移
1. 实现状态追踪
```typescript
syncManager.on('progress', ({ chatId, progress }) => {
  // 更新同步状态
  await db.chats.update({
    where: { id: chatId },
    data: { 
      syncStatus: 'running',
      syncProgress: progress 
    }
  })
})
```

2. 验证和监控
```typescript
const logger = useLogger()

ws.on('error', (error) => {
  logger.error('WebSocket error', { 
    error,
    reconnectAttempts: ws.reconnectAttempts
  })
})
```

### 3.3 全面推广
1. 移除旧实现
```typescript
// 设置环境变量
USE_NEW_WS_SYNC=true

// 清理旧代码
git rm packages/server/src/legacy-sync.ts
```

## 4. 回滚计划

### 4.1 触发条件
- 连接稳定性低于预期
- 消息延迟超过阈值
- 系统资源使用异常

### 4.2 回滚步骤
1. 切换特性开关
2. 恢复 SSE 实现
3. 验证系统状态

## 5. 时间线

1. 准备阶段 (3天)
   - 完成基础设施搭建
   - 部署 WebSocket 服务
   - 设置监控指标

2. 迁移阶段 (1周)
   - 逐步迁移同步功能
   - 收集使用数据
   - 处理反馈问题

3. 稳定阶段 (3天)
   - 系统优化
   - 完善文档
   - 移除旧代码 
