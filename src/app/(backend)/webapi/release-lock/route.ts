import { auth } from '@/auth';
import { getServerDB } from '@/database/core/db-adaptor';
import { TopicModel } from '@/database/models/topic';

/**
 * sendBeacon 端点：用户关闭页面时释放话题锁定
 * 使用 sendBeacon 发送的请求没有 TRPC 上下文，需要独立处理认证
 */
export const POST = async (req: Request) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { topicId } = (await req.json()) as { topicId: string };

    if (!topicId) {
      return new Response(JSON.stringify({ error: 'topicId is required' }), { status: 400 });
    }

    const serverDB = await getServerDB();
    const topicModel = new TopicModel(serverDB, userId);
    await topicModel.releaseLock(topicId);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
};
