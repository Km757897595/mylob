import { ENABLE_BUSINESS_FEATURES } from '@lobechat/business-const';
import {
  type EdgeSpeechOptions,
  type MicrosoftSpeechOptions,
  type OpenAITTSOptions,
  type TTSOptions,
} from '@lobehub/tts/react';
import { useEdgeSpeech, useMicrosoftSpeech, useOpenAITTS } from '@lobehub/tts/react';
import isEqual from 'fast-deep-equal';

import { useBusinessTTSProvider } from '@/business/client/hooks/useBusinessTTSProvider';
import { useOfflineTTS } from '@/hooks/useOfflineTTS';
import { createHeaderWithOpenAI } from '@/services/_header';
import { API_ENDPOINTS } from '@/services/_url';
import { useAgentStore } from '@/store/agent';
import { agentSelectors } from '@/store/agent/selectors';
import { useGlobalStore } from '@/store/global';
import { globalGeneralSelectors } from '@/store/global/selectors';
import { useUserStore } from '@/store/user';
import { settingsSelectors } from '@/store/user/selectors';
import { type TTSServer } from '@/types/agent';

interface TTSConfig extends TTSOptions {
  onUpload?: (currentVoice: string, arraybuffers: ArrayBuffer[]) => void;
  server?: TTSServer;
  voice?: string;
}

export const useTTS = (content: string, config?: TTSConfig) => {
  const ttsSettings = useUserStore(settingsSelectors.currentTTS, isEqual);
  const ttsAgentSettings = useAgentStore(
    agentSelectors.currentAgentTTSWithGlobal(ttsSettings),
    isEqual,
  );
  const lang = useGlobalStore(globalGeneralSelectors.currentLanguage);
  const voice = useAgentStore(agentSelectors.currentAgentTTSVoiceWithGlobal(lang, ttsSettings));
  const businessTTSProvider = useBusinessTTSProvider();
  const resolvedService = config?.server || ttsAgentSettings.ttsService;
  const resolvedVoice = config?.voice || voice;
  const resolvedOfflineVoice =
    config?.server === 'offline' && config?.voice
      ? config.voice
      : ttsAgentSettings.offline?.fallbackVoice === 'male'
        ? 'offline-male'
        : 'offline-female';
  const shouldFallbackToOffline =
    resolvedService !== 'offline' &&
    ttsAgentSettings.offline?.enabled !== false &&
    ttsAgentSettings.offline?.preferOfflineWhenUnavailable !== false;
  const offlineTTS = useOfflineTTS(content, resolvedOfflineVoice);

  const openAIOptions = {
    api: {
      headers: createHeaderWithOpenAI(),
      serviceUrl: API_ENDPOINTS.tts(ENABLE_BUSINESS_FEATURES ? businessTTSProvider : 'openai'),
    },
    options: {
      model: ttsSettings.openAI.ttsModel,
      voice: resolvedVoice,
    },
  } as OpenAITTSOptions;

  const edgeOptions = {
    api: {
      /**
       * @description client fetch
       * serviceUrl: TTS_URL.edge,
       */
    },
    options: {
      voice: resolvedVoice,
    },
  } as EdgeSpeechOptions;

  const microsoftOptions = {
    api: {
      serviceUrl: API_ENDPOINTS.microsoft,
    },
    options: {
      voice: resolvedVoice,
    },
  } as MicrosoftSpeechOptions;

  const fallbackToOffline = () => {
    if (!shouldFallbackToOffline) return;

    offlineTTS.stop();
    offlineTTS.start();
  };
  const handleError: NonNullable<TTSOptions['onError']> = (...args) => {
    config?.onError?.(...args);
    fallbackToOffline();
  };
  const handleErrorRetry: NonNullable<TTSOptions['onErrorRetry']> = (...args) => {
    config?.onErrorRetry?.(...args);
    fallbackToOffline();
  };

  // Always call provider hooks in a stable order to avoid hook-order changes when service switches.
  const openAITTS = useOpenAITTS(content, {
    ...config,
    ...openAIOptions,
    onError: handleError,
    onErrorRetry: handleErrorRetry,
    onFinish: (arraybuffers) => {
      config?.onFinish?.(arraybuffers);
      config?.onUpload?.(openAIOptions.options.voice || 'alloy', arraybuffers);
    },
  });
  const edgeTTS = useEdgeSpeech(content, {
    ...config,
    ...edgeOptions,
    onError: handleError,
    onErrorRetry: handleErrorRetry,
    onFinish: (arraybuffers) => {
      config?.onFinish?.(arraybuffers);
      config?.onUpload?.(edgeOptions.options.voice || 'alloy', arraybuffers);
    },
  });
  const microsoftTTS = useMicrosoftSpeech(content, {
    ...config,
    ...microsoftOptions,
    onError: handleError,
    onErrorRetry: handleErrorRetry,
    onFinish: (arraybuffers) => {
      config?.onFinish?.(arraybuffers);
      config?.onUpload?.(microsoftOptions.options.voice || 'alloy', arraybuffers);
    },
  });

  if (resolvedService === 'offline') {
    return offlineTTS;
  }

  switch (resolvedService) {
    case 'edge': {
      return edgeTTS;
    }
    case 'microsoft': {
      return microsoftTTS;
    }
    default: {
      return openAITTS;
    }
  }
};
