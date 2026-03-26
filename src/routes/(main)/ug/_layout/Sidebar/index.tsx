import React, { memo } from 'react';

import { NavPanelPortal } from '@/features/NavPanel';
import SideBarLayout from '@/features/NavPanel/SideBarLayout';

import Header from './Header';
import Topic from './Topic';

const Sidebar = memo(() => {
  return (
    <NavPanelPortal navKey="ug">
      <SideBarLayout body={<Topic />} header={<Header />} />
    </NavPanelPortal>
  );
});

Sidebar.displayName = 'UgSidebar';

export default Sidebar;
