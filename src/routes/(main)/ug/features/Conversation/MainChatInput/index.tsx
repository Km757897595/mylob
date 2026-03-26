'use client';

import { memo, useMemo } from 'react';

import { type ActionKeys } from '@/features/ChatInput';
import { ChatInput } from '@/features/Conversation';
import { useChatStore } from '@/store/chat';
import { selectActiveGroupDetail, useUserGroupStore } from '@/store/userGroup/store';

const MainChatInput = memo(() => {
  const hasAgent = useUserGroupStore((s) => !!selectActiveGroupDetail(s)?.group.agentId);
  const hasActiveTopic = useChatStore((s) => !!s.activeTopicId);

  const leftActions: ActionKeys[] = useMemo(() => ['model', 'fileUpload', 'mainToken'], []);

  // Disable input if no agent bound or no topic selected
  if (!hasAgent || !hasActiveTopic) return null;

  return (
    <ChatInput
      skipScrollMarginWithList
      leftActions={leftActions}
      rightActions={[]}
      sendButtonProps={{ shape: 'round' }}
      onEditorReady={(instance) => {
        useChatStore.setState({ mainInputEditor: instance });
      }}
    />
  );
});

MainChatInput.displayName = 'UgMainChatInput';

export default MainChatInput;
