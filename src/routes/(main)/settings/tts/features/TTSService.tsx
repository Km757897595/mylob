'use client';

import type { FormGroupItemType } from '@lobehub/ui';
import { Form, Icon, Select, Skeleton } from '@lobehub/ui';
import isEqual from 'fast-deep-equal';
import { Loader2Icon } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FORM_STYLE } from '@/const/layoutTokens';
import { buildVoiceCatalog } from '@/features/TTS/VoiceCatalog';
import { useGlobalStore } from '@/store/global';
import { globalGeneralSelectors } from '@/store/global/selectors';
import { useUserStore } from '@/store/user';
import { settingsSelectors } from '@/store/user/selectors';
import type { TTSServer, VoiceCatalogSelection } from '@/types/agent';

import { ttsServiceOptions } from './const';

const TTSService = memo(() => {
  const { t } = useTranslation('setting');
  const [form] = Form.useForm();
  const tts = useUserStore(settingsSelectors.currentTTS, isEqual);
  const lang = useGlobalStore(globalGeneralSelectors.currentLanguage);
  const [setSettings, isUserStateInit] = useUserStore((s) => [s.setSettings, s.isUserStateInit]);
  const [loading, setLoading] = useState(false);
  const catalog = useMemo(() => buildVoiceCatalog(lang), [lang]);

  if (!isUserStateInit) return <Skeleton active paragraph={{ rows: 2 }} title={false} />;

  const ttsService: FormGroupItemType = {
    children: [
      {
        children: <Select options={ttsServiceOptions} />,
        desc: t('settingTTS.ttsService.desc'),
        label: t('settingTTS.ttsService.title'),
        name: 'service',
      },
    ],
    extra: loading && <Icon spin icon={Loader2Icon} size={16} style={{ opacity: 0.5 }} />,
    title: t('settingTTS.tts'),
  };

  const pickDefaultVoiceForService = (service: TTSServer): VoiceCatalogSelection | undefined => {
    const item = catalog.find((v) => v.service === service);
    if (!item) return;
    return {
      gender: item.gender,
      label: item.label,
      locale: item.locale,
      service: item.service,
      style: item.style,
      timbre: item.timbre,
      voiceId: item.voiceId,
    };
  };

  return (
    <Form
      collapsible={false}
      form={form}
      initialValues={tts}
      items={[ttsService]}
      itemsType={'group'}
      variant={'filled'}
      onValuesChange={async (changed) => {
        setLoading(true);
        // 切换 service 时若与当前 selectedVoice.service 不一致，
        // 必须同步重置 selectedVoice，否则 selector 中
        // applySelectedVoiceToLegacyFields 会按 selectedVoice.service 强制覆盖回去，
        // 导致设置看似生效但运行时仍走旧 service。
        const nextService: TTSServer | undefined = changed.service;
        if (nextService && nextService !== tts.selectedVoice?.service) {
          const nextVoice = pickDefaultVoiceForService(nextService);
          await setSettings({
            tts: {
              ...changed,
              ...(nextVoice ? { selectedVoice: nextVoice } : {}),
            },
          });
        } else {
          await setSettings({ tts: changed });
        }
        setLoading(false);
      }}
      {...FORM_STYLE}
    />
  );
});

export default TTSService;
