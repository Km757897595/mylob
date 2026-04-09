'use client';

import type { OfflineTTSConfig, VoiceCatalogSelection } from '@lobechat/types';
import { Flexbox, Tag, Text } from '@lobehub/ui';
import { useTranslation } from 'react-i18next';

interface InheritedVoiceSummaryProps {
  offline?: Partial<OfflineTTSConfig>;
  selectedVoice?: VoiceCatalogSelection;
}

const InheritedVoiceSummary = ({ selectedVoice, offline }: InheritedVoiceSummaryProps) => {
  const { t } = useTranslation('setting');
  const fallbackVoice =
    offline?.fallbackVoice === 'male'
      ? t('settingTTS.offline.male')
      : t('settingTTS.offline.female');
  const offlineEnabled = offline?.enabled !== false;
  const autoFallback = offline?.preferOfflineWhenUnavailable !== false;

  return (
    <Flexbox gap={8}>
      <Flexbox horizontal align={'center'} justify={'space-between'}>
        <Text>{t('settingTTS.ttsService.title')}</Text>
        <Tag>{selectedVoice?.service || 'openai'}</Tag>
      </Flexbox>
      <Flexbox horizontal align={'center'} justify={'space-between'}>
        <Text>{t('settingTTS.voice.title')}</Text>
        <Tag>{selectedVoice?.label || selectedVoice?.voiceId || 'alloy'}</Tag>
      </Flexbox>
      <Flexbox horizontal align={'center'} justify={'space-between'}>
        <Text>{t('settingTTS.offline.title')}</Text>
        <Tag color={offlineEnabled ? 'green' : 'default'}>
          {offlineEnabled ? fallbackVoice : 'Disabled'}
        </Tag>
      </Flexbox>
      <Flexbox horizontal align={'center'} justify={'space-between'}>
        <Text>{t('settingTTS.offline.autoFallback')}</Text>
        <Tag color={autoFallback ? 'green' : 'default'}>
          {autoFallback ? 'Enabled' : 'Disabled'}
        </Tag>
      </Flexbox>
    </Flexbox>
  );
};

export default InheritedVoiceSummary;
