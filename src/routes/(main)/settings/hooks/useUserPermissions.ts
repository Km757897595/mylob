import { useEffect, useState } from 'react';

import { lambdaClient } from '@/libs/trpc/client';

interface UserPermissionInfo {
  category: string;
  permissionCode: string;
  permissionName: string;
  roleName: string;
}

/**
 * Hook: 获取当前用户的权限列表
 * 用于前端权限检查，如菜单权限控制
 */
export const useUserPermissions = () => {
  const [permissions, setPermissions] = useState<UserPermissionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        setLoading(true);
        // 调用后端 API 获取当前用户的权限
        const data = await lambdaClient.rbac.getMyPermissions.query();
        setPermissions(data as UserPermissionInfo[]);
        setError(null);
      } catch (err) {
        // 权限不足或其他错误时，设置为空权限列表
        setPermissions([]);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, []);

  /**
   * 检查用户是否拥有指定权限
   * @param permissionCode 权限编码，如 'user:manage'
   * @returns 是否拥有该权限
   */
  const hasPermission = (permissionCode: string) => {
    return permissions.some((perm) => perm.permissionCode === permissionCode);
  };

  /**
   * 检查用户是否拥有任意一个指定权限
   * @param permissionCodes 权限编码数组
   * @returns 是否拥有任意一个权限
   */
  const hasAnyPermission = (permissionCodes: string[]) => {
    return permissionCodes.some((code) => hasPermission(code));
  };

  /**
   * 检查用户是否拥有所有指定权限
   * @param permissionCodes 权限编码数组
   * @returns 是否拥有所有权限
   */
  const hasAllPermissions = (permissionCodes: string[]) => {
    return permissionCodes.every((code) => hasPermission(code));
  };

  return {
    permissions,
    loading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };
};
