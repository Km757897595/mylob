'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { Select } from 'antd';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useSpeechStore } from '@/store/speech';

const LANGUAGE_OPTIONS = [
  { label: '中文', value: 'zh' },
  { label: 'English', value: 'en' },
  { label: '日本語', value: 'ja' },
  { label: '한국어', value: 'ko' },
];

const ConfigPanel = memo(() => {
  const { t } = useTranslation('speech');
  const language = useSpeechStore((s) => s.language);
  const setLanguage = useSpeechStore((s) => s.setLanguage);

  return (
    <Flexbox gap={16} padding={10}>
      <Flexbox gap={8}>
        <Text weight={500}>{t('config.language.label')}</Text>
        <Select
          options={LANGUAGE_OPTIONS}
          style={{ width: '100%' }}
          value={language}
          onChange={setLanguage}
        />
      </Flexbox>
    </Flexbox>
  );
});

ConfigPanel.displayName = 'SpeechConfigPanel';

export default ConfigPanel;
