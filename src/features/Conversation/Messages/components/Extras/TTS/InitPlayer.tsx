import { getMessageError } from '@lobechat/fetch-sse';
import { type ChatMessageError, type ChatTTS } from '@lobechat/types';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useTTS } from '@/hooks/useTTS';
import { useFileStore } from '@/store/file';

import { useConversationStore } from '../../../../store';
import Player from './Player';

export interface TTSProps extends ChatTTS {
  content: string;
  id: string;
  loading?: boolean;
}

const InitPlayer = memo<TTSProps>(({ id, content, contentMd5, file }) => {
  const [isStart, setIsStart] = useState(false);
  const [error, setError] = useState<ChatMessageError>();
  const isDeletedRef = useRef(false);
  const isAutoStartedRef = useRef(false);
  const uploadTTS = useFileStore((s) => s.uploadTTSByArrayBuffers);
  const { t } = useTranslation('chat');

  const [ttsMessage, clearTTS] = useConversationStore((s) => [s.ttsMessage, s.clearTTS]);

  const setDefaultError = useCallback(
    (err?: any) => {
      setError({ body: err, message: t('tts.responseError', { ns: 'error' }), type: 500 });
    },
    [t],
  );

  const { isGlobalLoading, audio, start, stop, response } = useTTS(content, {
    onError: (err) => {
      if (isDeletedRef.current) return;
      stop();
      setDefaultError(err);
    },
    onErrorRetry: (err) => {
      if (isDeletedRef.current) return;
      stop();
      setDefaultError(err);
    },
    onSuccess: async () => {
      if (isDeletedRef.current) return;
      if (!response || response.ok) return;
      const message = await getMessageError(response);
      if (message) {
        setError(message);
      } else {
        setDefaultError();
      }
      stop();
    },
    onUpload: async (currentVoice, arrayBuffers) => {
      if (isDeletedRef.current) return;
      const fileID = await uploadTTS(id, arrayBuffers);
      if (isDeletedRef.current) return;
      ttsMessage(id, { contentMd5, file: fileID, voice: currentVoice });
    },
  });

  const handleInitStart = useCallback(() => {
    if (isStart) return;
    start();
    setIsStart(true);
  }, [isStart, start]);

  const handleDelete = useCallback(() => {
    isDeletedRef.current = true;
    stop();
    clearTTS(id);
  }, [stop, id, clearTTS]);

  const handleRetry = useCallback(() => {
    setError(undefined);
    start();
  }, [start]);

  useEffect(() => {
    // Skip if file exists, user has deleted TTS, or auto-start has already fired once.
    // 必须用 ref 防止 setIsStart 触发重渲染后 handleInitStart 引用变化、
    // 进而让该 effect 重跑、二次调用 start() —— 二次 start() 会 synth.cancel() 掉首次朗读。
    if (file || isDeletedRef.current || isAutoStartedRef.current) return;
    const timer = setTimeout(() => {
      if (isDeletedRef.current || isAutoStartedRef.current) return;
      isAutoStartedRef.current = true;
      handleInitStart();
    }, 100);
    return () => clearTimeout(timer);
  }, [file, handleInitStart]);

  return (
    <Player
      audio={audio}
      error={error}
      isLoading={isGlobalLoading}
      onDelete={handleDelete}
      onInitPlay={handleInitStart}
      onRetry={handleRetry}
    />
  );
});

export default InitPlayer;
