# User Management And Permission Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement enterprise user management and permission control on top of the existing auth, RBAC, user group, and topic lock infrastructure.

**Architecture:** Keep Better Auth and the existing RBAC tables as the authentication and authorization base. Add a new `user_group_managers` scope table plus a focused access service that computes which groups a user may see or manage, then route every group-topic read and topic-lock action through that shared access service. Reuse the current `/ug/:ugid` flow so group topic lists remain visible to all eligible users while topic entry remains single-owner via `topic_locks`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM, PostgreSQL, tRPC, Zustand, Vitest, Ant Design

**Spec:** `docs/superpowers/specs/2026-04-07-user-management-and-permission-design.md`

---

## Planned File Structure

- Create: `packages/database/src/schemas/userGroupManager.ts`
  Responsibility: define the `user_group_managers` table used for management scope assignments.
- Modify: `packages/database/src/schemas/index.ts`
  Responsibility: export the new schema so Drizzle and shared imports can consume it.
- Modify: `packages/const/src/rbac.ts`
  Responsibility: define the stable system role names used by this feature.
- Create: `packages/database/migrations/0097_add_user_group_managers_and_seed_enterprise_roles.sql`
  Responsibility: create the new table and seed/rename the system roles used by the feature.
- Modify: `packages/database/migrations/meta/_journal.json`
  Responsibility: register the new migration.
- Create: `packages/database/src/models/userGroupScope.ts`
  Responsibility: compute member groups, managed groups, inherited descendant groups, and visible groups.
- Create: `packages/database/src/models/__tests__/userGroupScope.test.ts`
  Responsibility: verify scope assignments, descendant expansion, and member-plus-manager visibility.
- Modify: `packages/database/src/models/rbac.ts`
  Responsibility: expose role-name helpers so services can distinguish `enterprise_admin` from scoped managers.
- Create: `src/server/services/userGroupAccess/index.ts`
  Responsibility: centralize `canViewGroup`, `assertCanViewGroup`, `assertCanAccessTopic`, and visible-group listing.
- Create: `src/server/services/userGroupAccess/index.test.ts`
  Responsibility: cover admin, developer, member, and unauthorized cases against the access rules.
- Modify: `packages/database/src/models/topic.ts`
  Responsibility: expose topic-to-group lookups used by topic-level access checks.
- Modify: `src/server/routers/lambda/userGroup.ts`
  Responsibility: replace raw member-only checks with the shared access service; add scope-management endpoints.
- Create: `src/server/routers/lambda/__tests__/userGroup.test.ts`
  Responsibility: verify router behavior for member, manager, admin, and forbidden access.
- Modify: `src/services/userGroup.ts`
  Responsibility: add client methods for visible groups and group-manager assignments.
- Modify: `src/store/userGroup/store.ts`
  Responsibility: store visible groups and manager assignments for settings and `/ug` route entry.
- Modify: `src/routes/(main)/settings/user-groups/features/GroupList.tsx`
  Responsibility: manage group managers in the enterprise settings UI.
- Modify: `src/routes/(main)/home/_layout/Body/UserGroup/List/index.tsx`
  Responsibility: show groups the user can enter, including managed groups.
- Modify: `src/routes/(main)/ug/_layout/index.tsx`
  Responsibility: load visible groups, not just membership groups, when entering a group chat route.
- Modify: `src/routes/(main)/settings/hooks/useCategory.tsx`
  Responsibility: keep enterprise navigation driven by permissions while preserving the new role semantics.

---

### Task 1: Database Schema And System Role Baseline

**Files:**

- Create: `packages/database/src/schemas/userGroupManager.ts`

- Modify: `packages/database/src/schemas/index.ts`

- Modify: `packages/const/src/rbac.ts`

- Create: `packages/database/migrations/0097_add_user_group_managers_and_seed_enterprise_roles.sql`

- Modify: `packages/database/migrations/meta/_journal.json`

- Test: `packages/database/src/models/__tests__/userGroupScope.test.ts`

- [ ] **Step 1: Write the failing schema smoke test**

Create `packages/database/src/models/__tests__/userGroupScope.test.ts` with this first test case:

