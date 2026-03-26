import { useEffect } from 'react';

import { useUserGroupStore } from '@/store/userGroup/store';

/**
 * 监听页面卸载事件，释放话题锁定。
 * 三层保障之一：beforeunload + 路由切换（layout unmount） + 心跳过期
 */
export const useGroupTopicLockCleanup = () => {
  const activeLockedTopicId = useUserGroupStore((s) => s.activeLockedTopicId);
  const leaveTopic = useUserGroupStore((s) => s.leaveTopic);

  useEffect(() => {
    if (!activeLockedTopicId) return;

    const handleBeforeUnload = () => {
      leaveTopic(activeLockedTopicId);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also release lock when the layout unmounts (route change)
      leaveTopic(activeLockedTopicId);
    };
  }, [activeLockedTopicId, leaveTopic]);
};
