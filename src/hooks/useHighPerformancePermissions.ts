import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";

// 缓存键
const CACHE_KEYS = {
  ROLE_TEMPLATES: 'role_templates',
  USERS: 'users',
  USER_PERMISSIONS: 'user_permissions',
  PROJECTS: 'projects'
};

// 缓存过期时间（2分钟，缩短缓存时间）
const CACHE_EXPIRY = 2 * 60 * 1000;

// 内存缓存
const memoryCache = new Map<string, { data: any; timestamp: number }>();

// 权限变更监听器
const permissionChangeListeners = new Set<() => void>();

// 缓存工具函数
const getCachedData = (key: string) => {
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
    return cached.data;
  }
  return null;
};

const setCachedData = (key: string, data: any) => {
  memoryCache.set(key, { data, timestamp: Date.now() });
};

// 清除特定缓存
const clearCachedData = (key: string) => {
  memoryCache.delete(key);
};

// 清除所有缓存
const clearAllCache = () => {
  memoryCache.clear();
};

// 通知所有监听器
const notifyPermissionChange = () => {
  permissionChangeListeners.forEach(listener => listener());
};

// 高性能权限管理 Hook
export function useHighPerformancePermissions() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [roleTemplates, setRoleTemplates] = useState<Record<string, any>>({});
  const [users, setUsers] = useState<any[]>([]);
  const [userPermissions, setUserPermissions] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());

  // 添加权限变更监听器
  useEffect(() => {
    const handlePermissionChange = () => {
      // 清除相关缓存
      clearCachedData(CACHE_KEYS.USER_PERMISSIONS);
      clearCachedData(CACHE_KEYS.ROLE_TEMPLATES);
      clearCachedData(CACHE_KEYS.USERS);
      
      // 重新加载数据
      loadAllData();
    };

    permissionChangeListeners.add(handlePermissionChange);

    return () => {
      permissionChangeListeners.delete(handlePermissionChange);
    };
  }, []);

  // 设置Supabase实时订阅
  useEffect(() => {
    // 监听用户权限变更
    const userPermissionsSubscription = supabase
      .channel('user_permissions_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'user_permissions' },
        (payload) => {
          console.log('用户权限变更:', payload);
          notifyPermissionChange();
        }
      )
      .subscribe();

    // 监听角色模板变更
    const roleTemplatesSubscription = supabase
      .channel('role_templates_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'role_permission_templates' },
        (payload) => {
          console.log('角色模板变更:', payload);
          notifyPermissionChange();
        }
      )
      .subscribe();

    // 监听用户信息变更
    const profilesSubscription = supabase
      .channel('profiles_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          console.log('用户信息变更:', payload);
          notifyPermissionChange();
        }
      )
      .subscribe();

    return () => {
      userPermissionsSubscription.unsubscribe();
      roleTemplatesSubscription.unsubscribe();
      profilesSubscription.unsubscribe();
    };
  }, []);

  // 优化的数据加载 - 使用缓存和并行加载
  const loadAllData = useCallback(async () => {
    setLoading(true);
    setLoadingProgress(0);
    
    try {
      // 检查缓存
      const cachedTemplates = getCachedData(CACHE_KEYS.ROLE_TEMPLATES);
      const cachedUsers = getCachedData(CACHE_KEYS.USERS);
      const cachedPermissions = getCachedData(CACHE_KEYS.USER_PERMISSIONS);
      const cachedProjects = getCachedData(CACHE_KEYS.PROJECTS);

      // 并行加载数据（优先使用缓存）
      const promises = [];
      
      if (!cachedTemplates) {
        promises.push(
          supabase.from('role_permission_templates').select('*')
            .then(res => {
              setLoadingProgress(prev => prev + 25);
              return res;
            })
        );
      } else {
        setLoadingProgress(25);
      }

      if (!cachedUsers) {
        promises.push(
          supabase.from('profiles').select('id, full_name, email, role, is_active, work_wechat_userid')
            .then(res => {
              setLoadingProgress(prev => prev + 25);
              return res;
            })
        );
      } else {
        setLoadingProgress(50);
      }

      if (!cachedPermissions) {
        promises.push(
          supabase.from('user_permissions').select('*').order('created_at', { ascending: false })
            .then(res => {
              setLoadingProgress(prev => prev + 25);
              return res;
            })
        );
      } else {
        setLoadingProgress(75);
      }

      if (!cachedProjects) {
        promises.push(
          supabase.from('projects').select('id, name, project_status')
            .then(res => {
              setLoadingProgress(prev => prev + 25);
              return res;
            })
        );
      } else {
        setLoadingProgress(100);
      }

      // 等待所有查询完成
      const results = await Promise.all(promises);
      
      // 处理结果
      let resultIndex = 0;
      
      if (!cachedTemplates) {
        const templatesRes = results[resultIndex++];
        if (templatesRes.data) {
          const templateMap = templatesRes.data.reduce((acc, template) => {
            acc[template.role] = template;
            return acc;
          }, {});
          setRoleTemplates(templateMap);
          setCachedData(CACHE_KEYS.ROLE_TEMPLATES, templateMap);
        }
      } else {
        setRoleTemplates(cachedTemplates);
      }

      if (!cachedUsers) {
        const usersRes = results[resultIndex++];
        if (usersRes.data) {
          setUsers(usersRes.data);
          setCachedData(CACHE_KEYS.USERS, usersRes.data);
        }
      } else {
        setUsers(cachedUsers);
      }

      if (!cachedPermissions) {
        const permissionsRes = results[resultIndex++];
        if (permissionsRes.data) {
          setUserPermissions(permissionsRes.data);
          setCachedData(CACHE_KEYS.USER_PERMISSIONS, permissionsRes.data);
        }
      } else {
        setUserPermissions(cachedPermissions);
      }

      if (!cachedProjects) {
        const projectsRes = results[resultIndex++];
        if (projectsRes.data) {
          setProjects(projectsRes.data);
          setCachedData(CACHE_KEYS.PROJECTS, projectsRes.data);
        }
      } else {
        setProjects(cachedProjects);
      }

      setLoadingProgress(100);

    } catch (error) {
      console.error('加载数据失败:', error);
      toast({
        title: "加载失败",
        description: "无法加载权限数据",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // 优化的用户权限计算
  const optimizedUserPermissions = useMemo(() => {
    if (!userPermissions.length) return [];
    
    // 使用 Map 进行高效去重
    const uniquePermissions = new Map();
    
    // 按创建时间排序，保留最新的
    userPermissions
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .forEach(perm => {
        const key = `${perm.user_id}_${perm.project_id || 'global'}`;
        if (!uniquePermissions.has(key)) {
          uniquePermissions.set(key, perm);
        }
      });
    
    return Array.from(uniquePermissions.values());
  }, [userPermissions]);

  // 优化的用户权限映射
  const userPermissionsMap = useMemo(() => {
    const map = new Map();
    optimizedUserPermissions.forEach(perm => {
      map.set(perm.user_id, perm);
    });
    return map;
  }, [optimizedUserPermissions]);

  // 快速保存权限（批量操作）
  const savePermissions = useCallback(async (templates?: Record<string, any>, permissions?: any[]) => {
    try {
      setLoading(true);

      const promises = [];

      // 保存角色模板
      if (templates) {
        const templatePromises = Object.entries(templates).map(([roleKey, template]) =>
          supabase
            .from('role_permission_templates')
            .upsert({
              role: roleKey,
              menu_permissions: template.menu_permissions,
              function_permissions: template.function_permissions,
              project_permissions: template.project_permissions,
              data_permissions: template.data_permissions,
              is_system: template.is_system || false,
              name: template.name,
              description: template.description,
              color: template.color
            }, { onConflict: 'role' })
        );
        promises.push(...templatePromises);
      }

      // 保存用户权限
      if (permissions && permissions.length > 0) {
        const validPermissions = permissions.filter(perm => 
          perm.user_id && (
            (perm.menu_permissions && perm.menu_permissions.length > 0) ||
            (perm.function_permissions && perm.function_permissions.length > 0) ||
            (perm.project_permissions && perm.project_permissions.length > 0) ||
            (perm.data_permissions && perm.data_permissions.length > 0)
          )
        );

        if (validPermissions.length > 0) {
          const currentUser = await supabase.auth.getUser();
          promises.push(
            supabase
              .from('user_permissions')
              .upsert(validPermissions.map(perm => ({
                user_id: perm.user_id,
                project_id: perm.project_id || null,
                menu_permissions: perm.menu_permissions || [],
                function_permissions: perm.function_permissions || [],
                project_permissions: perm.project_permissions || [],
                data_permissions: perm.data_permissions || [],
                created_by: currentUser.data.user?.id
              })), { onConflict: 'user_id,project_id' })
          );
        }
      }

      // 并行执行所有保存操作
      await Promise.all(promises);

      // 清除相关缓存，强制重新加载
      clearCachedData(CACHE_KEYS.ROLE_TEMPLATES);
      clearCachedData(CACHE_KEYS.USER_PERMISSIONS);
      clearCachedData(CACHE_KEYS.USERS);

      // 更新本地状态
      if (templates) {
        setRoleTemplates(templates);
      }

      if (permissions) {
        setUserPermissions(permissions);
      }

      setHasChanges(false);
      setLastUpdateTime(new Date());
      
      // 通知其他组件权限已变更
      notifyPermissionChange();
      
      toast({
        title: "保存成功",
        description: "权限配置已更新，其他用户将实时看到变更",
      });

    } catch (error) {
      console.error('保存失败:', error);
      toast({
        title: "保存失败",
        description: "无法保存权限配置",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // 清理缓存
  const clearCache = useCallback(() => {
    clearAllCache();
    setLastUpdateTime(new Date());
  }, []);

  // 刷新数据（清除缓存后重新加载）
  const refreshData = useCallback(async () => {
    clearAllCache();
    await loadAllData();
    setLastUpdateTime(new Date());
  }, [loadAllData]);

  // 强制刷新权限数据（用于权限变更后）
  const forceRefreshPermissions = useCallback(async () => {
    clearCachedData(CACHE_KEYS.USER_PERMISSIONS);
    clearCachedData(CACHE_KEYS.ROLE_TEMPLATES);
    clearCachedData(CACHE_KEYS.USERS);
    
    await loadAllData();
    setLastUpdateTime(new Date());
  }, [loadAllData]);

  // 初始化加载
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  return {
    loading,
    loadingProgress,
    roleTemplates,
    users,
    userPermissions: optimizedUserPermissions,
    userPermissionsMap,
    projects,
    hasChanges,
    lastUpdateTime,
    setHasChanges,
    setRoleTemplates,
    setUserPermissions,
    savePermissions,
    loadAllData,
    refreshData,
    clearCache,
    forceRefreshPermissions
  };
}