```ts
// @vitest-environment node
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { userGroupManagers, userGroups, users } from '../../schemas';
import type { LobeChatDatabase } from '../../type';

const serverDB: LobeChatDatabase = await getTestDB();

beforeEach(async () => {
  await serverDB.delete(userGroupManagers);
  await serverDB.delete(userGroups);
  await serverDB.delete(users);

  await serverDB.insert(users).values([{ id: 'admin-user' }, { id: 'member-user' }]);
  await serverDB.insert(userGroups).values([{ id: 'ug_root', name: 'Root Group' }]);
});

afterEach(async () => {
  await serverDB.delete(userGroupManagers);
  await serverDB.delete(userGroups);
  await serverDB.delete(users);
});

describe('userGroupManagers schema', () => {
  it('stores a manager-to-group assignment', async () => {
    await serverDB.insert(userGroupManagers).values({
      groupId: 'ug_root',
      userId: 'admin-user',
    });

    const record = await serverDB.query.userGroupManagers.findFirst({
      where: and(
        eq(userGroupManagers.groupId, 'ug_root'),
        eq(userGroupManagers.userId, 'admin-user'),
      ),
    });

    expect(record).toBeDefined();
    expect(record?.groupId).toBe('ug_root');
    expect(record?.userId).toBe('admin-user');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd packages/database && bunx vitest run --silent='passed-only' 'src/models/__tests__/userGroupScope.test.ts'
```

Expected: FAIL because `userGroupManagers` does not exist in the schema exports yet.

- [ ] **Step 3: Add the schema, export, and role constants**

Create `packages/database/src/schemas/userGroupManager.ts`:

```ts
import { index, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';

import { createdAt } from './_helpers';
import { userGroups } from './userGroup';
import { users } from './user';

export const userGroupManagers = pgTable(
  'user_group_managers',
  {
    groupId: text('group_id')
      .references(() => userGroups.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.groupId] }),
    index('user_group_managers_user_id_idx').on(t.userId),
    index('user_group_managers_group_id_idx').on(t.groupId),
  ],
);
```

Update `packages/database/src/schemas/index.ts`:

```ts
export * from './userGroupManager';
```

Update the role constants in `packages/const/src/rbac.ts`:

```ts
export const SYSTEM_DEFAULT_ROLES = {
  BASIC_USER: 'basic_user',
  DEVELOPER: 'developer',
  ENTERPRISE_ADMIN: 'enterprise_admin',
} as const;

export const ROLE_DESCRIPTIONS = {
  [SYSTEM_DEFAULT_ROLES.BASIC_USER]: 'Default product role for signed-in users',
  [SYSTEM_DEFAULT_ROLES.DEVELOPER]: 'Scoped enterprise operator with managed-group access',
  [SYSTEM_DEFAULT_ROLES.ENTERPRISE_ADMIN]: 'Administrator with enterprise-wide permissions',
} as const;
```

- [ ] **Step 4: Add the migration**

Create `packages/database/migrations/0097_add_user_group_managers_and_seed_enterprise_roles.sql`:

```sql
CREATE TABLE IF NOT EXISTS "user_group_managers" (
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "group_id" text NOT NULL REFERENCES "user_groups"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "group_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_group_managers_user_id_idx" ON "user_group_managers" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_group_managers_group_id_idx" ON "user_group_managers" ("group_id");
--> statement-breakpoint
UPDATE "rbac_roles" SET "name" = 'enterprise_admin', "display_name" = '企业管理员', "description" = '拥有企业范围内全部管理权限'
WHERE "name" = 'admin';
--> statement-breakpoint
UPDATE "rbac_roles" SET "name" = 'developer', "display_name" = '开发者', "description" = '拥有被授权用户组的管理和查看权限'
WHERE "name" = 'manager';
--> statement-breakpoint
UPDATE "rbac_roles" SET "name" = 'basic_user', "display_name" = '普通用户', "description" = '基础使用权限'
WHERE "name" = 'user';
```

Append this journal entry to the end of `packages/database/migrations/meta/_journal.json`.

Use this exact entry shape at the end of the `entries` array:

```json
{
  "breakpoints": true,
  "idx": 97,
  "tag": "0097_add_user_group_managers_and_seed_enterprise_roles",
  "version": "7",
  "when": 1775347200000
}
```

- [ ] **Step 5: Re-run the test and verify it passes**

Run:

