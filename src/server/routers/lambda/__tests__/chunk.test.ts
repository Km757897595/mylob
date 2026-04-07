import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { chunkRouter } from '@/server/routers/lambda/chunk';

const mockChunkCountByFileId = vi.fn();
const mockAsyncEmbeddingFileChunks = vi.fn();
const mockAssertVectorCreationWithinQuota = vi.fn();

vi.mock('@lobechat/utils/server', () => ({
  getXorPayload: vi.fn().mockReturnValue({}),
}));

vi.mock('@/database/models/chunk', () => ({
  ChunkModel: vi.fn(() => ({
    countByFileId: mockChunkCountByFileId,
  })),
}));

vi.mock('@/database/models/userQuota', () => ({
  UserQuotaModel: vi.fn(() => ({
    assertVectorCreationWithinQuota: mockAssertVectorCreationWithinQuota,
  })),
}));

vi.mock('@/server/globalConfig', () => ({
  getServerDefaultFilesConfig: vi.fn(),
}));

vi.mock('@/server/modules/ModelRuntime', () => ({
  initModelRuntimeFromDB: vi.fn(),
}));

vi.mock('@/server/services/document', () => ({
  DocumentService: vi.fn(() => ({})),
}));

vi.mock('@/server/services/chunk', () => ({
  ChunkService: vi.fn(() => ({
    asyncEmbeddingFileChunks: mockAsyncEmbeddingFileChunks,
  })),
}));

function createCallerWithCtx(partialCtx: any = {}) {
  const ctx = {
    authorizationHeader: 'encoded-key-vaults',
    serverDB: {},
    userId: 'test-user',
    ...partialCtx,
  };

  return { caller: chunkRouter.createCaller(ctx), ctx };
}

describe('chunkRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertVectorCreationWithinQuota.mockResolvedValue(undefined);
    mockAsyncEmbeddingFileChunks.mockResolvedValue('async-task-id');
    mockChunkCountByFileId.mockResolvedValue(12);
  });

  describe('createEmbeddingChunksTask', () => {
    it('should reject when vector quota would be exceeded before task creation', async () => {
      const { caller } = createCallerWithCtx();
      mockAssertVectorCreationWithinQuota.mockRejectedValue(
        new TRPCError({ code: 'FORBIDDEN', message: 'VECTOR_QUOTA_EXCEEDED' }),
      );

      await expect(caller.createEmbeddingChunksTask({ id: 'file-id' })).rejects.toThrow(
        'VECTOR_QUOTA_EXCEEDED',
      );
      expect(mockAsyncEmbeddingFileChunks).not.toHaveBeenCalled();
      expect(mockAssertVectorCreationWithinQuota).toHaveBeenCalledWith(12);
    });
  });
});
