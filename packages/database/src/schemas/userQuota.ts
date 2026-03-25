import { integer, pgTable, text } from 'drizzle-orm/pg-core';

import { timestamps } from './_helpers';
import { users } from './user';

export const userQuotas = pgTable('user_quotas', {
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .primaryKey(),
  maxFileSizeMB: integer('max_file_size_mb').default(500).notNull(),
  maxVectorCount: integer('max_vector_count').default(10000).notNull(),
  currentFileSizeMB: integer('current_file_size_mb').default(0).notNull(),
  currentVectorCount: integer('current_vector_count').default(0).notNull(),
  ...timestamps,
});

export type NewUserQuota = typeof userQuotas.$inferInsert;
export type UserQuotaItem = typeof userQuotas.$inferSelect;
