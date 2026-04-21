'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Tag, Typography } from 'antd';
import { Mic, MicOff, Trash2 } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useSpeechStore } from '@/store/speech';

type RecordingStatus = 'error' | 'idle' | 'recording';

const SAMPLE_RATE = 16_000;
const BUFFER_SIZE = 4096;
// flush ~200ms of PCM per POST to keep latency low
const FLUSH_INTERVAL_SAMPLES = Math.floor(SAMPLE_RATE * 0.2);

function float32ToInt16Base64(float32: Float32Array): string {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    pcm16[i] = s < 0 ? s * 0x80_00 : s * 0x7f_ff;
  }
  const bytes = new Uint8Array(pcm16.buffer);
  let binary = '';
  const CHUNK = 0x80_00;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(binary);
}

const SpeechWorkspace = memo(() => {
  const { t } = useTranslation('speech');
  const language = useSpeechStore((s) => s.language);

  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const bufferRef = useRef<Float32Array[]>([]);
  const bufferSamplesRef = useRef(0);
  const languageRef = useRef(language);
  const isRecordingRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  // lookup of item_id -> final transcript so we render results in turn order
  const finalByItemRef = useRef<Map<string, string>>(new Map());
  const itemOrderRef = useRef<string[]>([]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  const rebuildTranscript = useCallback(() => {
    const parts: string[] = [];
    for (const id of itemOrderRef.current) {
      const txt = finalByItemRef.current.get(id);
      if (txt) parts.push(txt);
    }
    setTranscript(parts.join(' '));
  }, []);

  const handleServerEvent = useCallback(
    (event: Record<string, any>) => {
      const type = event.type as string;
      if (type === 'conversation.item.input_audio_transcription.text') {
        const text = (event.text as string) || '';
        const stash = (event.stash as string) || '';
        setInterimText(text + stash);
      } else if (type === 'conversation.item.input_audio_transcription.completed') {
        const transcriptText = (event.transcript as string) || '';
        const itemId = (event.item_id as string) || `auto_${Date.now()}`;
        if (!finalByItemRef.current.has(itemId)) {
          itemOrderRef.current.push(itemId);
        }
        finalByItemRef.current.set(itemId, transcriptText);
        setInterimText('');
        rebuildTranscript();
      } else if (type === 'error') {
        setErrorMsg(event.error?.message || 'ASR error');
      }
    },
    [rebuildTranscript],
  );

  const sendAudio = useCallback(async (audioBase64: string) => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      await fetch('/api/asr/audio', {
        body: JSON.stringify({ audio: audioBase64, sessionId: sid }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
    } catch {
      // swallow; the SSE channel will surface errors
    }
  }, []);

  const flushBuffer = useCallback(() => {
    const totalSamples = bufferSamplesRef.current;
    if (totalSamples === 0) return;
    const combined = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of bufferRef.current) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    bufferRef.current = [];
    bufferSamplesRef.current = 0;
    sendAudio(float32ToInt16Base64(combined));
  }, [sendAudio]);

  const teardownAudio = useCallback(() => {
    isRecordingRef.current = false;
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    audioCtxRef.current?.close();
    processorRef.current = null;
    sourceRef.current = null;
    audioCtxRef.current = null;
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
  }, []);

  const teardownSse = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    sessionIdRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setErrorMsg('');
      finalByItemRef.current = new Map();
      itemOrderRef.current = [];
      setTranscript('');
      setInterimText('');

      const resp = await fetch('/api/asr', {
        body: JSON.stringify({ language: languageRef.current }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const data = await resp.json();
      if (!resp.ok || !data.sessionId) {
        setStatus('error');
        setErrorMsg(data.error || 'failed to create session');
        return;
      }
      sessionIdRef.current = data.sessionId;

      const es = new EventSource(`/api/asr/stream?sessionId=${data.sessionId}`);
      esRef.current = es;
      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          handleServerEvent(event);
        } catch {
          // ignore
        }
      };
      es.onerror = () => {
        // connection dropped — will reflect via status if recording ongoing
      };

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const AudioCtxCtor = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx: AudioContext = new AudioCtxCtor({ sampleRate: SAMPLE_RATE });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const processor = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);
      processorRef.current = processor;

      bufferRef.current = [];
      bufferSamplesRef.current = 0;
      isRecordingRef.current = true;

      processor.onaudioprocess = (e) => {
        if (!isRecordingRef.current) return;
        const input = e.inputBuffer.getChannelData(0);
        bufferRef.current.push(new Float32Array(input));
        bufferSamplesRef.current += input.length;
        if (bufferSamplesRef.current >= FLUSH_INTERVAL_SAMPLES) {
          flushBuffer();
        }
      };

      source.connect(processor);
      const mutedGain = audioCtx.createGain();
      mutedGain.gain.value = 0;
      processor.connect(mutedGain);
      mutedGain.connect(audioCtx.destination);

      setStatus('recording');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : t('workspace.micError'));
      teardownAudio();
      teardownSse();
    }
  }, [flushBuffer, handleServerEvent, t, teardownAudio, teardownSse]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    flushBuffer();
    teardownAudio();

    const sid = sessionIdRef.current;
    if (sid) {
      fetch(`/api/asr?sessionId=${sid}&mode=finish`, { method: 'DELETE' }).catch(() => {
        // ignore
      });
    }
    // keep SSE briefly to receive final completed events
    setTimeout(() => {
      teardownSse();
    }, 3000);

    setStatus('idle');
  }, [flushBuffer, teardownAudio, teardownSse]);

  useEffect(() => {
    return () => {
      teardownAudio();
      const sid = sessionIdRef.current;
      if (sid) {
        fetch(`/api/asr?sessionId=${sid}&mode=close`, { method: 'DELETE' }).catch(() => {
          // ignore
        });
      }
      teardownSse();
    };
  }, [teardownAudio, teardownSse]);

  const isRecording = status === 'recording';

  return (
    <Flexbox gap={24} padding={24} style={{ height: '100%', overflowY: 'auto' }}>
      <Flexbox horizontal align="center" gap={8}>
        <Mic size={20} />
        <Typography.Title level={4} style={{ margin: 0 }}>
          {t('workspace.title')}
        </Typography.Title>
      </Flexbox>

      <Flexbox horizontal align="center" gap={16}>
        <Button
          danger={isRecording}
          icon={isRecording ? <MicOff size={16} /> : <Mic size={16} />}
          size="large"
          type={isRecording ? 'default' : 'primary'}
          onClick={isRecording ? stopRecording : startRecording}
        >
          {isRecording ? t('workspace.stopButton') : t('workspace.startButton')}
        </Button>

        {isRecording && (
          <Tag color="red" style={{ fontSize: 13 }}>
            {t('workspace.recording')}
          </Tag>
        )}
      </Flexbox>

      {errorMsg && <Typography.Text type="danger">{errorMsg}</Typography.Text>}

      {interimText && (
        <Typography.Text italic type="secondary">
          {interimText}
        </Typography.Text>
      )}

      <Flexbox
        gap={12}
        style={{
          background: 'rgba(0,0,0,0.02)',
          borderRadius: 8,
          flex: 1,
          minHeight: 200,
          padding: 16,
        }}
      >
        <Flexbox horizontal align="center" justify="space-between">
          <Typography.Text strong>{t('workspace.transcriptLabel')}</Typography.Text>
          {transcript && (
            <Button
              icon={<Trash2 size={14} />}
              size="small"
              type="text"
              onClick={() => {
                finalByItemRef.current = new Map();
                itemOrderRef.current = [];
                setTranscript('');
              }}
            />
          )}
        </Flexbox>

        {transcript ? (
          <Typography.Paragraph
            copyable
            style={{ fontSize: 15, lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap' }}
          >
            {transcript}
          </Typography.Paragraph>
        ) : (
          <Typography.Text type="secondary">{t('workspace.emptyHint')}</Typography.Text>
        )}
      </Flexbox>
    </Flexbox>
  );
});

SpeechWorkspace.displayName = 'SpeechWorkspace';

export default SpeechWorkspace;
