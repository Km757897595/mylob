'use client';

import { AccordionItem, Flexbox, Text } from '@lobehub/ui';
import { memo, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { useUserGroupStore } from '@/store/userGroup/store';

import List from './List';

interface UserGroupProps {
  itemKey: string;
}

const UserGroup = memo<UserGroupProps>(({ itemKey }) => {
  const { t } = useTranslation('common');
  const fetchVisibleGroups = useUserGroupStore((s) => s.fetchVisibleGroups);

  useEffect(() => {
    fetchVisibleGroups();
  }, [fetchVisibleGroups]);

  return (
    <AccordionItem
      itemKey={itemKey}
      paddingBlock={4}
      paddingInline={'8px 4px'}
      title={
        <Flexbox horizontal align="center" gap={4}>
          <Text ellipsis fontSize={12} type={'secondary'} weight={500}>
            {t('navPanel.userGroup')}
          </Text>
        </Flexbox>
      }
    >
      <Suspense fallback={<SkeletonList rows={3} />}>
        <Flexbox gap={4} paddingBlock={1}>
          <List />
        </Flexbox>
      </Suspense>
    </AccordionItem>
  );
});

export default UserGroup;
