'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { Button } from 'antd';
import { MessageSquarePlus } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';

import { type GroupTopicItem, useUserGroupStore } from '@/store/userGroup/store';

import Item from './List/Item';

const POLL_INTERVAL = 10_000; // 10 seconds

const Topic = memo(() => {
  const { t } = useTranslation('userGroup');
  const params = useParams<{ ugid: string }>();
  const [searchParams] = useSearchParams();
  const activeTopicId = searchParams.get('topic');
  const [creating, setCreating] = useState(false);

  const [groupTopics, fetchGroupTopics, createGroupTopic] = useUserGroupStore((s) => [
    s.groupTopics[params.ugid || ''] || [],
    s.fetchGroupTopics,
    s.createGroupTopic,
  ]);

  // Fetch topics on mount and poll every 10s for lock status
  useEffect(() => {
    if (!params.ugid) return;
    fetchGroupTopics(params.ugid);
    const timer = setInterval(() => fetchGroupTopics(params.ugid!), POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchGroupTopics, params.ugid]);

  const handleCreate = useCallback(async () => {
    if (!params.ugid) return;
    setCreating(true);
    try {
      await createGroupTopic({ title: t('newTopic'), userGroupId: params.ugid });
    } finally {
      setCreating(false);
    }
  }, [createGroupTopic, params.ugid, t]);

  return (
    <Flexbox gap={4} padding={'8px 4px'}>
      <Flexbox horizontal align="center" justify="space-between" paddingInline={12}>
        <Text style={{ fontSize: 12 }} type="secondary" weight={500}>
          {t('topics')}
        </Text>
        <Button
          icon={<MessageSquarePlus size={14} />}
          loading={creating}
          size="small"
          type="text"
          onClick={handleCreate}
        />
      </Flexbox>
      <Flexbox gap={2}>
        {groupTopics.length === 0 ? (
          <Flexbox align="center" padding={24}>
            <Text style={{ fontSize: 12 }} type="secondary">
              {t('selectTopicToStart')}
            </Text>
          </Flexbox>
        ) : (
          groupTopics.map((topic: GroupTopicItem) => (
            <Item active={activeTopicId === topic.id} key={topic.id} topic={topic} />
          ))
        )}
      </Flexbox>
    </Flexbox>
  );
});

Topic.displayName = 'UgTopic';

export default Topic;
