'use client';

import { Accordion, Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import Agent from './Agent';
import BottomMenu from './BottomMenu';
import UserGroup from './UserGroup';

export enum GroupKey {
  Agent = 'agent',
  Project = 'project',
  UserGroup = 'userGroup',
}

const Body = memo(() => {
  return (
    <Flexbox flex={1} justify={'space-between'} paddingInline={4}>
      <Accordion defaultExpandedKeys={[GroupKey.Project, GroupKey.Agent]} gap={8}>
        <Agent itemKey={GroupKey.Agent} />
        <UserGroup itemKey={GroupKey.UserGroup} />
      </Accordion>
      <BottomMenu />
    </Flexbox>
  );
});

export default Body;
