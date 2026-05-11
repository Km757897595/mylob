/**
 * 阿里云 DashScope wan-video-edit dispatcher
 *
 * 文档：https://help.aliyun.com/zh/model-studio/wan-video-editing-api-reference
 */
import { persistRemoteVideo } from './persist';
import { getOutboundProxyDispatcher } from './proxy';
import type {
  VideoEditDispatcher,
  VideoEditQueryContext,
  VideoEditQueryResult,
  VideoEditSubmitInput,
  VideoEditSubmitResult,
} from './types';
import { VideoEditError } from './types';

const DASHSCOPE_BASE = 'https://dashscope.aliyuncs.com/api/v1';

export const MISSING_DASHSCOPE_KEY_CODE = 'MISSING_DASHSCOPE_KEY';

function resolveApiKey(override?: string): string {
  const key = override || process.env.DASHSCOPE_API_KEY;
  if (!key) {
    throw new VideoEditError('DashScope API key is not configured', 400, undefined, {
      code: MISSING_DASHSCOPE_KEY_CODE,
    });
  }
  return key;
}

/**
 * 内网代理 URL 改写为对外可访问的 URL，让 DashScope 能够拉取素材。
 * 已经是公网地址则原样返回。
 */
function toPublicUrl(url: string): string {
  const publicOrigin = process.env.WEBHOOK_PROXY_URL || process.env.APP_URL;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const isInternal =
      host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local') || host === '0.0.0.0';
    if (isInternal && publicOrigin) {
      const base = new URL(publicOrigin);
      parsed.protocol = base.protocol;
      parsed.hostname = base.hostname;
      parsed.port = base.port;
    }
    // 走我们自己的 /f/:id 代理时强制 stream 模式：避免 302 到内网 MinIO 让外部 AI 服务无法回拉。
    if (parsed.pathname.startsWith('/f/') && !parsed.searchParams.has('stream')) {
      parsed.searchParams.set('stream', '1');
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

async function submit(input: VideoEditSubmitInput): Promise<VideoEditSubmitResult> {
  const apiKey = resolveApiKey(input.apiKey);
  const { model, prompt, videoUrl, referenceImages = [], resolution = '720P', duration } = input;

  const media: Array<{ type: string; url: string }> = [
    { type: 'video', url: toPublicUrl(videoUrl) },
  ];
  for (const imgUrl of referenceImages) {
    if (imgUrl) media.push({ type: 'reference_image', url: toPublicUrl(imgUrl) });
  }

  const parameters: Record<string, unknown> = {
    prompt_extend: true,
    resolution,
  };
  if (duration) parameters.duration = duration;

  const payload = { input: { media, prompt }, model, parameters };

  // eslint-disable-next-line no-console
  console.log('[video-edit:dashscope] submit:', JSON.stringify(payload));

  const dispatcher = await getOutboundProxyDispatcher();
  let resp: Response;
  try {
    resp = await fetch(`${DASHSCOPE_BASE}/services/aigc/video-generation/video-synthesis`, {
      body: JSON.stringify(payload),
      // @ts-expect-error undici-specific option, supported by Node fetch
      dispatcher,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      method: 'POST',
    });
  } catch (e) {
    const cause = (e as { cause?: unknown }).cause;
    console.error('[video-edit:dashscope] network error:', e, 'cause:', cause);
    throw new VideoEditError(`DashScope network error: ${(e as Error).message}`, 502, {
      cause: cause ? String(cause) : undefined,
    });
  }

  const data = await resp.json();
  if (!resp.ok || !data.output?.task_id) {
    throw new VideoEditError(data.message || 'DashScope API error', resp.status || 500, data);
  }
  return { taskId: data.output.task_id };
}

async function query(taskId: string, ctx?: VideoEditQueryContext): Promise<VideoEditQueryResult> {
  const apiKey = resolveApiKey(ctx?.apiKey);
  const dispatcher = await getOutboundProxyDispatcher();
  let resp: Response;
  try {
    resp = await fetch(`${DASHSCOPE_BASE}/tasks/${taskId}`, {
      // @ts-expect-error undici-specific option
      dispatcher,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch (e) {
    // 网络抖动（fetch failed / ETIMEDOUT 等）当作仍在处理中，让前端继续轮询。
    console.warn('[video-edit:dashscope] transient query error, keep polling:', e);
    return { status: 'PROCESSING', videoUrl: null };
  }
  const data = await resp.json().catch(() => ({}) as Record<string, unknown>);
  if (!resp.ok) {
    // 5xx 也按可重试处理；4xx 才算真错。
    if (resp.status >= 500) {
      console.warn('[video-edit:dashscope] upstream 5xx, keep polling:', resp.status);
      return { status: 'PROCESSING', videoUrl: null };
    }
    throw new VideoEditError(
      (data as { message?: string }).message || 'DashScope API error',
      resp.status,
      data,
    );
  }
  const output = data.output ?? {};
  const raw = String(output.task_status || '').toUpperCase();
  let status: VideoEditQueryResult['status'] = 'PROCESSING';
  if (raw === 'SUCCEEDED') status = 'SUCCEEDED';
  else if (raw === 'FAILED' || raw === 'UNKNOWN') status = 'FAILED';
  else if (raw === 'PENDING') status = 'PENDING';

  let videoUrl: string | null = output.video_url ?? null;
  if (status === 'SUCCEEDED' && videoUrl) {
    videoUrl = await persistRemoteVideo(`dashscope:${taskId}`, videoUrl);
  }

  if (status === 'FAILED') {
    console.error('[video-edit:dashscope] task failed:', JSON.stringify(data));
    return {
      errorCode: output.code || data.code,
      errorMessage: output.message || data.message || 'DashScope task failed',
      status,
      videoUrl: null,
    };
  }

  return { status, videoUrl };
}

export const dashscopeDispatcher: VideoEditDispatcher = { query, submit };
