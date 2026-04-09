'use client';

import { type FormGroupItemType } from '@lobehub/ui';
import { Form, Icon, Skeleton } from '@lobehub/ui';
import isEqual from 'fast-deep-equal';
import { Loader2Icon } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FORM_STYLE } from '@/const/layoutTokens';
import { OfflineVoiceSettings } from '@/features/TTS/VoiceCatalog';
import { useUserStore } from '@/store/user';
import { settingsSelectors } from '@/store/user/selectors';

const Offline = memo(() => {
  const { t } = useTranslation('setting');
  const [form] = Form.useForm();
  const tts = useUserStore(settingsSelectors.currentTTS, isEqual);
  const [setSettings, isUserStateInit] = useUserStore((s) => [s.setSettings, s.isUserStateInit]);
  const [loading, setLoading] = useState(false);

  if (!isUserStateInit) return <Skeleton active paragraph={{ rows: 5 }} title={false} />;

  const offline: FormGroupItemType = {
    children: [
      {
        children: (
          <OfflineVoiceSettings
            value={tts.offline}
            onChange={async (value) => {
              setLoading(true);
              await setSettings({
                tts: {
                  offline: value,
                },
              });
              setLoading(false);
            }}
          />
        ),
      },
    ],
    extra: loading && <Icon spin icon={Loader2Icon} size={16} style={{ opacity: 0.5 }} />,
    title: t('settingTTS.offline.title'),
  };

  return (
    <Form
      collapsible={false}
      form={form}
      initialValues={tts}
      items={[offline]}
      itemsType={'group'}
      variant={'filled'}
      {...FORM_STYLE}
    />
  );
});

export default Offline;
