// 实时权限管理 Hook（无缓存版本）
// 文件: src/hooks/useMenuPermissions.ts

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface MenuPermissions {
  hasMenuAccess: (menuKey: string) => boolean;
  hasFunctionAccess: (functionKey: string) => boolean;
  loading: boolean;
}

export function useMenuPermissions(): MenuPermissions {
  const { profile } = useAuth();
  const [menuPermissions, setMenuPermissions] = useState<string[]>([]);
  const [functionPermissions, setFunctionPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) {
      setMenuPermissions([]);
      setFunctionPermissions([]);
      setLoading(false);
      return;
    }

    loadUserPermissions();
  }, [profile?.id, profile?.role]);

  const loadUserPermissions = async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);

      // 1. 首先获取用户特定权限（优先级最高）- 只查询最新的一条
      const { data: userPerms } = await supabase
        .from('user_permissions')
        .select('menu_permissions, function_permissions')
        .eq('user_id', profile.id)
        .is('project_id', null) // 全局权限
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (userPerms) {
        setMenuPermissions(userPerms.menu_permissions || []);
        setFunctionPermissions(userPerms.function_permissions || []);
        setLoading(false);
        return;
      }

      // 2. 如果没有用户特定权限，使用角色默认权限
      const { data: roleTemplate } = await supabase
        .from('role_permission_templates')
        .select('menu_permissions, function_permissions')
        .eq('role', profile.role)
        .single();

      if (roleTemplate) {
        setMenuPermissions(roleTemplate.menu_permissions || []);
        setFunctionPermissions(roleTemplate.function_permissions || []);
      } else {
        setMenuPermissions([]);
        setFunctionPermissions([]);
      }

    } catch (error) {
      console.error('加载用户权限失败:', error);
      setMenuPermissions([]);
      setFunctionPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  // 检查菜单权限
  const hasMenuAccess = (menuKey: string): boolean => {
    if (!menuKey) return false;
    
    // 管理员拥有所有权限
    if (profile?.role === 'admin') return true;
    
    // 检查用户是否有该菜单权限
    return menuPermissions.includes(menuKey) || menuPermissions.includes('all');
  };

  // 检查功能权限
  const hasFunctionAccess = (functionKey: string): boolean => {
    if (!functionKey) return false;
    
    // 管理员拥有所有权限
    if (profile?.role === 'admin') return true;
    
    // 检查用户是否有该功能权限
    return functionPermissions.includes(functionKey) || functionPermissions.includes('all');
  };

  return {
    hasMenuAccess,
    hasFunctionAccess,
    loading
  };
}

export default useMenuPermissions;