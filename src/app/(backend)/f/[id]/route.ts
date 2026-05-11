import debug from 'debug';

import { FileModel } from '@/database/models/file';
import { getServerDB } from '@/database/server';
import { getRedisConfig } from '@/envs/redis';
import { initializeRedis, isRedisEnabled } from '@/libs/redis';
import { FileService } from '@/server/services/file';

const log = debug('lobe-file:proxy');

type Params = Promise<{ id: string }>;

const FILE_PROXY_KEY_PREFIX = 'file-proxy:';
// Cache presigned URL for 4 minutes (URL expires in 5 minutes)
const PRESIGNED_URL_CACHE_TTL = 240;

const buildCacheKey = (id: string) => `${FILE_PROXY_KEY_PREFIX}${id}`;

interface CachedFileData {
  redirectUrl: string;
}

/**
 * File proxy service
 * GET /f/:id
 *
 * Features:
 * - Query database to get file record (without userId filter for public access)
 * - Generate access URL based on platform (desktop → local file, web → S3 presigned URL)
 * - Cache presigned URL in Redis to reduce S3 API calls
 * - Return 302 redirect
 */
export const GET = async (req: Request, segmentData: { params: Params }) => {
  try {
    const params = await segmentData.params;
    const { id } = params;

    // 当客户端无法跟随 302 到内网 MinIO（例如外部 AI 服务回拉素材）时，
    // 用 ?stream=1 让本服务直接把字节流出去。
    const streamMode = new URL(req.url).searchParams.get('stream') === '1';

    log('File proxy request: %s (stream=%s)', id, streamMode);

    const redisConfig = getRedisConfig();
    const redisClient = isRedisEnabled(redisConfig) ? await initializeRedis(redisConfig) : null;

    const cacheKey = buildCacheKey(id);
    let redirectUrl: string | null = null;

    if (redisClient) {
      const cachedStr = await redisClient.get(cacheKey);
      const cached = cachedStr ? (JSON.parse(cachedStr) as CachedFileData) : null;
      if (cached?.redirectUrl) {
        log('Cache hit for file: %s', id);
        redirectUrl = cached.redirectUrl;
      } else {
        log('Cache miss for file: %s', id);
      }
    }

    if (!redirectUrl) {
      const db = await getServerDB();
      const file = await FileModel.getFileById(db, id);
      if (!file) {
        log('File not found: %s', id);
        return new Response('File not found', { status: 404 });
      }
      const fileService = new FileService(db, file.userId);
      redirectUrl = await fileService.createPreSignedUrlForPreview(file.url, 300);
      log('Web S3 presigned URL generated (expires in 5 min)');

      if (redisClient) {
        await redisClient.set(cacheKey, JSON.stringify({ redirectUrl }), {
          ex: PRESIGNED_URL_CACHE_TTL,
        });
        log('Cached presigned URL for file: %s (TTL: %ds)', id, PRESIGNED_URL_CACHE_TTL);
      }
    }

    if (!streamMode) {
      return Response.redirect(redirectUrl, 302);
    }

    const upstream = await fetch(redirectUrl);
    if (!upstream.ok || !upstream.body) {
      log('Stream upstream failed: %s %s', id, upstream.status);
      return new Response('Upstream fetch failed', { status: 502 });
    }
    const headers = new Headers();
    const passThrough = ['content-type', 'content-length', 'accept-ranges', 'etag'];
    for (const key of passThrough) {
      const value = upstream.headers.get(key);
      if (value) headers.set(key, value);
    }
    headers.set('cache-control', 'private, max-age=60');
    return new Response(upstream.body, { headers, status: 200 });
  } catch (error) {
    console.error('File proxy error:', error);
    return new Response('Internal server error', {
      status: 500,
    });
  }
};
