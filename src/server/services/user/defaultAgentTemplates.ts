import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { and, eq, inArray } from 'drizzle-orm';

import { agents } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

export const DEFAULT_AGENT_TEMPLATES_PATH = path.resolve(
  process.cwd(),
  'docs/agent-templates/agent-templates.json',
);

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

interface AgentTemplateManifest {
  agents: AgentTemplate[];
}

const readDefaultAgentTemplates = async () => {
  const raw = await readFile(DEFAULT_AGENT_TEMPLATES_PATH, 'utf8');
  const parsed = JSON.parse(raw) as AgentTemplateManifest;

  return parsed.agents;
};

export const seedDefaultAgentTemplates = async (db: LobeChatDatabase, userId: string) => {
  const templates = await readDefaultAgentTemplates();
  if (templates.length === 0) return 0;

  const existingAgents = await db.query.agents.findMany({
    columns: { slug: true },
    where: and(
      eq(agents.userId, userId),
      inArray(
        agents.slug,
        templates.map((item) => item.slug),
      ),
    ),
  });

  const existingSlugs = new Set(existingAgents.map((item) => item.slug).filter(Boolean));
  const agentsToCreate = templates.filter((item) => !existingSlugs.has(item.slug));

  if (agentsToCreate.length === 0) return 0;

  await db
    .insert(agents)
    .values(
      agentsToCreate.map((item) => ({
        avatar: item.avatar,
        backgroundColor: item.backgroundColor,
        description: item.description,
        openingMessage: item.openingMessage,
        openingQuestions: item.openingQuestions,
        slug: item.slug,
        systemRole: item.systemRole,
        tags: item.tags,
        title: item.title,
        userId,
      })),
    )
    .onConflictDoNothing({
      target: [agents.slug, agents.userId],
    });

  return agentsToCreate.length;
};
