'use client';

import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import SideBarHeaderLayout from '@/features/NavPanel/SideBarHeaderLayout';

const Header = memo(() => {
  const { t } = useTranslation('common');
  return <SideBarHeaderLayout breadcrumb={[{ href: '/video-edit', title: t('tab.videoEdit') }]} />;
});

Header.displayName = 'VideoEditHeader';

export default Header;