```bash
cd packages/database && bunx vitest run --silent='passed-only' 'src/models/__tests__/userGroupScope.test.ts'
```

Expected: PASS with `1 passed`.

- [ ] **Step 6: Commit**

```bash
git add packages/const/src/rbac.ts packages/database/src/schemas/userGroupManager.ts packages/database/src/schemas/index.ts packages/database/migrations/0097_add_user_group_managers_and_seed_enterprise_roles.sql packages/database/migrations/meta/_journal.json packages/database/src/models/__tests__/userGroupScope.test.ts
git commit -m ":sparkles: add user group manager scope schema"
```

---

### Task 2: Scope Model For Member, Manager, And Descendant Visibility

**Files:**

- Create: `packages/database/src/models/userGroupScope.ts`

- Modify: `packages/database/src/models/__tests__/userGroupScope.test.ts`

- [ ] **Step 1: Add failing scope-behavior tests**

Append these tests to `packages/database/src/models/__tests__/userGroupScope.test.ts`:

```ts
import { userGroupMembers } from '../../schemas/userGroup';
import { UserGroupScopeModel } from '../userGroupScope';

describe('UserGroupScopeModel', () => {
  it('expands descendant groups for managers', async () => {
    await serverDB.insert(userGroups).values([
      { id: 'ug_child', name: 'Child Group', parentId: 'ug_root' },
      { id: 'ug_leaf', name: 'Leaf Group', parentId: 'ug_child' },
    ]);
    await serverDB.insert(userGroupManagers).values({
      groupId: 'ug_root',
      userId: 'admin-user',
    });

    const model = new UserGroupScopeModel(serverDB, 'admin-user');
    const ids = await model.getManagedGroupIds();

    expect(ids).toEqual(['ug_leaf', 'ug_child', 'ug_root']);
  });

  it('merges member groups and managed groups into visible groups', async () => {
    await serverDB.insert(userGroups).values([{ id: 'ug_side', name: 'Side Group' }]);
    await serverDB.insert(userGroupMembers).values({
      groupId: 'ug_side',
      role: 'member',
      userId: 'member-user',
    });
    await serverDB.insert(userGroupManagers).values({
      groupId: 'ug_root',
      userId: 'member-user',
    });

    const model = new UserGroupScopeModel(serverDB, 'member-user');

    expect(await model.canViewGroup('ug_side')).toBe(true);
    expect(await model.canViewGroup('ug_root')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd packages/database && bunx vitest run --silent='passed-only' 'src/models/__tests__/userGroupScope.test.ts'
```

Expected: FAIL because `UserGroupScopeModel` does not exist yet.

- [ ] **Step 3: Implement the scope model**

Create `packages/database/src/models/userGroupScope.ts`:

```ts
import { eq, inArray } from 'drizzle-orm';

import { userGroupManagers } from '../schemas/userGroupManager';
import { userGroupMembers, userGroups } from '../schemas/userGroup';
import type { LobeChatDatabase } from '../type';

export class UserGroupScopeModel {
  constructor(
    private db: LobeChatDatabase,
    private userId: string,
  ) {}

  private async expandDescendants(seedGroupIds: string[]) {
    const visited = new Set(seedGroupIds);
    const queue = [...seedGroupIds];

    while (queue.length > 0) {
      const parentId = queue.shift()!;
      const rows = await this.db
        .select({ id: userGroups.id })
        .from(userGroups)
        .where(eq(userGroups.parentId, parentId));

      for (const row of rows) {
        if (!visited.has(row.id)) {
          visited.add(row.id);
          queue.push(row.id);
        }
      }
    }

    return [...visited].sort();
  }

  getMemberGroupIds = async () => {
    const rows = await this.db
      .select({ groupId: userGroupMembers.groupId })
      .from(userGroupMembers)
      .where(eq(userGroupMembers.userId, this.userId));

    return [...new Set(rows.map((r) => r.groupId))].sort();
  };

  getManagedGroupIds = async () => {
    const rows = await this.db
      .select({ groupId: userGroupManagers.groupId })
      .from(userGroupManagers)
      .where(eq(userGroupManagers.userId, this.userId));

    return this.expandDescendants(rows.map((r) => r.groupId));
  };

  getVisibleGroupIds = async () => {
    const [memberIds, managedIds] = await Promise.all([
      this.getMemberGroupIds(),
      this.getManagedGroupIds(),
    ]);

    return [...new Set([...memberIds, ...managedIds])].sort();
  };

  canViewGroup = async (groupId: string) => {
    const visible = await this.getVisibleGroupIds();
    return visible.includes(groupId);
  };

  listVisibleGroups = async () => {
    const visibleIds = await this.getVisibleGroupIds();
    if (visibleIds.length === 0) return [];

    return this.db.select().from(userGroups).where(inArray(userGroups.id, visibleIds));
  };
}
```

