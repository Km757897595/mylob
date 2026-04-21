import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';
const DASHSCOPE_BASE = 'https://dashscope.aliyuncs.com/api/v1';

/**
 * Rewrite an internal proxy URL (e.g. http://localhost:3010/f/:id) into a
 * publicly reachable URL so DashScope can fetch it. Only the origin is
 * replaced; already-public URLs are returned unchanged.
 */
function toPublicUrl(url: string): string {
  const publicOrigin = process.env.WEBHOOK_PROXY_URL || process.env.APP_URL;
  if (!publicOrigin) return url;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const isInternal =
      host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local') || host === '0.0.0.0';
    if (!isInternal) return url;
    const base = new URL(publicOrigin);
    parsed.protocol = base.protocol;
    parsed.hostname = base.hostname;
    parsed.port = base.port;
    return parsed.toString();
  } catch {
    return url;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { prompt, videoUrl, referenceImages = [], resolution = '720P', promptExtend = true } = body;

  if (!videoUrl) {
    return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 });
  }
  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  const media: Array<{ type: string; url: string }> = [
    { type: 'video', url: toPublicUrl(videoUrl) },
  ];
  for (const imgUrl of referenceImages) {
    media.push({ type: 'reference_image', url: toPublicUrl(imgUrl) });
  }

  const payload = {
    model: 'wan2.7-videoedit',
    input: { media, prompt },
    parameters: { prompt_extend: promptExtend, resolution },
  };

  // eslint-disable-next-line no-console
  console.log('[video-edit] submit payload:', JSON.stringify(payload));

  const resp = await fetch(`${DASHSCOPE_BASE}/services/aigc/video-generation/video-synthesis`, {
    body: JSON.stringify(payload),
    headers: {
      'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable',
    },
    method: 'POST',
  });

  const data = await resp.json();
  if (!resp.ok) {
    console.error('[video-edit] DashScope error:', resp.status, data);
    return NextResponse.json(
      { error: data.message || 'DashScope API error', details: data },
      { status: resp.status },
    );
  }

  return NextResponse.json({ taskId: data.output?.task_id });
}

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get('taskId');
  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
  }

  const resp = await fetch(`${DASHSCOPE_BASE}/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${DASHSCOPE_API_KEY}` },
  });

  const data = await resp.json();
  if (!resp.ok) {
    return NextResponse.json(
      { error: data.message || 'DashScope API error' },
      { status: resp.status },
    );
  }

  const output = data.output ?? {};
  return NextResponse.json({
    status: output.task_status,
    videoUrl: output.video_url ?? null,
  });
}
