'use client';

import { ActionIcon, Tooltip } from '@lobehub/ui';
import { Loader2, Pause, Play } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useTTS } from '@/hooks/useTTS';
import type { VoiceCatalogSelection } from '@/types/agent';

interface VoicePreviewButtonProps {
  selection?: VoiceCatalogSelection;
}

const VoicePreviewButton = memo(({ selection }: VoicePreviewButtonProps) => {
  const { t } = useTranslation('setting');
  const [isPlaying, setIsPlaying] = useState(false);
  const resolvedSelection = selection || {
    label: 'Alloy',
    service: 'openai',
    voiceId: 'alloy',
  };
  const { isGlobalLoading, start, stop } = useTTS('LobeHub voice preview.', {
    server: resolvedSelection.service,
    voice: resolvedSelection.voiceId,
  });

  useEffect(() => {
    if (!isGlobalLoading) setIsPlaying(false);
  }, [isGlobalLoading]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();

      if (isPlaying) {
        stop();
        setIsPlaying(false);
        return;
      }

      start();
      setIsPlaying(true);
    },
    [isPlaying, start, stop],
  );

  if (!selection) return null;

  const icon = isGlobalLoading ? Loader2 : isPlaying ? Pause : Play;

  return (
    <Tooltip title={t('settingTTS.voice.preview')}>
      <ActionIcon icon={icon} loading={isGlobalLoading} size={'small'} onClick={handleClick} />
    </Tooltip>
  );
});

export default VoicePreviewButton;
