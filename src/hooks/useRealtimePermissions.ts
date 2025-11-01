// 实时权限更新 Hook
// 文件: src/hooks/useRealtimePermissions.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BatchQueryService } from '@/services/BatchQueryService';

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
  
  // 使用 useRef 避免循环依赖
  const usersRef = useRef<User[]>([]);
  usersRef.current = users;

  // 从数据库加载用户和权限数据（优化版本）
  const loadUsersWithPermissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 加载用户数据
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, is_active, work_wechat_userid, work_wechat_name, phone')
        .order('full_name');

      if (usersError) {
        throw usersError;
      }

      if (!usersData || usersData.length === 0) {
        setUsers([]);
        return;
      }

      // 批量获取用户权限（优化：减少数据库请求）
      const userIds = usersData.map(user => user.id);
      const batchPermissions = await BatchQueryService.getBatchUserEffectivePermissions(userIds);

      // 构建用户权限数据
      const usersWithPermissions = usersData.map(user => {
        const permissions = batchPermissions.get(user.id) || {
          menu_permissions: [],
          function_permissions: [],
          project_permissions: [],
          data_permissions: [],
          source: 'default' as const
        };

        return {
          ...user,
          permissions: {
            menu: permissions.menu_permissions,
            function: permissions.function_permissions,
            project: permissions.project_permissions,
            data: permissions.data_permissions
          }
        };
      });

      setUsers(usersWithPermissions);
    } catch (error) {
      console.error('加载用户权限数据失败:', error);
      setError(error instanceof Error ? error.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 刷新特定用户的权限（优化版本）
  const refreshUserPermissions = useCallback(async (userId: string) => {
    try {
      // 使用 useRef 避免依赖 users 数组
      const currentUsers = usersRef.current;
      const userIndex = currentUsers.findIndex(user => user.id === userId);
      if (userIndex === -1) return;

      const user = currentUsers[userIndex];
      
      // 批量获取单个用户的权限
      const batchPermissions = await BatchQueryService.getBatchUserEffectivePermissions([userId]);
      const permissions = batchPermissions.get(userId);

      if (permissions) {
        setUsers(prevUsers => 
          prevUsers.map(user => 
            user.id === userId 
              ? {
                  ...user,
                  permissions: {
                    menu: permissions.menu_permissions,
                    function: permissions.function_permissions,
                    project: permissions.project_permissions,
                    data: permissions.data_permissions
                  }
                }
              : user
          )
        );
      }
    } catch (error) {
      console.error(`刷新用户 ${userId} 权限失败:`, error);
    }
  }, []); // 空依赖数组，避免循环依赖

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
          const newData = payload.new as any;
          const oldData = payload.old as any;
          const userId = newData?.user_id || oldData?.user_id;
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
