import { TRPCError } from '@trpc/server';
import { eq, ilike, or, sum } from 'drizzle-orm';

import { embeddings, files, userQuotas, users } from '../schemas';
import type { LobeChatDatabase } from '../type';

const DEFAULT_MAX_FILE_SIZE_MB = 500;
const DEFAULT_MAX_VECTOR_COUNT = 10000;
const BYTES_PER_MB = 1024 * 1024;

export interface UserQuotaInfo {
  currentFileSizeBytes: number;
  currentFileSizeMB: number;
  currentVectorCount: number;
  email?: string | null;
  fullName?: string | null;
  maxFileSizeMB: number;
  maxVectorCount: number;
  userId: string;
  username?: string | null;
}

interface SetUserQuotaParams {
  maxFileSizeMB: number;
  maxVectorCount: number;
  userId: string;
}

interface ListUserQuotaParams {
  keyword?: string;
  limit?: number;
  offset?: number;
}

const bytesToMB = (bytes: number) => Math.ceil(bytes / BYTES_PER_MB);

export class UserQuotaModel {
  private readonly userId: string;
  private readonly db: LobeChatDatabase;

  constructor(db: LobeChatDatabase, userId: string) {
    this.userId = userId;
    this.db = db;
  }

  private getUserUsage = async (targetUserId: string) => {
    const [fileUsageResult, vectorUsageResult] = await Promise.all([
      this.db
        .select({ totalSize: sum(files.size) })
        .from(files)
        .where(eq(files.userId, targetUserId)),
      this.db.$count(embeddings, eq(embeddings.userId, targetUserId)),
    ]);

    const currentFileSizeBytes = Number(fileUsageResult[0]?.totalSize ?? 0);
    const currentVectorCount = Number(vectorUsageResult);

    return {
      currentFileSizeBytes,
      currentFileSizeMB: bytesToMB(currentFileSizeBytes),
      currentVectorCount,
    };
  };

  getUserQuota = async (userId: string = this.userId): Promise<UserQuotaInfo> => {
    const [quota, user, usage] = await Promise.all([
      this.db.query.userQuotas.findFirst({ where: eq(userQuotas.userId, userId) }),
      this.db.query.users.findFirst({
        columns: { email: true, fullName: true, username: true },
        where: eq(users.id, userId),
      }),
      this.getUserUsage(userId),
    ]);

    return {
      ...usage,
      email: user?.email,
      fullName: user?.fullName,
      maxFileSizeMB: quota?.maxFileSizeMB ?? DEFAULT_MAX_FILE_SIZE_MB,
      maxVectorCount: quota?.maxVectorCount ?? DEFAULT_MAX_VECTOR_COUNT,
      userId,
      username: user?.username,
    };
  };

  setUserQuota = async ({ maxFileSizeMB, maxVectorCount, userId }: SetUserQuotaParams) => {
    await this.db
      .insert(userQuotas)
      .values({
        maxFileSizeMB,
        maxVectorCount,
        userId,
      })
      .onConflictDoUpdate({
        set: {
          maxFileSizeMB,
          maxVectorCount,
          updatedAt: new Date(),
        },
        target: userQuotas.userId,
      });

    return this.getUserQuota(userId);
  };

  listUserQuota = async ({ keyword, limit = 20, offset = 0 }: ListUserQuotaParams = {}): Promise<
    UserQuotaInfo[]
  > => {
    const trimmedKeyword = keyword?.trim();
    const matchedUsers = await this.db.query.users.findMany({
      columns: { email: true, fullName: true, id: true, username: true },
      limit,
      offset,
      where: trimmedKeyword
        ? or(
            ilike(users.username, `%${trimmedKeyword}%`),
            ilike(users.email, `%${trimmedKeyword}%`),
            ilike(users.fullName, `%${trimmedKeyword}%`),
          )
        : undefined,
    });

    return Promise.all(matchedUsers.map((user) => this.getUserQuota(user.id)));
  };

  assertFileUploadWithinQuota = async (fileSizeBytes: number, userId: string = this.userId) => {
    const quota = await this.getUserQuota(userId);
    const nextUsageBytes = quota.currentFileSizeBytes + fileSizeBytes;

    if (nextUsageBytes > quota.maxFileSizeMB * BYTES_PER_MB) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'FILE_STORAGE_QUOTA_EXCEEDED',
      });
    }
  };

  assertVectorCreationWithinQuota = async (
    additionalVectors: number,
    userId: string = this.userId,
  ) => {
    if (additionalVectors <= 0) return;

    const quota = await this.getUserQuota(userId);
    const nextVectorCount = quota.currentVectorCount + additionalVectors;

    if (nextVectorCount > quota.maxVectorCount) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'VECTOR_QUOTA_EXCEEDED',
      });
    }
  };
}
