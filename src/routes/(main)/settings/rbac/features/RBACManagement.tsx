'use client';

import { Flexbox, FormGroup } from '@lobehub/ui';
import { Button, message, Modal, Select, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { lambdaClient } from '@/libs/trpc/client';

interface RoleItem {
  description: string | null;
  displayName: string;
  id: string;
  isSystem: boolean;
  name: string;
}

interface PermissionItem {
  category: string;
  code: string;
  id: string;
  name: string;
}

interface UserOption {
  label: string;
  value: string;
}

const RBACManagement = memo(() => {
  const { t } = useTranslation('setting');
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesData, permsData] = await Promise.all([
        lambdaClient.rbac.getRoles.query(),
        lambdaClient.rbac.getPermissions.query(),
      ]);
      setRoles(rolesData as RoleItem[]);
      setPermissions(permsData as PermissionItem[]);
    } catch {
      // 权限不足时静默处理
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    return () => clearTimeout(searchTimerRef.current);
  }, [fetchData]);

  const handleUserSearch = useCallback((keyword: string) => {
    clearTimeout(searchTimerRef.current);
    if (!keyword.trim()) {
      setUserOptions([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setUserSearchLoading(true);
      try {
        const results = await lambdaClient.rbac.searchUsers.query({ keyword });
        setUserOptions(
          results.map((u) => ({
            label: u.username
              ? `${u.username}${u.email ? ` <${u.email}>` : ''}`
              : (u.email ?? u.id),
            value: u.id,
          })),
        );
      } finally {
        setUserSearchLoading(false);
      }
    }, 300);
  }, []);

  const handleAssignRole = async () => {
    if (!targetUserId || selectedRoleIds.length === 0) return;
    try {
      await lambdaClient.rbac.assignRole.mutate({
        roleIds: selectedRoleIds,
        userId: targetUserId,
      });
      message.success(t('rbac.assignSuccess'));
      setAssignModalOpen(false);
      setTargetUserId('');
      setSelectedRoleIds([]);
      setUserOptions([]);
    } catch {
      message.error(t('rbac.assignFailed'));
    }
  };

  const handleModalClose = () => {
    setAssignModalOpen(false);
    setTargetUserId('');
    setSelectedRoleIds([]);
    setUserOptions([]);
    clearTimeout(searchTimerRef.current);
  };

  const roleColumns: ColumnsType<RoleItem> = [
    { dataIndex: 'displayName', key: 'displayName', title: t('rbac.roleName') },
    { dataIndex: 'name', key: 'name', title: t('rbac.roleCode') },
    { dataIndex: 'description', key: 'description', title: t('rbac.description') },
    {
      dataIndex: 'isSystem',
      key: 'isSystem',
      render: (val: boolean) =>
        val ? <Tag color="blue">{t('rbac.system')}</Tag> : <Tag>{t('rbac.custom')}</Tag>,
      title: t('rbac.type'),
    },
  ];

  const permColumns: ColumnsType<PermissionItem> = [
    { dataIndex: 'code', key: 'code', title: t('rbac.permCode') },
    { dataIndex: 'name', key: 'name', title: t('rbac.permName') },
    {
      dataIndex: 'category',
      key: 'category',
      render: (val: string) => <Tag>{val}</Tag>,
      title: t('rbac.category'),
    },
  ];

  return (
    <Flexbox gap={24}>
      <FormGroup
        collapsible={false}
        gap={16}
        title={t('rbac.roles')}
        variant={'filled'}
        extra={
          <Button type="primary" onClick={() => setAssignModalOpen(true)}>
            {t('rbac.assignRole')}
          </Button>
        }
      >
        <Table
          columns={roleColumns}
          dataSource={roles}
          loading={loading}
          pagination={false}
          rowKey="id"
          size="small"
        />
      </FormGroup>

      <FormGroup collapsible={false} gap={16} title={t('rbac.permissions')} variant={'filled'}>
        <Table
          columns={permColumns}
          dataSource={permissions}
          loading={loading}
          pagination={false}
          rowKey="id"
          size="small"
        />
      </FormGroup>

      <Modal
        okText={t('rbac.confirm')}
        open={assignModalOpen}
        title={t('rbac.assignRole')}
        onCancel={handleModalClose}
        onOk={handleAssignRole}
      >
        <Flexbox gap={16}>
          <Select
            showSearch
            filterOption={false}
            loading={userSearchLoading}
            options={userOptions}
            placeholder={t('rbac.userSearchPlaceholder')}
            style={{ width: '100%' }}
            value={targetUserId || undefined}
            onChange={(val: string) => setTargetUserId(val)}
            onSearch={handleUserSearch}
          />
          <Select
            mode="multiple"
            options={roles.map((r) => ({ label: r.displayName, value: r.id }))}
            placeholder={t('rbac.selectRoles')}
            value={selectedRoleIds}
            onChange={setSelectedRoleIds}
          />
        </Flexbox>
      </Modal>
    </Flexbox>
  );
});

export default RBACManagement;
