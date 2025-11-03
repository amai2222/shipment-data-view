// 动态菜单权限 Hook
// 从 menu_config 表读取菜单权限选项，替代硬编码配置

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { safeLogger } from '@/utils/safeLogger';

export interface MenuPermissionItem {
  key: string;
  label: string;
  url?: string;
}

export interface MenuPermissionGroup {
  group: string;
  permissions: MenuPermissionItem[];
}

export function useDynamicMenuPermissions() {
  const [loading, setLoading] = useState(true);
  const [menuPermissions, setMenuPermissions] = useState<MenuPermissionGroup[]>([]);
  const [allPermissionKeys, setAllPermissionKeys] = useState<string[]>([]);

  // 从数据库加载菜单权限配置
  useEffect(() => {
    const loadMenuPermissions = async () => {
      try {
        setLoading(true);

        const { data: menuData, error } = await supabase
          .from('menu_config')
          .select('*')
          .eq('is_active', true)
          .order('order_index');

        if (error) {
          safeLogger.error('加载菜单权限配置失败:', error);
          return;
        }

        if (!menuData || menuData.length === 0) {
          safeLogger.warn('菜单权限配置为空');
          return;
        }

        // 分离分组和菜单项，并按 order_index 排序
        const groups = menuData
          .filter(m => m.is_group)
          .sort((a, b) => a.order_index - b.order_index);  // 按顺序排序
        
        const items = menuData.filter(m => !m.is_group);

        // 构建分组权限结构（保持分组顺序）
        const groupedPermissions: MenuPermissionGroup[] = groups.map(group => ({
          group: group.title,
          permissions: items
            .filter(item => item.parent_key === group.key)
            .sort((a, b) => a.order_index - b.order_index)  // 按顺序排序，不是字母
            .map(item => ({
              key: item.key,
              label: item.title,
              url: item.url || undefined
            }))
        }));

        // 收集所有权限键
        const allKeys = groupedPermissions.flatMap(group => 
          group.permissions.map(p => p.key)
        );

        setMenuPermissions(groupedPermissions);
        setAllPermissionKeys(allKeys);

        safeLogger.debug('菜单权限配置加载成功:', {
          groups: groupedPermissions.length,
          totalPermissions: allKeys.length
        });

      } catch (error) {
        safeLogger.error('加载菜单权限配置异常:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMenuPermissions();
  }, []);

  // 根据URL获取权限键
  const getPermissionKeyByUrl = (url: string): string | null => {
    for (const group of menuPermissions) {
      for (const permission of group.permissions) {
        if (permission.url === url) {
          return permission.key;
        }
      }
    }
    return null;
  };

  // 根据权限键获取菜单信息
  const getMenuInfoByPermissionKey = (key: string): {
    title: string;
    url?: string;
    group: string;
  } | null => {
    for (const group of menuPermissions) {
      for (const permission of group.permissions) {
        if (permission.key === key) {
          return {
            title: permission.label,
            url: permission.url,
            group: group.group
          };
        }
      }
    }
    return null;
  };

  return {
    loading,
    menuPermissions,
    allPermissionKeys,
    getPermissionKeyByUrl,
    getMenuInfoByPermissionKey
  };
}

