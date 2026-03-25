'use client';

import { useTranslation } from 'react-i18next';

import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';

import RBACManagement from './features/RBACManagement';

const RBACPage = () => {
  const { t } = useTranslation('setting');

  return (
    <>
      <SettingHeader title={t('rbac.title')} />
      <RBACManagement />
    </>
  );
};

export default RBACPage;