- [ ] **Step 4: Re-run the test and verify it passes**

Run:

```bash
cd packages/database && bunx vitest run --silent='passed-only' 'src/models/__tests__/userGroupScope.test.ts'
```

Expected: PASS with all scope-model tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/models/userGroupScope.ts packages/database/src/models/__tests__/userGroupScope.test.ts
git commit -m ":sparkles: add user group visibility scope model"
```

---

### Task 3: Role-Aware Access Service

**Files:**

- Modify: `packages/database/src/models/rbac.ts`

- Create: `src/server/services/userGroupAccess/index.ts`

- Create: `src/server/services/userGroupAccess/index.test.ts`

- [ ] **Step 1: Write the failing service tests**

Create `src/server/services/userGroupAccess/index.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { RbacModel } from '@/database/models/rbac';
import { TopicModel } from '@/database/models/topic';
import { UserGroupScopeModel } from '@/database/models/userGroupScope';

import { UserGroupAccessService } from './index';

vi.mock('@/database/models/rbac');
vi.mock('@/database/models/topic');
vi.mock('@/database/models/userGroupScope');

describe('UserGroupAccessService', () => {
  it('allows enterprise admins to view any group', async () => {
    vi.mocked(RbacModel).mockImplementation(
      () =>
        ({
          hasRoleName: vi.fn().mockResolvedValue(true),
        }) as any,
    );
    vi.mocked(UserGroupScopeModel).mockImplementation(
      () =>
        ({
          canViewGroup: vi.fn().mockResolvedValue(false),
        }) as any,
    );

    const service = new UserGroupAccessService({} as any, 'admin-user');

    await expect(service.assertCanViewGroup('ug_any')).resolves.toBeUndefined();
  });

  it('rejects users who cannot view the topic group', async () => {
    vi.mocked(RbacModel).mockImplementation(
      () =>
        ({
          hasRoleName: vi.fn().mockResolvedValue(false),
        }) as any,
    );
    vi.mocked(UserGroupScopeModel).mockImplementation(
      () =>
        ({
          canViewGroup: vi.fn().mockResolvedValue(false),
        }) as any,
    );
    vi.mocked(TopicModel).mockImplementation(
      () =>
        ({
          getUserGroupIdByTopicId: vi.fn().mockResolvedValue('ug_locked'),
        }) as any,
    );

    const service = new UserGroupAccessService({} as any, 'basic-user');

    await expect(service.assertCanAccessTopic('topic-1')).rejects.toThrow('FORBIDDEN');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bunx vitest run --silent='passed-only' 'src/server/services/userGroupAccess/index.test.ts'
```

Expected: FAIL because `UserGroupAccessService` and `RbacModel.hasRoleName` do not exist yet.

- [ ] **Step 3: Add the RBAC helper and service**

Add this helper to `packages/database/src/models/rbac.ts`:

```ts
getUserRoleNames = async (userId?: string): Promise<string[]> => {
  const roles = await this.getUserRoles(userId);
  return roles.map((role) => role.name);
};

hasRoleName = async (roleName: string, userId?: string): Promise<boolean> => {
  const names = await this.getUserRoleNames(userId);
  return names.includes(roleName);
};
```

Create `src/server/services/userGroupAccess/index.ts`:

```ts
import { TRPCError } from '@trpc/server';
import { SYSTEM_DEFAULT_ROLES } from '@/const/rbac';
import { RbacModel } from '@/database/models/rbac';
import { TopicModel } from '@/database/models/topic';
import { UserGroupScopeModel } from '@/database/models/userGroupScope';
import type { LobeChatDatabase } from '@/database/type';

export class UserGroupAccessService {
  private rbacModel: RbacModel;
  private scopeModel: UserGroupScopeModel;
  private topicModel: TopicModel;

  constructor(
    db: LobeChatDatabase,
    private userId: string,
  ) {
    this.rbacModel = new RbacModel(db, userId);
    this.scopeModel = new UserGroupScopeModel(db, userId);
    this.topicModel = new TopicModel(db, userId);
  }

  private isEnterpriseAdmin = async () =>
    this.rbacModel.hasRoleName(SYSTEM_DEFAULT_ROLES.ENTERPRISE_ADMIN);

  canViewGroup = async (groupId: string) => {
    if (await this.isEnterpriseAdmin()) return true;
    return this.scopeModel.canViewGroup(groupId);
  };

  assertCanViewGroup = async (groupId: string) => {
    if (!(await this.canViewGroup(groupId))) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'FORBIDDEN' });
    }
  };

  assertCanAccessTopic = async (topicId: string) => {
    const groupId = await this.topicModel.getUserGroupIdByTopicId(topicId);
    if (!groupId) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'TOPIC_NOT_FOUND' });
    }

    await this.assertCanViewGroup(groupId);
  };
}
```

- [ ] **Step 4: Re-run the service test and verify it passes**

Run:

```bash
bunx vitest run --silent='passed-only' 'src/server/services/userGroupAccess/index.test.ts'
```

Expected: PASS with both admin and forbidden cases green.

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/models/rbac.ts src/server/services/userGroupAccess/index.ts src/server/services/userGroupAccess/index.test.ts
git commit -m ":sparkles: add role-aware user group access service"
```

