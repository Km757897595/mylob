import { VoiceList } from '@lobehub/tts';

import type { TTSServer } from '@/types/agent';

export type VoiceGender = 'female' | 'male' | 'neutral' | 'unknown';
export type VoiceTimbre = 'bright' | 'calm' | 'clear' | 'deep' | 'unknown' | 'warm';

export interface VoiceCatalogItem {
  gender?: VoiceGender;
  label: string;
  locale?: string;
  service: TTSServer;
  style?: string;
  timbre?: VoiceTimbre;
  voiceId: string;
}

interface VoiceOptionLike {
  label?: unknown;
  value: string | number;
}

const OPENAI_VOICE_META: Record<
  string,
  Pick<VoiceCatalogItem, 'gender' | 'locale' | 'style' | 'timbre'>
> = {
  alloy: { gender: 'neutral', locale: 'en-US', style: 'balanced', timbre: 'clear' },
  ash: { gender: 'male', locale: 'en-US', style: 'casual', timbre: 'deep' },
  ballad: { gender: 'female', locale: 'en-US', style: 'storytelling', timbre: 'warm' },
  coral: { gender: 'female', locale: 'en-US', style: 'friendly', timbre: 'bright' },
  echo: { gender: 'male', locale: 'en-US', style: 'serious', timbre: 'deep' },
  fable: { gender: 'male', locale: 'en-US', style: 'narration', timbre: 'warm' },
  nova: { gender: 'female', locale: 'en-US', style: 'assistant', timbre: 'bright' },
  onyx: { gender: 'male', locale: 'en-US', style: 'formal', timbre: 'deep' },
  sage: { gender: 'neutral', locale: 'en-US', style: 'calm', timbre: 'calm' },
  shimmer: { gender: 'female', locale: 'en-US', style: 'assistant', timbre: 'clear' },
  verse: { gender: 'female', locale: 'en-US', style: 'poetic', timbre: 'warm' },
};

const isVoiceOption = (option: unknown): option is VoiceOptionLike =>
  !!option && typeof option === 'object' && 'value' in option;

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const normalizeVoiceLabel = (voiceId: string, label?: unknown): string => {
  if (typeof label === 'string' && label.length > 0) return label;

  return voiceId.split(/[-_]/).filter(Boolean).map(capitalize).join(' ');
};

const extractLocaleFromVoiceId = (voiceId: string): string | undefined => {
  const matched = voiceId.match(/[a-z]{2}-[A-Z]{2}/);
  return matched?.[0];
};

const mapVoiceOptions = (
  service: TTSServer,
  options: unknown[] = [],
  metadata?: Record<string, Pick<VoiceCatalogItem, 'gender' | 'locale' | 'style' | 'timbre'>>,
) =>
  options.filter(isVoiceOption).map((option) => {
    const voiceId = String(option.value);
    const meta = metadata?.[voiceId];

    return {
      gender: meta?.gender,
      label: normalizeVoiceLabel(voiceId, option.label),
      locale: meta?.locale || extractLocaleFromVoiceId(voiceId),
      service,
      style: meta?.style,
      timbre: meta?.timbre,
      voiceId,
    } satisfies VoiceCatalogItem;
  });

export const OFFLINE_VOICE_CATALOG = [
  {
    gender: 'male',
    label: 'Offline Male',
    service: 'offline',
    voiceId: 'offline-male',
  },
  {
    gender: 'female',
    label: 'Offline Female',
    service: 'offline',
    voiceId: 'offline-female',
  },
] as const satisfies VoiceCatalogItem[];

export const buildVoiceCatalog = (lang?: string): VoiceCatalogItem[] => {
  const voiceList = new VoiceList(lang);
  const onlineCatalog = [
    ...mapVoiceOptions('openai', VoiceList.openaiVoiceOptions as unknown[], OPENAI_VOICE_META),
    ...mapVoiceOptions('edge', voiceList.edgeVoiceOptions as unknown[]),
    ...mapVoiceOptions('microsoft', voiceList.microsoftVoiceOptions as unknown[]),
  ];
  const deduplicated = new Map<string, VoiceCatalogItem>();

  [...onlineCatalog, ...OFFLINE_VOICE_CATALOG].forEach((item) => {
    const key = `${item.service}:${item.voiceId}`;
    if (!deduplicated.has(key)) deduplicated.set(key, item);
  });

  return [...deduplicated.values()];
};
