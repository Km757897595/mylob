import { describe, expect, it } from 'vitest';

import { OFFLINE_VOICE_CATALOG, type VoiceCatalogItem } from './catalog';
import { filterVoiceCatalog } from './filters';

describe('OFFLINE_VOICE_CATALOG', () => {
  it('should include exactly two offline fallback entries', () => {
    expect(OFFLINE_VOICE_CATALOG).toHaveLength(2);
    expect(OFFLINE_VOICE_CATALOG.map((item) => item.voiceId)).toEqual([
      'offline-male',
      'offline-female',
    ]);
    expect(OFFLINE_VOICE_CATALOG.map((item) => item.service)).toEqual(['offline', 'offline']);
    expect(OFFLINE_VOICE_CATALOG.map((item) => item.gender)).toEqual(['male', 'female']);
  });
});

describe('filterVoiceCatalog', () => {
  const catalog: VoiceCatalogItem[] = [
    {
      gender: 'neutral',
      label: 'Alloy',
      locale: 'en-US',
      service: 'openai',
      style: 'general',
      timbre: 'clear',
      voiceId: 'alloy',
    },
    {
      gender: 'male',
      label: 'Echo',
      locale: 'en-US',
      service: 'openai',
      style: 'narration',
      timbre: 'deep',
      voiceId: 'echo',
    },
    {
      gender: 'female',
      label: 'Edge One',
      locale: 'en-GB',
      service: 'edge',
      style: 'narration',
      timbre: 'warm',
      voiceId: 'edge-1',
    },
  ];

  it('should return full catalog when filters are empty', () => {
    expect(filterVoiceCatalog(catalog, {})).toEqual(catalog);
  });

  it('should treat empty array filters as no filter', () => {
    expect(filterVoiceCatalog(catalog, { service: [] })).toEqual(catalog);
  });

  it('should support array-based include filters', () => {
    expect(filterVoiceCatalog(catalog, { service: ['openai', 'edge'] })).toEqual(catalog);
  });

  it('should apply multiple filters together', () => {
    const result = filterVoiceCatalog(catalog, {
      gender: 'male',
      locale: 'en-US',
      service: 'openai',
      style: 'narration',
      timbre: 'deep',
    });

    expect(result).toEqual([catalog[1]]);
  });
});
