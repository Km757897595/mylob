import { describe, expect, it } from 'vitest';

import { type AgentStoreState } from '@/store/agent/initialState';
import { initialAgentSliceState } from '@/store/agent/slices/agent/initialState';
import { initialBuiltinAgentSliceState } from '@/store/agent/slices/builtin/initialState';

import { agentByIdSelectors } from './agentByIdSelectors';

const createState = (overrides: Partial<AgentStoreState> = {}): AgentStoreState => ({
  ...initialAgentSliceState,
  ...initialBuiltinAgentSliceState,
  ...overrides,
});

describe('agentByIdSelectors', () => {
  describe('getAgentTTSByIdWithGlobal', () => {
    it('should apply global TTS when agent inherits global settings', () => {
      const state = createState({
        agentMap: {
          'agent-1': {
            tts: {
              inheritGlobal: true,
            },
          },
        },
      });

      const tts = agentByIdSelectors.getAgentTTSByIdWithGlobal('agent-1', {
        offline: {
          enabled: true,
          fallbackVoice: 'female',
          preferOfflineWhenUnavailable: true,
        },
        openAI: { sttModel: 'whisper-1', ttsModel: 'tts-1' },
        selectedVoice: {
          label: 'edge-custom',
          service: 'edge',
          voiceId: 'edge-custom',
        },
        service: 'edge',
        sttAutoStop: true,
        sttServer: 'openai',
      } as any)(state);

      expect(tts.ttsService).toBe('edge');
      expect(tts.voice.edge).toBe('edge-custom');
      expect(tts.selectedVoice?.voiceId).toBe('edge-custom');
    });

    it('should not apply global TTS when inheritGlobal is false', () => {
      const state = createState({
        agentMap: {
          'agent-1': {
            tts: {
              inheritGlobal: false,
            },
          },
        },
      });

      const tts = agentByIdSelectors.getAgentTTSByIdWithGlobal('agent-1', {
        offline: {
          enabled: true,
          fallbackVoice: 'female',
          preferOfflineWhenUnavailable: true,
        },
        openAI: { sttModel: 'whisper-1', ttsModel: 'tts-1' },
        selectedVoice: {
          label: 'edge-custom',
          service: 'edge',
          voiceId: 'edge-custom',
        },
        service: 'edge',
        sttAutoStop: true,
        sttServer: 'openai',
      } as any)(state);

      expect(tts.ttsService).toBe('openai');
      expect(tts.voice.openai).toBe('alloy');
      expect(tts.selectedVoice?.voiceId).toBe('alloy');
    });
  });

  describe('getAgentBuilderContextById', () => {
    it('should return builder context from existing agent config', () => {
      const state = createState({
        agentMap: {
          'agent-1': {
            chatConfig: { historyCount: 6 },
            model: 'gpt-4o',
            plugins: ['search'],
            provider: 'openai',
            systemRole: 'You are a helper',
          },
        },
      });

      const context = agentByIdSelectors.getAgentBuilderContextById('agent-1')(state);

      expect(context.config).toMatchObject({
        chatConfig: { historyCount: 6 },
        model: 'gpt-4o',
        plugins: ['search'],
        provider: 'openai',
        systemRole: 'You are a helper',
      });
    });

    it('should not throw when agent config is missing', () => {
      const state = createState({ agentMap: {} });

      expect(() =>
        agentByIdSelectors.getAgentBuilderContextById('missing-agent')(state),
      ).not.toThrow();

      const context = agentByIdSelectors.getAgentBuilderContextById('missing-agent')(state);

      expect(context.config).toMatchObject({
        chatConfig: undefined,
        model: undefined,
        plugins: undefined,
        provider: undefined,
        systemRole: undefined,
      });
    });
  });
});
