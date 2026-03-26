# 用户组聊天页面设计文档

**日期**：2026-03-26
**状态**：已确认（v3，通过审查）

---

## 需求概述

用户组（班级）聊天页面应与 agent 聊天页面功能对齐：

- 点击 Home 侧边栏中的用户组 → 跳转到该组的专属聊天页
- 聊天页侧边栏列出该组的历史话题（含锁定状态）
- 点击话题 → 自动锁定 → 进入聊天问答
- 话题锁定机制：同一话题同一时刻只允许一人进入

---

## 一、数据模型变更

### 1.1 `user_groups` 表新增 `agent_id` 字段

**文件**：`packages/database/src/schemas/userGroup.ts`

```ts
agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
```

用户组绑定一个 AI agent，组内所有话题使用该 agent 进行 AI 回复。`agentId` 可为 null（暂未绑定）。

### 1.2 新增迁移文件

**新增文件**：`packages/database/migrations/0096_user_group_agent_binding.sql`

```sql
ALTER TABLE "user_groups" ADD COLUMN "agent_id" text
  REFERENCES "agents"("id") ON DELETE SET NULL;
```

**新增文件**：`packages/database/migrations/meta/0096_snapshot.json`

通过 `drizzle-kit generate` 自动生成。

> **注意**：当前仓库中 `0095_snapshot.json` 缺失（`0094_snapshot.json` 是最新 snapshot）。0096 snapshot 需基于 0094 snapshot 增量构造，同时将 0095 的 `user_group_id` 列变更和 0096 的 `agent_id` 列变更一并包含。如果先补全 0095 snapshot 再生成 0096，则 0096 只需包含 `agent_id` 增量。

**修改文件**：`packages/database/migrations/meta/_journal.json` 新增第 96 条：

```json
{
  "breakpoints": true,
  "idx": 96,
  "tag": "0096_user_group_agent_binding",
  "version": "7",
  "when": 1774742400000
}
```

### 1.3 Store 类型更新

**文件**：`src/store/userGroup/store.ts` 中的 `MyGroupItem` 类型，`group` 对象新增 `agentId` 字段：

```ts
export interface MyGroupItem {
  group: {
    agentId: string | null; // 新增
    // ...现有字段
  };
  role: string;
}
```

### 1.4 现有变更（已完成）

- `topics.user_group_id` FK 已在 migration 0095 完成
- `topic_locks` 表已存在，支持原子锁定 + 心跳续期

---

## 二、路由架构

### 2.1 新路由 `/ug/:ugid`

需修改两个路由配置文件：

- `src/spa/router/desktopRouter.config.tsx`（Web SPA，dynamic import）
- `src/spa/router/desktopRouter.config.desktop.tsx`（Electron，sync import）

路由结构：

```text
/ug/:ugid
├── _layout/        → UgLayout（Sidebar + Outlet）
│   ├── UgIdSync    → URL params 同步到 userGroupStore.activeGroupId
│   └── Sidebar/
│       ├── Header/ → 组名 + 绑定 agent 信息
│       └── Topic/  → 话题列表（含锁定状态）
└── index.tsx       → 对话页（Conversation + Portal）
```

URL 模式：`/ug/:ugid?topic=topicId`

### 2.2 新增 store 字段与 selector

`src/store/userGroup/store.ts` 新增：

```ts
// UserGroupState 接口新增
activeGroupId: string | null;

// UserGroupAction 接口新增
setActiveGroupId: (id: string | null) => void;

// 独立 selector（导出为具名函数）
export const selectActiveGroupDetail = (state: UserGroupStore): MyGroupItem | undefined =>
  state.myGroups.find((g) => g.group.id === state.activeGroupId);
```

### 2.3 导航流程

