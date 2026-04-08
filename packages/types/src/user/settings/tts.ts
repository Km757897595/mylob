import type { OfflineTTSConfig, TTSServer, VoiceCatalogSelection } from '../../agent/tts';

export type { OfflineTTSConfig, OfflineVoice, VoiceCatalogSelection } from '../../agent/tts';

export type STTServer = 'openai' | 'browser';

export interface UserTTSConfig {
  offline: OfflineTTSConfig;
  openAI: {
    sttModel: 'whisper-1';
    ttsModel: 'gpt-4o-mini-tts' | 'tts-1' | 'tts-1-hd';
  };
  selectedVoice: VoiceCatalogSelection;
  service: TTSServer;
  sttAutoStop: boolean;
  sttServer: STTServer;
}
