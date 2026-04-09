import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTTS } from './useTTS';

const mockUseUserStore = vi.hoisted(() => {
  const fn = vi.fn();
  (fn as any).getState = vi.fn(() => ({ settings: { keyVaults: {} } }));
  return fn;
});
const mockUseAgentStore = vi.hoisted(() => vi.fn());
const mockUseGlobalStore = vi.hoisted(() => vi.fn());
const mockUseBusinessTTSProvider = vi.hoisted(() => vi.fn());
const mockUseOfflineTTS = vi.hoisted(() => vi.fn());

const mockUseOpenAITTS = vi.hoisted(() => vi.fn());
const mockUseEdgeSpeech = vi.hoisted(() => vi.fn());
const mockUseMicrosoftSpeech = vi.hoisted(() => vi.fn());

vi.mock('@/store/user', () => ({
  useUserStore: mockUseUserStore,
}));

vi.mock('@/store/agent', () => ({
  useAgentStore: mockUseAgentStore,
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: mockUseGlobalStore,
}));

vi.mock('@/business/client/hooks/useBusinessTTSProvider', () => ({
  useBusinessTTSProvider: mockUseBusinessTTSProvider,
}));

vi.mock('@/hooks/useOfflineTTS', () => ({
  useOfflineTTS: mockUseOfflineTTS,
}));

vi.mock('@/store/user/selectors', () => ({
  settingsSelectors: {
    currentTTS: vi.fn((s: any) => s.tts),
  },
}));

vi.mock('@/store/agent/selectors', () => ({
  agentSelectors: {
    currentAgentTTSWithGlobal: vi.fn(() => (s: any) => s.tts),
    currentAgentTTSVoiceWithGlobal: vi.fn(() => (s: any) => s.voice),
  },
}));

vi.mock('@/store/global/selectors', () => ({
  globalGeneralSelectors: {
    currentLanguage: vi.fn((s: any) => s.language),
  },
}));

vi.mock('@lobehub/tts/react', () => ({
  useEdgeSpeech: mockUseEdgeSpeech,
  useMicrosoftSpeech: mockUseMicrosoftSpeech,
  useOpenAITTS: mockUseOpenAITTS,
}));

describe('useTTS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOfflineTTS.mockReturnValue({
      audio: undefined,
      isGlobalLoading: false,
      response: undefined,
      setText: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    });
  });

  it('should pass the resolved provider voice to onUpload', () => {
    const onUpload = vi.fn();
    mockUseUserStore.mockImplementation((selector) =>
      selector({
        tts: {
          openAI: { ttsModel: 'tts-1' },
        },
      }),
    );
    mockUseAgentStore.mockImplementation((selector) =>
      selector({
        tts: {
          offline: {
            enabled: true,
            fallbackVoice: 'female',
            preferOfflineWhenUnavailable: true,
          },
          ttsService: 'openai',
        },
        voice: 'nova',
      }),
    );
    mockUseGlobalStore.mockImplementation((selector) =>
      selector({
        language: 'en-US',
      }),
    );
    mockUseBusinessTTSProvider.mockReturnValue('openai');
    mockUseOpenAITTS.mockImplementation((_content, options) => {
      options?.onFinish?.([]);

      return {
        audio: undefined,
        isGlobalLoading: false,
        response: undefined,
        setText: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
    });

    renderHook(() => useTTS('hello', { onUpload }));

    expect(onUpload).toHaveBeenCalledWith('nova', []);
  });

  it('should route to offline hook when offline is selected', () => {
    const offlineStart = vi.fn();
    const offlineStop = vi.fn();
    mockUseOfflineTTS.mockReturnValue({
      audio: undefined,
      isGlobalLoading: false,
      response: undefined,
      setText: vi.fn(),
      start: offlineStart,
      stop: offlineStop,
    });
    mockUseUserStore.mockImplementation((selector) =>
      selector({
        tts: {
          openAI: { ttsModel: 'tts-1' },
        },
      }),
    );
    mockUseAgentStore.mockImplementation((selector) =>
      selector({
        tts: {
          offline: {
            enabled: true,
            fallbackVoice: 'female',
            preferOfflineWhenUnavailable: true,
          },
          ttsService: 'offline',
        },
        voice: 'alloy',
      }),
    );
    mockUseGlobalStore.mockImplementation((selector) =>
      selector({
        language: 'en-US',
      }),
    );
    mockUseBusinessTTSProvider.mockReturnValue('openai');

    const { result } = renderHook(() => useTTS('hello'));

    expect(mockUseOfflineTTS).toHaveBeenCalledWith('hello', 'offline-female');
    expect(result.current.isGlobalLoading).toBe(false);
    expect(result.current.start).toBe(offlineStart);
    expect(result.current.stop).toBe(offlineStop);
  });

  it('should fallback to offline speech when online provider errors', () => {
    const offlineStart = vi.fn();
    mockUseOfflineTTS.mockReturnValue({
      audio: undefined,
      isGlobalLoading: false,
      response: undefined,
      setText: vi.fn(),
      start: offlineStart,
      stop: vi.fn(),
    });
    mockUseUserStore.mockImplementation((selector) =>
      selector({
        tts: {
          openAI: { ttsModel: 'tts-1' },
        },
      }),
    );
    mockUseAgentStore.mockImplementation((selector) =>
      selector({
        tts: {
          offline: {
            enabled: true,
            fallbackVoice: 'male',
            preferOfflineWhenUnavailable: true,
          },
          ttsService: 'openai',
        },
        voice: 'alloy',
      }),
    );
    mockUseGlobalStore.mockImplementation((selector) =>
      selector({
        language: 'en-US',
      }),
    );
    mockUseBusinessTTSProvider.mockReturnValue('openai');
    mockUseOpenAITTS.mockImplementation((_content, options) => {
      options?.onError?.(new Error('network unavailable'));

      return {
        audio: undefined,
        isGlobalLoading: false,
        response: undefined,
        setText: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
    });

    renderHook(() => useTTS('hello'));

    expect(mockUseOfflineTTS).toHaveBeenCalledWith('hello', 'offline-male');
    expect(offlineStart).toHaveBeenCalled();
  });

  it('should support switching service across rerenders without throwing', () => {
    mockUseUserStore.mockImplementation((selector) =>
      selector({
        tts: {
          openAI: { ttsModel: 'tts-1' },
        },
      }),
    );
    mockUseAgentStore.mockImplementation((selector) =>
      selector({
        tts: {
          offline: {
            enabled: true,
            fallbackVoice: 'female',
            preferOfflineWhenUnavailable: true,
          },
          ttsService: 'openai',
        },
        voice: 'alloy',
      }),
    );
    mockUseGlobalStore.mockImplementation((selector) =>
      selector({
        language: 'en-US',
      }),
    );
    mockUseBusinessTTSProvider.mockReturnValue('openai');
    mockUseOpenAITTS.mockReturnValue({
      audio: undefined,
      isGlobalLoading: false,
      response: undefined,
      setText: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    });
    mockUseEdgeSpeech.mockReturnValue({
      audio: undefined,
      isGlobalLoading: false,
      response: undefined,
      setText: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    });
    mockUseMicrosoftSpeech.mockReturnValue({
      audio: undefined,
      isGlobalLoading: false,
      response: undefined,
      setText: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    });

    const { rerender } = renderHook(
      ({ server }: { server: 'offline' | 'openai' }) => useTTS('hello', { server }),
      {
        initialProps: { server: 'openai' as const },
      },
    );

    expect(() => rerender({ server: 'offline' as const })).not.toThrow();
  });
});
