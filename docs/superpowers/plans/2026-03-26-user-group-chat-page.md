# User Group Chat Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a dedicated `/ug/:ugid` chat page for user groups (班级), structurally matching the existing `/agent/:aid` chat page — with a topic sidebar (lock status), and a main conversation area.

**Architecture:** The user group chat page reuses the existing `chatStore` + `ConversationProvider` infrastructure. `UgIdSync` syncs URL params to both `userGroupStore.activeGroupId` and `chatStore.activeAgentId` (from the group's bound agent). The sidebar reads topics from `userGroupStore.groupTopics`. The conversation area uses `ConversationProvider` from `@/features/Conversation` with a context hook that reads `agentId` + `topicId` from `chatStore`, matching the agent chat pattern.

**Tech Stack:** React 19, TypeScript, react-router-dom, Zustand, Drizzle ORM, TRPC, antd, @lobehub/ui, react-i18next

**Spec:** `docs/superpowers/specs/2026-03-26-user-group-chat-page-design.md`

---

### Task 1: Database Schema — Add `agentId` to `userGroups`

**Files:**

- Modify: `packages/database/src/schemas/userGroup.ts:8-28`

- Create: `packages/database/migrations/0096_user_group_agent_binding.sql`

- Modify: `packages/database/migrations/meta/_journal.json`

- [ ] **Step 1: Add `agentId` column to schema**

In `packages/database/src/schemas/userGroup.ts`, add the import for `agents` and the `agentId` field:

```ts
// At the top, add import:
import { agents } from './agent';
```

Then inside the `userGroups` table definition, add after the `sort` field:

```ts
    agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
```

Verify the `agents` table is exported from `./agent` — run:

```bash
grep -n "export const agents" packages/database/src/schemas/agent.ts
```

- [ ] **Step 2: Create migration SQL**

Create `packages/database/migrations/0096_user_group_agent_binding.sql`:

```sql
ALTER TABLE "user_groups" ADD COLUMN "agent_id" text;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
```

- [ ] **Step 3: Register migration in journal**

In `packages/database/migrations/meta/_journal.json`, add a new entry at the end of the `entries` array (after the last existing entry):

```json
{
  "breakpoints": true,
  "idx": 96,
  "tag": "0096_user_group_agent_binding",
  "version": "7",
  "when": 1774742400000
}
```

- [ ] **Step 4: Generate snapshot**

Run from project root:

```bash
cd packages/database && bunx drizzle-kit generate
```

If `drizzle-kit generate` produces a new migration file that conflicts, discard the generated SQL (we wrote it manually) but keep the generated snapshot. If it doesn't produce a snapshot, create `packages/database/migrations/meta/0096_snapshot.json` by copying `0094_snapshot.json` and adding the `agent_id` column to the `user_groups` table definition.

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/schemas/userGroup.ts packages/database/migrations/0096_user_group_agent_binding.sql packages/database/migrations/meta/_journal.json packages/database/migrations/meta/0096_snapshot.json
git commit -m "feat(database): add agent_id to user_groups schema"
```

---

### Task 2: Backend — Model & TRPC Changes

**Files:**

- Modify: `packages/database/src/models/userGroup.ts:114-127`

- Modify: `src/server/routers/lambda/userGroup.ts:113-116`

- [ ] **Step 1: Add `memberCount` to `getUserGroupsWithDetails`**

In `packages/database/src/models/userGroup.ts`, replace the `getUserGroupsWithDetails` method (lines 114-127):

```ts
getUserGroupsWithDetails = async (userId?: string) => {
  const targetUserId = userId || this.userId;

  const memberCountSq = this.db
    .select({
      groupId: userGroupMembers.groupId,
      count: sql<number>`count(*)::int`.as('count'),
    })
    .from(userGroupMembers)
    .groupBy(userGroupMembers.groupId)
    .as('member_count');

  return this.db
    .select({
      group: userGroups,
      memberCount: sql<number>`coalesce(${memberCountSq.count}, 0)`.as('memberCount'),
      role: userGroupMembers.role,
    })
    .from(userGroupMembers)
    .innerJoin(userGroups, eq(userGroups.id, userGroupMembers.groupId))
    .leftJoin(memberCountSq, eq(memberCountSq.groupId, userGroupMembers.groupId))
    .where(eq(userGroupMembers.userId, targetUserId))
    .orderBy(asc(userGroups.sort), desc(userGroups.createdAt));
};
```

Add the `sql` import at the top of the file:

```ts
import { and, asc, desc, eq, sql } from 'drizzle-orm';
```

- [ ] **Step 2: Verify type-check passes**

```bash
cd packages/database && bun run type-check
```

Expected: PASS (no type errors)

- [ ] **Step 3: Commit**

```bash
git add packages/database/src/models/userGroup.ts
git commit -m "feat(database): add memberCount to getUserGroupsWithDetails"
```

---

### Task 3: Store Updates

**Files:**

- Modify: `src/store/userGroup/store.ts`

- [ ] **Step 1: Update `MyGroupItem` type and add `activeGroupId` state**

In `src/store/userGroup/store.ts`, update the `MyGroupItem` interface (around line 18):

```ts
export interface MyGroupItem {
  group: {
    accessedAt: Date;
    agentId: string | null;
    createdAt: Date;
    createdBy: string | null;
    description: string | null;
    id: string;
    name: string;
    parentId: string | null;
    sort: number | null;
    updatedAt: Date;
  };
  memberCount: number;
  role: string;
}
```

- [ ] **Step 2: Add `activeGroupId` to state and `setActiveGroupId` to action**

In `UserGroupState` interface, add:

```ts
activeGroupId: string | null;
```

In `UserGroupAction` interface, add:

```ts
  setActiveGroupId: (id: string | null) => void;
```

In `initialState`, add:

```ts
  activeGroupId: null,
```

In the `createStore` function body (inside the return object), add:

```ts
  setActiveGroupId: (id) => {
    set({ activeGroupId: id }, false, 'setActiveGroupId');
  },
```

- [ ] **Step 3: Add `selectActiveGroupDetail` selector**

After the `useUserGroupStore` export at the bottom of the file, add:

```ts
export const selectActiveGroupDetail = (state: UserGroupStore): MyGroupItem | undefined =>
  state.myGroups.find((g) => g.group.id === state.activeGroupId);
```

- [ ] **Step 4: Verify type-check**

```bash
bun run type-check
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/userGroup/store.ts
git commit -m "feat(store): add activeGroupId and selectActiveGroupDetail to userGroupStore"
```

---

### Task 4: i18n — Create `userGroup` Namespace

**Files:**

- Create: `src/locales/default/userGroup.ts`

- Modify: `src/locales/default/index.ts`

- [ ] **Step 1: Create the namespace file**

Create `src/locales/default/userGroup.ts`:

```ts
export default {
  newTopic: '新建话题',
  noAgentBound: '该用户组尚未绑定 AI 助手，请联系管理员配置',
  selectTopicToStart: '选择左侧话题开始对话，或点击「+ 新建话题」',
  topicLockedBy: '{{name}} 正在使用该话题',
  topics: '会话话题',
} as const;
```

- [ ] **Step 2: Register in index**

In `src/locales/default/index.ts`, add the import (alphabetical order, after `ui`):

```ts
import userGroup from './userGroup';
```

And add to the `resources` object (alphabetical order, after `ui`):

```ts
  userGroup,
```

- [ ] **Step 3: Commit**

```bash
git add src/locales/default/userGroup.ts src/locales/default/index.ts
git commit -m "feat(i18n): add userGroup namespace"
```

---

### Task 5: Router Config — Add `/ug` Route

**Files:**

- Modify: `src/spa/router/desktopRouter.config.tsx:59-94`

- Modify: `src/spa/router/desktopRouter.config.desktop.tsx:43-135`

- [ ] **Step 1: Add route to web SPA config (dynamic imports)**

In `src/spa/router/desktopRouter.config.tsx`, add the following block after the `group` route block (after line 94, before the discover routes):

```ts
      // User group chat routes
      {
        children: [
          {
            element: redirectElement('/'),
            index: true,
          },
          {
            children: [
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/ug'),
                  'Desktop > User Group',
                ),
                index: true,
              },
            ],
            element: dynamicLayout(
              () => import('@/routes/(main)/ug/_layout'),
              'Desktop > User Group > Layout',
            ),
            errorElement: <ErrorBoundary resetPath="/ug" />,
            path: ':ugid',
          },
        ],
        path: 'ug',
      },
