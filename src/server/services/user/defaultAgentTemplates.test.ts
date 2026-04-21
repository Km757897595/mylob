// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockReadFile } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: mockReadFile,
}));

const getSeedDefaultAgentTemplates = async () =>
  (await import('./defaultAgentTemplates')).seedDefaultAgentTemplates;

describe('seedDefaultAgentTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        agents: [
          {
            avatar: 'avatar-1',
            backgroundColor: '#111111',
            description: 'desc-1',
            openingMessage: 'hello-1',
            openingQuestions: ['q1'],
            slug: 'agent-1',
            systemRole: 'role-1',
            tags: ['tag-1'],
            title: 'Agent 1',
          },
          {
            avatar: 'avatar-2',
            backgroundColor: '#222222',
            description: 'desc-2',
            openingMessage: 'hello-2',
            openingQuestions: ['q2'],
            slug: 'agent-2',
            systemRole: 'role-2',
            tags: ['tag-2'],
            title: 'Agent 2',
          },
        ],
      }),
    );
  });

  it('should insert missing bundled templates for the target user', async () => {
    const seedDefaultAgentTemplates = await getSeedDefaultAgentTemplates();
    const findMany = vi.fn().mockResolvedValue([]);
    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });
    const insert = vi.fn().mockReturnValue({ values });

    const db = {
      insert,
      query: {
        agents: {
          findMany,
        },
      },
    } as any;

    const createdCount = await seedDefaultAgentTemplates(db, 'user-1');

    expect(createdCount).toBe(2);
    expect(findMany).toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith([
      expect.objectContaining({ slug: 'agent-1', userId: 'user-1' }),
      expect.objectContaining({ slug: 'agent-2', userId: 'user-1' }),
    ]);
    expect(onConflictDoNothing).toHaveBeenCalled();
  });

  it('should skip insert when all template slugs already exist', async () => {
    const seedDefaultAgentTemplates = await getSeedDefaultAgentTemplates();
    const findMany = vi.fn().mockResolvedValue([{ slug: 'agent-1' }, { slug: 'agent-2' }]);
    const values = vi.fn();
    const insert = vi.fn().mockReturnValue({ values });

    const db = {
      insert,
      query: {
        agents: {
          findMany,
        },
      },
    } as any;

    const createdCount = await seedDefaultAgentTemplates(db, 'user-1');

    expect(createdCount).toBe(0);
    expect(insert).not.toHaveBeenCalled();
  });

  it('should reuse loaded bundled templates across multiple calls', async () => {
    const seedDefaultAgentTemplates = await getSeedDefaultAgentTemplates();
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ slug: 'agent-1' }, { slug: 'agent-2' }]);
    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });
    const insert = vi.fn().mockReturnValue({ values });

    const db = {
      insert,
      query: {
        agents: {
          findMany,
        },
      },
    } as any;

    await seedDefaultAgentTemplates(db, 'user-1');
    await seedDefaultAgentTemplates(db, 'user-2');

    expect(mockReadFile).toHaveBeenCalledTimes(1);
  });
});
