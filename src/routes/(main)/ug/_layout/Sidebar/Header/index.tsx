'use client';

import { Avatar, Flexbox, Text } from '@lobehub/ui';
import { Users } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useAgentStore } from '@/store/agent';
import { agentSelectors } from '@/store/agent/selectors';
import { selectActiveGroupDetail, useUserGroupStore } from '@/store/userGroup/store';

const Header = memo(() => {
  const { t } = useTranslation('userGroup');
  const groupDetail = useUserGroupStore(selectActiveGroupDetail);

  const agentTitle = useAgentStore(agentSelectors.currentAgentTitle);
  const agentAvatar = useAgentStore(agentSelectors.currentAgentAvatar);

  if (!groupDetail) return null;

  const { group, memberCount } = groupDetail;
  const hasAgent = !!group.agentId;

  return (
    <Flexbox gap={8} padding={'12px 16px'}>
      <Flexbox horizontal align="center" gap={12}>
        <Avatar avatar={hasAgent ? agentAvatar : <Users size={20} />} shape="circle" size={40} />
        <Flexbox gap={2} style={{ minWidth: 0 }}>
          <Text ellipsis style={{ fontSize: 14, fontWeight: 600 }}>
            {group.name}
          </Text>
          <Text ellipsis style={{ fontSize: 12 }} type="secondary">
            {hasAgent ? agentTitle : t('noAgentBound')} · {memberCount}人
          </Text>
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
});

Header.displayName = 'UgHeader';

export default Header;
