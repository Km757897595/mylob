'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { Users } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useUserGroupStore } from '@/store/userGroup/store';

const List = memo(() => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const myGroups = useUserGroupStore((s) => s.myGroups);

  const handleClick = useCallback(
    (groupId: string) => {
      navigate(`/ug/${groupId}`);
    },
    [navigate],
  );

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
    <Flexbox gap={2}>
      {myGroups.map((item) => (
        <Flexbox
          horizontal
          align="center"
          gap={8}
          key={item.group.id}
          style={{
            borderRadius: 8,
            cursor: 'pointer',
            padding: '8px 12px',
          }}
          onClick={() => handleClick(item.group.id)}
        >
          <Users size={14} />
          <Text ellipsis style={{ fontSize: 13 }}>
            {item.group.name}
          </Text>
        </Flexbox>
      ))}
    </Flexbox>
  );
});

export default List;
