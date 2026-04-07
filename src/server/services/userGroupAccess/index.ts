import { TRPCError } from '@trpc/server';

import { SYSTEM_DEFAULT_ROLES } from '@/const/rbac';
import { RbacModel } from '@/database/models/rbac';
import { TopicModel } from '@/database/models/topic';
import { UserGroupModel } from '@/database/models/userGroup';
import { UserGroupScopeModel } from '@/database/models/userGroupScope';
import type { UserGroupItem } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

export interface VisibleUserGroupItem {
  accessMode: 'both' | 'managed' | 'member';
  group: UserGroupItem;
  memberCount: number;
  role: string | null;
}

export class UserGroupAccessService {
  private rbacModel: RbacModel;
  private scopeModel: UserGroupScopeModel;
  private topicModel: TopicModel;
  private userGroupModel: UserGroupModel;

  constructor(
    db: LobeChatDatabase,
    private userId: string,
  ) {
    this.rbacModel = new RbacModel(db, userId);
    this.scopeModel = new UserGroupScopeModel(db, userId);
    this.topicModel = new TopicModel(db, userId);
    this.userGroupModel = new UserGroupModel(db, userId);
  }

  private isEnterpriseAdmin = async () =>
    this.rbacModel.hasRoleName(SYSTEM_DEFAULT_ROLES.ENTERPRISE_ADMIN);

  canViewGroup = async (groupId: string) => {
    if (await this.isEnterpriseAdmin()) return true;

    return this.scopeModel.canViewGroup(groupId);
  };

  assertCanViewGroup = async (groupId: string) => {
    if (!(await this.canViewGroup(groupId))) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'FORBIDDEN' });
    }
  };

  assertCanAccessTopic = async (topicId: string) => {
    const groupId = await this.topicModel.getUserGroupIdByTopicId(topicId);

    if (!groupId) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'TOPIC_NOT_FOUND' });
    }

    await this.assertCanViewGroup(groupId);
  };

  listVisibleGroups = async (): Promise<VisibleUserGroupItem[]> => {
    if (await this.isEnterpriseAdmin()) {
      const groups = await this.userGroupModel.query();
      const items = await Promise.all(
        groups.map(async (group) => ({
          accessMode: 'managed' as const,
          group,
          memberCount: (await this.userGroupModel.getGroupMembers(group.id)).length,
          role: SYSTEM_DEFAULT_ROLES.ENTERPRISE_ADMIN,
        })),
      );

      return this.sortVisibleGroups(items);
    }

    const memberGroups = await this.userGroupModel.getUserGroupsWithDetails();
    const managedGroupIds = new Set(await this.scopeModel.getManagedGroupIds());
    const visibleMap = new Map<string, VisibleUserGroupItem>(
      memberGroups.map((item) => [
        item.group.id,
        {
          accessMode: managedGroupIds.has(item.group.id) ? 'both' : 'member',
          group: item.group,
          memberCount: item.memberCount,
          role: item.role,
        },
      ]),
    );

    const visibleGroups = await this.scopeModel.listVisibleGroups();

    for (const group of visibleGroups) {
      if (!managedGroupIds.has(group.id) || visibleMap.has(group.id)) continue;

      visibleMap.set(group.id, {
        accessMode: 'managed',
        group,
        memberCount: (await this.userGroupModel.getGroupMembers(group.id)).length,
        role: null,
      });
    }

    return this.sortVisibleGroups([...visibleMap.values()]);
  };

  private sortVisibleGroups = (items: VisibleUserGroupItem[]) =>
    [...items].sort(
      (left, right) =>
        (left.group.sort ?? Number.MAX_SAFE_INTEGER) -
          (right.group.sort ?? Number.MAX_SAFE_INTEGER) ||
        right.group.createdAt.getTime() - left.group.createdAt.getTime(),
    );
}
