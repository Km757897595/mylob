/**
 * 预置助手模板导入脚本
 *
 * 使用方式：
 *   DATABASE_URL=postgresql://... bunx tsx scripts/seed-agent-templates.ts <userId>
 *
 * 环境变量：
 *   DATABASE_URL  — PostgreSQL 连接字符串（必须）
 *   DATABASE_DRIVER — 数据库驱动，"node"（默认）或 "neon"
 *
 * 说明：
 *   为指定用户批量创建 23 个预置 AI 助手模板。
 *   userId 为目标用户的数据库 ID（管理员账号）。
 *   脚本会跳过已存在相同 slug 的助手，可安全重复执行。
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { and, eq } from 'drizzle-orm';
import { drizzle as nodeDrizzle } from 'drizzle-orm/node-postgres';
import { Pool as NodePool } from 'pg';

import * as schema from '../packages/database/src/schemas';
import { idGenerator, randomSlug } from '../packages/database/src/utils/idGenerator';

const TEMPLATES_PATH = resolve(__dirname, '../docs/agent-templates/agent-templates.json');

interface AgentTemplate {
  avatar: string;
  backgroundColor: string;
  description: string;
  openingMessage: string;
  openingQuestions: string[];
  slug: string;
  systemRole: string;
  tags: string[];
  title: string;
}

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
      '用法: DATABASE_URL=postgresql://... bunx tsx scripts/seed-agent-templates.ts <userId>',
    );
    console.error(
      '示例: DATABASE_URL=postgresql://postgres:pass@localhost:5432/lobechat bunx tsx scripts/seed-agent-templates.ts user_abc123',
    );
    process.exit(1);
  }

  const { db, pool } = createDatabase();

  // 读取模板数据
  const raw = readFileSync(TEMPLATES_PATH, 'utf-8');
  const { agents: templates } = JSON.parse(raw) as { agents: AgentTemplate[] };

  console.log(`准备为用户 ${userId} 创建 ${templates.length} 个预置助手...\n`);

  let created = 0;
  let skipped = 0;

  for (const tpl of templates) {
    try {
      // 检查是否已存在同 slug + userId 的助手（唯一约束: agents_slug_user_id_unique）
      const existing = await db.query.agents.findFirst({
        where: and(eq(schema.agents.slug, tpl.slug), eq(schema.agents.userId, userId)),
      });

      if (existing) {
        console.log(`  跳过: ${tpl.title} (slug: ${tpl.slug} 已存在)`);
        skipped++;
        continue;
      }

      await db.insert(schema.agents).values({
        id: idGenerator('agents'),
        slug: tpl.slug || randomSlug(3),
        title: tpl.title,
        description: tpl.description,
        tags: tpl.tags,
        avatar: tpl.avatar,
        backgroundColor: tpl.backgroundColor,
        systemRole: tpl.systemRole,
        openingMessage: tpl.openingMessage,
        openingQuestions: tpl.openingQuestions,
        userId,
      });

      console.log(`  创建: ${tpl.title}`);
      created++;
    } catch (error: any) {
      // slug 唯一约束冲突视为已存在
      if (error?.message?.includes('unique') || error?.code === '23505') {
        console.log(`  跳过: ${tpl.title} (已存在)`);
        skipped++;
      } else {
        console.error(`  失败: ${tpl.title} - ${error?.message}`);
      }
    }
  }

  console.log(`\n完成！创建 ${created} 个，跳过 ${skipped} 个。`);

  // 关闭连接池
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('脚本执行失败:', err);
  process.exit(1);
});
