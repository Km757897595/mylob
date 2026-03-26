import { Flexbox } from '@lobehub/ui';
import React, { memo, Suspense } from 'react';

import Loading from '@/components/Loading/BrandTextLoading';

import ConversationArea from './ConversationArea';

const Conversation = memo(() => {
  return (
    <Suspense fallback={<Loading debugId="UG > Conversation" />}>
      <Flexbox height="100%" style={{ overflow: 'hidden', position: 'relative' }} width="100%">
        <ConversationArea />
      </Flexbox>
    </Suspense>
  );
});

Conversation.displayName = 'UgConversation';

export default Conversation;
