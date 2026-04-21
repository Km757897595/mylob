# Voice Service Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build global and agent-level voice service configuration with a unified voice catalog, live preview, and Web offline male/female fallback voices.

**Architecture:** Extend the existing TTS config model in place, then add selector-level effective config resolution so Agent settings can inherit from global defaults without copying values. Reuse a shared voice catalog data layer and shared UI panel in both settings surfaces, and teach `useTTS` to route either to the existing online providers or to a browser-backed offline speech fallback.

**Tech Stack:** TypeScript, React, Zustand selectors, `@lobehub/ui`, `@lobehub/tts/react`, Vitest, Testing Library, i18n (`src/locales/default`, `locales/zh-CN`)

---

### Task 1: Expand TTS Types, Defaults, and Copy Baseline

**Files:**

- Modify: `packages/types/src/user/settings/tts.ts`

- Modify: `packages/types/src/agent/tts.ts`

- Modify: `packages/const/src/settings/tts.ts`

- Modify: `packages/const/src/settings/agent.ts`

- Modify: `src/locales/default/setting.ts`

- Modify: `locales/zh-CN/setting.json`

- Modify: `src/store/user/slices/settings/selectors/settings.test.ts`

- Modify: `src/store/agent/selectors/selectors.test.ts`

- [ ] **Step 1: Write the failing selector expectations for the new defaults**

Add one user-settings test and one agent-selector test that describe the new shape before writing implementation:

```ts
it('should merge the new global TTS defaults', () => {
  const s = {
    settings: {
      tts: {
        service: 'offline',
        offline: { enabled: true, fallbackVoice: 'male' },
      },
    },
  } as unknown as UserStore;

  const result = settingsSelectors.currentTTS(s);

  expect(result.service).toBe('offline');
  expect(result.offline.enabled).toBe(true);
  expect(result.offline.fallbackVoice).toBe('male');
  expect(result.selectedVoice.service).toBe('openai');
});

it('should keep inheritGlobal enabled in the default agent TTS config', () => {
  const state = createState({
    activeAgentId: 'agent-1',
    agentMap: { 'agent-1': {} },
  });

  expect(agentSelectors.currentAgentTTS(state).inheritGlobal).toBe(true);
});
```

- [ ] **Step 2: Run the focused tests to confirm the defaults are missing**

Run:

```bash
bunx vitest run --silent='passed-only' 'src/store/user/slices/settings/selectors/settings.test.ts' 'src/store/agent/selectors/selectors.test.ts'
```

Expected:

```text
FAIL  ...currentTTS...
FAIL  ...currentAgentTTS...
Property 'service' does not exist
```

- [ ] **Step 3: Add the new config types, defaults, and i18n keys**

Implement the new config shape directly in the existing TTS type files instead of introducing a new exported module:

```ts
export type TTSServer = 'openai' | 'edge' | 'microsoft' | 'offline';
export type OfflineVoice = 'male' | 'female';

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
```

Update the defaults so the system has a stable baseline:

```ts
export const DEFAULT_TTS_CONFIG: UserTTSConfig = {
  openAI: { sttModel: 'whisper-1', ttsModel: 'tts-1' },
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
  sttAutoStop: true,
  sttServer: 'openai',
};
```

And update the agent default to opt into inheritance:

```ts
export const DEFAUTT_AGENT_TTS_CONFIG: LobeAgentTTSConfig = {
  inheritGlobal: true,
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
  showAllLocaleVoice: false,
  sttLocale: 'auto',
  ttsService: 'openai',
  voice: { openai: 'alloy' },
};
```

Add the new strings needed by the upcoming UI in both locale files:

```ts
'settingTTS.catalog.title': 'Voice Library',
'settingTTS.catalog.service': 'Voice Service',
'settingTTS.catalog.gender': 'Gender',
'settingTTS.catalog.timbre': 'Timbre',
'settingTTS.catalog.style': 'Style',
'settingTTS.catalog.inherit': 'Inherit Global Voice Settings',
'settingTTS.offline.title': 'Offline Voice',
'settingTTS.offline.female': 'Offline Female Voice',
'settingTTS.offline.male': 'Offline Male Voice',
```

- [ ] **Step 4: Re-run the selector tests and update snapshots**

Run:

