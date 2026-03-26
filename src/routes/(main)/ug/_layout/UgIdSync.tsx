import { usePrevious, useUnmount } from 'ahooks';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { useAgentStore } from '@/store/agent';
import { useChatStore } from '@/store/chat';
import { selectActiveGroupDetail, useUserGroupStore } from '@/store/userGroup/store';

const UgIdSync = () => {
  const params = useParams<{ ugid?: string }>();
  const prevUgId = usePrevious(params.ugid);

  // Sync ugid to userGroupStore and chatStore
  useEffect(() => {
    useUserGroupStore.getState().setActiveGroupId(params.ugid ?? null);
    useChatStore.setState({ activeGroupId: params.ugid }, false, 'UgIdSync/groupId');
  }, [params.ugid]);

  // Sync the group's bound agentId to chatStore so ConversationProvider works
  const agentId = useUserGroupStore((s) => selectActiveGroupDetail(s)?.group.agentId);

  useEffect(() => {
    if (agentId) {
      useAgentStore.setState({ activeAgentId: agentId }, false, 'UgIdSync/agentId');
      useChatStore.setState({ activeAgentId: agentId }, false, 'UgIdSync/agentId');
    }
  }, [agentId]);

  // Reset activeTopicId when switching groups
  useEffect(() => {
    if (prevUgId !== undefined && prevUgId !== params.ugid) {
      useChatStore.getState().switchTopic(null, { skipRefreshMessage: true });
    }
  }, [params.ugid, prevUgId]);

  // Cleanup on unmount
  useUnmount(() => {
    useUserGroupStore.getState().setActiveGroupId(null);
    useAgentStore.setState({ activeAgentId: undefined }, false, 'UgIdSync/unmount');
    useChatStore.setState(
      { activeAgentId: undefined, activeGroupId: undefined, activeTopicId: undefined },
      false,
      'UgIdSync/unmount',
    );
  });

  return null;
};

export default UgIdSync;
