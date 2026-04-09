import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import VoiceCatalog from './VoiceCatalog';

const setSettings = vi.hoisted(() => vi.fn());
const mockUseUserStore = vi.hoisted(() => vi.fn());
const mockUseGlobalStore = vi.hoisted(() => vi.fn());

vi.mock('@/store/user', () => ({
  useUserStore: mockUseUserStore,
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: mockUseGlobalStore,
}));

vi.mock('@/store/user/selectors', () => ({
  settingsSelectors: {
    currentTTS: (s: any) => s.tts,
  },
}));

vi.mock('@/store/global/selectors', () => ({
  globalGeneralSelectors: {
    currentLanguage: (s: any) => s.language,
  },
}));

vi.mock('@/features/TTS/VoiceCatalog', () => ({
  VoiceCatalogPanel: ({ catalog, onSelect }: any) => (
    <button type={'button'} onClick={() => onSelect(catalog[0])}>
      {catalog[0].label}
    </button>
  ),
  buildVoiceCatalog: () => [
    {
      label: 'Nova',
      service: 'openai',
      voiceId: 'nova',
    },
  ],
}));

describe('VoiceCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUserStore.mockImplementation((selector: any) =>
      selector({
        isUserStateInit: true,
        setSettings,
        tts: {
          offline: {
            enabled: true,
            fallbackVoice: 'female',
            preferOfflineWhenUnavailable: true,
          },
          selectedVoice: {
            label: 'Alloy',
            service: 'openai',
            voiceId: 'alloy',
          },
          service: 'openai',
        },
      }),
    );
    mockUseGlobalStore.mockImplementation((selector: any) =>
      selector({
        language: 'en-US',
      }),
    );
  });

  it('should save the selected global voice', async () => {
    render(<VoiceCatalog />);

    await userEvent.click(screen.getByRole('button', { name: 'Nova' }));

    expect(setSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        tts: expect.objectContaining({
          selectedVoice: expect.objectContaining({ voiceId: 'nova' }),
        }),
      }),
    );
  });
});
