import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { appendAudio } from '../sessions';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  const { sessionId, audio } = body as { audio?: string; sessionId?: string };
  if (!sessionId || !audio) {
    return NextResponse.json({ error: 'sessionId and audio required' }, { status: 400 });
  }
  const ok = appendAudio(sessionId, audio);
  if (!ok) return NextResponse.json({ error: 'session not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
