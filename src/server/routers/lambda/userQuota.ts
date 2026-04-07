import { z } from 'zod';

import { UserQuotaModel } from '@/database/models/userQuota';
import { authedProcedure, rbacProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

const userQuotaManageProcedure = rbacProcedure('user:manage')
  .use(serverDatabase)
  .use(async (opts) => {
    const { ctx } = opts;

    return opts.next({
      ctx: { userQuotaModel: new UserQuotaModel(ctx.serverDB, ctx.userId) },
    });
  });

const userQuotaQueryProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: { userQuotaModel: new UserQuotaModel(ctx.serverDB, ctx.userId) },
  });
});

export const userQuotaRouter = router({
  getMyQuota: userQuotaQueryProcedure.query(async ({ ctx }) => {
    return ctx.userQuotaModel.getUserQuota();
  }),

  getUserQuota: userQuotaManageProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.userQuotaModel.getUserQuota(input.userId);
    }),

  listUserQuota: userQuotaManageProcedure
    .input(
      z
        .object({
          keyword: z.string().optional(),
          limit: z.number().int().min(1).max(100).optional(),
          offset: z.number().int().min(0).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return ctx.userQuotaModel.listUserQuota(input);
    }),

  setUserQuota: userQuotaManageProcedure
    .input(
      z.object({
        maxFileSizeMB: z
          .number()
          .int()
          .min(1)
          .max(1024 * 1024),
        maxVectorCount: z.number().int().min(1).max(10_000_000),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.userQuotaModel.setUserQuota(input);
    }),
});

export type UserQuotaRouter = typeof userQuotaRouter;
