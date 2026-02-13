'use client';

import { useLayoutEffect } from 'react';
import { createStoreUpdater } from 'zustand-utils';

import { useQueryState } from '@/hooks/useQueryParam';

import { useGenerationTopicContext } from './StoreContext';

/**
 * Bidirectional sync between URL 'topic' param and store's activeGenerationTopicId
 */
const TopicUrlSync = () => {
  const { useStore } = useGenerationTopicContext();
  const useStoreUpdater = createStoreUpdater(useStore);

  const [topic, setTopic] = useQueryState('topic', { history: 'replace', throttleMs: 500 });
  useStoreUpdater('activeGenerationTopicId', topic);

  useLayoutEffect(() => {
    let prevTopicId = useStore.getState().activeGenerationTopicId;
    const unsubscribeTopic = useStore.subscribe((state) => {
      if (state.activeGenerationTopicId !== prevTopicId) {
        prevTopicId = state.activeGenerationTopicId;
        setTopic(state.activeGenerationTopicId || null);
      }
    });

    return () => {
      unsubscribeTopic();
    };
  }, [setTopic]);

  return null;
};

export default TopicUrlSync;
