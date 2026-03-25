import { z } from 'zod';

import { RbacModel } from '@/database/models/rbac';
import { UserModel } from '@/database/models/user';
import { authedProcedure, rbacProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

// 管理操作：需要 user:manage 权限
const rbacManageProcedure = rbacProcedure('user:manage')
  .use(serverDatabase)
  .use(async (opts) => {
    const { ctx } = opts;
    return opts.next({
      ctx: { rbacModel: new RbacModel(ctx.serverDB, ctx.userId) },
    });
  });

// 只读查询：任何已认证用户可查自己的权限
const rbacQueryProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;
  return opts.next({
    ctx: { rbacModel: new RbacModel(ctx.serverDB, ctx.userId) },
  });
});

export const rbacRouter = router({
  // 查自己的权限（任何用户可用）
  getMyPermissions: rbacQueryProcedure.query(async ({ ctx }) => {
    return ctx.rbacModel.getUserPermissionDetails();
  }),

  getMyRoles: rbacQueryProcedure.query(async ({ ctx }) => {
    return ctx.rbacModel.getUserRoles();
  }),

  // 以下需 user:manage 权限
  getRoles: rbacManageProcedure.query(async ({ ctx }) => {
    return ctx.rbacModel.getAllRoles();
  }),

  getPermissions: rbacManageProcedure.query(async ({ ctx }) => {
    return ctx.rbacModel.getAllPermissions();
  }),

  getUserPermissions: rbacManageProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.rbacModel.getUserPermissionDetails(input.userId);
    }),

  assignRole: rbacManageProcedure
    .input(z.object({ roleIds: z.array(z.string()), userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.rbacModel.updateUserRoles(input.userId, input.roleIds);
    }),

  searchUsers: rbacManageProcedure
    .input(
      z.object({ keyword: z.string().min(1), limit: z.number().int().min(1).max(50).optional() }),
    )
    .query(async ({ input, ctx }) =>
      UserModel.searchUsers(ctx.serverDB, input.keyword, input.limit),
    ),
});

export type RbacRouter = typeof rbacRouter;
