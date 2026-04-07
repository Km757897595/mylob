import {
  ASYNC_TASK_TIMEOUT,
  VIDEO_GENERATION_ASYNC_TASK_TIMEOUT,
} from '@lobechat/business-config/server';
import type { UserMemoryExtractionMetadata } from '@lobechat/types';
import {
  AsyncTaskError,
  AsyncTaskErrorType,
  AsyncTaskStatus,
  AsyncTaskType,
} from '@lobechat/types';
import { and, eq, inArray, or, sql } from 'drizzle-orm';

import type { AsyncTaskSelectItem, NewAsyncTaskItem } from '../schemas';
import { asyncTasks } from '../schemas';
import type { LobeChatDatabase } from '../type';

export class AsyncTaskModel {
  private userId: string;
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase, userId: string) {
    this.userId = userId;
    this.db = db;
  }

  create = async (
    params: Pick<NewAsyncTaskItem, 'type' | 'status' | 'metadata' | 'parentId'>,
  ): Promise<string> => {
    const data = await this.db
      .insert(asyncTasks)
      .values({ ...params, userId: this.userId })
      .returning();

    return data[0].id;
  };

  delete = async (id: string) => {
    return this.db
      .delete(asyncTasks)
      .where(and(eq(asyncTasks.id, id), eq(asyncTasks.userId, this.userId)));
  };

  findById = async (id: string) => {
    return this.db.query.asyncTasks.findFirst({ where: and(eq(asyncTasks.id, id)) });
  };

  static findByInferenceId = async (db: LobeChatDatabase, inferenceId: string) => {
    return db.query.asyncTasks.findFirst({
      where: eq(asyncTasks.inferenceId, inferenceId),
    });
  };

  update(taskId: string, value: Partial<AsyncTaskSelectItem>) {
    return this.db
      .update(asyncTasks)
      .set({ ...value, updatedAt: new Date() })
      .where(and(eq(asyncTasks.id, taskId)));
  }

  findActiveByType = async (type: AsyncTaskType) => {
    return this.db.query.asyncTasks.findFirst({
      where: and(
        eq(asyncTasks.userId, this.userId),
        eq(asyncTasks.type, type),
        inArray(asyncTasks.status, [AsyncTaskStatus.Pending, AsyncTaskStatus.Processing]),
      ),
    });
  };

  incrementUserMemoryExtractionProgress = async (taskId: string) => {
    const completedExpr = sql<number>`COALESCE(((${asyncTasks.metadata}) -> 'progress' ->> 'completedTopics')::int, 0) + 1`;
    const totalExpr = sql<
      number | null
    >`((${asyncTasks.metadata}) -> 'progress' ->> 'totalTopics')::int`;

    const result = await this.db
      .update(asyncTasks)
      .set({
        metadata: sql`
          jsonb_set(
            jsonb_set(
              ${asyncTasks.metadata},
              '{progress,completedTopics}',
              to_jsonb(${completedExpr}),
              true
            ),
            '{progress,totalTopics}',
            COALESCE((${asyncTasks.metadata}) -> 'progress' -> 'totalTopics', 'null'::jsonb),
            true
          )
        `,
        status: sql`
          CASE
            WHEN ${totalExpr} IS NOT NULL AND ${completedExpr} >= ${totalExpr}
              THEN ${AsyncTaskStatus.Success}
            ELSE ${AsyncTaskStatus.Processing}
          END
        `,
        updatedAt: new Date(),
      })
      .where(and(eq(asyncTasks.id, taskId), eq(asyncTasks.userId, this.userId)))
      .returning({ metadata: asyncTasks.metadata, status: asyncTasks.status });

    return result[0];
  };

  findByIds = async (taskIds: string[], type: AsyncTaskType): Promise<AsyncTaskSelectItem[]> => {
    let chunkTasks: AsyncTaskSelectItem[] = [];

    if (taskIds.length > 0) {
      await this.checkTimeoutTasks(taskIds);
      chunkTasks = await this.db.query.asyncTasks.findMany({
        where: and(inArray(asyncTasks.id, taskIds), eq(asyncTasks.type, type)),
      });
    }

    return chunkTasks;
  };

  /**
   * Mark active tasks as error when they exceed their task-specific timeout budget.
   */
  checkTimeoutTasks = async (ids: string[]) => {
    const now = Date.now();
    const tasks = await this.db
      .select({ createdAt: asyncTasks.createdAt, id: asyncTasks.id, type: asyncTasks.type })
      .from(asyncTasks)
      .where(
        and(
          inArray(asyncTasks.id, ids),
          or(
            eq(asyncTasks.status, AsyncTaskStatus.Pending),
            eq(asyncTasks.status, AsyncTaskStatus.Processing),
          ),
        ),
      );

    const timedOutTaskIds = tasks
      .filter((task) => task.createdAt.getTime() < now - getAsyncTaskTimeoutMs(task.type))
      .map((task) => task.id);

    if (timedOutTaskIds.length > 0) {
      await this.db
        .update(asyncTasks)
        .set({
          error: new AsyncTaskError(
            AsyncTaskErrorType.Timeout,
            'task is timeout, please try again',
          ),
          status: AsyncTaskStatus.Error,
        })
        .where(inArray(asyncTasks.id, timedOutTaskIds));
    }
  };
}

export const getAsyncTaskTimeoutMs = (type: AsyncTaskType | string | null | undefined) => {
  if (type === AsyncTaskType.VideoGeneration) {
    return VIDEO_GENERATION_ASYNC_TASK_TIMEOUT;
  }

  return ASYNC_TASK_TIMEOUT;
};

export const initUserMemoryExtractionMetadata = (
  metadata?: UserMemoryExtractionMetadata,
): UserMemoryExtractionMetadata => ({
  progress: {
    completedTopics: metadata?.progress?.completedTopics ?? 0,
    totalTopics: metadata?.progress?.totalTopics ?? null,
  },
  range: metadata?.range,
  source: metadata?.source ?? 'chat_topic',
});