```

- [ ] **Step 2: Add route to Electron config (sync imports)**

In `src/spa/router/desktopRouter.config.desktop.tsx`, add the sync imports at the top (after the GroupProfilePage import, around line 45):

```ts
import UserGroupPage from '@/routes/(main)/ug';
import DesktopUserGroupLayout from '@/routes/(main)/ug/_layout';
```

Then add the route block after the group chat routes block (after line 135, before the discover routes):

```ts
      // User group chat routes
      {
        children: [
          {
            element: redirectElement('/'),
            index: true,
          },
          {
            children: [
              {
                element: <UserGroupPage />,
                index: true,
              },
            ],
            element: <DesktopUserGroupLayout />,
            errorElement: <ErrorBoundary resetPath="/ug" />,
            path: ':ugid',
          },
        ],
        path: 'ug',
      },
```

- [ ] **Step 3: Commit**

```bash
git add src/spa/router/desktopRouter.config.tsx src/spa/router/desktopRouter.config.desktop.tsx
git commit -m "feat(router): add /ug/:ugid route for user group chat"
```

---

### Task 6: Route Layout — `_layout/` Shell

**Files:**

- Create: `src/routes/(main)/ug/_layout/index.tsx`

- Create: `src/routes/(main)/ug/_layout/style.ts`

- Create: `src/routes/(main)/ug/_layout/UgIdSync.tsx`

- [ ] **Step 1: Create layout style**

Create `src/routes/(main)/ug/_layout/style.ts`:

```ts
import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  mainContainer: css`
    position: relative;
    overflow: hidden;
    background: ${cssVar.colorBgContainer};
  `,
}));
```

- [ ] **Step 2: Create `UgIdSync`**

Create `src/routes/(main)/ug/_layout/UgIdSync.tsx`:

```ts
import { usePrevious, useUnmount } from 'ahooks';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { useChatStore } from '@/store/chat';
import { selectActiveGroupDetail, useUserGroupStore } from '@/store/userGroup/store';

