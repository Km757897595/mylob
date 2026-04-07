import { describe, expect, it } from 'vitest';

import { createVideoInputSchema } from '@/server/routers/lambda/video';

vi.mock('@/server/modules/ModelRuntime', () => ({
  initModelRuntimeFromDB: vi.fn(),
}));

describe('createVideoInputSchema', () => {
  it('should require videoUrl when mode is v2v', () => {
    const result = createVideoInputSchema.safeParse({
      generationTopicId: 'topic-id',
      model: 'video-model',
      params: {
        mode: 'v2v',
        prompt: 'stylize this video',
        runtime: 'local',
      },
      provider: 'provider-id',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['params', 'videoUrl']);
  });

  it('should accept unified protocol params for local v2v', () => {
    const result = createVideoInputSchema.safeParse({
      generationTopicId: 'topic-id',
      model: 'video-model',
      params: {
        duration: 5,
        mode: 'v2v',
        prompt: 'stylize this video',
        resolution: '720p',
        runtime: 'local',
        videoUrl: 'https://example.com/source.mp4',
      },
      provider: 'provider-id',
    });

    expect(result.success).toBe(true);
    expect(result.data?.params).toMatchObject({
      duration: 5,
      mode: 'v2v',
      resolution: '720p',
      runtime: 'local',
      videoUrl: 'https://example.com/source.mp4',
    });
  });
});
