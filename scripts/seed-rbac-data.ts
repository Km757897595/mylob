/**
 * RBAC 种子数据初始化脚本
 *
 * 用途：单独补充写入 RBAC 预定义角色和权限数据（不含建表）
 *
 * 使用方式：
 *   DATABASE_URL=postgresql://... bunx tsx scripts/seed-rbac-data.ts
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { permissions, rolePermissions, roles } from '../packages/database/src/schemas/rbac';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('错误: 未设置 DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const db = drizzle(pool);

async function main() {
  console.log('\n开始写入 RBAC 种子数据...\n');

  // 1. 写入系统角色
  await db
    .insert(roles)
    .values([
      {
        id: 'role_admin',
        name: 'admin',
        displayName: '超级管理员',
        description: '拥有所有权限',
        isSystem: true,
      },
      {
        id: 'role_manager',
        name: 'manager',
        displayName: '部门管理员',
        description: '管理下属用户和查看下属话题',
        isSystem: true,
      },
      {
        id: 'role_user',
        name: 'user',
        displayName: '普通用户',
        description: '基础使用权限',
        isSystem: true,
      },
    ])
    .onConflictDoNothing();
  console.log('✓ 系统角色写入完成（admin / manager / user）');

  // 2. 写入权限
  await db
    .insert(permissions)
    .values([
      { id: 'perm_chat', code: 'chat:create', name: '创建对话', category: 'chat' },
      { id: 'perm_img', code: 'image:generate', name: '生成图片', category: 'image' },
      { id: 'perm_vid', code: 'video:generate', name: '生成视频', category: 'video' },
      { id: 'perm_kb', code: 'kb:manage', name: '管理知识库', category: 'knowledge_base' },
      { id: 'perm_user', code: 'user:manage', name: '管理用户', category: 'admin' },
      {
        id: 'perm_topic_sub',
        code: 'topic:view_subordinate',
        name: '查看下属话题',
        category: 'topic',
      },
      { id: 'perm_topic_lock', code: 'topic:lock', name: '锁定话题', category: 'topic' },
    ])
    .onConflictDoNothing();
  console.log('✓ 权限写入完成（7 个权限）');

  // 3. admin 拥有所有权限
  const allPerms = await db.select({ id: permissions.id }).from(permissions);
  if (allPerms.length > 0) {
    await db
      .insert(rolePermissions)
      .values(allPerms.map((p) => ({ roleId: 'role_admin', permissionId: p.id })))
      .onConflictDoNothing();
    console.log(`✓ admin 角色权限映射完成（${allPerms.length} 个）`);
  }

  // 4. manager 权限
  const managerPermCodes = [
    'chat:create',
    'image:generate',
    'video:generate',
    'kb:manage',
    'topic:view_subordinate',
    'topic:lock',
  ];
  const allPerms2 = await db
    .select({ id: permissions.id, code: permissions.code })
    .from(permissions);
  const managerPermIds = allPerms2.filter((p) => managerPermCodes.includes(p.code));
  if (managerPermIds.length > 0) {
    await db
      .insert(rolePermissions)
      .values(managerPermIds.map((p) => ({ roleId: 'role_manager', permissionId: p.id })))
      .onConflictDoNothing();
    console.log(`✓ manager 角色权限映射完成（${managerPermIds.length} 个）`);
  }

  // 5. user 基础权限
  const userPermCodes = ['chat:create', 'image:generate', 'video:generate', 'kb:manage'];
  const userPermIds = allPerms2.filter((p) => userPermCodes.includes(p.code));
  if (userPermIds.length > 0) {
    await db
      .insert(rolePermissions)
      .values(userPermIds.map((p) => ({ roleId: 'role_user', permissionId: p.id })))
      .onConflictDoNothing();
    console.log(`✓ user 角色权限映射完成（${userPermIds.length} 个）`);
  }

  console.log('\n✅ 种子数据写入完成！\n');
}

main()
  .catch((err) => {
    console.error('❌ 写入失败:', err?.message ?? err);
    process.exit(1);
  })
  .finally(() => pool.end());
