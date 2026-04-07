import { asc, desc, eq, inArray } from 'drizzle-orm';

import { userGroupMembers, userGroups } from '../schemas/userGroup';
import { userGroupManagers } from '../schemas/userGroupManager';
import type { LobeChatDatabase } from '../type';

export class UserGroupScopeModel {
  private db: LobeChatDatabase;
  private userId: string;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  private expandDescendants = async (seedGroupIds: string[]) => {
    const visited = new Set(seedGroupIds);
    const queue = [...seedGroupIds];

    for (const parentId of queue) {
      const children = await this.db
        .select({ id: userGroups.id })
        .from(userGroups)
        .where(eq(userGroups.parentId, parentId));

      for (const child of children) {
        if (!visited.has(child.id)) {
          visited.add(child.id);
          queue.push(child.id);
        }
      }
    }

    return [...visited].sort();
  };

  getMemberGroupIds = async () => {
    const rows = await this.db
      .select({ groupId: userGroupMembers.groupId })
      .from(userGroupMembers)
      .where(eq(userGroupMembers.userId, this.userId));

    return [...new Set(rows.map((row) => row.groupId))].sort();
  };

  getManagedGroupIds = async () => {
    const rows = await this.db
      .select({ groupId: userGroupManagers.groupId })
      .from(userGroupManagers)
      .where(eq(userGroupManagers.userId, this.userId));

    return this.expandDescendants(rows.map((row) => row.groupId));
  };

  getVisibleGroupIds = async () => {
    const [memberGroupIds, managedGroupIds] = await Promise.all([
      this.getMemberGroupIds(),
      this.getManagedGroupIds(),
    ]);

    return [...new Set([...memberGroupIds, ...managedGroupIds])].sort();
  };

  canViewGroup = async (groupId: string) => {
    const visibleGroupIds = await this.getVisibleGroupIds();

    return visibleGroupIds.includes(groupId);
  };

  listVisibleGroups = async () => {
    const visibleGroupIds = await this.getVisibleGroupIds();

    if (visibleGroupIds.length === 0) return [];

    return this.db
      .select()
      .from(userGroups)
      .where(inArray(userGroups.id, visibleGroupIds))
      .orderBy(asc(userGroups.sort), desc(userGroups.createdAt));
  };
}
