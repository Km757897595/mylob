import { shallow } from 'zustand/shallow';
import { createWithEqualityFn } from 'zustand/traditional';
import { type StateCreator } from 'zustand/vanilla';

import { userGroupService } from '@/services/userGroup';

import { createDevtools } from '../middleware/createDevtools';

export interface GroupTopicItem {
  createdAt: Date | null;
  creator: { avatar: string | null; fullName: string | null; id: string } | null;
  id: string;
  lock: { expiresAt: Date | null; lockedAt: Date | null; lockedBy: string | null } | null;
  title: string | null;
  updatedAt: Date | null;
}

export interface MyGroupItem {
  group: {
    accessedAt: Date;
    agentId: string | null;
    createdAt: Date;
    createdBy: string | null;
    description: string | null;
    id: string;
    name: string;
    parentId: string | null;
    sort: number | null;
    updatedAt: Date;
  };
  memberCount: number;
  role: string;
}

export interface UserGroupStore extends UserGroupState, UserGroupAction {}

interface UserGroupState {
  /** 当前激活的组 ID（侧边栏路由用） */
  activeGroupId: string | null;
  /** 当前激活的话题锁定续期定时器 */
  activeLockedTopicId: string | null;
  /** 管理页面用的组列表 */
  groups: any[];
  /** 组话题列表 */
  groupTopics: Record<string, GroupTopicItem[]>;
  loading: boolean;
  /** 管理页面用的成员列表 */
  members: Record<string, any[]>;
  /** 当前用户所在的组（侧边栏用） */
  myGroups: MyGroupItem[];
}

interface UserGroupAction {
  // ---- 管理类 ----
  addMember: (groupId: string, userId: string) => Promise<void>;
  createGroup: (params: { description?: string; name: string }) => Promise<void>;
  // ---- 使用类 ----
  createGroupTopic: (params: {
    agentId?: string;
    title: string;
    userGroupId: string;
  }) => Promise<string | undefined>;
  deleteGroup: (id: string) => Promise<void>;
  enterTopic: (topicId: string) => Promise<{ lockedBy?: string; success: boolean }>;
  fetchGroups: () => Promise<void>;
  fetchGroupTopics: (groupId: string) => Promise<void>;

  fetchMembers: (groupId: string) => Promise<void>;
  fetchMyGroups: () => Promise<void>;
  leaveTopic: (topicId: string) => void;
  removeMember: (groupId: string, userId: string) => Promise<void>;
  setActiveGroupId: (id: string | null) => void;
}

const LOCK_RENEW_INTERVAL = 2 * 60 * 1000; // 2 分钟续期

const initialState: UserGroupState = {
  activeGroupId: null,
  activeLockedTopicId: null,
  groups: [],
  groupTopics: {},
  loading: false,
  members: {},
  myGroups: [],
};

// 保存续期定时器引用（store 外部管理，避免序列化问题）
let lockRenewTimer: ReturnType<typeof setInterval> | null = null;

const createStore: StateCreator<UserGroupStore, [['zustand/devtools', never]]> = (set, get) => ({
  ...initialState,

  setActiveGroupId: (id) => {
    set({ activeGroupId: id }, false, 'setActiveGroupId');
  },

  // ============ 管理类 ============

  fetchGroups: async () => {
    set({ loading: true }, false, 'fetchGroups/start');
    const groups = await userGroupService.getGroups();
    set({ groups, loading: false }, false, 'fetchGroups/done');
  },

  createGroup: async (params) => {
    await userGroupService.createGroup(params);
    await get().fetchGroups();
  },

  deleteGroup: async (id) => {
    await userGroupService.deleteGroup(id);
    await get().fetchGroups();
  },

  fetchMembers: async (groupId) => {
    const members = await userGroupService.getGroupMembersWithDetails(groupId);
    set((s) => ({ members: { ...s.members, [groupId]: members } }), false, 'fetchMembers');
  },

  addMember: async (groupId, userId) => {
    await userGroupService.addMember(groupId, userId);
    await get().fetchMembers(groupId);
  },

  removeMember: async (groupId, userId) => {
    await userGroupService.removeMember(groupId, userId);
    await get().fetchMembers(groupId);
  },

  // ============ 使用类 ============

  fetchMyGroups: async () => {
    const myGroups = await userGroupService.getMyGroups();
    set({ myGroups }, false, 'fetchMyGroups');
  },

  fetchGroupTopics: async (groupId) => {
    const items = await userGroupService.getGroupTopics(groupId);
    set(
      (s) => ({ groupTopics: { ...s.groupTopics, [groupId]: items as GroupTopicItem[] } }),
      false,
      'fetchGroupTopics',
    );
  },

  createGroupTopic: async (params) => {
    const topic = await userGroupService.createGroupTopic(params);
    await get().fetchGroupTopics(params.userGroupId);
    return topic?.id;
  },

  /**
   * 进入话题：尝试锁定，成功则启动心跳续期
   */
  enterTopic: async (topicId) => {
    // 先离开之前的话题
    const prev = get().activeLockedTopicId;
    if (prev && prev !== topicId) {
      get().leaveTopic(prev);
    }

    const result = await userGroupService.tryLockTopic(topicId);

    if (result.success) {
      set({ activeLockedTopicId: topicId }, false, 'enterTopic/locked');

      // 启动心跳续期
      lockRenewTimer = setInterval(async () => {
        const ok = await userGroupService.renewLock(topicId);
        if (!ok) {
          // 续期失败（可能被抢占），清除定时器
          get().leaveTopic(topicId);
        }
      }, LOCK_RENEW_INTERVAL);
    }

    return result;
  },

  /**
   * 离开话题：释放锁 + 停止心跳
   */
  leaveTopic: (topicId) => {
    if (lockRenewTimer) {
      clearInterval(lockRenewTimer);
      lockRenewTimer = null;
    }

    // 如果页面正在卸载，使用 sendBeacon
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      userGroupService.releaseLockBeacon(topicId);
    } else {
      userGroupService.releaseLock(topicId).catch(() => {
        // 静默失败，心跳过期也会自动释放
      });
    }

    set({ activeLockedTopicId: null }, false, 'leaveTopic');
  },
});

const devtools = createDevtools('userGroup');

export const useUserGroupStore = createWithEqualityFn<UserGroupStore>()(
  devtools(createStore),
  shallow,
);

export const selectActiveGroupDetail = (state: UserGroupStore): MyGroupItem | undefined =>
  state.myGroups.find((g) => g.group.id === state.activeGroupId);