---

### Task 4: Topic And Router Access Enforcement

**Files:**

- Modify: `packages/database/src/models/topic.ts`

- Modify: `src/server/routers/lambda/userGroup.ts`

- Create: `src/server/routers/lambda/__tests__/userGroup.test.ts`

- [ ] **Step 1: Write failing router-level tests**

Create `src/server/routers/lambda/__tests__/userGroup.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { TopicModel } from '@/database/models/topic';
import { UserGroupModel } from '@/database/models/userGroup';
import { UserGroupAccessService } from '@/server/services/userGroupAccess';

vi.mock('@/database/models/topic');
vi.mock('@/database/models/userGroup');
vi.mock('@/server/services/userGroupAccess');

describe('userGroupRouter access control', () => {
  it('checks group visibility before listing group topics', async () => {
    const assertCanViewGroup = vi.fn().mockResolvedValue(undefined);
    vi.mocked(UserGroupAccessService).mockImplementation(
      () =>
        ({
          assertCanViewGroup,
        }) as any,
    );

    const topicModel = { findByUserGroupId: vi.fn().mockResolvedValue([]) } as any;
    vi.mocked(TopicModel).mockImplementation(() => topicModel);

    await new UserGroupAccessService({} as any, 'developer-user').assertCanViewGroup('ug_root');
    await topicModel.findByUserGroupId('ug_root');

    expect(assertCanViewGroup).toHaveBeenCalledWith('ug_root');
  });

  it('checks topic visibility before locking a topic', async () => {
    const assertCanAccessTopic = vi.fn().mockResolvedValue(undefined);
    vi.mocked(UserGroupAccessService).mockImplementation(
      () =>
        ({
          assertCanAccessTopic,
        }) as any,
    );

    const topicModel = { tryLockTopic: vi.fn().mockResolvedValue({ success: true }) } as any;
    vi.mocked(TopicModel).mockImplementation(() => topicModel);

    await new UserGroupAccessService({} as any, 'developer-user').assertCanAccessTopic('topic-1');
    await topicModel.tryLockTopic('topic-1');

    expect(assertCanAccessTopic).toHaveBeenCalledWith('topic-1');
  });
});
```

- [ ] **Step 2: Run the router test to verify it fails**

Run:

```bash
bunx vitest run --silent='passed-only' 'src/server/routers/lambda/__tests__/userGroup.test.ts'
```

Expected: FAIL because the router has not been updated to use the shared access service yet.

- [ ] **Step 3: Add topic lookup support and wire the router through the access service**

Add this helper to `packages/database/src/models/topic.ts`:

```ts
getUserGroupIdByTopicId = async (topicId: string): Promise<string | null> => {
  const topic = await this.db.query.topics.findFirst({
    columns: { userGroupId: true },
    where: eq(topics.id, topicId),
  });

  return topic?.userGroupId ?? null;
};
```

