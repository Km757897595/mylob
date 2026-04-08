export type TTSServer = 'openai' | 'edge' | 'microsoft' | 'offline';

export type OfflineVoice = 'female' | 'male';

export interface VoiceCatalogSelection {
  gender?: 'female' | 'male' | 'neutral' | 'unknown';
  label: string;
  locale?: string;
  service: TTSServer;
  style?: string;
  timbre?: 'bright' | 'calm' | 'clear' | 'deep' | 'unknown' | 'warm';
  voiceId: string;
}

export interface OfflineTTSConfig {
  enabled: boolean;
  fallbackVoice: OfflineVoice;
  preferOfflineWhenUnavailable: boolean;
}

export interface LobeAgentTTSConfig {
  inheritGlobal?: boolean;
  offline?: OfflineTTSConfig;
  selectedVoice?: VoiceCatalogSelection;
  showAllLocaleVoice?: boolean;
  sttLocale: 'auto' | string;
  ttsService: TTSServer;
  voice: {
    edge?: string;
    microsoft?: string;
    openai: string;
  };
}
