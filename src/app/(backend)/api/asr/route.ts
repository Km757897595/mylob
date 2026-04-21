import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { closeSession, createSession, finishSession, hasSession } from './sessions';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!process.env.DASHSCOPE_API_KEY) {
    return NextResponse.json({ error: 'DASHSCOPE_API_KEY is not configured' }, { status: 500 });
  }
  const body = await req.json().catch(() => ({}));
  const language = (body.language as string) || 'zh';
  const session = createSession(language);
  return NextResponse.json({ sessionId: session.id });
}

export async function DELETE(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId || !hasSession(sessionId)) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }
  const mode = req.nextUrl.searchParams.get('mode') || 'finish';
  if (mode === 'finish') {
    finishSession(sessionId);
  } else {
    closeSession(sessionId);
  }
  return NextResponse.json({ ok: true });
}
