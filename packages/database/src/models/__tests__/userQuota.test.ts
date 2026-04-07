// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserQuotaModel } from '../userQuota';

describe('UserQuotaModel', () => {
  let countMock: ReturnType<typeof vi.fn>;
  let insertMock: ReturnType<typeof vi.fn>;
  let onConflictDoUpdateMock: ReturnType<typeof vi.fn>;
  let selectMock: ReturnType<typeof vi.fn>;
  let userFindFirstMock: ReturnType<typeof vi.fn>;
  let userFindManyMock: ReturnType<typeof vi.fn>;
  let userQuotaFindFirstMock: ReturnType<typeof vi.fn>;

  const createDb = () =>
    ({
      $count: countMock,
      insert: insertMock,
      query: {
        userQuotas: {
          findFirst: userQuotaFindFirstMock,
        },
        users: {
          findFirst: userFindFirstMock,
          findMany: userFindManyMock,
        },
      },
      select: selectMock,
    }) as any;

  beforeEach(() => {
    countMock = vi.fn();
    onConflictDoUpdateMock = vi.fn().mockResolvedValue(undefined);
    insertMock = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: onConflictDoUpdateMock,
      }),
    });
    selectMock = vi.fn();
    userFindFirstMock = vi.fn();
    userFindManyMock = vi.fn();
    userQuotaFindFirstMock = vi.fn();
  });

  describe('getUserQuota', () => {
    it('should return defaults with current usage when no quota row exists', async () => {
      const whereMock = vi.fn().mockResolvedValue([{ totalSize: '2097152' }]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      selectMock.mockReturnValue({ from: fromMock });
      countMock.mockResolvedValue(2);
      userQuotaFindFirstMock.mockResolvedValue(undefined);
      userFindFirstMock.mockResolvedValue({
        email: 'quota@example.com',
        fullName: 'Quota User',
        username: 'quota-user',
      });

      const model = new UserQuotaModel(createDb(), 'user-1');

      await expect(model.getUserQuota()).resolves.toMatchObject({
        currentFileSizeBytes: 2 * 1024 * 1024,
        currentFileSizeMB: 2,
        currentVectorCount: 2,
        email: 'quota@example.com',
        fullName: 'Quota User',
        maxFileSizeMB: 500,
        maxVectorCount: 10000,
        userId: 'user-1',
        username: 'quota-user',
      });
    });
  });

  describe('setUserQuota', () => {
    it('should upsert quota values for the target user', async () => {
      const savedQuota = {
        maxFileSizeMB: 128,
        maxVectorCount: 2048,
      };

      const whereMock = vi.fn().mockResolvedValue([{ totalSize: '0' }]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      selectMock.mockReturnValue({ from: fromMock });
      countMock.mockResolvedValue(0);
      userQuotaFindFirstMock.mockResolvedValue(savedQuota);
      userFindFirstMock.mockResolvedValue({
        email: 'quota@example.com',
        fullName: 'Quota User',
        username: 'quota-user',
      });

      const model = new UserQuotaModel(createDb(), 'admin-user');

      await expect(
        model.setUserQuota({ maxFileSizeMB: 128, maxVectorCount: 2048, userId: 'user-1' }),
      ).resolves.toMatchObject({
        maxFileSizeMB: 128,
        maxVectorCount: 2048,
        userId: 'user-1',
      });

      expect(insertMock).toHaveBeenCalled();
      expect(onConflictDoUpdateMock).toHaveBeenCalled();
    });
  });

  describe('listUserQuota', () => {
    it('should list matched users with quota info', async () => {
      userFindManyMock.mockResolvedValue([
        {
          email: 'quota@example.com',
          fullName: 'Quota User',
          id: 'user-1',
          username: 'quota-user',
        },
      ]);

      const whereMock = vi
        .fn()
        .mockResolvedValueOnce([{ totalSize: '1048576' }])
        .mockResolvedValueOnce([{ totalSize: '1048576' }]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      selectMock.mockReturnValue({ from: fromMock });
      countMock.mockResolvedValue(1);
      userQuotaFindFirstMock.mockResolvedValue({
        maxFileSizeMB: 32,
        maxVectorCount: 256,
      });
      userFindFirstMock.mockResolvedValue({
        email: 'quota@example.com',
        fullName: 'Quota User',
        username: 'quota-user',
      });

      const model = new UserQuotaModel(createDb(), 'admin-user');

      await expect(
        model.listUserQuota({ keyword: 'quota', limit: 10, offset: 0 }),
      ).resolves.toEqual([
        expect.objectContaining({
          currentFileSizeBytes: 1024 * 1024,
          currentFileSizeMB: 1,
          fullName: 'Quota User',
          maxFileSizeMB: 32,
          maxVectorCount: 256,
          userId: 'user-1',
          username: 'quota-user',
        }),
      ]);
    });
  });
});
