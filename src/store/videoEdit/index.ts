import { create } from 'zustand';

export interface VideoEditConfig {
  prompt: string;
  referenceImages: string[];
  resolution: '1080P' | '720P';
  videoUrl: string;
}

export interface VideoEditTask {
  error?: string;
  resultUrl?: string;
  status: 'failed' | 'idle' | 'pending' | 'processing' | 'succeeded';
  taskId?: string;
}

interface VideoEditStore {
  config: VideoEditConfig;
  setConfig: (patch: Partial<VideoEditConfig>) => void;
  setTask: (patch: Partial<VideoEditTask>) => void;
  task: VideoEditTask;
}

export const useVideoEditStore = create<VideoEditStore>((set) => ({
  config: {
    prompt: '',
    referenceImages: [],
    resolution: '720P',
    videoUrl: '',
  },
  setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
  setTask: (patch) => set((s) => ({ task: { ...s.task, ...patch } })),
  task: { status: 'idle' },
}));
