import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AgentTTS from './index';

const setAgentConfig = vi.hoisted(() => vi.fn());
const mockUseStore = vi.hoisted(() => vi.fn());
const mockUseUserStore = vi.hoisted(() => vi.fn());
const mockUseGlobalStore = vi.hoisted(() => vi.fn());

vi.mock('../store', () => ({
  selectors: {
    currentTtsConfig: (state: any) => state.config.tts,
  },
  useStore: mockUseStore,
}));

vi.mock('@/store/user', () => ({
  useUserStore: mockUseUserStore,
}));

vi.mock('@/store/user/selectors', () => ({
  settingsSelectors: {
    currentTTS: (state: any) => state.tts,
  },
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: mockUseGlobalStore,
}));

vi.mock('@/store/global/selectors', () => ({
  globalGeneralSelectors: {
    currentLanguage: (state: any) => state.language,
  },
}));

vi.mock('@/features/TTS/VoiceCatalog', () => ({
  OfflineVoiceSettings: () => <div>offline settings</div>,
  VoiceCatalogPanel: () => <div>voice catalog panel</div>,
  buildVoiceCatalog: () => [],
}));

describe('AgentTTS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const agentState = {
      config: {
        tts: {
          inheritGlobal: true,
          offline: {
            enabled: true,
            fallbackVoice: 'female',
            preferOfflineWhenUnavailable: true,
          },
          selectedVoice: { label: 'Alloy', service: 'openai', voiceId: 'alloy' },
          sttLocale: 'auto',
        },
      },
      setAgentConfig,
    };
    const userState = {
      tts: {
        offline: {
          enabled: true,
          fallbackVoice: 'female',
          preferOfflineWhenUnavailable: true,
        },
        selectedVoice: { label: 'Nova', service: 'openai', voiceId: 'nova' },
        service: 'openai',
      },
    };
    const globalState = {
      language: 'en-US',
    };

    mockUseStore.mockImplementation((selector: any) => selector(agentState));
    mockUseUserStore.mockImplementation((selector: any) => selector(userState));
    mockUseGlobalStore.mockImplementation((selector: any) => selector(globalState));
  });

  it('should allow disabling inheritGlobal and saving override mode', async () => {
    render(<AgentTTS />);

    await userEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(setAgentConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          tts: expect.objectContaining({
            inheritGlobal: false,
          }),
        }),
      );
    });
  });
});
