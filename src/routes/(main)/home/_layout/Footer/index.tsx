'use client';

import { type MenuProps } from '@lobehub/ui';
import { ActionIcon, DropdownMenu, Flexbox, Icon } from '@lobehub/ui';
import { CircleHelp, Feather, FlaskConical, Settings2 } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import ThemeButton from '@/features/User/UserPanel/ThemeButton';
import { useFeedbackModal } from '@/hooks/useFeedbackModal';
import { useNavLayout } from '@/hooks/useNavLayout';

const Footer = memo(() => {
  const { t } = useTranslation('common');
  const { footer } = useNavLayout();

  const { open: openFeedbackModal } = useFeedbackModal();

  const handleOpenFeedbackModal = useCallback(() => {
    openFeedbackModal();
  }, [openFeedbackModal]);

  const helpMenuItems: MenuProps['items'] = [
    ...(footer.showSettingsEntry
      ? [
          {
            icon: <Icon icon={Settings2} />,
            key: 'setting',
            label: <Link to="/settings">{t('userPanel.setting')}</Link>,
          },
          {
            type: 'divider' as const,
          },
        ]
      : []),
    {
      icon: <Icon icon={Feather} />,
      key: 'feedback',
      label: t('userPanel.feedback'),
      onClick: handleOpenFeedbackModal,
    },
    ...(footer.showEvalEntry && footer.layout === 'compact'
      ? [
          {
            icon: <Icon icon={FlaskConical} />,
            key: 'eval',
            label: <Link to="/eval">Evaluation Lab</Link>,
          },
        ]
      : []),
  ];

  return (
    <>
      {footer.layout === 'expanded' ? (
        <Flexbox horizontal align={'center'} gap={2} justify={'space-between'} padding={8}>
          <Flexbox horizontal align={'center'} flex={1} gap={2}>
            <DropdownMenu items={helpMenuItems} placement="topLeft">
              <ActionIcon aria-label={t('userPanel.help')} icon={CircleHelp} size={16} />
            </DropdownMenu>
            <Link to="/eval">
              <ActionIcon icon={FlaskConical} size={16} title="Evaluation Lab" />
            </Link>
          </Flexbox>
          <ThemeButton placement={'topCenter'} size={16} />
        </Flexbox>
      ) : (
        <Flexbox horizontal align={'center'} gap={2} padding={8}>
          <DropdownMenu items={helpMenuItems} placement="topLeft">
            <ActionIcon aria-label={t('userPanel.help')} icon={CircleHelp} size={16} />
          </DropdownMenu>
        </Flexbox>
      )}
    </>
  );
});

export default Footer;
