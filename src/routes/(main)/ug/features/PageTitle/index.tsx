'use client';

import { memo } from 'react';
import { useParams } from 'react-router-dom';

import PageTitle from '@/components/PageTitle';
import { useChatStore } from '@/store/chat';
import { topicSelectors } from '@/store/chat/slices/topic/selectors';
import { selectActiveGroupDetail, useUserGroupStore } from '@/store/userGroup/store';

const Title = memo(() => {
  const params = useParams<{ ugid: string }>();
  const groupName = useUserGroupStore((s) => selectActiveGroupDetail(s)?.group.name);
  const topicId = useChatStore((s) => s.activeTopicId);
  // Read from chatStore first (real-time summarization updates), fallback to userGroupStore
  const chatStoreTitle = useChatStore((s) =>
    topicId ? topicSelectors.getTopicById(topicId)(s)?.title : undefined,
  );
  const ugStoreTitle = useUserGroupStore(
    (s) => s.groupTopics[params.ugid ?? '']?.find((t) => t.id === topicId)?.title,
  );
  const topicTitle = chatStoreTitle || ugStoreTitle;

  return <PageTitle title={[topicTitle, groupName].filter(Boolean).join(' · ')} />;
});

export default Title;
