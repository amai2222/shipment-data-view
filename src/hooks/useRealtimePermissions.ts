// 实时权限更新 Hook
// 文件: src/hooks/useRealtimePermissions.ts

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PermissionDatabaseService } from '@/services/PermissionDatabaseService';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  permissions: {
    menu: string[];
    function: string[];
    project: string[];
    data: string[];
  };
}

export function useRealtimePermissions() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 从数据库加载用户和权限数据
  const loadUsersWithPermissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 加载用户数据
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, is_active')
        .order('full_name');

      if (usersError) {
        throw usersError;
      }

      // 为每个用户加载权限数据
      const usersWithPermissions = await Promise.all(
        (usersData || []).map(async (user) => {
          try {
            const effectivePermissions = await PermissionDatabaseService.getUserEffectivePermissions(
              user.id, 
              user.role
            );
            
            return {
              ...user,
              permissions: {
                menu: effectivePermissions.menu_permissions,
                function: effectivePermissions.function_permissions,
                project: effectivePermissions.project_permissions,
                data: effectivePermissions.data_permissions
              }
            };
          } catch (error) {
            console.error(`加载用户 ${user.id} 权限失败:`, error);
            return {
              ...user,
              permissions: {
                menu: [],
                function: [],
                project: [],
                data: []
              }
            };
          }
        })
      );

      setUsers(usersWithPermissions);
    } catch (error) {
      console.error('加载用户权限数据失败:', error);
      setError(error instanceof Error ? error.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 刷新特定用户的权限
  const refreshUserPermissions = useCallback(async (userId: string) => {
    try {
      const userIndex = users.findIndex(user => user.id === userId);
      if (userIndex === -1) return;

      const user = users[userIndex];
      const effectivePermissions = await PermissionDatabaseService.getUserEffectivePermissions(
        user.id, 
        user.role
      );

      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId 
            ? {
                ...user,
                permissions: {
                  menu: effectivePermissions.menu_permissions,
                  function: effectivePermissions.function_permissions,
                  project: effectivePermissions.project_permissions,
                  data: effectivePermissions.data_permissions
                }
              }
            : user
        )
      );
    } catch (error) {
      console.error(`刷新用户 ${userId} 权限失败:`, error);
    }
  }, [users]);

  // 设置实时订阅
  useEffect(() => {
    // 订阅用户权限变更
    const userPermissionsChannel = supabase
      .channel('user_permissions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_permissions'
        },
        (payload) => {
          console.log('用户权限变更:', payload);
          const userId = payload.new?.user_id || payload.old?.user_id;
          if (userId) {
            refreshUserPermissions(userId);
          }
        }
      )
      .subscribe();

    // 订阅角色模板变更
    const roleTemplatesChannel = supabase
      .channel('role_templates_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'role_permission_templates'
        },
        (payload) => {
          console.log('角色模板变更:', payload);
          // 角色模板变更影响所有使用该角色的用户
          loadUsersWithPermissions();
        }
      )
      .subscribe();

    // 订阅用户信息变更
    const profilesChannel = supabase
      .channel('profiles_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          console.log('用户信息变更:', payload);
          loadUsersWithPermissions();
        }
      )
      .subscribe();

    // 初始加载
    loadUsersWithPermissions();

    // 清理订阅
    return () => {
      supabase.removeChannel(userPermissionsChannel);
      supabase.removeChannel(roleTemplatesChannel);
      supabase.removeChannel(profilesChannel);
    };
  }, [loadUsersWithPermissions, refreshUserPermissions]);

  return {
    users,
    loading,
    error,
    refreshUsers: loadUsersWithPermissions,
    refreshUserPermissions
  };
}

export default useRealtimePermissions;
