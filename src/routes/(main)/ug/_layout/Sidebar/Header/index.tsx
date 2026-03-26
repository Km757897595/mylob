'use client';

import { Avatar, Flexbox, Text } from '@lobehub/ui';
import { Users } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import SideBarHeaderLayout from '@/features/NavPanel/SideBarHeaderLayout';
import { useAgentStore } from '@/store/agent';
import { agentSelectors } from '@/store/agent/selectors';
import { selectActiveGroupDetail, useUserGroupStore } from '@/store/userGroup/store';

const GroupInfo = memo(() => {
  const { t } = useTranslation('userGroup');
  const groupDetail = useUserGroupStore(selectActiveGroupDetail);

  const agentTitle = useAgentStore(agentSelectors.currentAgentTitle);
  const agentAvatar = useAgentStore(agentSelectors.currentAgentAvatar);

  if (!groupDetail) return null;

  const { group, memberCount } = groupDetail;
  const hasAgent = !!group.agentId;

  return (
    <Flexbox horizontal align="center" gap={8}>
      <Avatar avatar={hasAgent ? agentAvatar : <Users size={16} />} shape="circle" size={28} />
      <Flexbox gap={0} style={{ minWidth: 0 }}>
        <Text ellipsis style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
          {group.name}
        </Text>
        <Text ellipsis style={{ fontSize: 11, lineHeight: 1.3 }} type="secondary">
          {hasAgent ? agentTitle : t('noAgentBound')} · {memberCount}人
        </Text>
      </Flexbox>
    </Flexbox>
  );
});

const Header = memo(() => {
  return <SideBarHeaderLayout left={<GroupInfo />} />;
});

Header.displayName = 'UgHeader';

export default Header;
