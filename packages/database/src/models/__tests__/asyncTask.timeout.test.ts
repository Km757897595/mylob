// @vitest-environment node
import { ASYNC_TASK_TIMEOUT } from '@lobechat/business-config/server';
import { AsyncTaskType } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import { getAsyncTaskTimeoutMs } from '../asyncTask';

describe('getAsyncTaskTimeoutMs', () => {
  it('should keep the default timeout for non-video async tasks', () => {
    expect(getAsyncTaskTimeoutMs(AsyncTaskType.Chunking)).toBe(ASYNC_TASK_TIMEOUT);
    expect(getAsyncTaskTimeoutMs(AsyncTaskType.Embedding)).toBe(ASYNC_TASK_TIMEOUT);
  });

  it('should allow video generation tasks to run longer than the default timeout', () => {
    expect(getAsyncTaskTimeoutMs(AsyncTaskType.VideoGeneration)).toBeGreaterThan(
      ASYNC_TASK_TIMEOUT,
    );
  });
});