```text
Home 侧边栏点击组名
  → navigate('/ug/:ugid')
  → UgIdSync 读取 :ugid → userGroupStore.setActiveGroupId(ugid)

侧边栏点击话题
  → tryLockTopic(topicId)
  ├─ 成功（未锁 / 已是自己的锁）→ navigate('?topic=topicId') → 加载消息
  └─ 失败（他人持有锁）→ message.warning('XXX 正在使用该话题')

离开路由（unmount）
  → _layout/index.tsx 中的 useGroupTopicLockCleanup hook 触发
  → leaveTopic(activeLockedTopicId)
  → setActiveGroupId(null)
  → beforeunload → sendBeacon 释放锁（备用）
  → 心跳 5 分钟超时自动过期（后端兜底）
```

**注意**：锁定清理由 `useGroupTopicLockCleanup` hook 在 `_layout/index.tsx` 中管理（不在 `UgIdSync` 中），`UgIdSync` 仅负责 `activeGroupId` 同步。

---

## 三、侧边栏设计

### 3.1 文件结构

```text
src/routes/(main)/ug/_layout/Sidebar/
├── index.tsx
├── Header/
│   └── index.tsx      → 组名 + agent 头像/名称 + 成员数
└── Topic/
    ├── index.tsx      → AccordionItem 包裹
    └── List/
        └── Item/
            └── index.tsx  → 单条话题，含锁定状态渲染
```

### 3.2 Header 布局

**正常状态**（已绑定 agent）：

```text
┌─────────────────────────┐
│ [Agent头像]  计算机2301班 │
│  DeepSeek · 3人          │
└─────────────────────────┘
```

**agentId === null**（未绑定 agent）：

```text
┌─────────────────────────┐
│ [默认头像]  计算机2301班  │
│  暂未绑定 Agent · 3人     │
└─────────────────────────┘
```

**成员数来源**：`getMyGroups` TRPC 接口返回值中包含 `memberCount`。需在 `UserGroupModel.getUserGroupsWithDetails()` 中新增 count 子查询，避免调用需要 `user:manage` 权限的 `getGroupMembersWithDetails`。

读取：`selectActiveGroupDetail(userGroupStore)` → 获取组名、agentId、memberCount。

### 3.3 话题列表

```text
┌─────────────────────────┐
│ 会话话题          [+ 新建]│
├─────────────────────────┤
│ 🔓 如何理解递归...        │
│ 🔒 Python基础... 张三    │  ← lockedBy 显示姓名
│ 🔓 数据库设计...          │
└─────────────────────────┘
```

- 数据来源：`userGroupStore.groupTopics[groupId]`
- 刷新策略：SWR 每 10 秒轮询，确保锁定状态最新
- 已锁（他人）：cursor `not-allowed`，opacity 0.6，点击弹 warning
- 已锁（自己）：高亮激活样式，可直接重新进入（navigate 到当前 topic）
- 未锁：点击 → `tryLockTopic` → 成功则导航

---

## 四、对话区设计

### 4.1 页面结构

`src/routes/(main)/ug/index.tsx`：

```tsx
<>
  <PageTitle />
  <Flexbox horizontal height="100%">
    <Conversation />
    <Portal />
  </Flexbox>
</>
```

### 4.2 对话上下文

`ConversationArea` 使用以下上下文：

```ts
context = {
  agentId: group.agentId, // 用户组绑定的 agent（可能为 null）
  topicId: activeTopicId, // URL query param: ?topic=xxx
  groupId: ugid, // 用于区分用户组话题
};
```

### 4.3 `agentId === null` 的处理

当用户组未绑定 agent 时：

- `ConversationArea` 展示空状态，禁用输入框
- 空状态文案：`t('userGroup.noAgentBound')`（"该用户组尚未绑定 AI 助手，请联系管理员配置"）
- 话题历史消息可以正常浏览，仅禁止发送新消息

### 4.4 空状态（未选中话题）

```text
┌──────────────────────────┐
│   选择左侧话题开始对话      │
│   或点击「+ 新建话题」      │
└──────────────────────────┘
```

文案 key：`userGroup.selectTopicToStart`

### 4.5 输入框

复用现有 `MainChatInput`，消息发送走 chatStore + TRPC，无需额外改造。

---

## 五、Home 侧边栏改造

### 5.1 改造内容

