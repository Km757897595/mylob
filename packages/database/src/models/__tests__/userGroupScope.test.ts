// @vitest-environment node
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { roles, userGroupManagers, userGroups, users } from '../../schemas';
import { userGroupMembers } from '../../schemas/userGroup';
import type { LobeChatDatabase } from '../../type';
import { UserGroupScopeModel } from '../userGroupScope';

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

  it('renames seeded system roles to the enterprise baseline', async () => {
    const systemRoles: [string, string][] = [
      ['role_admin', 'enterprise_admin'],
      ['role_manager', 'developer'],
      ['role_user', 'basic_user'],
    ];

    for (const [id, expectedName] of systemRoles) {
      const [role] = await serverDB
        .select({ id: roles.id, name: roles.name })
        .from(roles)
        .where(eq(roles.id, id))
        .limit(1);

      expect(role).toBeDefined();
      expect(role?.name).toBe(expectedName);
    }
  });
});

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

    expect(ids).toEqual(['ug_child', 'ug_leaf', 'ug_root']);
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
