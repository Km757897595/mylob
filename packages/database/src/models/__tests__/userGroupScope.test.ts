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
