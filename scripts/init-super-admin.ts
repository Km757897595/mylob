#!/usr/bin/env tsx
/**
 * 超级管理员初始化脚本
 *
 * 使用方式：
 *   DATABASE_URL=postgresql://... bunx tsx scripts/init-super-admin.ts <userId>
 *
 * 说明：
 *   为指定用户赋予 admin 角色（超级管理员）。
 *   脚本幂等性强，可重复执行。
 *
 * 示例：
 *   DATABASE_URL=postgresql://postgres:password@localhost:5432/lobechat bunx tsx scripts/init-super-admin.ts user_123abc
 */

import { drizzle as nodeDrizzle } from 'drizzle-orm/node-postgres';
import { Pool as NodePool } from 'pg';

import { RbacModel } from '../packages/database/src/models/rbac';
import * as schema from '../packages/database/src/schemas';

function createDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('错误: 环境变量 DATABASE_URL 未设置');
    console.error('示例: DATABASE_URL=postgresql://postgres:password@localhost:5432/lobechat');
    process.exit(1);
  }

  const pool = new NodePool({ connectionString });
  const db = nodeDrizzle(pool, { schema });
  return { db, pool };
}

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error(
      '用法: DATABASE_URL=postgresql://... bunx tsx scripts/init-super-admin.ts <userId>',
    );
    console.error(
      '示例: DATABASE_URL=postgresql://postgres:password@localhost:5432/lobechat bunx tsx scripts/init-super-admin.ts user_123abc',
    );
    process.exit(1);
  }

  const { db, pool } = createDatabase();

  try {
    console.log(`\n正在为用户 ${userId} 初始化超级管理员权限...\n`);

    // 创建 RbacModel 实例
    const rbacModel = new RbacModel(db, userId);

    // 获取 admin 角色 ID
    const adminRole = await db.query.roles.findFirst({
      where: (roles, { eq }) => eq(roles.name, 'admin'),
    });

    if (!adminRole) {
      console.error('❌ 错误: 找不到 admin 角色。请先运行数据库迁移。');
      process.exit(1);
    }

    const adminRoleId = adminRole.id;

    // 检查用户是否已经拥有 admin 角色
    const existingRole = await db.query.userRoles.findFirst({
      where: (userRoles, { and, eq }) =>
        and(eq(userRoles.userId, userId), eq(userRoles.roleId, adminRoleId)),
    });

    if (existingRole) {
      console.log(`✓ 用户 ${userId} 已拥有 admin 角色，无需重复分配。`);
    } else {
      // 赋予 admin 角色
      await rbacModel.updateUserRoles(userId, [adminRoleId]);
      console.log(`✓ 已成功为用户 ${userId} 赋予 admin 角色（超级管理员）`);
    }

    // 显示用户的权限信息
    const userRoles = await rbacModel.getUserRoles();
    console.log(`\n用户 ${userId} 的角色信息：`);
    console.table(userRoles);

    const userPermissions = await rbacModel.getUserPermissionDetails();
    console.log(`\n用户 ${userId} 的权限信息：`);
    console.table(
      userPermissions.map((perm) => ({
        编码: perm.permissionCode,
        名称: perm.permissionName,
        分类: perm.category,
      })),
    );

    console.log('\n✅ 初始化完成！\n');
  } catch (error: any) {
    console.error('❌ 初始化失败:', error?.message || error);
    process.exit(1);
  } finally {
    // 关闭连接池
    await pool.end();
  }
}

main().catch((err) => {
  console.error('脚本执行失败:', err);
  process.exit(1);
});