```bash
bunx vitest run --silent='passed-only' 'src/store/user/slices/settings/selectors/settings.test.ts' 'src/store/agent/selectors/selectors.test.ts' -u
```

Expected:

```text
PASS  src/store/user/slices/settings/selectors/settings.test.ts
PASS  src/store/agent/selectors/selectors.test.ts
Snapshots updated
```

- [ ] **Step 5: Commit the baseline config model**

Run:

```bash
git add packages/types/src/user/settings/tts.ts packages/types/src/agent/tts.ts packages/const/src/settings/tts.ts packages/const/src/settings/agent.ts src/locales/default/setting.ts locales/zh-CN/setting.json src/store/user/slices/settings/selectors/settings.test.ts src/store/agent/selectors/selectors.test.ts
git commit -m ":sparkles: expand voice service config defaults"
```

### Task 2: Add Effective TTS Resolution in Selectors

**Files:**

- Modify: `src/store/user/slices/settings/selectors/settings.ts`

- Modify: `src/store/agent/selectors/selectors.ts`

- Modify: `src/store/agent/selectors/agentByIdSelectors.ts`

- Modify: `src/store/agent/selectors/selectors.test.ts`

- Modify: `src/store/user/slices/settings/selectors/settings.test.ts`

- [ ] **Step 1: Add failing tests for inheritance, override, and legacy bridging**

Extend the existing selector tests with three focused cases:

```ts
it('should inherit service and voice from the global defaults', () => {
  const state = createState({
    activeAgentId: 'agent-1',
    agentMap: { 'agent-1': { tts: { inheritGlobal: true } } },
  });

  const tts = agentSelectors.currentAgentTTS(state);

  expect(tts.ttsService).toBe('openai');
  expect(tts.selectedVoice?.voiceId).toBe('alloy');
});

it('should prefer the agent override when inheritGlobal is false', () => {
  const state = createState({
    activeAgentId: 'agent-1',
    agentMap: {
      'agent-1': {
        tts: {
          inheritGlobal: false,
          selectedVoice: { label: 'Nova', service: 'openai', voiceId: 'nova' },
        },
      },
    },
  });

  expect(agentSelectors.currentAgentTTSVoice('en-US')(state)).toBe('nova');
});

it('should bridge selectedVoice back to legacy ttsService and voice fields', () => {
  const state = createState({
    activeAgentId: 'agent-1',
    agentMap: {
      'agent-1': {
        tts: {
          inheritGlobal: false,
          selectedVoice: { label: 'Offline Female', service: 'offline', voiceId: 'offline-female' },
        },
      },
    },
  });

  expect(agentSelectors.currentAgentTTS(state).ttsService).toBe('offline');
});
```

- [ ] **Step 2: Run only the selector tests and verify they fail for the new behavior**

Run:

```bash
bunx vitest run --silent='passed-only' 'src/store/agent/selectors/selectors.test.ts' 'src/store/user/slices/settings/selectors/settings.test.ts'
```

Expected:

```text
FAIL  ...inherit service and voice from the global defaults
FAIL  ...bridge selectedVoice back to legacy ttsService...
```

- [ ] **Step 3: Implement selector-level config resolution and legacy field hydration**

Add a small resolver inside `src/store/agent/selectors/selectors.ts` that merges Agent, global, and default values once:

```ts
const hydrateLegacyVoiceFields = (selection?: VoiceCatalogSelection) => {
  if (!selection) return undefined;

  switch (selection.service) {
    case 'edge':
      return { ttsService: 'edge' as const, voice: { edge: selection.voiceId } };
    case 'microsoft':
      return { ttsService: 'microsoft' as const, voice: { microsoft: selection.voiceId } };
    case 'offline':
      return { ttsService: 'offline' as const, voice: {} };
    default:
      return { ttsService: 'openai' as const, voice: { openai: selection.voiceId } };
  }
};

const resolveEffectiveTTSConfig = (
  agentTTS: Partial<LobeAgentTTSConfig> | undefined,
  globalTTS: UserTTSConfig,
) => {
  const source = agentTTS?.inheritGlobal === false ? merge(globalTTS, agentTTS) : globalTTS;
  const selectedVoice =
    agentTTS?.inheritGlobal === false
      ? agentTTS?.selectedVoice || globalTTS.selectedVoice
      : globalTTS.selectedVoice;
  return merge(
    DEFAUTT_AGENT_TTS_CONFIG,
    source,
    { selectedVoice },
    hydrateLegacyVoiceFields(selectedVoice),
  );
};
```

