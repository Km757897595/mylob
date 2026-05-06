import type { UserTTSConfig } from '@lobechat/types';

export const DEFAULT_TTS_CONFIG: UserTTSConfig = {
  offline: {
    enabled: true,
    fallbackVoice: 'female',
    preferOfflineWhenUnavailable: true,
  },
  openAI: {
    sttModel: 'whisper-1',
    ttsModel: 'tts-1',
  },
  selectedVoice: {
    label: 'Offline Female',
    service: 'offline',
    voiceId: 'offline-female',
  },
  service: 'offline',
  sttAutoStop: true,
  sttServer: 'browser',
};
