import { index, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

import { timestamptz } from './_helpers';
import { topics } from './topic';
import { users } from './user';

// ============ 话题锁定表 ============
export const topicLocks = pgTable(
  'topic_locks',
  {
    topicId: text('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    lockedBy: text('locked_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lockedAt: timestamptz('locked_at').notNull().defaultNow(),
    expiresAt: timestamptz('expires_at').notNull(), // 超时自动释放
  },
  (t) => [
    uniqueIndex('topic_locks_topic_id_unique').on(t.topicId),
    index('topic_locks_locked_by_idx').on(t.lockedBy),
    index('topic_locks_expires_at_idx').on(t.expiresAt),
  ],
);
