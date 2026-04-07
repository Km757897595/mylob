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
