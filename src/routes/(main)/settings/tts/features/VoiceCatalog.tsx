'use client';

import { type FormGroupItemType } from '@lobehub/ui';
import { Form, Icon, Skeleton } from '@lobehub/ui';
import isEqual from 'fast-deep-equal';
import { Loader2Icon } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FORM_STYLE } from '@/const/layoutTokens';
import { buildVoiceCatalog, VoiceCatalogPanel } from '@/features/TTS/VoiceCatalog';
import { useGlobalStore } from '@/store/global';
import { globalGeneralSelectors } from '@/store/global/selectors';
import { useUserStore } from '@/store/user';
import { settingsSelectors } from '@/store/user/selectors';

const VoiceCatalog = memo(() => {
  const { t } = useTranslation('setting');
  const [form] = Form.useForm();
  const tts = useUserStore(settingsSelectors.currentTTS, isEqual);
  const lang = useGlobalStore(globalGeneralSelectors.currentLanguage);
  const [setSettings, isUserStateInit] = useUserStore((s) => [s.setSettings, s.isUserStateInit]);
  const [loading, setLoading] = useState(false);
  const catalog = useMemo(() => buildVoiceCatalog(lang), [lang]);

  if (!isUserStateInit) return <Skeleton active paragraph={{ rows: 5 }} title={false} />;

  const voiceCatalog: FormGroupItemType = {
    children: [
      {
        children: (
          <VoiceCatalogPanel
            catalog={catalog}
            selectedVoice={tts.selectedVoice}
            onSelect={async (selectedVoice) => {
              setLoading(true);
              await setSettings({
                tts: {
                  selectedVoice,
                  service: selectedVoice.service,
                },
              });
              setLoading(false);
            }}
          />
        ),
      },
    ],
    extra: loading && <Icon spin icon={Loader2Icon} size={16} style={{ opacity: 0.5 }} />,
    title: t('settingTTS.catalog.title'),
  };

  return (
    <Form
      collapsible={false}
      form={form}
      initialValues={tts}
      items={[voiceCatalog]}
      itemsType={'group'}
      variant={'filled'}
      {...FORM_STYLE}
    />
  );
});

export default VoiceCatalog;
