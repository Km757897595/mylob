# Auto Seed Agent Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every newly registered user and every existing signed-in user automatically has the bundled 23 agent templates without requiring the manual seed script.

**Architecture:** Keep the current Better Auth registration hook as the primary bootstrap path, and add an idempotent backfill call to the authenticated `user.getUserState` initialization flow. Reuse the existing template seeding service, but make its template loading cheap and deterministic so repeated checks are safe.

**Tech Stack:** Better Auth database hooks, tRPC lambda router, Drizzle database access, Vitest.

---

### Task 1: Cover login-time template backfill with tests

**Files:**

- Modify: `src/server/routers/lambda/__tests__/user.test.ts`

- Test: `src/server/routers/lambda/__tests__/user.test.ts`

- [ ] **Step 1: Add a failing test for template backfill during `getUserState`**

```ts
it('should ensure bundled agent templates before returning user state', async () => {
  const mockSeed = vi.fn().mockResolvedValue(23);
  vi.mocked(seedDefaultAgentTemplates).mockImplementation(mockSeed);

  await userRouter.createCaller({ ...mockCtx }).getUserState();

  expect(mockSeed).toHaveBeenCalledWith(serverDB, mockUserId);
});
```

- [ ] **Step 2: Run the router test to verify it fails**

Run: `bunx vitest run --silent='passed-only' 'src/server/routers/lambda/__tests__/user.test.ts'`
Expected: FAIL because `seedDefaultAgentTemplates` is not called inside `getUserState`.

- [ ] **Step 3: Keep the rest of the existing `getUserState` assertions intact**

```ts
expect(result).toMatchObject({
  isOnboard: true,
  userId: mockUserId,
});
```

- [ ] **Step 4: Re-run after implementation and expect green**

Run: `bunx vitest run --silent='passed-only' 'src/server/routers/lambda/__tests__/user.test.ts'`
Expected: PASS

### Task 2: Cover template loader reuse and idempotency

**Files:**

- Modify: `src/server/services/user/defaultAgentTemplates.test.ts`

- Test: `src/server/services/user/defaultAgentTemplates.test.ts`

- [ ] **Step 1: Add a failing test that repeated ensure calls do not require repeated file parsing**

```ts
it('should reuse loaded bundled templates across multiple calls', async () => {
  await seedDefaultAgentTemplates(db, 'user-1');
  await seedDefaultAgentTemplates(db, 'user-2');

  expect(mockReadFile).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the service test to verify it fails**

Run: `bunx vitest run --silent='passed-only' 'src/server/services/user/defaultAgentTemplates.test.ts'`
Expected: FAIL because the current implementation reads the JSON file on every call.

- [ ] **Step 3: Keep the existing insert/idempotency assertions**

```ts
expect(createdCount).toBe(2);
expect(onConflictDoNothing).toHaveBeenCalled();
```

- [ ] **Step 4: Re-run after implementation and expect green**

Run: `bunx vitest run --silent='passed-only' 'src/server/services/user/defaultAgentTemplates.test.ts'`
Expected: PASS

### Task 3: Implement minimal production changes

**Files:**

- Modify: `src/server/routers/lambda/user.ts`

- Modify: `src/server/services/user/defaultAgentTemplates.ts`

- [ ] **Step 1: Reuse the existing seeding service in `getUserState`**

```ts
await seedDefaultAgentTemplates(ctx.serverDB, ctx.userId);
```

- [ ] **Step 2: Keep the call before user state aggregation so first-load state sees the templates**

```ts
const [state, messageCount, hasExtraSession, referralStatus, subscriptionPlan] =
  await Promise.all([...]);
```

- [ ] **Step 3: Memoize template file loading in the service**

```ts
let templatePromise: Promise<AgentTemplate[]> | undefined;

const readDefaultAgentTemplates = async () => {
  templatePromise ??= readFile(DEFAULT_AGENT_TEMPLATES_PATH, 'utf8').then((raw) => {
    const parsed = JSON.parse(raw) as AgentTemplateManifest;
    return parsed.agents;
  });

  return templatePromise;
};
```

- [ ] **Step 4: Preserve existing idempotency guarantees**

```ts
.onConflictDoNothing({
  target: [agents.slug, agents.userId],
});
```

### Task 4: Verify targeted behavior

**Files:**

- Test: `src/server/services/user/defaultAgentTemplates.test.ts`

- Test: `src/server/routers/lambda/__tests__/user.test.ts`

- [ ] **Step 1: Run template service tests**

Run: `bunx vitest run --silent='passed-only' 'src/server/services/user/defaultAgentTemplates.test.ts'`
Expected: PASS

- [ ] **Step 2: Run user router tests**

Run: `bunx vitest run --silent='passed-only' 'src/server/routers/lambda/__tests__/user.test.ts'`
Expected: PASS

- [ ] **Step 3: Run both together as a final confidence check**

Run: `bunx vitest run --silent='passed-only' 'src/server/services/user/defaultAgentTemplates.test.ts' 'src/server/routers/lambda/__tests__/user.test.ts'`
Expected: PASS
