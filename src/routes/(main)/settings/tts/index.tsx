import { useTranslation } from 'react-i18next';

import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';

import Offline from './features/Offline';
import OpenAI from './features/OpenAI';
import STT from './features/STT';
import TTSService from './features/TTSService';
import VoiceCatalog from './features/VoiceCatalog';

const Page = () => {
  const { t } = useTranslation('setting');
  return (
    <>
      <SettingHeader title={t('tab.tts')} />
      <STT />
      <TTSService />
      <VoiceCatalog />
      <Offline />
      <OpenAI />
    </>
  );
};

export default Page;