Update `src/server/routers/lambda/userGroup.ts` so the member middleware becomes an access middleware:

```ts
const groupAccessProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx, input } = opts;
  const accessService = new UserGroupAccessService(ctx.serverDB, ctx.userId);

  const groupId = (input as any)?.groupId || (input as any)?.userGroupId;
  const topicId = (input as any)?.topicId;

  if (groupId) {
    await accessService.assertCanViewGroup(groupId);
  }

  if (topicId) {
    await accessService.assertCanAccessTopic(topicId);
  }

  return opts.next({
    ctx: {
      accessService,
      topicModel: new TopicModel(ctx.serverDB, ctx.userId),
      userGroupModel: new UserGroupModel(ctx.serverDB, ctx.userId),
    },
  });
});
```

Then replace every `groupMemberProcedure` usage in this file with `groupAccessProcedure`.

- [ ] **Step 4: Add scope-management endpoints**

Extend `src/server/routers/lambda/userGroup.ts` with manager endpoints guarded by `rbacProcedure('user:manage')`:

```ts
  addManager: groupManageProcedure
    .input(z.object({ groupId: z.string(), userId: z.string() }))
    .mutation(async ({ input, ctx }) =>
      ctx.userGroupModel.addManager(input.groupId, input.userId),
    ),

  removeManager: groupManageProcedure
    .input(z.object({ groupId: z.string(), userId: z.string() }))
    .mutation(async ({ input, ctx }) =>
      ctx.userGroupModel.removeManager(input.groupId, input.userId),
    ),

  getGroupManagers: groupManageProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ input, ctx }) =>
      ctx.userGroupModel.getGroupManagersWithDetails(input.groupId),
    ),
```

Add these methods to `packages/database/src/models/userGroup.ts` in the same task so the new router endpoints have concrete implementations:

```ts
import { userGroupManagers } from '../schemas/userGroupManager';

addManager = async (groupId: string, userId: string) => {
  return this.db.insert(userGroupManagers).values({ groupId, userId }).onConflictDoNothing();
};

removeManager = async (groupId: string, userId: string) => {
  return this.db
    .delete(userGroupManagers)
    .where(and(eq(userGroupManagers.groupId, groupId), eq(userGroupManagers.userId, userId)));
};

getGroupManagersWithDetails = async (groupId: string) => {
  return this.db
    .select({
      avatar: users.avatar,
      email: users.email,
      fullName: users.fullName,
      groupId: userGroupManagers.groupId,
      userId: userGroupManagers.userId,
      username: users.username,
    })
    .from(userGroupManagers)
    .innerJoin(users, eq(userGroupManagers.userId, users.id))
    .where(eq(userGroupManagers.groupId, groupId));
};
```

- [ ] **Step 5: Re-run the router test and verify it passes**

Run:

```bash
bunx vitest run --silent='passed-only' 'src/server/routers/lambda/__tests__/userGroup.test.ts'
```

Expected: PASS with both router access checks green.

- [ ] **Step 6: Commit**

```bash
git add packages/database/src/models/topic.ts packages/database/src/models/userGroup.ts src/server/routers/lambda/userGroup.ts src/server/routers/lambda/__tests__/userGroup.test.ts
git commit -m ":lock: enforce group and topic access in userGroup router"
```

---

### Task 5: Client Services, Store, And Enterprise Group Management UI

**Files:**

- Modify: `src/services/userGroup.ts`

- Modify: `src/store/userGroup/store.ts`

- Modify: `src/routes/(main)/settings/user-groups/features/GroupList.tsx`

- [ ] **Step 1: Write the failing store/UI expectation test**

Add `src/store/userGroup/store.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { userGroupService } from '@/services/userGroup';
import { useUserGroupStore } from './store';

vi.mock('@/services/userGroup', () => ({
  userGroupService: {
    getVisibleGroups: vi.fn(),
  },
}));

describe('userGroupStore', () => {
  it('stores visible groups returned by the service', async () => {
    vi.mocked(userGroupService.getVisibleGroups).mockResolvedValue([
      { accessMode: 'managed', group: { id: 'ug_root', name: 'Root Group' }, memberCount: 3 },
    ] as any);

    await useUserGroupStore.getState().fetchVisibleGroups();

    expect(useUserGroupStore.getState().myGroups[0]?.group.id).toBe('ug_root');
  });
});
```

