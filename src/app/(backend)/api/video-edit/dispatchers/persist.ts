/**
 * 把 dispatcher 返回的临时视频 URL 落地到本地 RustFS / S3，
 * 返回可长期访问的对象地址。
 *
 * - 通过 `VIDEO_EDIT_PERSIST_TO_S3` 开关控制；未开启则原样返回。
 * - 仅当配齐 S3_ENDPOINT/S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY 时生效，
 *   缺失时降级返回原 URL（不阻断主流程）。
 * - 进程内缓存 taskId → 已落地的 URL，避免轮询期间重复下载上传。
 */
import urlJoin from 'url-join';

import { fileEnv } from '@/envs/file';
import { FileS3 } from '@/server/modules/S3';

const cache = new Map<string, string>();

function isEnabled(): boolean {
  return process.env.VIDEO_EDIT_PERSIST_TO_S3 === '1';
}

function publicUrlOf(key: string): string {
  if (fileEnv.S3_PUBLIC_DOMAIN) {
    return fileEnv.S3_ENABLE_PATH_STYLE
      ? urlJoin(fileEnv.S3_PUBLIC_DOMAIN, fileEnv.S3_BUCKET!, key)
      : urlJoin(fileEnv.S3_PUBLIC_DOMAIN, key);
  }
  // 没有公网域名时退化为内网代理路径，前端可经 Next.js 反代访问
  return `/api/files/${key}`;
}

function inferExt(url: string, contentType?: string | null): string {
  const m = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(url);
  if (m) return m[1].toLowerCase();
  if (contentType?.includes('mp4')) return 'mp4';
  if (contentType?.includes('webm')) return 'webm';
  return 'mp4';
}

/**
 * 下载远端视频并写入 S3。失败时抛错由调用方决定降级。
 */
async function uploadRemoteToS3(remoteUrl: string, taskKey: string): Promise<string> {
  const resp = await fetch(remoteUrl);
  if (!resp.ok) {
    throw new Error(`fetch remote video failed: ${resp.status}`);
  }
  const ab = await resp.arrayBuffer();
  const buffer = Buffer.from(ab);
  const ext = inferExt(remoteUrl, resp.headers.get('content-type'));
  const key = `video-edit/${taskKey.replaceAll(/[^\w-]/g, '_')}-${Date.now()}.${ext}`;

  const s3 = new FileS3();
  await s3.uploadBuffer(key, buffer, `video/${ext}`);
  return publicUrlOf(key);
}

/**
 * 转存远端视频到 RustFS / S3。失败 / 未启用 / 配置缺失时返回原 URL。
 *
 * @param taskKey 进程内幂等缓存的 key（建议 `${provider}:${taskId}`）
 * @param remoteUrl 来自上游模型平台的临时视频地址
 */
export async function persistRemoteVideo(taskKey: string, remoteUrl: string): Promise<string> {
  if (!isEnabled() || !remoteUrl) return remoteUrl;

  const cached = cache.get(taskKey);
  if (cached) return cached;

  if (!fileEnv.S3_ENDPOINT || !fileEnv.S3_BUCKET) {
    console.warn('[video-edit] persist enabled but S3 not configured; skip');
    return remoteUrl;
  }

  try {
    const persisted = await uploadRemoteToS3(remoteUrl, taskKey);
    cache.set(taskKey, persisted);
    return persisted;
  } catch (e) {
    console.error('[video-edit] persist to S3 failed:', e);
    return remoteUrl;
  }
}
