'use client';

import type { OfflineTTSConfig } from '@lobechat/types';
import { Flexbox, Select, Text } from '@lobehub/ui';
import { Switch } from 'antd';
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

const OfflineVoiceSettings = ({ value, onChange, disabled }: OfflineVoiceSettingsProps) => {
  const { t } = useTranslation('setting');
  const merged = { ...DEFAULT_OFFLINE_SETTINGS, ...value };

  const updateValue = (patch: Partial<OfflineTTSConfig>) => {
    onChange?.({ ...merged, ...patch });
  };

  return (
    <Flexbox gap={10}>
      <Flexbox horizontal align={'center'} justify={'space-between'}>
        <Text>{t('settingTTS.offline.enabled')}</Text>
        <Switch
          checked={merged.enabled}
          disabled={disabled}
          onChange={(checked) => updateValue({ enabled: checked })}
        />
      </Flexbox>
      <Flexbox horizontal align={'center'} justify={'space-between'}>
        <Text>{t('settingTTS.offline.defaultVoice')}</Text>
        <Select
          disabled={disabled || !merged.enabled}
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
      <Flexbox horizontal align={'center'} justify={'space-between'}>
        <Text>{t('settingTTS.offline.autoFallback')}</Text>
        <Switch
          checked={merged.preferOfflineWhenUnavailable}
          disabled={disabled || !merged.enabled}
          onChange={(checked) => updateValue({ preferOfflineWhenUnavailable: checked })}
        />
      </Flexbox>
    </Flexbox>
  );
};

export { OfflineVoiceSettings };

export default OfflineVoiceSettings;
