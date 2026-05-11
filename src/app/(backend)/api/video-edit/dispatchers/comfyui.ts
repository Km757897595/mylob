/**
 * ComfyUI 本地视频编辑 dispatcher
 *
 * 离线运行：仅访问 COMFYUI_BASE_URL 指向的本地 ComfyUI 服务，不发起任何外网请求。
 *
 * 工作流模板加载顺序：
 * 1. process.env.COMFYUI_VIDEO_EDIT_WORKFLOW —— 直接内联 JSON 字符串
 * 2. process.env.COMFYUI_VIDEO_EDIT_WORKFLOW_PATH —— 本地 JSON 文件路径
 *
 * 模板支持的占位符（字符串替换）：
 *   {{video_filename}}  上传后的源视频文件名
 *   {{prompt}}          编辑提示词
 *   {{width}} / {{height}}  分辨率
 *   {{frames}}          目标帧数（duration * 16fps）
 */
import { persistRemoteVideo } from './persist';
import type {
  VideoEditDispatcher,
  VideoEditQueryResult,
  VideoEditSubmitInput,
  VideoEditSubmitResult,
} from './types';
import { VideoEditError } from './types';

interface ComfyHistoryEntry {
  outputs?: Record<string, { gifs?: ComfyOutputFile[]; videos?: ComfyOutputFile[] }>;
  status?: { completed?: boolean; status_str?: string };
}

interface ComfyOutputFile {
  filename: string;
  subfolder?: string;
  type?: string;
}

function getBaseURL(): string {
  return (
    process.env.COMFYUI_VIDEO_EDIT_BASE_URL ||
    process.env.COMFYUI_BASE_URL ||
    process.env.COMFYUI_DEFAULT_URL ||
    'http://127.0.0.1:8188'
  ).replace(/\/+$/, '');
}

async function loadWorkflowTemplate(): Promise<string> {
  const inline = process.env.COMFYUI_VIDEO_EDIT_WORKFLOW;
  if (inline) return inline;

  const path = process.env.COMFYUI_VIDEO_EDIT_WORKFLOW_PATH;
  if (path) {
    const fs = await import('node:fs/promises');
    return await fs.readFile(path, 'utf8');
  }

  throw new VideoEditError(
    'ComfyUI workflow template not configured. Set COMFYUI_VIDEO_EDIT_WORKFLOW or COMFYUI_VIDEO_EDIT_WORKFLOW_PATH.',
    500,
  );
}

/**
 * 把请求里的 videoUrl（data:URL / http(s) / 内网代理 URL）取回为 Buffer。
 */
async function fetchVideoBuffer(videoUrl: string): Promise<{ buffer: Buffer; filename: string }> {
  if (videoUrl.startsWith('data:')) {
    const match = videoUrl.match(/^data:(.+?);base64,(.*)$/);
    if (!match) throw new VideoEditError('Invalid data URL for videoUrl', 400);
    const mime = match[1];
    const ext = mime.split('/')[1] || 'mp4';
    return {
      buffer: Buffer.from(match[2], 'base64'),
      filename: `video-edit-${Date.now()}.${ext}`,
    };
  }
  const resp = await fetch(videoUrl);
  if (!resp.ok) {
    throw new VideoEditError(`Failed to fetch source video: ${resp.status}`, 400);
  }
  const ab = await resp.arrayBuffer();
  const urlPath = new URL(videoUrl).pathname.split('/').pop() || `video-${Date.now()}.mp4`;
  return { buffer: Buffer.from(ab), filename: urlPath };
}

async function uploadToComfyUI(baseURL: string, buffer: Buffer, filename: string): Promise<string> {
  const form = new FormData();
  form.append('image', new Blob([buffer]), filename);
  form.append('overwrite', 'true');
  const resp = await fetch(`${baseURL}/upload/image`, { body: form, method: 'POST' });
  if (!resp.ok) {
    const text = await resp.text();
    throw new VideoEditError(`ComfyUI upload failed: ${text}`, resp.status);
  }
  const data = (await resp.json()) as { name?: string };
  if (!data.name) throw new VideoEditError('ComfyUI upload returned no filename', 500);
  return data.name;
}

function applyPlaceholders(template: string, vars: Record<string, string>): string {
  return template.replaceAll(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? '');
}

async function submit(input: VideoEditSubmitInput): Promise<VideoEditSubmitResult> {
  const baseURL = getBaseURL();
  const template = await loadWorkflowTemplate();

  const { videoUrl, prompt, resolution = '720P', duration = 5 } = input;
  const { width, height } =
    resolution === '480P' ? { height: 480, width: 854 } : { height: 720, width: 1280 };
  const frames = Math.max(1, Math.min(5, duration)) * 16;

  const { buffer, filename } = await fetchVideoBuffer(videoUrl);
  const uploaded = await uploadToComfyUI(baseURL, buffer, filename);

  const filled = applyPlaceholders(template, {
    frames: String(frames),
    height: String(height),
    prompt,
    video_filename: uploaded,
    width: String(width),
  });

  let workflow: unknown;
  try {
    workflow = JSON.parse(filled);
  } catch (e) {
    throw new VideoEditError('ComfyUI workflow template is not valid JSON', 500, String(e));
  }

  const resp = await fetch(`${baseURL}/prompt`, {
    body: JSON.stringify({ prompt: workflow }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  const data = (await resp.json()) as { error?: unknown; prompt_id?: string };
  if (!resp.ok || !data.prompt_id) {
    throw new VideoEditError('ComfyUI queue prompt failed', resp.status || 500, data);
  }
  return { taskId: data.prompt_id };
}

async function query(taskId: string): Promise<VideoEditQueryResult> {
  const baseURL = getBaseURL();
  let resp: Response;
  try {
    resp = await fetch(`${baseURL}/history/${taskId}`);
  } catch (e) {
    console.warn('[video-edit:comfyui] transient query error, keep polling:', e);
    return { status: 'PROCESSING', videoUrl: null };
  }
  if (!resp.ok) {
    if (resp.status >= 500) return { status: 'PROCESSING', videoUrl: null };
    throw new VideoEditError('ComfyUI history fetch failed', resp.status);
  }
  const history = (await resp.json()) as Record<string, ComfyHistoryEntry>;
  const entry = history[taskId];
  if (!entry) return { status: 'PROCESSING', videoUrl: null };

  const statusStr = entry.status?.status_str?.toLowerCase();
  if (statusStr === 'error') return { status: 'FAILED', videoUrl: null };
  if (!entry.status?.completed) return { status: 'PROCESSING', videoUrl: null };

  for (const node of Object.values(entry.outputs || {})) {
    const file = node.videos?.[0] || node.gifs?.[0];
    if (file?.filename) {
      const params = new URLSearchParams({
        filename: file.filename,
        subfolder: file.subfolder || '',
        type: file.type || 'output',
      });
      const remoteUrl = `${baseURL}/view?${params.toString()}`;
      const videoUrl = await persistRemoteVideo(`comfyui:${taskId}`, remoteUrl);
      return { status: 'SUCCEEDED', videoUrl };
    }
  }
  return { status: 'FAILED', videoUrl: null };
}

export const comfyuiDispatcher: VideoEditDispatcher = { query, submit };
