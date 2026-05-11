import { comfyuiDispatcher } from './comfyui';
import { dashscopeDispatcher } from './dashscope';
import type { VideoEditDispatcher } from './types';

const DISPATCHERS: Record<string, VideoEditDispatcher> = {
  comfyui: comfyuiDispatcher,
  dashscope: dashscopeDispatcher,
  qwen: dashscopeDispatcher,
};

export function getDispatcher(provider: string): VideoEditDispatcher | undefined {
  return DISPATCHERS[provider];
}

export function listSupportedProviders(): string[] {
  return Object.keys(DISPATCHERS);
}

export type { VideoEditDispatcher } from './types';
export { VideoEditError } from './types';
