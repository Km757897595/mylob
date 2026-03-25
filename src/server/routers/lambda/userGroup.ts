import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { TopicModel } from '@/database/models/topic';
import { UserGroupModel } from '@/database/models/userGroup';
import { authedProcedure, rbacProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

// ============ 管理类 Procedure（需要 user:manage 权限，Settings 中使用） ============

const groupManageProcedure = rbacProcedure('user:manage')
  .use(serverDatabase)
  .use(async (opts) => {
    const { ctx } = opts;
    return opts.next({
      ctx: {
        userGroupModel: new UserGroupModel(ctx.serverDB, ctx.userId),
      },
    });
  });

// ============ 使用类 Procedure（只需登录 + 组成员校验，主界面使用） ============

const groupMemberProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx, input } = opts;
  const groupId = (input as any)?.groupId || (input as any)?.userGroupId;

  if (groupId) {
    const userGroupModel = new UserGroupModel(ctx.serverDB, ctx.userId);
    const isMember = await userGroupModel.isMember(groupId);
    if (!isMember) {
      throw new TRPCError({ code: 'FORBIDDEN', message: '非组成员，无法访问该用户组' });
    }
  }

  return opts.next({
    ctx: {
      topicModel: new TopicModel(ctx.serverDB, ctx.userId),
      userGroupModel: new UserGroupModel(ctx.serverDB, ctx.userId),
    },
  });
});

export const userGroupRouter = router({
  // ============ 管理类路由 ============

  addMember: groupManageProcedure
    .input(
      z.object({
        groupId: z.string(),
        role: z.enum(['group_admin', 'member']).optional(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) =>
      ctx.userGroupModel.addMember(input.groupId, input.userId, input.role),
    ),

  createGroup: groupManageProcedure
    .input(
      z.object({
        description: z.string().optional(),
        name: z.string(),
        parentId: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => ctx.userGroupModel.create(input)),

  deleteGroup: groupManageProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => ctx.userGroupModel.delete(input.id)),

  getGroupMembersWithDetails: groupManageProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ input, ctx }) => ctx.userGroupModel.getGroupMembersWithDetails(input.groupId)),

  getGroups: groupManageProcedure.query(async ({ ctx }) => ctx.userGroupModel.query()),

  removeMember: groupManageProcedure
    .input(z.object({ groupId: z.string(), userId: z.string() }))
    .mutation(async ({ input, ctx }) =>
      ctx.userGroupModel.removeMember(input.groupId, input.userId),
    ),

  updateGroup: groupManageProcedure
    .input(
      z.object({
        description: z.string().optional(),
        id: z.string(),
        name: z.string().optional(),
      }),
    )
    .mutation(async ({ input: { id, ...value }, ctx }) => ctx.userGroupModel.update(id, value)),

  // ============ 使用类路由（组成员均可访问） ============

  /**
   * 在组内创建话题
   */
  createGroupTopic: groupMemberProcedure
    .input(
      z.object({
        agentId: z.string().optional(),
        title: z.string(),
        userGroupId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => ctx.topicModel.createGroupTopic(input)),

  /**
   * 获取组内所有话题（含锁定状态 + 创建者信息）
   */
  getGroupTopics: groupMemberProcedure
    .input(
      z.object({
        current: z.number().optional(),
        groupId: z.string(),
        pageSize: z.number().optional(),
      }),
    )
    .query(async ({ input, ctx }) =>
      ctx.topicModel.findByUserGroupId(input.groupId, {
        current: input.current,
        pageSize: input.pageSize,
      }),
    ),

  /**
   * 获取当前用户所在的所有组（含组详情）
   */
  getMyGroups: groupMemberProcedure.query(async ({ ctx }) =>
    ctx.userGroupModel.getUserGroupsWithDetails(),
  ),

  /**
   * 释放话题锁定
   */
  releaseLock: groupMemberProcedure
    .input(z.object({ topicId: z.string() }))
    .mutation(async ({ input, ctx }) => ctx.topicModel.releaseLock(input.topicId)),

  /**
   * 心跳续期
   */
  renewLock: groupMemberProcedure
    .input(z.object({ topicId: z.string() }))
    .mutation(async ({ input, ctx }) => ctx.topicModel.renewLock(input.topicId)),

  /**
   * 尝试锁定话题（进入话题时调用）
   */
  tryLockTopic: groupMemberProcedure
    .input(z.object({ topicId: z.string() }))
    .mutation(async ({ input, ctx }) => ctx.topicModel.tryLockTopic(input.topicId)),
});

export type UserGroupRouter = typeof userGroupRouter;
