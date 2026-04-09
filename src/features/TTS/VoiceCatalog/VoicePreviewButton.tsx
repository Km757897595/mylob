'use client';

import { Button } from '@lobehub/ui';
import { memo, useEffect, useState } from 'react';
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

  if (!selection) return null;

  const togglePlay = () => {
    if (isPlaying) {
      stop();
      setIsPlaying(false);
      return;
    }

    start();
    setIsPlaying(true);
  };

  return (
    <Button loading={isGlobalLoading} size={'small'} onClick={togglePlay}>
      {t('settingTTS.voice.preview')}
    </Button>
  );
});

export default VoicePreviewButton;
