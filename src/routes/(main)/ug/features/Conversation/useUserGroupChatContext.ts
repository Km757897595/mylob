'use client';

import { type ConversationContext } from '@lobechat/types';

import { useChatStore } from '@/store/chat';

/**
 * Hook to get user group conversation context.
 * Reads agentId and topicId from chatStore (set by UgIdSync).
 * Scope is always 'main' — user group topics don't support threads.
 * Note: groupId is NOT passed here — ConversationContext.groupId refers to
 * multi-agent chat groups (chatGroups table), not user groups (userGroups table).
 * UG messages are associated via topicId (the topic has groupId in the topics table).
 */
export function useUserGroupChatContext(): ConversationContext {
  const [agentId, topicId] = useChatStore((s) => [s.activeAgentId ?? '', s.activeTopicId ?? null]);

  return {
    agentId,
    scope: 'main',
    topicId,
  };
}