Update `currentAgentTTS` and `getAgentTTSById` to use the resolver, and keep `currentAgentTTSVoice` selecting from the hydrated legacy fields so message playback keeps working without a wider refactor.

- [ ] **Step 4: Re-run the selector suite**

Run:

```bash
bunx vitest run --silent='passed-only' 'src/store/agent/selectors/selectors.test.ts' 'src/store/user/slices/settings/selectors/settings.test.ts'
```

Expected:

```text
PASS  src/store/agent/selectors/selectors.test.ts
PASS  src/store/user/slices/settings/selectors/settings.test.ts
```

- [ ] **Step 5: Commit the selector resolver**

Run:

```bash
git add src/store/user/slices/settings/selectors/settings.ts src/store/agent/selectors/selectors.ts src/store/agent/selectors/agentByIdSelectors.ts src/store/agent/selectors/selectors.test.ts src/store/user/slices/settings/selectors/settings.test.ts
git commit -m ":sparkles: resolve effective voice config from selectors"
```

### Task 3: Create the Shared Voice Catalog Data Layer

**Files:**

- Create: `src/features/TTS/VoiceCatalog/catalog.ts`

- Create: `src/features/TTS/VoiceCatalog/filters.ts`

- Create: `src/features/TTS/VoiceCatalog/index.ts`

- Create: `src/features/TTS/VoiceCatalog/filters.test.ts`

- [ ] **Step 1: Write failing tests for catalog filtering and offline entries**

Create `src/features/TTS/VoiceCatalog/filters.test.ts` with a small static catalog contract:

```ts
import { describe, expect, it } from 'vitest';

import { OFFLINE_VOICE_CATALOG, filterVoiceCatalog } from './filters';

describe('filterVoiceCatalog', () => {
  it('should always expose the offline male and female entries', () => {
    expect(OFFLINE_VOICE_CATALOG.map((item) => item.voiceId)).toEqual([
      'offline-male',
      'offline-female',
    ]);
  });

  it('should filter by service, gender, and timbre together', () => {
    const result = filterVoiceCatalog(
      [
        {
          gender: 'female',
          label: 'Nova',
          service: 'openai',
          timbre: 'warm',
          voiceId: 'nova',
          locale: 'en-US',
          style: ['natural'],
          tags: [],
          previewable: true,
          offlineCapable: false,
          id: 'openai-nova',
        },
        {
          gender: 'male',
          label: 'Yunxi',
          service: 'edge',
          timbre: 'bright',
          voiceId: 'zh-CN-Yunxi',
          locale: 'zh-CN',
          style: ['broadcast'],
          tags: [],
          previewable: true,
          offlineCapable: false,
          id: 'edge-yunxi',
        },
      ],
      { gender: 'female', service: 'openai', timbre: 'warm' },
    );

    expect(result.map((item) => item.voiceId)).toEqual(['nova']);
  });
});
```

- [ ] **Step 2: Run the new unit test and verify the helper does not exist yet**

Run:

```bash
bunx vitest run --silent='passed-only' 'src/features/TTS/VoiceCatalog/filters.test.ts'
```

Expected:

```text
FAIL  Cannot find module './filters'
```

- [ ] **Step 3: Implement the static catalog and pure filtering helpers**

Create a focused data layer with one export for static offline voices and one export for all providers:

```ts
export const OFFLINE_VOICE_CATALOG: VoiceCatalogItem[] = [
  {
    gender: 'male',
    id: 'offline-male',
    label: 'Offline Male Voice',
    locale: 'system',
    offlineCapable: true,
    previewable: true,
    service: 'offline',
    style: ['offline'],
    tags: ['fallback'],
    timbre: 'deep',
    voiceId: 'offline-male',
  },
  {
    gender: 'female',
    id: 'offline-female',
    label: 'Offline Female Voice',
    locale: 'system',
    offlineCapable: true,
    previewable: true,
    service: 'offline',
    style: ['offline'],
    tags: ['fallback'],
    timbre: 'warm',
    voiceId: 'offline-female',
  },
];

export const filterVoiceCatalog = (catalog: VoiceCatalogItem[], filters: VoiceCatalogFilters) =>
  catalog.filter((item) => {
    if (filters.service && item.service !== filters.service) return false;
    if (filters.gender && item.gender !== filters.gender) return false;
    if (filters.timbre && item.timbre !== filters.timbre) return false;
    if (filters.style && !item.style.includes(filters.style)) return false;
    if (filters.locale && item.locale !== filters.locale) return false;
    return true;
  });
```

