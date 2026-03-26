import { Flexbox } from '@lobehub/ui';
import { type FC, useEffect } from 'react';
import { Outlet } from 'react-router-dom';

import { useInitAgentConfig } from '@/hooks/useInitAgentConfig';
import { selectActiveGroupDetail, useUserGroupStore } from '@/store/userGroup/store';

import Sidebar from './Sidebar';
import { styles } from './style';
import UgIdSync from './UgIdSync';
import { useGroupTopicLockCleanup } from './useGroupTopicLockCleanup';

const Layout: FC = () => {
  useGroupTopicLockCleanup();

  // Ensure myGroups is loaded (needed for direct navigation to /ug/:ugid)
  const fetchMyGroups = useUserGroupStore((s) => s.fetchMyGroups);
  useEffect(() => {
    fetchMyGroups();
  }, [fetchMyGroups]);

  // Fetch agent config so agentStore.agentMap is populated for Header display
  const agentId = useUserGroupStore((s) => selectActiveGroupDetail(s)?.group.agentId);
  useInitAgentConfig(agentId ?? undefined);

  return (
    <>
      <Sidebar />
      <Flexbox className={styles.mainContainer} flex={1} height={'100%'}>
        <Outlet />
      </Flexbox>
      <UgIdSync />
    </>
  );
};

export default Layout;
