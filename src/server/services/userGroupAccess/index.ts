import { TRPCError } from '@trpc/server';

import { SYSTEM_DEFAULT_ROLES } from '@/const/rbac';
import { RbacModel } from '@/database/models/rbac';
import { TopicModel } from '@/database/models/topic';
import { UserGroupScopeModel } from '@/database/models/userGroupScope';
import type { LobeChatDatabase } from '@/database/type';

export class UserGroupAccessService {
  private rbacModel: RbacModel;
  private scopeModel: UserGroupScopeModel;
  private topicModel: TopicModel;

  constructor(
    db: LobeChatDatabase,
    private userId: string,
  ) {
    this.rbacModel = new RbacModel(db, userId);
    this.scopeModel = new UserGroupScopeModel(db, userId);
    this.topicModel = new TopicModel(db, userId);
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
}
