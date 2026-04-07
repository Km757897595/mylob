'use client';

import { Flexbox, FormGroup } from '@lobehub/ui';
import { Button, Drawer, Input, message, Modal, Popconfirm, Select, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Trash2, Users } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { lambdaClient } from '@/libs/trpc/client';

interface GroupItem {
  agentId: string | null;
  createdBy: string | null;
  description: string | null;
  id: string;
  name: string;
  parentId: string | null;
}

interface MemberItem {
  avatar: string | null;
  createdAt: Date;
  email: string | null;
  fullName: string | null;
  groupId: string;
  role: string;
  userId: string;
  username: string | null;
}

interface ManagerItem {
  avatar: string | null;
  email: string | null;
  fullName: string | null;
  groupId: string;
  userId: string;
  username: string | null;
}

interface UserOption {
  label: string;
  value: string;
}

interface AgentOption {
  label: string;
  value: string;
}

const GroupList = memo(() => {
  const { t } = useTranslation('setting');
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  // 成员管理 Drawer 状态
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<GroupItem | null>(null);
  const [managers, setManagers] = useState<ManagerItem[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [managerLoading, setManagerLoading] = useState(false);
  const [addManagerUserId, setAddManagerUserId] = useState('');
  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState<'group_admin' | 'member'>('member');
  const [addUserOptions, setAddUserOptions] = useState<UserOption[]>([]);
  const [addUserSearchLoading, setAddUserSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Agent binding state
  const [agentOptions, setAgentOptions] = useState<AgentOption[]>([]);
  const [agentLoading, setAgentLoading] = useState(false);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const data = await lambdaClient.userGroup.getGroups.query();
      setGroups(data as GroupItem[]);
    } catch {
      // 权限不足时静默处理
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
    return () => clearTimeout(searchTimerRef.current);
  }, [fetchGroups]);

  // Fetch available agents for binding
  const fetchAgents = useCallback(async (keyword?: string) => {
    setAgentLoading(true);
    try {
      const data = await lambdaClient.agent.queryAgents.query({
        includeVirtual: true,
        keyword,
        limit: 50,
      });
      setAgentOptions(
        data.map((a: any) => ({
          label: a.title || a.id,
          value: a.id,
        })),
      );
    } catch {
      setAgentOptions([]);
    } finally {
      setAgentLoading(false);
    }
  }, []);

  const handleBindAgent = useCallback(
    async (groupId: string, agentId: string | null) => {
      try {
        await lambdaClient.userGroup.updateGroup.mutate({ agentId, id: groupId });
        message.success(t('userGroups.bindAgentSuccess'));
        fetchGroups();
      } catch {
        message.error(t('userGroups.bindAgentFailed'));
      }
    },
    [fetchGroups, t],
  );

  const fetchMembers = useCallback(async (groupId: string) => {
    setMemberLoading(true);
    try {
      const data = await lambdaClient.userGroup.getGroupMembersWithDetails.query({ groupId });
      setMembers(data as MemberItem[]);
    } catch {
      setMembers([]);
    } finally {
      setMemberLoading(false);
    }
  }, []);

  const fetchManagers = useCallback(async (groupId: string) => {
    setManagerLoading(true);
    try {
      const data = await lambdaClient.userGroup.getGroupManagers.query({ groupId });
      setManagers(data as ManagerItem[]);
    } catch {
      setManagers([]);
    } finally {
      setManagerLoading(false);
    }
  }, []);

  const handleOpenMembers = useCallback(
    (group: GroupItem) => {
      setActiveGroup(group);
      setDrawerOpen(true);
      fetchMembers(group.id);
      fetchManagers(group.id);
    },
    [fetchManagers, fetchMembers],
  );

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setActiveGroup(null);
    setManagers([]);
    setMembers([]);
    setAddManagerUserId('');
    setAddUserId('');
    setAddRole('member');
    setAddUserOptions([]);
    clearTimeout(searchTimerRef.current);
  };

  const handleUserSearch = useCallback((keyword: string) => {
    clearTimeout(searchTimerRef.current);
    if (!keyword.trim()) {
      setAddUserOptions([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setAddUserSearchLoading(true);
      try {
        const results = await lambdaClient.rbac.searchUsers.query({ keyword });
        setAddUserOptions(
          results.map((u) => ({
            label: u.username
              ? `${u.username}${u.email ? ` <${u.email}>` : ''}`
              : (u.email ?? u.id),
            value: u.id,
          })),
        );
      } finally {
        setAddUserSearchLoading(false);
      }
    }, 300);
  }, []);

  const handleAddMember = async () => {
    if (!addUserId || !activeGroup) return;
    try {
      await lambdaClient.userGroup.addMember.mutate({
        groupId: activeGroup.id,
        role: addRole,
        userId: addUserId,
      });
      message.success(t('userGroups.addMemberSuccess'));
      setAddUserId('');
      setAddUserOptions([]);
      fetchMembers(activeGroup.id);
    } catch {
      message.error(t('userGroups.addMemberFailed'));
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!activeGroup) return;
    try {
      await lambdaClient.userGroup.removeMember.mutate({
        groupId: activeGroup.id,
        userId,
      });
      message.success(t('userGroups.removeMemberSuccess'));
      fetchMembers(activeGroup.id);
    } catch {
      message.error(t('userGroups.removeMemberFailed'));
    }
  };

  const handleAddManager = async () => {
    if (!addManagerUserId || !activeGroup) return;
    try {
      await lambdaClient.userGroup.addManager.mutate({
        groupId: activeGroup.id,
        userId: addManagerUserId,
      });
      message.success(t('userGroups.addManagerSuccess'));
      setAddManagerUserId('');
      setAddUserOptions([]);
      fetchManagers(activeGroup.id);
    } catch {
      message.error(t('userGroups.addManagerFailed'));
    }
  };

  const handleRemoveManager = async (userId: string) => {
    if (!activeGroup) return;
    try {
      await lambdaClient.userGroup.removeManager.mutate({
        groupId: activeGroup.id,
        userId,
      });
      message.success(t('userGroups.removeManagerSuccess'));
      fetchManagers(activeGroup.id);
    } catch {
      message.error(t('userGroups.removeManagerFailed'));
    }
  };

  const handleCreate = async () => {
    if (!newGroupName.trim()) return;
    try {
      await lambdaClient.userGroup.createGroup.mutate({
        description: newGroupDesc || undefined,
        name: newGroupName,
      });
      message.success(t('userGroups.createSuccess'));
      setCreateModalOpen(false);
      setNewGroupName('');
      setNewGroupDesc('');
      fetchGroups();
    } catch {
      message.error(t('userGroups.createFailed'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await lambdaClient.userGroup.deleteGroup.mutate({ id });
      message.success(t('userGroups.deleteSuccess'));
      fetchGroups();
    } catch {
      message.error(t('userGroups.deleteFailed'));
    }
  };

  const memberColumns: ColumnsType<MemberItem> = [
    {
      key: 'user',
      render: (_, record) => <span>{record.username || record.email || record.userId}</span>,
      title: t('userGroups.members'),
    },
    {
      dataIndex: 'role',
      key: 'role',
      render: (role: string) =>
        role === 'group_admin' ? (
          <Tag color="blue">{t('userGroups.roleAdmin')}</Tag>
        ) : (
          <Tag>{t('userGroups.roleMember')}</Tag>
        ),
      title: t('userGroups.memberRole'),
      width: 100,
    },
    {
      key: 'actions',
      render: (_, record) => (
        <Popconfirm
          title={t('userGroups.removeMember')}
          onConfirm={() => handleRemoveMember(record.userId)}
        >
          <Button danger size="small" type="text">
            {t('userGroups.removeMember')}
          </Button>
        </Popconfirm>
      ),
      title: t('userGroups.actions'),
      width: 80,
    },
  ];

  const managerColumns: ColumnsType<ManagerItem> = [
    {
      key: 'user',
      render: (_, record) => <span>{record.username || record.email || record.userId}</span>,
      title: t('userGroups.managers'),
    },
    {
      key: 'actions',
      render: (_, record) => (
        <Popconfirm
          title={t('userGroups.removeManager')}
          onConfirm={() => handleRemoveManager(record.userId)}
        >
          <Button danger size="small" type="text">
            {t('userGroups.removeManager')}
          </Button>
        </Popconfirm>
      ),
      title: t('userGroups.actions'),
      width: 120,
    },
  ];

  const columns: ColumnsType<GroupItem> = [
    { dataIndex: 'name', key: 'name', title: t('userGroups.groupName') },
    { dataIndex: 'description', key: 'description', title: t('userGroups.description') },
    {
      key: 'agent',
      render: (_, record) => (
        <Flexbox horizontal align="center" gap={4}>
          <Select
            allowClear
            showSearch
            filterOption={false}
            loading={agentLoading}
            options={agentOptions}
            placeholder={t('userGroups.bindAgentPlaceholder')}
            size="small"
            style={{ width: 180 }}
            value={record.agentId || undefined}
            onChange={(val) => handleBindAgent(record.id, val ?? null)}
            onSearch={(keyword) => fetchAgents(keyword)}
            onDropdownVisibleChange={(open) => {
              if (open) fetchAgents();
            }}
          />
        </Flexbox>
      ),
      title: t('userGroups.boundAgent'),
      width: 220,
    },
    {
      key: 'actions',
      render: (_, record) => (
        <Flexbox horizontal gap={4}>
          <Button
            icon={<Users size={14} />}
            size="small"
            type="text"
            onClick={() => handleOpenMembers(record)}
          >
            {t('userGroups.manageMembers')}
          </Button>
          <Button
            danger
            icon={<Trash2 size={14} />}
            size="small"
            type="text"
            onClick={() => handleDelete(record.id)}
          />
        </Flexbox>
      ),
      title: t('userGroups.actions'),
      width: 160,
    },
  ];

  return (
    <>
      <FormGroup
        collapsible={false}
        gap={16}
        title={t('userGroups.groups')}
        variant={'filled'}
        extra={
          <Button type="primary" onClick={() => setCreateModalOpen(true)}>
            {t('userGroups.createGroup')}
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={groups}
          loading={loading}
          pagination={false}
          rowKey="id"
          size="small"
        />
      </FormGroup>

      <Modal
        okText={t('userGroups.confirm')}
        open={createModalOpen}
        title={t('userGroups.createGroup')}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreate}
      >
        <Flexbox gap={12}>
          <Input
            placeholder={t('userGroups.groupNamePlaceholder')}
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <Input
            placeholder={t('userGroups.descriptionPlaceholder')}
            value={newGroupDesc}
            onChange={(e) => setNewGroupDesc(e.target.value)}
          />
        </Flexbox>
      </Modal>

      <Drawer
        open={drawerOpen}
        title={activeGroup ? `${t('userGroups.manageMembers')} — ${activeGroup.name}` : ''}
        width={480}
        onClose={handleDrawerClose}
      >
        <Flexbox gap={16}>
          <FormGroup title={t('userGroups.members')}>
            <Flexbox gap={12}>
              <Table
                columns={memberColumns}
                dataSource={members}
                loading={memberLoading}
                locale={{ emptyText: t('userGroups.noMembers') }}
                pagination={false}
                rowKey="userId"
                size="small"
              />

              <Flexbox gap={8} style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
                <Select
                  showSearch
                  filterOption={false}
                  loading={addUserSearchLoading}
                  options={addUserOptions}
                  placeholder={t('userGroups.searchUserPlaceholder')}
                  style={{ width: '100%' }}
                  value={addUserId || undefined}
                  onChange={(val: string) => setAddUserId(val)}
                  onSearch={handleUserSearch}
                />
                <Flexbox horizontal gap={8}>
                  <Select
                    style={{ width: 140 }}
                    value={addRole}
                    options={[
                      { label: t('userGroups.roleMember'), value: 'member' },
                      { label: t('userGroups.roleAdmin'), value: 'group_admin' },
                    ]}
                    onChange={setAddRole}
                  />
                  <Button
                    disabled={!addUserId}
                    style={{ flex: 1 }}
                    type="primary"
                    onClick={handleAddMember}
                  >
                    {t('userGroups.addMember')}
                  </Button>
                </Flexbox>
              </Flexbox>
            </Flexbox>
          </FormGroup>

          <FormGroup title={t('userGroups.managers')}>
            <Flexbox gap={12}>
              <Table
                columns={managerColumns}
                dataSource={managers}
                loading={managerLoading}
                locale={{ emptyText: t('userGroups.noManagers') }}
                pagination={false}
                rowKey="userId"
                size="small"
              />

              <Flexbox gap={8} style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
                <Select
                  showSearch
                  filterOption={false}
                  loading={addUserSearchLoading}
                  options={addUserOptions}
                  placeholder={t('userGroups.searchUserPlaceholder')}
                  style={{ width: '100%' }}
                  value={addManagerUserId || undefined}
                  onChange={(val: string) => setAddManagerUserId(val)}
                  onSearch={handleUserSearch}
                />
                <Button disabled={!addManagerUserId} type="primary" onClick={handleAddManager}>
                  {t('userGroups.addManager')}
                </Button>
              </Flexbox>
            </Flexbox>
          </FormGroup>
        </Flexbox>
      </Drawer>
    </>
  );
});

export default GroupList;
