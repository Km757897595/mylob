'use client';

import { VoiceList } from '@lobehub/tts';
import type { FormGroupItemType } from '@lobehub/ui';
import { Form, Select } from '@lobehub/ui';
import { Switch } from 'antd';
import isEqual from 'fast-deep-equal';
import { Mic } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FORM_STYLE } from '@/const/layoutTokens';
import {
  buildVoiceCatalog,
  OfflineVoiceSettings,
  VoiceCatalogPanel,
} from '@/features/TTS/VoiceCatalog';
import { useGlobalStore } from '@/store/global';
import { globalGeneralSelectors } from '@/store/global/selectors';
import { useUserStore } from '@/store/user';
import { settingsSelectors } from '@/store/user/selectors';
import { merge } from '@/utils/merge';

import { selectors, useStore } from '../store';
import InheritedVoiceSummary from './InheritedVoiceSummary';

const TTS_SETTING_KEY = 'tts';
const { localeOptions } = VoiceList;

const AgentTTS = memo(() => {
  const { t } = useTranslation('setting');
  const [form] = Form.useForm();
  const lang = useGlobalStore(globalGeneralSelectors.currentLanguage);
  const globalTTS = useUserStore(settingsSelectors.currentTTS, isEqual);
  const config = useStore(selectors.currentTtsConfig, isEqual);
  const updateConfig = useStore((s) => s.setAgentConfig);
  const [draftConfig, setDraftConfig] = useState(config);
  const catalog = useMemo(() => buildVoiceCatalog(lang), [lang]);
  const isInherited = draftConfig.inheritGlobal !== false;
  const effectiveSelection = isInherited ? globalTTS.selectedVoice : draftConfig.selectedVoice;
  const effectiveOffline = isInherited ? globalTTS.offline : draftConfig.offline;

  useEffect(() => {
    setDraftConfig(config);
  }, [config]);

  const tts: FormGroupItemType = {
    children: [
      {
        children: <Switch />,
        label: t('settingTTS.catalog.inherit'),
        layout: 'horizontal',
        minWidth: undefined,
        name: 'inheritGlobal',
        valuePropName: 'checked',
      },
      ...(isInherited
        ? [
            {
              children: (
                <InheritedVoiceSummary
                  offline={globalTTS.offline}
                  selectedVoice={globalTTS.selectedVoice}
                />
              ),
              label: t('settingTTS.catalog.title'),
            },
          ]
        : [
            {
              children: (
                <VoiceCatalogPanel
                  catalog={catalog}
                  selectedVoice={effectiveSelection}
                  onSelect={(selectedVoice) => {
                    form.setFieldsValue({
                      selectedVoice,
                    });
                    setDraftConfig((state) =>
                      merge(state, {
                        selectedVoice,
                      }),
                    );
                  }}
                />
              ),
              label: t('settingTTS.catalog.title'),
            },
            {
              children: (
                <OfflineVoiceSettings
                  value={effectiveOffline}
                  onChange={(offline) => {
                    form.setFieldsValue({ offline });
                    setDraftConfig((state) =>
                      merge(state, {
                        offline,
                      }),
                    );
                  }}
                />
              ),
              label: t('settingTTS.offline.title'),
            },
          ]),
      {
        children: (
          <Select
            options={[
              { label: t('settingCommon.lang.autoMode'), value: 'auto' },
              ...(localeOptions || []),
            ]}
          />
        ),
        desc: t('settingTTS.sttLocale.desc'),
        label: t('settingTTS.sttLocale.title'),
        name: 'sttLocale',
      },
    ],
    icon: Mic,
    title: t('settingTTS.title'),
  };

  return (
    <Form
      form={form}
      initialValues={config}
      items={[tts]}
      itemsType={'group'}
      variant={'borderless'}
      onValuesChange={async (_, values) => {
        const nextConfig = merge(config, values);
        setDraftConfig(nextConfig);

        await updateConfig({
          [TTS_SETTING_KEY]: nextConfig,
        });
      }}
      {...FORM_STYLE}
    />
  );
});

export default AgentTTS;
