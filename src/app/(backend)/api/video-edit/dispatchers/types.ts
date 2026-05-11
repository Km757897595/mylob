export interface VideoEditSubmitInput {
  apiKey?: string;
  duration?: number;
  model: string;
  prompt: string;
  referenceImages?: string[];
  resolution?: '480P' | '720P';
  videoUrl: string;
}

export interface VideoEditQueryContext {
  apiKey?: string;
}

export interface VideoEditSubmitResult {
  taskId: string;
}

export interface VideoEditQueryResult {
  errorCode?: string;
  errorMessage?: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  videoUrl: string | null;
}

export interface VideoEditDispatcher {
  query: (taskId: string, ctx?: VideoEditQueryContext) => Promise<VideoEditQueryResult>;
  submit: (input: VideoEditSubmitInput) => Promise<VideoEditSubmitResult>;
}

export class VideoEditError extends Error {
  code?: string;
  details?: unknown;
  status: number;

  constructor(message: string, status = 500, details?: unknown, options?: { code?: string }) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = options?.code;
  }
}
