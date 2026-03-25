'use client';

import { useTranslation } from 'react-i18next';

import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';

import GroupList from './features/GroupList';

const UserGroupsPage = () => {
  const { t } = useTranslation('setting');

  return (
    <>
      <SettingHeader title={t('userGroups.title')} />
      <GroupList />
    </>
  );
};

export default UserGroupsPage;
