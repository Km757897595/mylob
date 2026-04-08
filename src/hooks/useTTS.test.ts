import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useTTS } from './useTTS';

const mockUseUserStore = vi.hoisted(() => vi.fn());
const mockUseAgentStore = vi.hoisted(() => vi.fn());
const mockUseGlobalStore = vi.hoisted(() => vi.fn());
const mockUseBusinessTTSProvider = vi.hoisted(() => vi.fn());

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

vi.mock('@/store/user/selectors', () => ({
  settingsSelectors: {
    currentTTS: vi.fn((s) => s.tts),
  },
}));

vi.mock('@/store/agent/selectors', () => ({
  agentSelectors: {
    currentAgentTTS: vi.fn((s) => s.tts),
    currentAgentTTSVoice: vi.fn(() => (s) => s.voice),
  },
}));

vi.mock('@/store/global/selectors', () => ({
  globalGeneralSelectors: {
    currentLanguage: vi.fn((s) => s.language),
  },
}));

vi.mock('@lobehub/tts/react', () => ({
  useEdgeSpeech: mockUseEdgeSpeech,
  useMicrosoftSpeech: mockUseMicrosoftSpeech,
  useOpenAITTS: mockUseOpenAITTS,
}));

describe('useTTS', () => {
  it('should return a safe fallback when offline is selected', () => {
    mockUseUserStore.mockImplementation((selector) =>
      selector({
        tts: {
          openAI: { ttsModel: 'tts-1' },
        },
      }),
    );
    mockUseAgentStore.mockImplementation((selector) =>
      selector({
        tts: { ttsService: 'offline' },
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

    expect(result.current.isGlobalLoading).toBe(false);
    expect(mockUseOpenAITTS).not.toHaveBeenCalled();
    expect(mockUseEdgeSpeech).not.toHaveBeenCalled();
    expect(mockUseMicrosoftSpeech).not.toHaveBeenCalled();
  });
});