const UgIdSync = () => {
  const params = useParams<{ ugid?: string }>();
  const prevUgId = usePrevious(params.ugid);

  // Sync ugid to userGroupStore
  useEffect(() => {
    useUserGroupStore.getState().setActiveGroupId(params.ugid ?? null);
  }, [params.ugid]);

  // Sync the group's bound agentId to chatStore so ConversationProvider works
  const agentId = useUserGroupStore((s) => selectActiveGroupDetail(s)?.group.agentId);

  useEffect(() => {
    if (agentId) {
      useChatStore.setState({ activeAgentId: agentId }, false, 'UgIdSync/agentId');
    }
  }, [agentId]);

  // Reset activeTopicId when switching groups
  useEffect(() => {
    if (prevUgId !== undefined && prevUgId !== params.ugid) {
      useChatStore.getState().switchTopic(null, { skipRefreshMessage: true });
    }
  }, [params.ugid, prevUgId]);

  // Cleanup on unmount
  useUnmount(() => {
    useUserGroupStore.getState().setActiveGroupId(null);
    useChatStore.setState(
      { activeAgentId: undefined, activeTopicId: undefined },
      false,
      'UgIdSync/unmount',
    );
  });

  return null;
};

export default UgIdSync;
```

- [ ] **Step 3: Create layout component**

Create `src/routes/(main)/ug/_layout/index.tsx`:

```ts
import { Flexbox } from '@lobehub/ui';
import { type FC } from 'react';
import { Outlet } from 'react-router-dom';

import { useGroupTopicLockCleanup } from './useGroupTopicLockCleanup';
import Sidebar from './Sidebar';
import { styles } from './style';
import UgIdSync from './UgIdSync';

const Layout: FC = () => {
  useGroupTopicLockCleanup();

  return (
    <>
      <Sidebar />
      <Flexbox className={styles.mainContainer} flex={1} height={'100%'}>
        <Outlet />
      </Flexbox>
      <UgIdSync />
    </>
  );
};

export default Layout;
```

- [ ] **Step 4: Create lock cleanup hook (migrated from home sidebar)**

Create `src/routes/(main)/ug/_layout/useGroupTopicLockCleanup.ts`:

```ts
import { useEffect } from 'react';

