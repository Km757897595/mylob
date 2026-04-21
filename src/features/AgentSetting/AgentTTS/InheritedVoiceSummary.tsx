'use client';

import type { OfflineTTSConfig, VoiceCatalogSelection } from '@lobechat/types';
import { Flexbox, Tag, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { Globe, Mic, Volume2, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface InheritedVoiceSummaryProps {
  offline?: Partial<OfflineTTSConfig>;
  selectedVoice?: VoiceCatalogSelection;
}

const useStyles = createStyles(({ css, token }) => ({
  container: css`
    padding-block: 12px;
    padding-inline: 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;

    background: ${token.colorFillQuaternary};
  `,
  row: css`
    padding-block: 4px;
    padding-inline: 0;
  `,
}));

const InheritedVoiceSummary = ({ selectedVoice, offline }: InheritedVoiceSummaryProps) => {
  const { t } = useTranslation('setting');
  const { styles } = useStyles();
  const fallbackVoice =
    offline?.fallbackVoice === 'male'
      ? t('settingTTS.offline.male')
      : t('settingTTS.offline.female');
  const offlineEnabled = offline?.enabled !== false;
  const autoFallback = offline?.preferOfflineWhenUnavailable !== false;

  return (
    <Flexbox className={styles.container} gap={8}>
      <Flexbox horizontal align={'center'} className={styles.row} justify={'space-between'}>
        <Flexbox horizontal align={'center'} gap={8}>
          <Globe size={14} style={{ opacity: 0.65 }} />
          <Text>{t('settingTTS.ttsService.title')}</Text>
        </Flexbox>
        <Tag>{selectedVoice?.service || 'openai'}</Tag>
      </Flexbox>
      <Flexbox horizontal align={'center'} className={styles.row} justify={'space-between'}>
        <Flexbox horizontal align={'center'} gap={8}>
          <Volume2 size={14} style={{ opacity: 0.65 }} />
          <Text>{t('settingTTS.voice.title')}</Text>
        </Flexbox>
        <Tag>{selectedVoice?.label || selectedVoice?.voiceId || 'alloy'}</Tag>
      </Flexbox>
      <Flexbox horizontal align={'center'} className={styles.row} justify={'space-between'}>
        <Flexbox horizontal align={'center'} gap={8}>
          <WifiOff size={14} style={{ opacity: 0.65 }} />
          <Text>{t('settingTTS.offline.title')}</Text>
        </Flexbox>
        <Tag color={offlineEnabled ? 'green' : 'default'}>
          {offlineEnabled ? fallbackVoice : t('settingTTS.offline.disabled')}
        </Tag>
      </Flexbox>
      <Flexbox horizontal align={'center'} className={styles.row} justify={'space-between'}>
        <Flexbox horizontal align={'center'} gap={8}>
          <Mic size={14} style={{ opacity: 0.65 }} />
          <Text>{t('settingTTS.offline.autoFallback')}</Text>
        </Flexbox>
        <Tag color={autoFallback ? 'green' : 'default'}>
          {autoFallback ? t('settingTTS.offline.enabled') : t('settingTTS.offline.disabled')}
        </Tag>
      </Flexbox>
    </Flexbox>
  );
};

export default InheritedVoiceSummary;
