'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { message } from 'antd';
import { Lock, Unlock } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { useChatStore } from '@/store/chat';
import { type GroupTopicItem, useUserGroupStore } from '@/store/userGroup/store';

interface TopicItemProps {
  active: boolean;
  topic: GroupTopicItem;
}

const TopicItem = memo<TopicItemProps>(({ topic, active }) => {
  const { t } = useTranslation('userGroup');
  const navigate = useNavigate();
  const params = useParams<{ ugid: string }>();
  const enterTopic = useUserGroupStore((s) => s.enterTopic);

  const isLockedByOther = !!topic.lock?.lockedBy;
  const lockerName = topic.lock?.lockedBy ? topic.lock.lockedBy.slice(0, 6) : null;

  const handleClick = useCallback(async () => {
    if (active) return;

    // Optimistically switch topic for instant UI feedback
    useChatStore.setState({ activeTopicId: topic.id }, false, 'UgTopicItem/optimistic');
    navigate(`/ug/${params.ugid}?topic=${topic.id}`, { replace: true });

    // Then lock in background — revert if fails
    const result = await enterTopic(topic.id);
    if (!result.success) {
      useChatStore.setState({ activeTopicId: undefined }, false, 'UgTopicItem/revert');
      navigate(`/ug/${params.ugid}`, { replace: true });
      const name = result.lockedBy || '';
      message.warning(t('topicLockedBy', { name }));
    }
  }, [active, enterTopic, navigate, params.ugid, t, topic.id]);

  return (
    <Flexbox
      horizontal
      align="center"
      gap={8}
      style={{
        background: active ? 'var(--ant-color-bg-text-hover)' : undefined,
        borderRadius: 8,
        cursor: isLockedByOther && !active ? 'not-allowed' : 'pointer',
        opacity: isLockedByOther && !active ? 0.6 : 1,
        padding: '8px 12px',
      }}
      onClick={handleClick}
    >
      {isLockedByOther ? <Lock size={14} /> : <Unlock size={14} style={{ opacity: 0.3 }} />}
      <Text ellipsis style={{ flex: 1, fontSize: 13 }}>
        {topic.title || t('newTopic')}
      </Text>
      {isLockedByOther && lockerName && (
        <Text style={{ fontSize: 11, flexShrink: 0 }} type="secondary">
          {lockerName}
        </Text>
      )}
    </Flexbox>
  );
});

TopicItem.displayName = 'UgTopicItem';

export default TopicItem;