import { useUserGroupStore } from '@/store/userGroup/store';

/**
 * 监听页面卸载事件，释放话题锁定。
 * 三层保障之一：beforeunload + 路由切换（layout unmount） + 心跳过期
 */
export const useGroupTopicLockCleanup = () => {
  const activeLockedTopicId = useUserGroupStore((s) => s.activeLockedTopicId);
  const leaveTopic = useUserGroupStore((s) => s.leaveTopic);

  useEffect(() => {
    if (!activeLockedTopicId) return;

    const handleBeforeUnload = () => {
      leaveTopic(activeLockedTopicId);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also release lock when the layout unmounts (route change)
      leaveTopic(activeLockedTopicId);
    };
  }, [activeLockedTopicId, leaveTopic]);
};
```

- [ ] **Step 5: Commit**

```bash
git add src/routes/(main)/ug/_layout/
git commit -m "feat(ug): create layout shell with UgIdSync and lock cleanup"
```

---

### Task 7: Sidebar — Header, Topic List, Lock Status

**Files:**

- Create: `src/routes/(main)/ug/_layout/Sidebar/index.tsx`

- Create: `src/routes/(main)/ug/_layout/Sidebar/Header/index.tsx`

- Create: `src/routes/(main)/ug/_layout/Sidebar/Topic/index.tsx`

- Create: `src/routes/(main)/ug/_layout/Sidebar/Topic/List/Item/index.tsx`

- [ ] **Step 1: Create Sidebar shell**

Create `src/routes/(main)/ug/_layout/Sidebar/index.tsx`:

```tsx
import React, { memo } from 'react';

import { NavPanelPortal } from '@/features/NavPanel';
import SideBarLayout from '@/features/NavPanel/SideBarLayout';

import Header from './Header';
import Topic from './Topic';

const Sidebar = memo(() => {
  return (
    <NavPanelPortal navKey="ug">
      <SideBarLayout body={<Topic />} header={<Header />} />
    </NavPanelPortal>
  );
});

Sidebar.displayName = 'UgSidebar';

export default Sidebar;
```

- [ ] **Step 2: Create Header**

Create `src/routes/(main)/ug/_layout/Sidebar/Header/index.tsx`:

```tsx
'use client';

import { Avatar, Flexbox, Text } from '@lobehub/ui';
import { Users } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useAgentStore } from '@/store/agent';
import { agentSelectors } from '@/store/agent/selectors';
import { selectActiveGroupDetail, useUserGroupStore } from '@/store/userGroup/store';

