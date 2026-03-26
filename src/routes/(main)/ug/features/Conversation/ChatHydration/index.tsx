'use client';

import { memo, useLayoutEffect } from 'react';
import { createStoreUpdater } from 'zustand-utils';

import { useQueryState } from '@/hooks/useQueryParam';
import { useChatStore } from '@/store/chat';

// Sync URL query params (?topic=xxx) to chatStore — identical to agent ChatHydration
const ChatHydration = memo(() => {
  const useStoreUpdater = createStoreUpdater(useChatStore);

  const [topic, setTopic] = useQueryState('topic', { history: 'replace', throttleMs: 500 });
  useStoreUpdater('activeTopicId', topic!);

  useLayoutEffect(() => {
    const unsubscribe = useChatStore.subscribe(
      (s) => s.activeTopicId,
      (state) => {
        setTopic(!state ? null : state);
      },
    );
    return () => unsubscribe();
  }, [setTopic]);

  return null;
});

export default ChatHydration;
