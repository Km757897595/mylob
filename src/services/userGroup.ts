import { lambdaClient } from '@/libs/trpc/client';

class UserGroupService {
  // ---- 管理类（Settings 中使用，需要 user:manage 权限） ----

  getGroups = () => lambdaClient.userGroup.getGroups.query();

  createGroup = (params: { description?: string; name: string; parentId?: string }) =>
    lambdaClient.userGroup.createGroup.mutate(params);

  updateGroup = (params: { description?: string; id: string; name?: string }) =>
    lambdaClient.userGroup.updateGroup.mutate(params);

  deleteGroup = (id: string) => lambdaClient.userGroup.deleteGroup.mutate({ id });

  addMember = (groupId: string, userId: string, role?: 'group_admin' | 'member') =>
    lambdaClient.userGroup.addMember.mutate({ groupId, role, userId });

  removeMember = (groupId: string, userId: string) =>
    lambdaClient.userGroup.removeMember.mutate({ groupId, userId });

  getGroupMembersWithDetails = (groupId: string) =>
    lambdaClient.userGroup.getGroupMembersWithDetails.query({ groupId });

  getGroupManagers = (groupId: string) =>
    lambdaClient.userGroup.getGroupManagers.query({ groupId });

  addManager = (groupId: string, userId: string) =>
    lambdaClient.userGroup.addManager.mutate({ groupId, userId });

  removeManager = (groupId: string, userId: string) =>
    lambdaClient.userGroup.removeManager.mutate({ groupId, userId });

  // ---- 使用类（主界面使用，只需登录 + 组成员校验） ----

  getMyGroups = () => lambdaClient.userGroup.getMyGroups.query();

  getVisibleGroups = () => lambdaClient.userGroup.getVisibleGroups.query();

  getGroupTopics = (groupId: string, params?: { current?: number; pageSize?: number }) =>
    lambdaClient.userGroup.getGroupTopics.query({ groupId, ...params });

  createGroupTopic = (params: { agentId?: string; title: string; userGroupId: string }) =>
    lambdaClient.userGroup.createGroupTopic.mutate(params);

  tryLockTopic = (topicId: string) => lambdaClient.userGroup.tryLockTopic.mutate({ topicId });

  renewLock = (topicId: string) => lambdaClient.userGroup.renewLock.mutate({ topicId });

  releaseLock = (topicId: string) => lambdaClient.userGroup.releaseLock.mutate({ topicId });

  /**
   * sendBeacon 释放锁（浏览器关闭时使用，不走 TRPC）
   */
  releaseLockBeacon = (topicId: string) => {
    navigator.sendBeacon('/webapi/release-lock', JSON.stringify({ topicId }));
  };
}

export const userGroupService = new UserGroupService();