const Header = memo(() => {
  const { t } = useTranslation('userGroup');
  const groupDetail = useUserGroupStore(selectActiveGroupDetail);

  const agentTitle = useAgentStore(agentSelectors.currentAgentTitle);
  const agentAvatar = useAgentStore(agentSelectors.currentAgentAvatar);

  if (!groupDetail) return null;

  const { group, memberCount } = groupDetail;
  const hasAgent = !!group.agentId;

  return (
    <Flexbox gap={8} padding={'12px 16px'}>
      <Flexbox horizontal align="center" gap={12}>
        <Avatar avatar={hasAgent ? agentAvatar : <Users size={20} />} shape="circle" size={40} />
        <Flexbox gap={2} style={{ minWidth: 0 }}>
          <Text ellipsis style={{ fontSize: 14, fontWeight: 600 }}>
            {group.name}
          </Text>
          <Text ellipsis style={{ fontSize: 12 }} type="secondary">
            {hasAgent ? agentTitle : t('noAgentBound')} · {memberCount}人
          </Text>
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
});

Header.displayName = 'UgHeader';

export default Header;
```

- [ ] **Step 3: Create Topic List Item with lock status**

Create `src/routes/(main)/ug/_layout/Sidebar/Topic/List/Item/index.tsx`:

```tsx
'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { message } from 'antd';
import { Lock, Unlock } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { type GroupTopicItem, useUserGroupStore } from '@/store/userGroup/store';

interface TopicItemProps {
  active: boolean;
  topic: GroupTopicItem;
}

const TopicItem = memo<TopicItemProps>(({ topic, active }) => {
  const { t } = useTranslation('userGroup');
  const navigate = useNavigate();
  const params = useParams<{ ugid: string }>();
  const enterTopic = useUserGroupStore((s) => s.enterTopic);

  const isLockedByOther = !!topic.lock?.lockedBy;
  const lockerName = topic.lock?.lockedBy
    ? topic.creator?.fullName || topic.lock.lockedBy.slice(0, 6)
    : null;

  const handleClick = useCallback(async () => {
    if (active) return; // Already viewing this topic

    const result = await enterTopic(topic.id);
    if (result.success) {
      navigate(`/ug/${params.ugid}?topic=${topic.id}`, { replace: true });
    } else {
      const name = result.lockedBy || '';
      message.warning(t('topicLockedBy', { name }));
    }
  }, [active, enterTopic, navigate, params.ugid, t, topic.id]);

  return (
    <Flexbox
      horizontal
      align="center"
      gap={8}
      onClick={handleClick}
      style={{
        background: active ? 'var(--ant-color-bg-text-hover)' : undefined,
        borderRadius: 8,
        cursor: isLockedByOther && !active ? 'not-allowed' : 'pointer',
        opacity: isLockedByOther && !active ? 0.6 : 1,
        padding: '8px 12px',
      }}
    >
      {isLockedByOther ? <Lock size={14} /> : <Unlock size={14} style={{ opacity: 0.3 }} />}
      <Text ellipsis style={{ flex: 1, fontSize: 13 }}>
        {topic.title || t('newTopic')}
      </Text>
      {isLockedByOther && lockerName && (
        <Text style={{ fontSize: 11, flexShrink: 0 }} type="secondary">
          {lockerName}
        </Text>
      )}
    </Flexbox>
  );
});

TopicItem.displayName = 'UgTopicItem';

export default TopicItem;
```

- [ ] **Step 4: Create Topic accordion with list and create button**

Create `src/routes/(main)/ug/_layout/Sidebar/Topic/index.tsx`:

```tsx
'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { Button, message } from 'antd';
import { MessageSquarePlus } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { type GroupTopicItem, useUserGroupStore } from '@/store/userGroup/store';

import Item from './List/Item';

const POLL_INTERVAL = 10_000; // 10 seconds

const Topic = memo(() => {
  const { t } = useTranslation('userGroup');
  const navigate = useNavigate();
  const params = useParams<{ ugid: string }>();
  const [searchParams] = useSearchParams();
  const activeTopicId = searchParams.get('topic');
  const [creating, setCreating] = useState(false);

  const [groupTopics, fetchGroupTopics, createGroupTopic, enterTopic] = useUserGroupStore((s) => [
    s.groupTopics[params.ugid || ''] || [],
    s.fetchGroupTopics,
    s.createGroupTopic,
    s.enterTopic,
  ]);

  // Fetch topics on mount and poll every 10s for lock status
  useEffect(() => {
    if (!params.ugid) return;
    fetchGroupTopics(params.ugid);
    const timer = setInterval(() => fetchGroupTopics(params.ugid!), POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchGroupTopics, params.ugid]);

  const handleCreate = useCallback(async () => {
    if (!params.ugid) return;
    setCreating(true);
    try {
      await createGroupTopic({ title: t('newTopic'), userGroupId: params.ugid });
    } finally {
      setCreating(false);
    }
  }, [createGroupTopic, params.ugid, t]);

  return (
    <Flexbox gap={4} padding={'8px 4px'}>
      <Flexbox horizontal align="center" justify="space-between" paddingInline={12}>
        <Text style={{ fontSize: 12 }} type="secondary" weight={500}>
          {t('topics')}
        </Text>
        <Button
          icon={<MessageSquarePlus size={14} />}
          loading={creating}
          size="small"
          type="text"
          onClick={handleCreate}
        />
      </Flexbox>
      <Flexbox gap={2}>
        {groupTopics.length === 0 ? (
          <Flexbox align="center" padding={24}>
            <Text style={{ fontSize: 12 }} type="secondary">
              {t('selectTopicToStart')}
            </Text>
          </Flexbox>
        ) : (
          groupTopics.map((topic: GroupTopicItem) => (
            <Item active={activeTopicId === topic.id} key={topic.id} topic={topic} />
          ))
        )}
      </Flexbox>
    </Flexbox>
  );
});

Topic.displayName = 'UgTopic';

export default Topic;
```

- [ ] **Step 5: Commit**

```bash
git add src/routes/(main)/ug/_layout/Sidebar/
git commit -m "feat(ug): create sidebar with header, topic list, and lock status"
```

---

### Task 8: Conversation Features — Chat Area & Input

**Files:**

- Create: `src/routes/(main)/ug/features/Conversation/index.tsx`

- Create: `src/routes/(main)/ug/features/Conversation/ConversationArea.tsx`

- Create: `src/routes/(main)/ug/features/Conversation/useUserGroupChatContext.ts`

- Create: `src/routes/(main)/ug/features/Conversation/ChatHydration/index.tsx`

- Create: `src/routes/(main)/ug/features/Conversation/MainChatInput/index.tsx`

- [ ] **Step 1: Create context hook**

Create `src/routes/(main)/ug/features/Conversation/useUserGroupChatContext.ts`:

```ts
'use client';

import { type ConversationContext } from '@lobechat/types';

import { useChatStore } from '@/store/chat';

/**
 * Hook to get user group conversation context.
 * Reads agentId and topicId from chatStore (set by UgIdSync).
 * Scope is always 'main' — user group topics don't support threads.
 */
export function useUserGroupChatContext(): ConversationContext {
  const [agentId, topicId] = useChatStore((s) => [s.activeAgentId ?? '', s.activeTopicId ?? null]);

  return {
    agentId,
    scope: 'main',
    topicId,
  };
}
```

- [ ] **Step 2: Create ChatHydration**

Create `src/routes/(main)/ug/features/Conversation/ChatHydration/index.tsx`:

```tsx
'use client';

import { memo, useLayoutEffect } from 'react';
import { createStoreUpdater } from 'zustand-utils';

import { useQueryState } from '@/hooks/useQueryParam';
import { useChatStore } from '@/store/chat';

// Sync URL query params (?topic=xxx) to chatStore — identical to agent ChatHydration
const ChatHydration = memo(() => {
  const useStoreUpdater = createStoreUpdater(useChatStore);

  const [topic, setTopic] = useQueryState('topic', { history: 'replace', throttleMs: 500 });
  useStoreUpdater('activeTopicId', topic!);

  useLayoutEffect(() => {
    const unsubscribe = useChatStore.subscribe(
      (s) => s.activeTopicId,
      (state) => {
        setTopic(!state ? null : state);
      },
    );
    return () => unsubscribe();
  }, [setTopic]);

  return null;
});

export default ChatHydration;
```

- [ ] **Step 3: Create MainChatInput**

Create `src/routes/(main)/ug/features/Conversation/MainChatInput/index.tsx`:

```tsx
'use client';

import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { type ActionKeys } from '@/features/ChatInput';
import { ChatInput } from '@/features/Conversation';
import { useChatStore } from '@/store/chat';
import { selectActiveGroupDetail, useUserGroupStore } from '@/store/userGroup/store';

const MainChatInput = memo(() => {
  const { t } = useTranslation('userGroup');
  const hasAgent = useUserGroupStore((s) => !!selectActiveGroupDetail(s)?.group.agentId);
  const hasActiveTopic = useChatStore((s) => !!s.activeTopicId);

  const leftActions: ActionKeys[] = useMemo(() => ['model', 'fileUpload', 'mainToken'], []);

  // Disable input if no agent bound or no topic selected
  if (!hasAgent || !hasActiveTopic) return null;

  return (
    <ChatInput
      skipScrollMarginWithList
      leftActions={leftActions}
      rightActions={[]}
      sendButtonProps={{ shape: 'round' }}
      onEditorReady={(instance) => {
        useChatStore.setState({ mainInputEditor: instance });
      }}
    />
  );
});

MainChatInput.displayName = 'UgMainChatInput';

export default MainChatInput;
```

- [ ] **Step 4: Create ConversationArea**

Create `src/routes/(main)/ug/features/Conversation/ConversationArea.tsx`:

```tsx
'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ChatList, ConversationProvider } from '@/features/Conversation';
import { useOperationState } from '@/hooks/useOperationState';
import { useChatStore } from '@/store/chat';
import { messageMapKey } from '@/store/chat/utils/messageMapKey';
import { selectActiveGroupDetail, useUserGroupStore } from '@/store/userGroup/store';

import ChatHydration from './ChatHydration';
import MainChatInput from './MainChatInput';
import { useUserGroupChatContext } from './useUserGroupChatContext';

const ConversationArea = memo(() => {
  const { t } = useTranslation('userGroup');
  const context = useUserGroupChatContext();
  const hasAgent = useUserGroupStore((s) => !!selectActiveGroupDetail(s)?.group.agentId);
  const hasActiveTopic = useChatStore((s) => !!s.activeTopicId);

  const chatKey = useMemo(() => messageMapKey(context), [context.agentId, context.topicId]);
  const replaceMessages = useChatStore((s) => s.replaceMessages);
  const messages = useChatStore((s) => s.dbMessagesMap[chatKey]);
  const operationState = useOperationState(context);

  // Empty state: no topic selected or no agent bound
  if (!hasActiveTopic || !hasAgent) {
    return (
      <Flexbox align="center" flex={1} justify="center" width="100%">
        <Text style={{ fontSize: 14 }} type="secondary">
          {!hasAgent ? t('noAgentBound') : t('selectTopicToStart')}
        </Text>
      </Flexbox>
    );
  }

  return (
    <ConversationProvider
      context={context}
      hasInitMessages={!!messages}
      messages={messages}
      operationState={operationState}
      onMessagesChange={(msgs, ctx) => {
        replaceMessages(msgs, { context: ctx });
      }}
    >
      <Flexbox
        flex={1}
        width="100%"
        style={{ overflowX: 'hidden', overflowY: 'auto', position: 'relative' }}
      >
        <ChatList />
      </Flexbox>
      <MainChatInput />
      <ChatHydration />
    </ConversationProvider>
  );
});

ConversationArea.displayName = 'UgConversationArea';

export default ConversationArea;
```

- [ ] **Step 5: Create Conversation wrapper**

Create `src/routes/(main)/ug/features/Conversation/index.tsx`:

```tsx
import { Flexbox } from '@lobehub/ui';
import React, { memo, Suspense } from 'react';

import Loading from '@/components/Loading/BrandTextLoading';

import ConversationArea from './ConversationArea';

const Conversation = memo(() => {
  return (
    <Suspense fallback={<Loading debugId="UG > Conversation" />}>
      <Flexbox height="100%" style={{ overflow: 'hidden', position: 'relative' }} width="100%">
        <ConversationArea />
      </Flexbox>
    </Suspense>
  );
});

Conversation.displayName = 'UgConversation';

export default Conversation;
```

- [ ] **Step 6: Commit**

```bash
git add src/routes/(main)/ug/features/Conversation/
git commit -m "feat(ug): create conversation area with context, hydration, and input"
```

---

### Task 9: Portal & Page — Main Route Entry

**Files:**

- Create: `src/routes/(main)/ug/features/Portal/index.tsx`

- Create: `src/routes/(main)/ug/features/PageTitle/index.tsx`

- Create: `src/routes/(main)/ug/index.tsx`

- [ ] **Step 1: Create Portal (placeholder)**

Create `src/routes/(main)/ug/features/Portal/index.tsx`:

Portal subcomponents (`PortalPanel`, thread panels) are agent/group-specific and not directly reusable. Use a null placeholder — Portal can be enhanced later if needed.

```tsx
const Portal = () => null;
export default Portal;
```

- [ ] **Step 2: Create PageTitle**

Create `src/routes/(main)/ug/features/PageTitle/index.tsx`:

```tsx
'use client';

import { memo } from 'react';

import PageTitle from '@/components/PageTitle';
import { useChatStore } from '@/store/chat';
import { topicSelectors } from '@/store/chat/selectors';
import { selectActiveGroupDetail, useUserGroupStore } from '@/store/userGroup/store';

const Title = memo(() => {
  const groupName = useUserGroupStore((s) => selectActiveGroupDetail(s)?.group.name);
  const topicTitle = useChatStore((s) => topicSelectors.currentActiveTopic(s)?.title);

  return <PageTitle title={[topicTitle, groupName].filter(Boolean).join(' · ')} />;
});

export default Title;
```

- [ ] **Step 3: Create page entry**

Create `src/routes/(main)/ug/index.tsx`:

```tsx
'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import Conversation from './features/Conversation';
import PageTitle from './features/PageTitle';
import Portal from './features/Portal';

const UserGroupChatPage = memo(() => {
  return (
    <>
      <PageTitle />
      <Flexbox
        horizontal
        height="100%"
        style={{ overflow: 'hidden', position: 'relative' }}
        width="100%"
      >
        <Conversation />
        <Portal />
      </Flexbox>
    </>
  );
});

export default UserGroupChatPage;
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/(main)/ug/index.tsx src/routes/(main)/ug/features/
git commit -m "feat(ug): create main page with conversation and portal"
```

---

### Task 10: Home Sidebar — Simplify to Navigation

**Files:**

- Modify: `src/routes/(main)/home/_layout/Body/UserGroup/List/index.tsx`

- Modify: `src/routes/(main)/home/_layout/Body/UserGroup/index.tsx`

- Delete: `src/routes/(main)/home/_layout/Body/UserGroup/List/GroupTopicList.tsx`

- Delete: `src/routes/(main)/home/_layout/Body/UserGroup/useGroupTopicLockCleanup.ts`

- [ ] **Step 1: Rewrite `List/index.tsx` as navigation-only**

Replace the entire content of `src/routes/(main)/home/_layout/Body/UserGroup/List/index.tsx`:

```tsx
'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { Users } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useUserGroupStore } from '@/store/userGroup/store';

const List = memo(() => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const myGroups = useUserGroupStore((s) => s.myGroups);

  const handleClick = useCallback(
    (groupId: string) => {
      navigate(`/ug/${groupId}`);
    },
    [navigate],
  );

  if (myGroups.length === 0) {
    return (
      <Flexbox align="center" justify="center" padding={16}>
        <Text fontSize={12} type="secondary">
          {t('navPanel.noUserGroup')}
        </Text>
      </Flexbox>
    );
  }

  return (
    <Flexbox gap={2}>
      {myGroups.map((item) => (
        <Flexbox
          horizontal
          align="center"
          gap={8}
          key={item.group.id}
          onClick={() => handleClick(item.group.id)}
          style={{
            borderRadius: 8,
            cursor: 'pointer',
            padding: '8px 12px',
          }}
        >
          <Users size={14} />
          <Text ellipsis style={{ fontSize: 13 }}>
            {item.group.name}
          </Text>
        </Flexbox>
      ))}
    </Flexbox>
  );
});

export default List;
```

- [ ] **Step 2: Remove lock cleanup from home sidebar**

In `src/routes/(main)/home/_layout/Body/UserGroup/index.tsx`, remove the import and call of `useGroupTopicLockCleanup`:

Remove line 11:

```ts
import { useGroupTopicLockCleanup } from './useGroupTopicLockCleanup';
```

Remove line 21:

```ts
useGroupTopicLockCleanup();
```

- [ ] **Step 3: Delete migrated files**

```bash
rm src/routes/(main)/home/_layout/Body/UserGroup/List/GroupTopicList.tsx
rm src/routes/(main)/home/_layout/Body/UserGroup/useGroupTopicLockCleanup.ts
```

- [ ] **Step 4: Verify no broken imports**

```bash
bun run type-check
```

Expected: PASS — `GroupTopicList` is no longer imported anywhere; `useGroupTopicLockCleanup` moved to `/ug/_layout/`.

- [ ] **Step 5: Commit**

```bash
git add src/routes/(main)/home/_layout/Body/UserGroup/
git commit -m "refactor(home): simplify user group sidebar to navigation-only"
```

---

### Task 11: Integration Verification

- [ ] **Step 1: Full type-check**

```bash
bun run type-check
```

Expected: PASS

- [ ] **Step 2: Start dev server and verify route loads**

```bash
bun run dev:spa
```

Open browser, navigate to `/ug/test-group-id`. Verify:

- The layout renders (sidebar + main area)

- No console errors about missing modules

- The empty state text appears ("选择左侧话题开始对话")

- [ ] **Step 3: Verify home sidebar navigation**

Navigate to `/`. In the left sidebar, under "我的用户组", click a group name. Verify:

- Browser navigates to `/ug/:groupId`

- The sidebar shows the group header with name

- The topic list area appears (empty if no topics)

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(ug): integration fixes for user group chat page"
```
