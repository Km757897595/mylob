'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import Conversation from './features/Conversation';
import PageTitle from './features/PageTitle';
import Portal from './features/Portal';

const UserGroupChatPage = memo(() => {
  return (
    <>
      <PageTitle />
      <Flexbox
        horizontal
        height="100%"
        style={{ overflow: 'hidden', position: 'relative' }}
        width="100%"
      >
        <Conversation />
        <Portal />
      </Flexbox>
    </>
  );
});

export default UserGroupChatPage;
