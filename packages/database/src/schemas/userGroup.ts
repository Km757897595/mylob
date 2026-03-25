import { index, integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';

import { idGenerator } from '../utils/idGenerator';
import { createdAt, timestamps } from './_helpers';
import { users } from './user';

// ============ 用户组表 ============
export const userGroups = pgTable(
  'user_groups',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('userGroups'))
      .primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    parentId: text('parent_id'), // 支持层级结构（自引用）
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    sort: integer('sort'),
    ...timestamps,
  },
  (t) => [
    index('user_groups_created_by_idx').on(t.createdBy),
    index('user_groups_parent_id_idx').on(t.parentId),
  ],
);

export type NewUserGroup = typeof userGroups.$inferInsert;
export type UserGroupItem = typeof userGroups.$inferSelect;

// ============ 用户组成员表 ============
export const userGroupMembers = pgTable(
  'user_group_members',
  {
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    groupId: text('group_id')
      .references(() => userGroups.id, { onDelete: 'cascade' })
      .notNull(),
    role: text('role').default('member').notNull(), // 'group_admin' | 'member'
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.groupId] }),
    index('user_group_members_user_id_idx').on(t.userId),
    index('user_group_members_group_id_idx').on(t.groupId),
  ],
);

export type NewUserGroupMember = typeof userGroupMembers.$inferInsert;
