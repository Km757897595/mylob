import { type ChatMessageError } from '@lobechat/types';
import { type AudioPlayerProps } from '@lobehub/tts/react';
import { AudioPlayer } from '@lobehub/tts/react';
import { ActionIcon, Alert, Button, Flexbox, Highlighter, Tag } from '@lobehub/ui';
import { PauseIcon, PlayIcon, TrashIcon } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface PlayerProps extends AudioPlayerProps {
  error?: ChatMessageError;
  onDelete: () => void;
  onRetry?: () => void;
}

/**
 * 离线 TTS 走 window.speechSynthesis，没有 audio buffer，
 * AudioPlayer 无法控制其播放/暂停。这里直接用浏览器原生 API 控制。
 */
const OfflinePlaybackControls = memo<{ isLoading: boolean; onDelete: () => void }>(
  ({ isLoading, onDelete }) => {
    const { t } = useTranslation('chat');
    const [isPaused, setIsPaused] = useState(false);

    const handlePauseResume = useCallback(() => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      const synth = window.speechSynthesis;
      if (synth.paused) {
        synth.resume();
        setIsPaused(false);
      } else if (synth.speaking) {
        synth.pause();
        setIsPaused(true);
      }
    }, []);

    // 朗读结束后 isLoading 会变 false，重置暂停状态
    useEffect(() => {
      if (!isLoading) setIsPaused(false);
    }, [isLoading]);

    return (
      <Flexbox horizontal align={'center'} gap={4} style={{ minWidth: 200, width: '100%' }}>
        <ActionIcon
          icon={isPaused ? PlayIcon : PauseIcon}
          size={'small'}
          title={isPaused ? t('tts.action') : t('tts.action')}
          onClick={handlePauseResume}
        />
        <Tag style={{ margin: 0 }}>{isPaused ? t('stt.prettifying') : t('stt.loading')}</Tag>
        <ActionIcon icon={TrashIcon} size={'small'} title={t('tts.clear')} onClick={onDelete} />
      </Flexbox>
    );
  },
);

const Player = memo<PlayerProps>(({ onRetry, error, onDelete, audio, isLoading, onInitPlay }) => {
  const { t } = useTranslation('chat');

  if (error) {
    return (
      <Flexbox horizontal align={'center'} style={{ minWidth: 200, width: '100%' }}>
        <Alert
          closable
          style={{ alignItems: 'center', width: '100%' }}
          title={error.message}
          type="error"
          action={
            <Button size={'small'} type={'primary'} onClick={onRetry}>
              {t('retry', { ns: 'common' })}
            </Button>
          }
          extra={
            error.body && (
              <Highlighter actionIconSize={'small'} language={'json'} variant={'borderless'}>
                {JSON.stringify(error.body, null, 2)}
              </Highlighter>
            )
          }
          onClose={onDelete}
        />
      </Flexbox>
    );
  }

  // 离线 TTS 走 speechSynthesis，没有 audio buffer，单独渲染控件
  if (!audio) {
    return <OfflinePlaybackControls isLoading={isLoading ?? false} onDelete={onDelete} />;
  }

  return (
    <Flexbox horizontal align={'center'} style={{ minWidth: 200, width: '100%' }}>
      <AudioPlayer
        audio={audio}
        buttonSize={'small'}
        isLoading={isLoading}
        timeRender={'tag'}
        timeStyle={{ margin: 0 }}
        onInitPlay={onInitPlay}
        onLoadingStop={stop}
      />
      <ActionIcon icon={TrashIcon} size={'small'} title={t('tts.clear')} onClick={onDelete} />
    </Flexbox>
  );
});

export default Player;
