'use client';

import { memo } from 'react';
import { useParams } from 'react-router-dom';

import PageTitle from '@/components/PageTitle';
import { useChatStore } from '@/store/chat';
import { selectActiveGroupDetail, useUserGroupStore } from '@/store/userGroup/store';

const Title = memo(() => {
  const params = useParams<{ ugid: string }>();
  const groupName = useUserGroupStore((s) => selectActiveGroupDetail(s)?.group.name);
  const topicId = useChatStore((s) => s.activeTopicId);
  const topicTitle = useUserGroupStore(
    (s) => s.groupTopics[params.ugid ?? '']?.find((t) => t.id === topicId)?.title,
  );

  return <PageTitle title={[topicTitle, groupName].filter(Boolean).join(' · ')} />;
});

export default Title;