| 文件                          | 变更                                                       |
| ----------------------------- | ---------------------------------------------------------- |
| `List/index.tsx`              | Collapse → 简单列表，点击调用 `navigate('/ug/' + groupId)` |
| `List/GroupTopicList.tsx`     | **删除**（功能迁移到新路由侧边栏）                         |
| `useGroupTopicLockCleanup.ts` | **迁移**到 `/ug/_layout/index.tsx`，在路由生命周期内管理   |

### 5.2 改造后行为

- Home 侧边栏用户组区域：仅显示组名列表，点击跳转
- 锁定状态、话题列表、新建话题按钮全部在 `/ug/:ugid` 页面内处理
- 职责明确：Home 侧边栏 = 入口导航；`/ug` 路由 = 完整聊天体验

---

## 六、i18n 规划

新增 namespace：`src/locales/default/userGroup.ts`（新文件，避免堆入 `common.ts`）

| Key                            | 中文默认值                                 | 用途                  |
| ------------------------------ | ------------------------------------------ | --------------------- |
| `userGroup.selectTopicToStart` | 选择左侧话题开始对话，或点击「+ 新建话题」 | 空状态                |
| `userGroup.noAgentBound`       | 该用户组尚未绑定 AI 助手，请联系管理员配置 | agentId 为 null       |
| `userGroup.topicLockedBy`      | {{name}} 正在使用该话题                    | 锁定警告（带插值）    |
| `userGroup.newTopic`           | 新建话题                                   | 新建按钮              |
| `userGroup.topics`             | 会话话题                                   | 侧边栏 Accordion 标题 |

注册：在 `src/locales/default/index.ts` 中导入并导出 `userGroup` namespace。

---

## 七、新建文件清单

```text
packages/database/migrations/0096_user_group_agent_binding.sql
packages/database/migrations/meta/0096_snapshot.json

src/locales/default/userGroup.ts

src/routes/(main)/ug/
├── _layout/
│   ├── index.tsx
│   ├── UgIdSync.tsx
│   └── Sidebar/
│       ├── index.tsx
│       ├── Header/
│       │   └── index.tsx
│       └── Topic/
│           ├── index.tsx
│           └── List/
│               └── Item/
│                   └── index.tsx
├── features/
│   ├── Conversation/
│   │   └── index.tsx
│   └── Portal/
│       └── index.tsx
└── index.tsx
```

> **说明**：`features/` 放在 `src/routes/(main)/ug/` 下，遵循现有 `/agent` 和 `/group` 路由的实际惯例（两者均在 `src/routes/(main)/*/features/` 下放置对话组件）。

## 八、修改文件清单

```text
packages/database/src/schemas/userGroup.ts              (+agentId 字段)
packages/database/src/models/userGroup.ts               (getUserGroupsWithDetails 新增 memberCount 子查询)
packages/database/migrations/meta/_journal.json         (+0096 entry)
src/spa/router/desktopRouter.config.tsx                 (+/ug route, dynamic import)
src/spa/router/desktopRouter.config.desktop.tsx         (+/ug route, sync import)
src/store/userGroup/store.ts                            (UserGroupState +activeGroupId; UserGroupAction +setActiveGroupId; +selectActiveGroupDetail; MyGroupItem +agentId)
src/server/routers/lambda/userGroup.ts                  (getMyGroups 返回值新增 memberCount)
src/locales/default/index.ts                            (+userGroup namespace 注册)
src/routes/(main)/home/_layout/Body/UserGroup/List/index.tsx  (简化为导航列表)
```

## 九、删除文件清单

```text
src/routes/(main)/home/_layout/Body/UserGroup/List/GroupTopicList.tsx
src/routes/(main)/home/_layout/Body/UserGroup/useGroupTopicLockCleanup.ts
  （逻辑迁移到 /ug/_layout/index.tsx）
```

---

## 十、不在本次范围内

- 用户组设置页中绑定 agent 的管理 UI — 放在 Settings > 用户组管理
- 移动端适配
- 话题搜索功能
- 话题权限细分（group_admin vs member 的不同操作权限）
