'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { Button, message } from 'antd';
import { Lock, MessageSquarePlus } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type GroupTopicItem, useUserGroupStore } from '@/store/userGroup/store';

interface GroupTopicListProps {
  groupId: string;
}

const GroupTopicList = memo<GroupTopicListProps>(({ groupId }) => {
  const { t } = useTranslation('common');
  const [creating, setCreating] = useState(false);

  const [groupTopics, fetchGroupTopics, createGroupTopic, enterTopic] = useUserGroupStore((s) => [
    s.groupTopics[groupId] || [],
    s.fetchGroupTopics,
    s.createGroupTopic,
    s.enterTopic,
  ]);

  useEffect(() => {
    fetchGroupTopics(groupId);
  }, [fetchGroupTopics, groupId]);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      await createGroupTopic({
        title: t('navPanel.newGroupTopic'),
        userGroupId: groupId,
      });
    } finally {
      setCreating(false);
    }
  }, [createGroupTopic, groupId, t]);

  const handleEnter = useCallback(
    async (topicId: string) => {
      const result = await enterTopic(topicId);
      if (!result.success) {
        message.warning(t('navPanel.topicLocked'));
      }
    },
    [enterTopic, t],
  );

  return (
    <Flexbox gap={2} paddingInline={4}>
      {groupTopics.map((topic: GroupTopicItem) => {
        const isLocked = !!topic.lock?.lockedBy;
        return (
          <Flexbox
            horizontal
            align="center"
            gap={8}
            key={topic.id}
            style={{
              borderRadius: 6,
              cursor: isLocked ? 'not-allowed' : 'pointer',
              opacity: isLocked ? 0.6 : 1,
              padding: '6px 8px',
            }}
            onClick={() => handleEnter(topic.id)}
          >
            {isLocked && <Lock size={12} />}
            <Text ellipsis fontSize={12} style={{ flex: 1 }}>
              {topic.title || t('navPanel.untitledTopic')}
            </Text>
            {topic.creator && (
              <Text fontSize={10} type="secondary">
                {topic.creator.fullName || topic.creator.id.slice(0, 6)}
              </Text>
            )}
          </Flexbox>
        );
      })}
      <Button
        block
        icon={<MessageSquarePlus size={14} />}
        loading={creating}
        size="small"
        type="text"
        onClick={handleCreate}
      >
        {t('navPanel.newGroupTopic')}
      </Button>
    </Flexbox>
  );
});

export default GroupTopicList;
