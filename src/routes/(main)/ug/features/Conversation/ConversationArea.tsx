'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ChatList, ConversationProvider } from '@/features/Conversation';
import { useOperationState } from '@/hooks/useOperationState';
import { useChatStore } from '@/store/chat';
import { messageMapKey } from '@/store/chat/utils/messageMapKey';
import { selectActiveGroupDetail, useUserGroupStore } from '@/store/userGroup/store';

import ChatHydration from './ChatHydration';
import MainChatInput from './MainChatInput';
import { useUserGroupChatContext } from './useUserGroupChatContext';

const ConversationArea = memo(() => {
  const { t } = useTranslation('userGroup');
  const context = useUserGroupChatContext();
  const hasAgent = useUserGroupStore((s) => !!selectActiveGroupDetail(s)?.group.agentId);
  const hasActiveTopic = useChatStore((s) => !!s.activeTopicId);

  const chatKey = useMemo(() => messageMapKey(context), [context.agentId, context.topicId]);
  const replaceMessages = useChatStore((s) => s.replaceMessages);
  const messages = useChatStore((s) => s.dbMessagesMap[chatKey]);
  const operationState = useOperationState(context);

  // Empty state: no topic selected or no agent bound
  if (!hasActiveTopic || !hasAgent) {
    return (
      <Flexbox align="center" flex={1} justify="center" width="100%">
        <Text style={{ fontSize: 14 }} type="secondary">
          {!hasAgent ? t('noAgentBound') : t('selectTopicToStart')}
        </Text>
      </Flexbox>
    );
  }

  return (
    <ConversationProvider
      context={context}
      hasInitMessages={!!messages}
      messages={messages}
      operationState={operationState}
      onMessagesChange={(msgs, ctx) => {
        replaceMessages(msgs, { context: ctx });
      }}
    >
      <Flexbox
        flex={1}
        style={{ overflowX: 'hidden', overflowY: 'auto', position: 'relative' }}
        width="100%"
      >
        <ChatList />
      </Flexbox>
      <MainChatInput />
      <ChatHydration />
    </ConversationProvider>
  );
});

ConversationArea.displayName = 'UgConversationArea';

export default ConversationArea;
