'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { Collapse } from 'antd';
import { Users } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useUserGroupStore } from '@/store/userGroup/store';

import GroupTopicList from './GroupTopicList';

const List = memo(() => {
  const { t } = useTranslation('common');
  const myGroups = useUserGroupStore((s) => s.myGroups);

  if (myGroups.length === 0) {
    return (
      <Flexbox align="center" justify="center" padding={16}>
        <Text fontSize={12} type="secondary">
          {t('navPanel.noUserGroup')}
        </Text>
      </Flexbox>
    );
  }

  return (
    <Collapse
      ghost
      bordered={false}
      size="small"
      items={myGroups.map((item) => ({
        children: <GroupTopicList groupId={item.group.id} />,
        key: item.group.id,
        label: (
          <Flexbox horizontal align="center" gap={6}>
            <Users size={14} />
            <Text ellipsis fontSize={12}>
              {item.group.name}
            </Text>
          </Flexbox>
        ),
      }))}
    />
  );
});

export default List;
