'use client';

import { memo } from 'react';

import PageTitle from '@/components/PageTitle';
import { useChatStore } from '@/store/chat';
import { topicSelectors } from '@/store/chat/selectors';
import { selectActiveGroupDetail, useUserGroupStore } from '@/store/userGroup/store';

const Title = memo(() => {
  const groupName = useUserGroupStore((s) => selectActiveGroupDetail(s)?.group.name);
  const topicTitle = useChatStore((s) => topicSelectors.currentActiveTopic(s)?.title);

  return <PageTitle title={[topicTitle, groupName].filter(Boolean).join(' · ')} />;
});

export default Title;
