# Telegram Search 项目模块文档

## 项目结构概览

```
telegram-search/
├── packages/
│   ├── frontend/        # 前端 Vue 应用
│   ├── server/         # HTTP API 服务
│   ├── cli/           # 命令行工具
│   ├── db/            # 数据库模型和迁移
│   ├── core/          # 核心业务逻辑和适配器
│   └── common/        # 公共工具和类型
├── config/            # 配置文件
├── docs/             # 文档
└── libs/            # 第三方库定制
```

## 前端模块 (packages/frontend)

### 页面组件 (src/pages)

#### 命令相关页面 (pages/commands)

- `sync.vue`: 同步命令页面
  - 功能：管理 Telegram 聊天同步操作
  - 主要组件：
    - 聊天选择器
    - 同步状态显示
    - 进度条
    - 优先级设置对话框
  - 关键特性：
    - 支持多聊天同步
    - 实时进度显示
    - 错误处理和重试
    - 优先级管理

- `export.vue`: 导出命令页面
  - 功能：管理消息导出操作
  - 主要组件：
    - 聊天和消息类型选择器
    - 导出进度显示
    - 导出选项配置

### API 模块 (src/apis)

#### 命令相关 API (apis/commands)

- `useSyncChats.ts`: 多聊天同步 Hook
  - 功能：
    - 管理多个聊天的同步状态
    - 处理同步进度和错误
    - 提供取消同步功能
  - 主要方法：
    - `executeChatsSync`: 执行多聊天同步
    - `getSyncStatus`: 获取同步状态
    - `cancelSync`: 取消同步操作

- `useSyncMetadata.ts`: 元数据同步 Hook
  - 功能：
    - 管理聊天元数据的同步
    - 处理同步进度和状态
  - 主要方法：
    - `executeMetadataSync`: 执行元数据同步
    - `cleanup`: 清理同步状态

- `useExport.ts`: 导出功能 Hook
  - 功能：
    - 管理消息导出操作
    - 处理导出进度和状态
  - 主要方法：
    - `executeExport`: 执行导出操作
    - `cleanup`: 清理导出状态

### 组件库 (src/components)

#### UI 组件 (components/ui)

- `Pagination.vue`: 分页组件
  - 功能：提供通用分页功能
  - 特性：
    - 支持自定义主题
    - 响应式设计
    - 页码导航

- `ProgressBar.vue`: 进度条组件
  - 功能：显示操作进度
  - 特性：
    - 支持不同状态样式
    - 动画效果
    - 百分比显示

- `SelectDropdown.vue`: 下拉选择组件
  - 功能：提供下拉选择功能
  - 特性：
    - 支持搜索
    - 自定义选项渲染
    - 多选支持

- `StatusBadge.vue`: 状态标签组件
  - 功能：显示操作状态
  - 特性：
    - 不同状态的视觉反馈
    - 图标支持
    - 自定义样式

### 组合式函数 (src/composables)

- `useSession.ts`: 会话管理
  - 功能：
    - 管理 Telegram 会话状态
    - 处理连接检查
    - 提供登录状态管理

- `useCommands.ts`: 命令处理
  - 功能：
    - 管理命令执行状态
    - 处理命令进度和结果
    - 提供通用命令操作接口

### 工具函数 (src/utils)

- 格式化工具
- 类型转换
- 错误处理

## 后端模块 (packages/server)

### API 路由 (src/routes)

- 命令相关路由
  - `/commands/sync`: 同步命令
  - `/commands/export`: 导出命令
  - `/commands/multi-sync`: 多聊天同步

### 服务层 (src/services)

- 同步服务
- 导出服务
- 会话管理服务

## 数据库模块 (packages/db)

### 模型定义 (src/models)

- 消息模型
- 聊天模型
- 文件夹模型
- 同步配置模型

### 迁移脚本 (src/migrations)

- 数据库结构迁移
- 索引优化
- 数据更新脚本

## 核心模块 (packages/core)

### 适配器 (src/adapters)

- Telegram 客户端适配器
- 向量嵌入适配器
- 存储适配器

### 服务实现 (src/services)

- 消息处理服务
- 向量计算服务
- 搜索服务

## CLI 模块 (packages/cli)

### 命令实现 (src/commands)

- `sync`: 同步命令
- `export`: 导出命令
- `import`: 导入命令
- `watch`: 消息监听命令

## 公共模块 (packages/common)

### 类型定义 (src/types)

- 命令类型
- 消息类型
- 配置类型
- API 响应类型

### 工具函数 (src/utils)

- 日志工具
- 错误处理
- 类型转换
- 配置管理

## 配置模块 (config)

- 环境配置
- 数据库配置
- API 配置
- 客户端配置

## 文档 (docs)

- `architecture.md`: 系统架构文档
- `database-design.md`: 数据库设计文档
- `development-guide.md`: 开发指南
- `modules.md`: 模块文档（本文档）

## 第三方库定制 (libs)

- Telegram 客户端定制
- 向量计算库定制
- UI 组件库定制

## 模块间的关系

1. 前端与后端
   - 通过 HTTP API 和 SSE 通信
   - 共享类型定义和接口规范

2. 后端与核心
   - 后端调用核心模块的服务
   - 共享适配器接口

3. CLI 与核心
   - CLI 使用核心模块的功能
   - 共享数据处理逻辑

4. 数据库与其他模块
   - 提供统一的数据访问层
   - 共享模型定义和迁移脚本

## 扩展性设计

1. 适配器模式
   - 支持不同的 Telegram 客户端
   - 支持不同的向量计算服务
   - 支持不同的存储后端

2. 模块化设计
   - 独立的功能模块
   - 清晰的依赖关系
   - 可插拔的组件

3. 类型系统
   - 完整的类型定义
   - 类型安全的接口
   - 可重用的类型

## 开发指南

1. 模块开发流程
   - 遵循类型定义
   - 使用适配器接口
   - 保持向后兼容

2. 测试策略
   - 单元测试
   - 集成测试
   - E2E 测试

3. 文档维护
   - 及时更新模块文档
   - 记录 API 变更
   - 维护开发指南 
