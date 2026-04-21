import debug from 'debug';
import WebSocket from 'ws';

const log = debug('lobe-asr:session');

const DASHSCOPE_MODEL = process.env.DASHSCOPE_ASR_MODEL || 'qwen3-asr-flash-realtime';
const DASHSCOPE_WS_URL = `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${DASHSCOPE_MODEL}`;

export interface AsrSession {
  audioBuffer: string[];
  id: string;
  language: string;
  ready: boolean;
  sse?: {
    close: () => void;
    send: (event: Record<string, any>) => void;
  };
  ws: WebSocket;
}

// Persist across route-handler bundle instances and HMR reloads (Next.js dev)
const globalForSessions = globalThis as unknown as {
  __asrSessions?: Map<string, AsrSession>;
};
const sessions: Map<string, AsrSession> =
  globalForSessions.__asrSessions ?? new Map<string, AsrSession>();
globalForSessions.__asrSessions = sessions;

function randomId() {
  return `asr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getSession(id: string): AsrSession | undefined {
  return sessions.get(id);
}

export function hasSession(id: string): boolean {
  return sessions.has(id);
}

export function createSession(language: string): AsrSession {
  const apiKey = process.env.DASHSCOPE_API_KEY || '';
  const id = randomId();
  const ws = new WebSocket(DASHSCOPE_WS_URL, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  const session: AsrSession = {
    audioBuffer: [],
    id,
    language,
    ready: false,
    ws,
  };
  sessions.set(id, session);

  ws.on('open', () => {
    log('[%s] ws opened', id);
  });

  ws.on('message', (data: Buffer) => {
    let event: Record<string, any>;
    try {
      event = JSON.parse(data.toString());
    } catch {
      return;
    }
    const type = event.type as string;
    log('[%s] ws event: %s %o', id, type, type === 'error' ? event : {});

    if (type === 'error') console.error('[asr] dashscope error:', event);

    if (type === 'session.created') {
      ws.send(
        JSON.stringify({
          event_id: `upd_${Date.now()}`,
          session: {
            input_audio_format: 'pcm',
            input_audio_transcription: { language },
            sample_rate: 16_000,
            turn_detection: {
              silence_duration_ms: 800,
              threshold: 0.2,
              type: 'server_vad',
            },
          },
          type: 'session.update',
        }),
      );
    }

    if (type === 'session.updated') {
      session.ready = true;
      // flush any buffered audio
      while (session.audioBuffer.length > 0) {
        const audio = session.audioBuffer.shift()!;
        ws.send(
          JSON.stringify({
            audio,
            event_id: `app_${Date.now()}`,
            type: 'input_audio_buffer.append',
          }),
        );
      }
    }

    session.sse?.send(event);

    if (type === 'session.finished' || type === 'error') {
      closeSession(id);
    }
  });

  ws.on('error', (err) => {
    log('[%s] ws error: %s', id, err.message);
    session.sse?.send({ error: { message: err.message }, type: 'error' });
    closeSession(id);
  });

  ws.on('unexpected-response', (_req, res) => {
    console.error('[asr] unexpected-response status=%s headers=%o', res.statusCode, res.headers);
  });

  ws.on('close', (code, reason) => {
    log('[%s] ws closed code=%s reason=%s', id, code, reason.toString());

    console.error('[asr] ws closed code=%s reason=%s', code, reason.toString());
    session.sse?.send({ code, reason: reason.toString(), type: 'session.closed' });
    session.sse?.close();
    sessions.delete(id);
  });

  return session;
}

export function appendAudio(sessionId: string, audioBase64: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  if (!session.ready) {
    session.audioBuffer.push(audioBase64);
    return true;
  }
  if (session.ws.readyState !== WebSocket.OPEN) return false;
  session.ws.send(
    JSON.stringify({
      audio: audioBase64,
      event_id: `app_${Date.now()}`,
      type: 'input_audio_buffer.append',
    }),
  );
  return true;
}

export function finishSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;
  if (session.ws.readyState === WebSocket.OPEN) {
    session.ws.send(
      JSON.stringify({
        event_id: `fin_${Date.now()}`,
        type: 'session.finish',
      }),
    );
  }
}

export function closeSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;
  try {
    if (
      session.ws.readyState === WebSocket.OPEN ||
      session.ws.readyState === WebSocket.CONNECTING
    ) {
      session.ws.close();
    }
  } catch {
    // ignore
  }
  session.sse?.close();
  sessions.delete(sessionId);
}

export function attachSse(
  sessionId: string,
  sse: { close: () => void; send: (event: Record<string, any>) => void },
): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  session.sse = sse;
  return true;
}
