import { create } from 'zustand';

export type VideoEditResolution = '480P' | '720P';

export interface VideoEditConfig {
  duration: number;
  model: string;
  prompt: string;
  provider: string;
  referenceImages: string[];
  resolution: VideoEditResolution;
  /** 源视频时长（秒），上传后由前端探测填入；用于裁剪 duration 上限。 */
  sourceDuration?: number;
  videoUrl: string;
}

export interface VideoEditTask {
  error?: string;
  errorCode?: string;
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

export const DEFAULT_VIDEO_EDIT_MODEL = 'wan2.7-videoedit';
export const DEFAULT_VIDEO_EDIT_PROVIDER = 'dashscope';

export const useVideoEditStore = create<VideoEditStore>((set) => ({
  config: {
    duration: 5,
    model: DEFAULT_VIDEO_EDIT_MODEL,
    prompt: '',
    provider: DEFAULT_VIDEO_EDIT_PROVIDER,
    referenceImages: [],
    resolution: '720P',
    videoUrl: '',
  },
  setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
  setTask: (patch) => set((s) => ({ task: { ...s.task, ...patch } })),
  task: { status: 'idle' },
}));
