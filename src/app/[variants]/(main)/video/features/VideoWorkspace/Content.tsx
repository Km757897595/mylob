'use client';

import { useVideoStore } from '@/store/video';
import { generationBatchSelectors, videoGenerationTopicSelectors } from '@/store/video/selectors';

import GenerationFeed from '../GenerationFeed';
import PromptInput from '../PromptInput';
import EmptyState from './EmptyState';

const VideoWorkspaceContent = () => {
  const activeTopicId = useVideoStore(videoGenerationTopicSelectors.activeGenerationTopicId);
  const useFetchGenerationBatches = useVideoStore((s) => s.useFetchGenerationBatches);
  const isCurrentGenerationTopicLoaded = useVideoStore(
    generationBatchSelectors.isCurrentGenerationTopicLoaded,
  );
  useFetchGenerationBatches(activeTopicId);
  const currentBatches = useVideoStore(generationBatchSelectors.currentGenerationBatches);
  const hasGenerations = currentBatches && currentBatches.length > 0;

  if (!isCurrentGenerationTopicLoaded) {
    return <PromptInput disableAnimation={true} showTitle={false} />;
  }

  if (!hasGenerations) return <EmptyState />;

  return (
    <>
      <GenerationFeed key={activeTopicId} />
      <PromptInput disableAnimation={true} showTitle={false} />
    </>
  );
};

export default VideoWorkspaceContent;
