import { DOWNLOAD_URL } from '@lobechat/const';
import { CircleUserRound, Download, Settings2 } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { type CellProps } from '@/components/Cell';
import { usePlatform } from '@/hooks/usePlatform';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/selectors';

export const useCategory = (_onOpenChangelogModal: () => void) => {
  const navigate = useNavigate();
  const { t } = useTranslation(['common', 'setting', 'auth']);
  const [isLoginWithAuth] = useUserStore((s) => [authSelectors.isLoginWithAuth(s)]);
  const { isIOS, isAndroid } = usePlatform();

  const downloadUrl = useMemo(() => {
    if (isIOS) return DOWNLOAD_URL.ios;
    if (isAndroid) return DOWNLOAD_URL.android;
    return DOWNLOAD_URL.default;
  }, [isIOS, isAndroid]);

  const profile: CellProps[] = [
    {
      icon: CircleUserRound,
      key: 'profile',
      label: t('userPanel.profile'),
      onClick: () => navigate('/me/profile'),
    },
  ];

  const settings: CellProps[] = [
    {
      icon: Settings2,
      key: 'setting',
      label: t('userPanel.setting'),
      onClick: () => navigate('/me/settings'),
    },
    {
      type: 'divider',
    },
  ];

  const getDesktopApp: CellProps[] = [
    {
      icon: Download,
      key: 'get-desktop-app',
      label: t('getDesktopApp'),
      onClick: () => window.open(downloadUrl, '__blank'),
    },
    {
      type: 'divider',
    },
  ];

  /* ↓ cloud slot ↓ */

  /* ↑ cloud slot ↑ */

  const mainItems = [
    {
      type: 'divider',
    },
    ...(isLoginWithAuth ? profile : []),
    ...(isLoginWithAuth ? settings : []),
    /* ↓ cloud slot ↓ */

    /* ↑ cloud slot ↑ */
    ...getDesktopApp,
  ].filter(Boolean) as CellProps[];

  return mainItems;
};