Keep this task data-only. Do not introduce React components yet.

- [ ] **Step 4: Re-run the catalog tests**

Run:

```bash
bunx vitest run --silent='passed-only' 'src/features/TTS/VoiceCatalog/filters.test.ts'
```

Expected:

```text
PASS  src/features/TTS/VoiceCatalog/filters.test.ts
```

- [ ] **Step 5: Commit the shared catalog model**

Run:

```bash
git add src/features/TTS/VoiceCatalog/catalog.ts src/features/TTS/VoiceCatalog/filters.ts src/features/TTS/VoiceCatalog/index.ts src/features/TTS/VoiceCatalog/filters.test.ts
git commit -m ":sparkles: add shared voice catalog helpers"
```

### Task 4: Build the Global Voice Settings UI

**Files:**

- Create: `src/features/TTS/VoiceCatalog/VoicePreviewButton.tsx`

- Create: `src/features/TTS/VoiceCatalog/VoiceCatalogPanel.tsx`

- Create: `src/features/TTS/VoiceCatalog/OfflineVoiceSettings.tsx`

- Create: `src/routes/(main)/settings/tts/features/TTSService.tsx`

- Create: `src/routes/(main)/settings/tts/features/VoiceCatalog.tsx`

- Create: `src/routes/(main)/settings/tts/features/Offline.tsx`

- Create: `src/routes/(main)/settings/tts/features/VoiceCatalog.test.tsx`

- Modify: `src/routes/(main)/settings/tts/index.tsx`

- Modify: `src/routes/(main)/settings/tts/features/const.tsx`

- [ ] **Step 1: Write a component test for selecting a voice and persisting global settings**

Create `src/routes/(main)/settings/tts/features/VoiceCatalog.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import VoiceCatalog from './VoiceCatalog';

const setSettings = vi.fn();

vi.mock('@/store/user', () => ({
  useUserStore: (selector: any) =>
    selector({
      isUserStateInit: true,
      setSettings,
      settings: {},
    }),
}));

describe('VoiceCatalog', () => {
  it('should save the selected global voice', async () => {
    render(<VoiceCatalog />);

    await userEvent.click(screen.getByText('Nova'));

    expect(setSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        tts: expect.objectContaining({
          selectedVoice: expect.objectContaining({ voiceId: 'nova' }),
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run the new component test and confirm the page fragment does not exist yet**

Run:

```bash
bunx vitest run --silent='passed-only' 'src/routes/(main)/settings/tts/features/VoiceCatalog.test.tsx'
```

Expected:

```text
FAIL  Cannot find module './VoiceCatalog'
```

- [ ] **Step 3: Implement reusable catalog UI and wire it into the global settings page**

Create the shared preview button around `useTTS`:

```tsx
export const VoicePreviewButton = ({ selection }: { selection: VoiceCatalogSelection }) => {
  const previewText = 'LobeHub voice preview.';
  const { audio, isGlobalLoading, start, stop } = useTTS(previewText, {
    server: selection.service,
    voice: selection.voiceId,
  });

  return (
    <AudioPlayer
      audio={audio}
      buttonActive
      isLoading={isGlobalLoading}
      showSlider={false}
      showTime={false}
      onInitPlay={start}
      onLoadingStop={stop}
    />
  );
};
```

Use the shared panel in the new global setting section:

```tsx
const VoiceCatalog = () => {
  const { t } = useTranslation('setting');
  const tts = useUserStore(settingsSelectors.currentTTS, isEqual);
  const setSettings = useUserStore((s) => s.setSettings);
  const catalog = buildVoiceCatalog();

  return (
    <VoiceCatalogPanel
      catalog={catalog}
      selectedVoice={tts.selectedVoice}
      title={t('settingTTS.catalog.title')}
      onSelect={async (selectedVoice) => {
        await setSettings({ tts: { selectedVoice, service: selectedVoice.service } });
      }}
    />
  );
};
```

Then render the new sections:

```tsx
<>
  <SettingHeader title={t('tab.tts')} />
  <STT />
  <TTSService />
  <VoiceCatalog />
  <Offline />
  <OpenAI />
