import { Flexbox } from '@lobehub/ui';
import { type FC } from 'react';
import { Outlet } from 'react-router-dom';

import Sidebar from './Sidebar';
import { styles } from './style';
import UgIdSync from './UgIdSync';
import { useGroupTopicLockCleanup } from './useGroupTopicLockCleanup';

const Layout: FC = () => {
  useGroupTopicLockCleanup();

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
