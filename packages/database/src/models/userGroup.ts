import { and, asc, desc, eq, sql } from 'drizzle-orm';

import { users } from '../schemas/user';
import {
  type NewUserGroup,
  type UserGroupItem,
  userGroupMembers,
  userGroups,
} from '../schemas/userGroup';
import type { LobeChatDatabase } from '../type';
import { idGenerator } from '../utils/idGenerator';

export class UserGroupModel {
  private db: LobeChatDatabase;
  private userId: string;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  // ---- 用户组 CRUD ----

  create = async (params: Pick<NewUserGroup, 'name' | 'description' | 'parentId'>) => {
    const [result] = await this.db
      .insert(userGroups)
      .values({ ...params, id: this.genId(), createdBy: this.userId })
      .returning();
    return result;
  };

  query = async () => {
    return this.db
      .select()
      .from(userGroups)
      .orderBy(asc(userGroups.sort), desc(userGroups.createdAt));
  };

  findById = async (id: string) => {
    return this.db.query.userGroups.findFirst({ where: eq(userGroups.id, id) });
  };

  update = async (id: string, value: Partial<UserGroupItem>) => {
    return this.db
      .update(userGroups)
      .set({ ...value, updatedAt: new Date() })
      .where(eq(userGroups.id, id));
  };

  delete = async (id: string) => {
    return this.db.delete(userGroups).where(eq(userGroups.id, id));
  };

  // ---- 成员管理 ----

  addMember = async (groupId: string, userId: string, role = 'member') => {
    return this.db.insert(userGroupMembers).values({ groupId, userId, role }).onConflictDoNothing();
  };

  removeMember = async (groupId: string, userId: string) => {
    return this.db
      .delete(userGroupMembers)
      .where(and(eq(userGroupMembers.groupId, groupId), eq(userGroupMembers.userId, userId)));
  };

  getGroupMembers = async (groupId: string) => {
    return this.db.select().from(userGroupMembers).where(eq(userGroupMembers.groupId, groupId));
  };

  getGroupMembersWithDetails = async (groupId: string) => {
    return this.db
      .select({
        avatar: users.avatar,
        createdAt: userGroupMembers.createdAt,
        email: users.email,
        fullName: users.fullName,
        groupId: userGroupMembers.groupId,
        role: userGroupMembers.role,
        userId: userGroupMembers.userId,
        username: users.username,
      })
      .from(userGroupMembers)
      .innerJoin(users, eq(userGroupMembers.userId, users.id))
      .where(eq(userGroupMembers.groupId, groupId));
  };

  getUserGroups = async (userId?: string) => {
    const targetUserId = userId || this.userId;
    return this.db
      .select({ groupId: userGroupMembers.groupId, role: userGroupMembers.role })
      .from(userGroupMembers)
      .where(eq(userGroupMembers.userId, targetUserId));
  };

  // ---- 组成员校验 ----

  /**
   * 检查用户是否是某个组的成员
   */
  isMember = async (groupId: string, userId?: string): Promise<boolean> => {
    const targetUserId = userId || this.userId;
    const result = await this.db
      .select({ userId: userGroupMembers.userId })
      .from(userGroupMembers)
      .where(and(eq(userGroupMembers.groupId, groupId), eq(userGroupMembers.userId, targetUserId)))
      .limit(1);
    return result.length > 0;
  };

  /**
   * 获取用户所在的所有组（含组详情）
   */
  getUserGroupsWithDetails = async (userId?: string) => {
    const targetUserId = userId || this.userId;

    const memberCountSq = this.db
      .select({
        groupId: userGroupMembers.groupId,
        count: sql<number>`count(*)::int`.as('count'),
      })
      .from(userGroupMembers)
      .groupBy(userGroupMembers.groupId)
      .as('member_count');

    return this.db
      .select({
        group: userGroups,
        memberCount: sql<number>`coalesce(${memberCountSq.count}, 0)`.as('memberCount'),
        role: userGroupMembers.role,
      })
      .from(userGroupMembers)
      .innerJoin(userGroups, eq(userGroups.id, userGroupMembers.groupId))
      .leftJoin(memberCountSq, eq(memberCountSq.groupId, userGroupMembers.groupId))
      .where(eq(userGroupMembers.userId, targetUserId))
      .orderBy(asc(userGroups.sort), desc(userGroups.createdAt));
  };

  private genId = () => idGenerator('userGroups');
}