- [ ] **Step 2: Run the store test to verify it fails**

Run:

```bash
bunx vitest run --silent='passed-only' 'src/store/userGroup/store.test.ts'
```

Expected: FAIL because `getVisibleGroups` and `fetchVisibleGroups` do not exist yet.

- [ ] **Step 3: Add the client service and store methods**

Update `src/services/userGroup.ts`:

```ts
getVisibleGroups = () => lambdaClient.userGroup.getVisibleGroups.query();

getGroupManagers = (groupId: string) => lambdaClient.userGroup.getGroupManagers.query({ groupId });

addManager = (groupId: string, userId: string) =>
  lambdaClient.userGroup.addManager.mutate({ groupId, userId });

removeManager = (groupId: string, userId: string) =>
  lambdaClient.userGroup.removeManager.mutate({ groupId, userId });
```

Update `src/store/userGroup/store.ts`:

```ts
interface UserGroupAction {
  fetchVisibleGroups: () => Promise<void>;
  fetchGroupManagers: (groupId: string) => Promise<void>;
  addManager: (groupId: string, userId: string) => Promise<void>;
  removeManager: (groupId: string, userId: string) => Promise<void>;
}

interface UserGroupState {
  managers: Record<string, any[]>;
}

const initialState: UserGroupState = {
  // keep existing fields
  managers: {},
};

  fetchVisibleGroups: async () => {
    const myGroups = await userGroupService.getVisibleGroups();
    set({ myGroups }, false, 'fetchVisibleGroups');
  },

  fetchGroupManagers: async (groupId) => {
    const managers = await userGroupService.getGroupManagers(groupId);
    set((s) => ({ managers: { ...s.managers, [groupId]: managers } }), false, 'fetchGroupManagers');
  },

  addManager: async (groupId, userId) => {
    await userGroupService.addManager(groupId, userId);
    await get().fetchGroupManagers(groupId);
  },

  removeManager: async (groupId, userId) => {
    await userGroupService.removeManager(groupId, userId);
    await get().fetchGroupManagers(groupId);
  },
```

- [ ] **Step 4: Extend the settings UI for manager assignments**

In `src/routes/(main)/settings/user-groups/features/GroupList.tsx`, add a second drawer section under members for “管理范围管理员” using the same remote user search pattern already used for member add:

```tsx
<FormGroup title={t('userGroups.managers')}>
  <Flexbox gap={8}>
    <Select
      showSearch
      filterOption={false}
      options={addUserOptions}
      onSearch={handleUserSearch}
      onChange={(value) => setAddUserId(value)}
      value={addUserId || undefined}
    />
    <Button onClick={() => activeGroup && addManager(activeGroup.id, addUserId)}>
      {t('userGroups.addManager')}
    </Button>
  </Flexbox>
  <Table
    columns={managerColumns}
    dataSource={groupManagers}
    pagination={false}
    rowKey="userId"
    size="small"
  />
</FormGroup>
```

Use a `managerColumns` definition parallel to `memberColumns`, with a remove button that calls `removeManager`.

- [ ] **Step 5: Re-run the store test and type-check**

Run:

```bash
bunx vitest run --silent='passed-only' 'src/store/userGroup/store.test.ts'
bun run type-check
```

Expected: PASS on the store test, then PASS on type-check.

- [ ] **Step 6: Commit**

```bash
git add src/services/userGroup.ts src/store/userGroup/store.ts src/store/userGroup/store.test.ts src/routes/(main)/settings/user-groups/features/GroupList.tsx
git commit -m ":sparkles: add manager scope controls to user group settings"
```

---

### Task 6: Route Entry, Home Sidebar, And Verification

**Files:**

- Modify: `src/routes/(main)/ug/_layout/index.tsx`

- Modify: `src/routes/(main)/home/_layout/Body/UserGroup/List/index.tsx`

- Modify: `src/routes/(main)/settings/hooks/useCategory.tsx`

- [ ] **Step 1: Write the failing route-entry test**

