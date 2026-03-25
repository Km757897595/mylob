import { index, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

import { createNanoId } from '../utils/idGenerator';
import { timestamps, timestamptz } from './_helpers';
import { topics } from './topic';
import { users } from './user';
import { userGroups } from './userGroup';

// ============ 话题-组共享表 ============
export const topicGroupShares = pgTable(
  'topic_group_shares',
  {
    id: text('id')
      .$defaultFn(() => createNanoId(8)())
      .primaryKey(),
    topicId: text('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    groupId: text('group_id')
      .notNull()
      .references(() => userGroups.id, { onDelete: 'cascade' }),
    sharedBy: text('shared_by').references(() => users.id, { onDelete: 'set null' }),
    permission: text('permission').default('read').notNull(), // 'read' | 'write'
    ...timestamps,
  },
  (t) => [
    uniqueIndex('topic_group_shares_topic_group_unique').on(t.topicId, t.groupId),
    index('topic_group_shares_group_id_idx').on(t.groupId),
  ],
);

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
