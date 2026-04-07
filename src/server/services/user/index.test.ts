import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserService } from './index';

const { mockIdentify, mockSeedDefaultAgentTemplates, mockTrack } = vi.hoisted(() => ({
  mockIdentify: vi.fn(),
  mockSeedDefaultAgentTemplates: vi.fn(),
  mockTrack: vi.fn(),
}));

vi.mock('@/libs/analytics', () => ({
  initializeServerAnalytics: vi.fn().mockResolvedValue({
    identify: mockIdentify,
    track: mockTrack,
  }),
}));

vi.mock('./defaultAgentTemplates', () => ({
  seedDefaultAgentTemplates: mockSeedDefaultAgentTemplates,
}));

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initUser', () => {
    it('should seed bundled agent templates for newly created users', async () => {
      const db = {} as any;
      const service = new UserService(db);

      await service.initUser({
        email: 'user@example.com',
        id: 'new-user-id',
        username: 'new-user',
      });

      expect(mockSeedDefaultAgentTemplates).toHaveBeenCalledWith(db, 'new-user-id');
      expect(mockIdentify).toHaveBeenCalledWith(
        'new-user-id',
        expect.objectContaining({ email: 'user@example.com', username: 'new-user' }),
      );
      expect(mockTrack).toHaveBeenCalled();
    });
  });
});