</>
```

- [ ] **Step 4: Re-run the global settings UI test**

Run:

```bash
bunx vitest run --silent='passed-only' 'src/routes/(main)/settings/tts/features/VoiceCatalog.test.tsx'
```

Expected:

```text
PASS  src/routes/(main)/settings/tts/features/VoiceCatalog.test.tsx
```

- [ ] **Step 5: Commit the global settings UI**

Run:

```bash
git add src/features/TTS/VoiceCatalog/VoicePreviewButton.tsx src/features/TTS/VoiceCatalog/VoiceCatalogPanel.tsx src/features/TTS/VoiceCatalog/OfflineVoiceSettings.tsx 'src/routes/(main)/settings/tts/features/TTSService.tsx' 'src/routes/(main)/settings/tts/features/VoiceCatalog.tsx' 'src/routes/(main)/settings/tts/features/Offline.tsx' 'src/routes/(main)/settings/tts/features/VoiceCatalog.test.tsx' 'src/routes/(main)/settings/tts/index.tsx' 'src/routes/(main)/settings/tts/features/const.tsx'
git commit -m ":sparkles: add global voice library settings"
```

### Task 5: Update Agent TTS Settings to Support Inheritance and Overrides

**Files:**

- Create: `src/features/AgentSetting/AgentTTS/InheritedVoiceSummary.tsx`

- Create: `src/features/AgentSetting/AgentTTS/index.test.tsx`

- Modify: `src/features/AgentSetting/AgentTTS/index.tsx`

- [ ] **Step 1: Add a failing component test for the inherit/override toggle**

Create `src/features/AgentSetting/AgentTTS/index.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import AgentTTS from './index';

const setAgentConfig = vi.fn();

vi.mock('../store', () => ({
  selectors: {
    currentTtsConfig: (state: any) => state.config.tts,
  },
  useStore: (selector: any) =>
    selector({
      config: {
        tts: {
          inheritGlobal: true,
          selectedVoice: { label: 'Alloy', service: 'openai', voiceId: 'alloy' },
        },
      },
      setAgentConfig,
    }),
}));

