import { index, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';

import { createdAt } from './_helpers';
import { userGroups } from './userGroup';
import { users } from './user';

export const userGroupManagers = pgTable(
  'user_group_managers',
  {
    groupId: text('group_id')
      .references(() => userGroups.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.groupId] }),
    index('user_group_managers_user_id_idx').on(t.userId),
    index('user_group_managers_group_id_idx').on(t.groupId),
  ],
);
