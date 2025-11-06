// 动态菜单管理 Hook
// 从数据库读取菜单配置，替代硬编码的菜单结构

import { useState, useEffect, useMemo } from 'react';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useSimplePermissions } from './useSimplePermissions';
import { safeLogger } from '@/utils/safeLogger';

export interface MenuItem {
  id: string;
  key: string;
  title: string;
  url?: string;
  icon?: string;
  orderIndex: number;
  isActive: boolean;
  requiredPermissions: string[];
}

export interface MenuGroup {
  id: string;
  key: string;
  title: string;
  icon?: string;
  orderIndex: number;
  items: MenuItem[];
}

interface MenuConfigRow {
  id: string;
  key: string;
  parent_key: string | null;
  title: string;
  url: string | null;
  icon: string | null;
  order_index: number;
  is_active: boolean;
  is_group: boolean;
  required_permissions: string[] | null;
}

export function useDynamicMenu() {
  const [loading, setLoading] = useState(true);
  const [menuGroups, setMenuGroups] = useState<MenuGroup[]>([]);
  const [urlToKeyMap, setUrlToKeyMap] = useState<Record<string, string>>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { hasMenuAccess, isAdmin } = useSimplePermissions();

  // 从数据库加载菜单配置
  useEffect(() => {
    const loadMenuConfig = async () => {
      try {
        setLoading(true);
        
        const { data: menuData, error } = await supabase
          .from('menu_config')
          .select('*')
          .eq('is_active', true)
          .order('order_index');

        if (error) {
          safeLogger.error('加载菜单配置失败:', error);
          return;
        }

        if (!menuData || menuData.length === 0) {
          safeLogger.warn('菜单配置为空');
          return;
        }

        // 分离分组和菜单项
        const groups = menuData.filter(m => m.is_group) as MenuConfigRow[];
        const items = menuData.filter(m => !m.is_group) as MenuConfigRow[];

        // 构建 URL 到 Key 的映射
        const keyMap: Record<string, string> = {};
        items.forEach(item => {
          if (item.url) {
            keyMap[item.url] = item.key;
          }
        });
        setUrlToKeyMap(keyMap);

        // 构建分组菜单结构
        const groupedMenus: MenuGroup[] = groups.map(group => ({
          id: group.id,
          key: group.key,
          title: group.title,
          icon: group.icon || undefined,
          orderIndex: group.order_index,
          items: items
            .filter(item => item.parent_key === group.key)
            .map(item => ({
              id: item.id,
              key: item.key,
              title: item.title,
              url: item.url || undefined,
              icon: item.icon || undefined,
              orderIndex: item.order_index,
              isActive: item.is_active,
              requiredPermissions: item.required_permissions || []
            }))
            .sort((a, b) => a.orderIndex - b.orderIndex)
        })).sort((a, b) => a.orderIndex - b.orderIndex);

        setMenuGroups(groupedMenus);
        safeLogger.debug('菜单配置加载成功:', {
          groups: groupedMenus.length,
          items: items.length
        });

      } catch (error) {
        safeLogger.error('加载菜单配置异常:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMenuConfig();

    // 订阅菜单配置变化（实时更新）
    const subscription = supabase
      .channel('menu_config_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_config'
        },
        (payload) => {
          safeLogger.debug('菜单配置变化:', payload);
          // 菜单变化时重新加载
          loadMenuConfig();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshTrigger]);

  // 根据权限过滤菜单
  const filteredMenuGroups = useMemo(() => {
    if (loading || !menuGroups.length) return [];

    return menuGroups.map(group => ({
      ...group,
      items: group.items.filter(item => {
        // 管理员可以访问所有菜单
        if (isAdmin) return true;

        // 检查是否有任何所需权限
        if (!item.requiredPermissions || item.requiredPermissions.length === 0) {
          return true;
        }

        // 只要有一个权限满足就可以访问
        return item.requiredPermissions.some(permission => 
          hasMenuAccess(permission)
        );
      })
    })).filter(group => {
      // 如果分组内没有可访问的菜单项，隐藏整个分组
      return group.items.length > 0;
    });
  }, [menuGroups, hasMenuAccess, isAdmin, loading]);

  // 获取菜单 Key（从 URL）
  const getMenuKey = (url: string): string => {
    return urlToKeyMap[url] || '';
  };

  // 检查菜单是否有访问权限
  const checkMenuAccess = (url: string): boolean => {
    const menuKey = getMenuKey(url);
    if (!menuKey) return false;
    
    // 管理员有所有权限
    if (isAdmin) return true;
    
    return hasMenuAccess(menuKey);
  };

  // 手动刷新菜单
  const refreshMenus = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return {
    loading,
    menuGroups: filteredMenuGroups,
    urlToKeyMap,
    getMenuKey,
    checkMenuAccess,
    refreshMenus
  };
}

