// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerDB } from '@/database/core/db-adaptor';
import { getTestDB } from '@/database/core/getTestDB';
import {
  topicLocks,
  topics,
  userGroupManagers,
  userGroupMembers,
  userGroups,
  users,
} from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import { userGroupRouter } from '../userGroup';

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

const serverDB: LobeChatDatabase = await getTestDB();

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getServerDB).mockResolvedValue(serverDB as any);

  await serverDB.delete(topicLocks);
  await serverDB.delete(topics);
  await serverDB.delete(userGroupManagers);
  await serverDB.delete(userGroupMembers);
  await serverDB.delete(userGroups);
  await serverDB.delete(users);
});

afterEach(async () => {
  await serverDB.delete(topicLocks);
  await serverDB.delete(topics);
  await serverDB.delete(userGroupManagers);
  await serverDB.delete(userGroupMembers);
  await serverDB.delete(userGroups);
  await serverDB.delete(users);
});

describe('userGroupRouter access control', () => {
  it('lists all group topics for a same-group member', async () => {
    await serverDB.insert(users).values([{ id: 'member-user' }, { id: 'creator-user' }]);
    await serverDB.insert(userGroups).values([{ id: 'ug_root', name: 'Root Group' }]);
    await serverDB.insert(userGroupMembers).values({
      groupId: 'ug_root',
      role: 'member',
      userId: 'member-user',
    });
    await serverDB.insert(topics).values({
      id: 'topic-shared',
      title: 'Shared Topic',
      userGroupId: 'ug_root',
      userId: 'creator-user',
    });

    const caller = userGroupRouter.createCaller({ userId: 'member-user' } as any);
    const result = await caller.getGroupTopics({ groupId: 'ug_root' });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('topic-shared');
  });

  it('allows a manager to view descendant group topics', async () => {
    await serverDB.insert(users).values([{ id: 'manager-user' }, { id: 'creator-user' }]);
    await serverDB.insert(userGroups).values([
      { id: 'ug_root', name: 'Root Group' },
      { id: 'ug_child', name: 'Child Group', parentId: 'ug_root' },
    ]);
    await serverDB.insert(userGroupManagers).values({
      groupId: 'ug_root',
      userId: 'manager-user',
    });
    await serverDB.insert(topics).values({
      id: 'topic-child',
      title: 'Child Topic',
      userGroupId: 'ug_child',
      userId: 'creator-user',
    });

    const caller = userGroupRouter.createCaller({ userId: 'manager-user' } as any);
    const result = await caller.getGroupTopics({ groupId: 'ug_child' });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('topic-child');
  });

  it('rejects locking a topic outside the caller visibility scope', async () => {
    await serverDB.insert(users).values([{ id: 'outsider-user' }, { id: 'creator-user' }]);
    await serverDB.insert(userGroups).values([{ id: 'ug_locked', name: 'Locked Group' }]);
    await serverDB.insert(topics).values({
      id: 'topic-locked',
      title: 'Locked Topic',
      userGroupId: 'ug_locked',
      userId: 'creator-user',
    });

    const caller = userGroupRouter.createCaller({ userId: 'outsider-user' } as any);

    await expect(caller.tryLockTopic({ topicId: 'topic-locked' })).rejects.toThrow('FORBIDDEN');
  });
});
