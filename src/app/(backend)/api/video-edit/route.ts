import { getUserAuth } from '@lobechat/utils/server';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { AiProviderModel } from '@/database/models/aiProvider';
import { getServerDB } from '@/database/server';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';

import { getDispatcher, listSupportedProviders, VideoEditError } from './dispatchers';

export const runtime = 'nodejs';
export const maxDuration = 60;

const DEFAULT_PROVIDER = 'dashscope';

/**
 * 阿里云百炼 (Aliyun Bailian) 在 LobeChat AI 服务商体系里的 id 是 `qwen`，
 * 此 dispatcher 把它和 `dashscope` 视为同一套 keyVault 来源。
 */
const BAILIAN_PROVIDER_ID = 'qwen';

function decodeTaskId(raw: string): { provider: string; taskId: string } {
  const idx = raw.indexOf(':');
  if (idx === -1) return { provider: DEFAULT_PROVIDER, taskId: raw };
  return { provider: raw.slice(0, idx), taskId: raw.slice(idx + 1) };
}

/**
 * 解析用户在「设置 → AI 服务商 → 阿里云百炼」中配置的 apiKey。
 * 未登录或未配置时返回 undefined，由 dispatcher 决定是否回退到 env。
 */
async function resolveBailianApiKey(): Promise<string | undefined> {
  try {
    const { userId } = await getUserAuth();
    if (!userId) return undefined;
    const db = await getServerDB();
    const provider = await new AiProviderModel(db, userId).getAiProviderById(
      BAILIAN_PROVIDER_ID,
      KeyVaultsGateKeeper.getUserKeyVaults,
    );
    const apiKey = (provider?.keyVaults as { apiKey?: string } | undefined)?.apiKey;
    return apiKey || undefined;
  } catch {
    return undefined;
  }
}

async function resolveCreds(provider: string) {
  if (provider === 'dashscope' || provider === 'qwen') {
    const apiKey = await resolveBailianApiKey();
    return { apiKey };
  }
  return {};
}

function errorResponse(err: VideoEditError) {
  return NextResponse.json(
    { code: err.code, details: err.details, error: err.message },
    { status: err.status },
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    duration,
    model,
    prompt,
    provider = DEFAULT_PROVIDER,
    referenceImages = [],
    resolution = '720P',
    videoUrl,
  } = body || {};

  if (!videoUrl) {
    return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 });
  }
  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }
  if (!model) {
    return NextResponse.json({ error: 'model is required' }, { status: 400 });
  }

  const dispatcher = getDispatcher(provider);
  if (!dispatcher) {
    return NextResponse.json(
      {
        error: `Unsupported provider "${provider}". Supported: ${listSupportedProviders().join(', ')}`,
      },
      { status: 400 },
    );
  }

  try {
    const creds = await resolveCreds(provider);
    const { taskId } = await dispatcher.submit({
      ...creds,
      duration,
      model,
      prompt,
      referenceImages,
      resolution,
      videoUrl,
    });
    return NextResponse.json({ taskId: `${provider}:${taskId}` });
  } catch (e) {
    const err = e instanceof VideoEditError ? e : new VideoEditError(String(e), 500);
    console.error('[video-edit] submit error:', err.message, err.details);
    return errorResponse(err);
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('taskId');
  if (!raw) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
  }

  const { provider, taskId } = decodeTaskId(raw);
  const dispatcher = getDispatcher(provider);
  if (!dispatcher) {
    return NextResponse.json({ error: `Unsupported provider "${provider}"` }, { status: 400 });
  }

  try {
    const creds = await resolveCreds(provider);
    const result = await dispatcher.query(taskId, creds);
    return NextResponse.json(result);
  } catch (e) {
    const err = e instanceof VideoEditError ? e : new VideoEditError(String(e), 500);
    console.error('[video-edit] query error:', err.message);
    return errorResponse(err);
  }
}
