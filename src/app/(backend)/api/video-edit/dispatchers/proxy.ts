/**
 * 仅用于外部 AI 服务（DashScope 等）出网请求的代理 dispatcher 工厂。
 *
 * 不挂全局 dispatcher，避免污染本地回环（Vite dev、MinIO、Postgres 等）。
 * 由调用方在 fetch options 里显式传入 `dispatcher`。
 */
import type { Dispatcher } from 'undici';

let cached: Dispatcher | null | undefined;

export async function getOutboundProxyDispatcher(): Promise<Dispatcher | undefined> {
  if (cached !== undefined) return cached ?? undefined;

  const proxyUrl = process.env.VIDEO_EDIT_OUTBOUND_PROXY;
  if (!proxyUrl) {
    cached = null;
    return undefined;
  }

  try {
    const { ProxyAgent } = await import('undici');
    cached = new ProxyAgent(proxyUrl);
    // eslint-disable-next-line no-console
    console.log(`[video-edit] outbound ProxyAgent ready -> ${proxyUrl}`);
    return cached;
  } catch (e) {
    console.warn('[video-edit] failed to init ProxyAgent:', e);
    cached = null;
    return undefined;
  }
}
