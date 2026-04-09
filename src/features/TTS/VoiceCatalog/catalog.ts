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
