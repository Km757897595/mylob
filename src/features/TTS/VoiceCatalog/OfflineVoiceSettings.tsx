'use client';

import type { OfflineTTSConfig } from '@lobechat/types';
import { Flexbox, Select, Text } from '@lobehub/ui';
import { Switch, Typography } from 'antd';
import { createStyles } from 'antd-style';
import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface OfflineVoiceSettingsProps {
  disabled?: boolean;
  onChange?: (value: OfflineTTSConfig) => void;
  value?: Partial<OfflineTTSConfig>;
}

const DEFAULT_OFFLINE_SETTINGS: OfflineTTSConfig = {
  enabled: true,
  fallbackVoice: 'female',
  preferOfflineWhenUnavailable: true,
};

const useStyles = createStyles(({ css, token }) => ({
  row: css`
    padding-block: 8px;
    padding-inline: 0;
  `,
  section: css`
    padding-block: 4px;
    padding-inline: 0;
    border-radius: ${token.borderRadiusLG}px;
  `,
}));

const OfflineVoiceSettings = ({ value, onChange, disabled }: OfflineVoiceSettingsProps) => {
  const { t } = useTranslation('setting');
  const { styles } = useStyles();
  const merged = { ...DEFAULT_OFFLINE_SETTINGS, ...value };
  const isDisabled = disabled || !merged.enabled;

  const updateValue = (patch: Partial<OfflineTTSConfig>) => {
    onChange?.({ ...merged, ...patch });
  };

  return (
    <Flexbox className={styles.section} gap={4}>
      <Flexbox horizontal align={'center'} className={styles.row} justify={'space-between'}>
        <Flexbox horizontal align={'center'} gap={8}>
          <WifiOff size={16} style={{ opacity: 0.65 }} />
          <Text>{t('settingTTS.offline.enabled')}</Text>
        </Flexbox>
        <Switch
          checked={merged.enabled}
          disabled={disabled}
          onChange={(checked) => updateValue({ enabled: checked })}
        />
      </Flexbox>
      <Flexbox horizontal align={'center'} className={styles.row} justify={'space-between'}>
        <Text style={{ opacity: isDisabled ? 0.45 : 1 }}>
          {t('settingTTS.offline.defaultVoice')}
        </Text>
        <Select
          disabled={isDisabled}
          style={{ minWidth: 180 }}
          value={merged.fallbackVoice}
          options={[
            { label: t('settingTTS.offline.female'), value: 'female' },
            { label: t('settingTTS.offline.male'), value: 'male' },
          ]}
          onChange={(fallbackVoice) =>
            updateValue({
              fallbackVoice: fallbackVoice as OfflineTTSConfig['fallbackVoice'],
            })
          }
        />
      </Flexbox>
      <Flexbox horizontal align={'center'} className={styles.row} justify={'space-between'}>
        <Flexbox gap={2} style={{ opacity: isDisabled ? 0.45 : 1 }}>
          <Text>{t('settingTTS.offline.autoFallback')}</Text>
          <Typography.Text style={{ fontSize: 12 }} type={'secondary'}>
            {t('settingTTS.offline.autoFallbackDesc')}
          </Typography.Text>
        </Flexbox>
        <Switch
          checked={merged.preferOfflineWhenUnavailable}
          disabled={isDisabled}
          onChange={(checked) => updateValue({ preferOfflineWhenUnavailable: checked })}
        />
      </Flexbox>
    </Flexbox>
  );
};

export { OfflineVoiceSettings };

export default OfflineVoiceSettings;