describe('AgentTTS', () => {
  it('should allow disabling inheritGlobal and saving an override', async () => {
    render(<AgentTTS />);

    await userEvent.click(screen.getByRole('switch'));

    expect(setAgentConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        tts: expect.objectContaining({ inheritGlobal: false }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run the Agent TTS component test and verify the UI does not expose inheritance yet**

Run:

```bash
bunx vitest run --silent='passed-only' 'src/features/AgentSetting/AgentTTS/index.test.tsx'
```

Expected:

```text
FAIL  Unable to find an accessible element with the role "switch"
```

- [ ] **Step 3: Implement inheritance UI with the shared catalog components**

Replace the current service-specific select stack with a top-level inherit toggle:

```tsx
const inheritItem = {
  children: <Switch />,
  label: t('settingTTS.catalog.inherit'),
  layout: 'horizontal' as const,
  name: [TTS_SETTING_KEY, 'inheritGlobal'],
  valuePropName: 'checked',
};
```

Render either the inherited summary or the full override editor:

```tsx
const globalTTS = useUserStore(settingsSelectors.currentTTS, isEqual);
const isInherited = config.inheritGlobal !== false;
const effectiveSelection = isInherited ? globalTTS.selectedVoice : config.selectedVoice;

return (
  <Form
    form={form}
    initialValues={{ [TTS_SETTING_KEY]: config }}
    items={[
      {
        children: [
          inheritItem,
          isInherited
            ? {
                children: (
                  <InheritedVoiceSummary
                    selectedVoice={globalTTS.selectedVoice}
                    offline={globalTTS.offline}
                  />
                ),
                label: t('settingTTS.catalog.title'),
              }
            : {
                children: (
                  <VoiceCatalogPanel
                    catalog={catalog}
                    selectedVoice={effectiveSelection}
                    onSelect={handleSelectVoice}
                  />
                ),
                label: t('settingTTS.catalog.title'),
              },
          !isInherited
            ? {
                children: (
                  <OfflineVoiceSettings value={config.offline} onChange={handleOfflineChange} />
                ),
                label: t('settingTTS.offline.title'),
              }
            : undefined,
        ].filter(Boolean),
        icon: Mic,
        title: t('settingTTS.title'),
      },
    ]}
    onFinish={updateConfig}
  />
);
```

- [ ] **Step 4: Re-run the Agent TTS test**

Run:

```bash
bunx vitest run --silent='passed-only' 'src/features/AgentSetting/AgentTTS/index.test.tsx'
```

Expected:

```text
PASS  src/features/AgentSetting/AgentTTS/index.test.tsx
```

- [ ] **Step 5: Commit the Agent override UI**

Run:

```bash
git add src/features/AgentSetting/AgentTTS/InheritedVoiceSummary.tsx src/features/AgentSetting/AgentTTS/index.test.tsx src/features/AgentSetting/AgentTTS/index.tsx
git commit -m ":sparkles: add agent voice inheritance controls"
```

### Task 6: Add Web Offline TTS and Online-to-Offline Fallback

**Files:**

- Create: `src/hooks/useOfflineTTS.ts`

- Create: `src/hooks/useTTS.test.ts`

- Modify: `src/hooks/useTTS.ts`

- [ ] **Step 1: Write a failing hook test for explicit offline mode and fallback mode**

Create `src/hooks/useTTS.test.ts` with two focused cases:

```ts
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useTTS } from './useTTS';

const speak = vi.fn();
const getVoices = vi.fn(() => [
  { lang: 'en-US', name: 'System Female' },
  { lang: 'en-US', name: 'System Male' },
]);

Object.defineProperty(window, 'speechSynthesis', {
  value: { cancel: vi.fn(), getVoices, speak },
  writable: true,
});

describe('useTTS', () => {
  it('should use speechSynthesis when server is offline', () => {
    renderHook(() =>
      useTTS('hello', {
        server: 'offline',
        voice: 'offline-female',
      }),
    );

    expect(getVoices).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the hook test and verify the offline branch is missing**

Run:

```bash
bunx vitest run --silent='passed-only' 'src/hooks/useTTS.test.ts'
```

Expected:

```text
FAIL  Type '"offline"' is not assignable to parameter of type ...
```

- [ ] **Step 3: Implement `useOfflineTTS` and route fallback through `useTTS`**

Keep the browser-specific logic in its own hook:

```ts
export const useOfflineTTS = (content: string, voice: string) => {
  const start = () => {
    const utterance = new SpeechSynthesisUtterance(content);
    const voices = window.speechSynthesis.getVoices();
    utterance.voice =
      voices.find((item) =>
        voice === 'offline-male'
          ? /male|man|david|tom/i.test(item.name)
          : /female|woman|aria|sara/i.test(item.name),
      ) || voices[0];
    window.speechSynthesis.speak(utterance);
  };

  const stop = () => window.speechSynthesis.cancel();

  return {
    audio: undefined,
    isGlobalLoading: false,
    response: undefined,
    setText: () => {},
    start,
    stop,
  };
};
```

Then update `useTTS`:

```ts
if ((config?.server || ttsAgentSettings.ttsService) === 'offline') {
  const offlineVoiceId =
    config?.voice ||
    (ttsAgentSettings.offline?.fallbackVoice === 'male' ? 'offline-male' : 'offline-female');
  return useOfflineTTS(content, offlineVoiceId);
}
```

And wrap the online branch with a fallback callback that switches to `useOfflineTTS` when the effective config says `preferOfflineWhenUnavailable`.

- [ ] **Step 4: Re-run the hook test**

Run:

```bash
bunx vitest run --silent='passed-only' 'src/hooks/useTTS.test.ts'
```

Expected:

```text
PASS  src/hooks/useTTS.test.ts
```

- [ ] **Step 5: Commit the offline fallback runtime**

Run:

```bash
git add src/hooks/useOfflineTTS.ts src/hooks/useTTS.ts src/hooks/useTTS.test.ts
git commit -m ":sparkles: add offline speech fallback for tts"
```

### Task 7: Run the Focused Regression Suite and Final Type Check

**Files:**

- Modify: `docs/superpowers/specs/2026-04-08-voice-service-config-design.md`
  - Only if implementation deviated from the approved design and needs a short note

- [ ] **Step 1: Run all targeted tests touched by the feature**

Run:

```bash
bunx vitest run --silent='passed-only' 'src/store/user/slices/settings/selectors/settings.test.ts' 'src/store/agent/selectors/selectors.test.ts' 'src/features/TTS/VoiceCatalog/filters.test.ts' 'src/routes/(main)/settings/tts/features/VoiceCatalog.test.tsx' 'src/features/AgentSetting/AgentTTS/index.test.tsx' 'src/hooks/useTTS.test.ts'
```

Expected:

```text
PASS  6 files
```

- [ ] **Step 2: Run the narrowest available type check for the repo**

Run:

```bash
bun run type-check
```

Expected:

```text
Found 0 errors
```

- [ ] **Step 3: Smoke-check the main flows manually**

Verify these paths in the app after the tests are green:

```text
1. Global settings > TTS: service switch + catalog filters + preview
2. Agent settings > TTS: inherit global on/off
3. Agent message TTS playback when online
4. Agent message TTS playback when forced to offline
```

- [ ] **Step 4: Update the spec only if the shipped behavior changed**

If no behavior changed relative to the approved spec, skip this step. If it changed, add one small “Implementation Notes” section:

```md
## Implementation Notes

- Web offline voice matching uses browser voice-name heuristics and falls back to the first local voice when a gender-specific match is unavailable.
```

- [ ] **Step 5: Commit the final verified feature**

Run:

```bash
git add packages/types/src/user/settings/tts.ts packages/types/src/agent/tts.ts packages/const/src/settings/tts.ts packages/const/src/settings/agent.ts src/locales/default/setting.ts locales/zh-CN/setting.json src/store/user/slices/settings/selectors/settings.ts src/store/user/slices/settings/selectors/settings.test.ts src/store/agent/selectors/selectors.ts src/store/agent/selectors/agentByIdSelectors.ts src/store/agent/selectors/selectors.test.ts src/features/TTS/VoiceCatalog/catalog.ts src/features/TTS/VoiceCatalog/filters.ts src/features/TTS/VoiceCatalog/index.ts src/features/TTS/VoiceCatalog/filters.test.ts src/features/TTS/VoiceCatalog/VoicePreviewButton.tsx src/features/TTS/VoiceCatalog/VoiceCatalogPanel.tsx src/features/TTS/VoiceCatalog/OfflineVoiceSettings.tsx 'src/routes/(main)/settings/tts/features/TTSService.tsx' 'src/routes/(main)/settings/tts/features/VoiceCatalog.tsx' 'src/routes/(main)/settings/tts/features/Offline.tsx' 'src/routes/(main)/settings/tts/features/VoiceCatalog.test.tsx' 'src/routes/(main)/settings/tts/index.tsx' 'src/routes/(main)/settings/tts/features/const.tsx' src/features/AgentSetting/AgentTTS/InheritedVoiceSummary.tsx src/features/AgentSetting/AgentTTS/index.test.tsx src/features/AgentSetting/AgentTTS/index.tsx src/hooks/useOfflineTTS.ts src/hooks/useTTS.ts src/hooks/useTTS.test.ts
git commit -m ":white_check_mark: finish voice service config feature"
```

## Self-Review

### Spec Coverage

- Multi-service TTS switching is implemented in Task 1, Task 2, and Task 4.
- Visual voice library with filters and preview is implemented in Task 3 and Task 4.
- Offline male/female voice support is implemented in Task 1, Task 3, and Task 6.
- Global default plus Agent override behavior is implemented in Task 2 and Task 5.

### Placeholder Scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every task includes exact file paths, at least one code block, and an explicit verification command.

### Type Consistency

- The plan uses one shared `TTSServer` union that includes `offline`.
- The plan uses one shared `VoiceCatalogSelection` object across user settings, agent settings, shared UI, and runtime resolution.
- The plan uses one shared `OfflineTTSConfig` shape across defaults, selectors, and UI.
