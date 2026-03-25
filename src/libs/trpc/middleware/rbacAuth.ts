import { TRPCError } from '@trpc/server';

import { getServerDB } from '@/database/core/db-adaptor';
import { RbacModel } from '@/database/models/rbac';

import { trpc } from '../lambda/init';

/**
 * Factory function that creates a tRPC middleware to check if the user has a specific permission.
 * Usage: requirePermission('user:manage') returns a middleware instance.
 */
export const requirePermission = (permissionCode: string) =>
  trpc.middleware(async (opts) => {
    const { ctx } = opts;

    if (!ctx.userId) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    const serverDB = await getServerDB();
    const rbacModel = new RbacModel(serverDB, ctx.userId);
    const hasPermission = await rbacModel.hasPermission(permissionCode);

    if (!hasPermission) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Missing permission: ${permissionCode}`,
      });
    }

    return opts.next({ ctx: { userId: ctx.userId } });
  });
