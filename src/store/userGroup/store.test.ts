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
      {
        accessMode: 'managed',
        group: { id: 'ug_root', name: 'Root Group' },
        memberCount: 3,
        role: null,
      },
    ] as any);

    await useUserGroupStore.getState().fetchVisibleGroups();

    expect(useUserGroupStore.getState().myGroups[0]?.group.id).toBe('ug_root');
  });
});