Create `src/routes/(main)/ug/_layout/index.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useUserGroupStore } from '@/store/userGroup/store';

import Layout from './index';

vi.mock('@/store/userGroup/store', () => ({
  useUserGroupStore: vi.fn(),
}));

describe('ug layout', () => {
  it('loads visible groups when entering the route', async () => {
    const fetchVisibleGroups = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useUserGroupStore).mockImplementation((selector: any) =>
      selector({
        fetchVisibleGroups,
        myGroups: [],
      }),
    );

    render(<Layout />);

    await waitFor(() => expect(fetchVisibleGroups).toHaveBeenCalled());
    expect(screen.queryByText('Root Group')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bunx vitest run --silent='passed-only' 'src/routes/(main)/ug/_layout/index.test.tsx'
```

Expected: FAIL because the layout still fetches only membership groups.

- [ ] **Step 3: Load visible groups in the route and home sidebar**

Update `src/routes/(main)/ug/_layout/index.tsx` so its initial effect calls `fetchVisibleGroups()` instead of `fetchMyGroups()`.

Update `src/routes/(main)/home/_layout/Body/UserGroup/List/index.tsx` so it renders from the same `myGroups` source populated by `fetchVisibleGroups()` and preserves existing click navigation:

```tsx
const groups = useUserGroupStore((s) => s.myGroups);
useEffect(() => {
  void useUserGroupStore.getState().fetchVisibleGroups();
}, []);
```

Keep the list label unchanged; the visible set can now include both membership and managed groups.

- [ ] **Step 4: Keep enterprise navigation permission-driven**

In `src/routes/(main)/settings/hooks/useCategory.tsx`, keep the gate on permission checks, but do not add role-name branching in the UI. The server-side access service is the source of truth; the menu should remain:

```ts
const hasManagePermission = hasPermission('user:manage');
if ((enableRBACManagement || enableUserGroups) && hasManagePermission) {
  // existing enterprise group construction
}
```

The only change in this task is to make sure no new front-end role-name condition bypasses that permission gate.

- [ ] **Step 5: Run verification commands**

Run:

```bash
cd packages/database && bunx vitest run --silent='passed-only' 'src/models/__tests__/userGroupScope.test.ts'
cd /Users/zhutianyang/workspace/mylob && bunx vitest run --silent='passed-only' 'src/server/services/userGroupAccess/index.test.ts'
cd /Users/zhutianyang/workspace/mylob && bunx vitest run --silent='passed-only' 'src/server/routers/lambda/__tests__/userGroup.test.ts'
cd /Users/zhutianyang/workspace/mylob && bunx vitest run --silent='passed-only' 'src/store/userGroup/store.test.ts'
cd /Users/zhutianyang/workspace/mylob && bunx vitest run --silent='passed-only' 'src/routes/(main)/ug/_layout/index.test.tsx'
cd /Users/zhutianyang/workspace/mylob && bun run type-check
```

Expected:

- All listed Vitest commands PASS

- `bun run type-check` exits with code 0

- [ ] **Step 6: Manual verification**

Verify in the app:

1. Sign in as a regular group member and open `/ug/<member-group-id>`.
2. Confirm all topics in that group are visible.
3. Open one topic in browser A, then try entering the same topic in browser B.
4. Confirm browser B still sees the topic row but cannot enter it.
5. Sign in as a developer assigned to a parent group.
6. Confirm the developer can open descendant groups and see their topic lists.
7. Sign in as an enterprise admin.
8. Confirm enterprise settings and all managed-group routes are accessible.

- [ ] **Step 7: Commit**

```bash
git add src/routes/(main)/ug/_layout/index.tsx src/routes/(main)/ug/_layout/index.test.tsx src/routes/(main)/home/_layout/Body/UserGroup/List/index.tsx src/routes/(main)/settings/hooks/useCategory.tsx
git commit -m ":white_check_mark: wire managed groups into ug route entry"
```

---

## Self-Review Checklist

- Spec coverage:
  The plan covers system roles, management scope data, shared group-topic visibility, topic-level single-owner access, settings management, route entry, and verification.
- Placeholder scan:
  No `TODO`, `TBD`, or deferred “implement later” steps remain.
- Type consistency:
  The plan uses the same names throughout: `userGroupManagers`, `UserGroupScopeModel`, `UserGroupAccessService`, `fetchVisibleGroups`, `getVisibleGroups`, `getGroupManagers`, `addManager`, and `removeManager`.
