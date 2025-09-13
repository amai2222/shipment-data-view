// 增强的权限管理Hook

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  UserPermission, 
  RolePermissionTemplate, 
  PermissionContext, 
  PermissionCheck,
  UserRole,
  PermissionType
} from '@/types/permissions';
import { DEFAULT_PERMISSIONS } from '@/config/permissions';

export function useAdvancedPermissions() {
  const { user, profile } = useAuth();
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [roleTemplates, setRoleTemplates] = useState<Record<UserRole, RolePermissionTemplate>>({} as Record<UserRole, RolePermissionTemplate>);
  const [loading, setLoading] = useState(true);
  const [currentProject, setCurrentProject] = useState<string | null>(null);

  const loadPermissions = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      // 并行加载用户权限和角色模板
      const [userPermsResult, roleTemplatesResult] = await Promise.all([
        supabase
          .from('user_permissions')
          .select('*')
          .eq('user_id', user.id),
        supabase
          .from('role_permission_templates')
          .select('*')
      ]);

      if (userPermsResult.error) {
        console.warn('加载用户权限失败，使用默认权限:', userPermsResult.error);
        setUserPermissions([]);
      } else {
        // 处理用户权限数据，确保包含所有必需字段
        const userPerms = (userPermsResult.data || []).map(perm => ({
          id: perm.id,
          user_id: perm.user_id,
          project_id: perm.project_id,
          menu_permissions: perm.menu_permissions || [],
          function_permissions: perm.function_permissions || [],
          project_permissions: perm.project_permissions || [],
          data_permissions: perm.data_permissions || [],
          inherit_role: perm.inherit_role ?? true,
          custom_settings: perm.custom_settings || {},
          created_at: perm.created_at,
          updated_at: perm.updated_at,
          created_by: perm.created_by || ''
        }));
        setUserPermissions(userPerms);
      }
      
      if (roleTemplatesResult.error) {
        console.warn('加载角色模板失败，使用默认模板:', roleTemplatesResult.error);
        setRoleTemplates({} as Record<UserRole, RolePermissionTemplate>);
      } else {
        // 转换为以角色为键的对象，确保包含所有必需字段
        const templates: Record<UserRole, RolePermissionTemplate> = {} as Record<UserRole, RolePermissionTemplate>;
        roleTemplatesResult.data?.forEach(template => {
          templates[template.role] = {
            id: template.id,
            role: template.role,
            name: template.name || template.role,
            description: template.description || '',
            color: template.color || 'bg-gray-500',
            menu_permissions: template.menu_permissions || [],
            function_permissions: template.function_permissions || [],
            project_permissions: template.project_permissions || [],
            data_permissions: template.data_permissions || [],
            is_system: template.is_system ?? true,
            created_at: template.created_at,
            updated_at: template.updated_at
          };
        });
        setRoleTemplates(templates);
      }
      
    } catch (error) {
      console.error('加载权限数据失败:', error);
      // 设置默认值
      setUserPermissions([]);
      setRoleTemplates({} as Record<UserRole, RolePermissionTemplate>);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // 加载用户权限数据
  useEffect(() => {
    if (user?.id) {
      loadPermissions();
    }
  }, [user?.id, loadPermissions]); // 添加 loadPermissions 依赖

  // 获取当前用户的权限上下文
  const getPermissionContext = useMemo((): PermissionContext => {
    if (!user || !profile) {
      return {
        userId: '',
        userRole: 'viewer',
        currentProject,
        permissions: {
          menu: [],
          function: [],
          project: [],
          data: []
        }
      };
    }

    const userRole = profile.role as UserRole;
    
    // 获取用户特定权限
    const userPerm = userPermissions.find(
      p => p.user_id === user.id && 
      (currentProject ? p.project_id === currentProject : p.project_id === null)
    );

    // 获取用户角色
    const roleTemplate = roleTemplates[userRole];

    // 如果用户有特定权限且不继承角色权限
    if (userPerm && !userPerm.inherit_role) {
      return {
        userId: user.id,
        userRole,
        currentProject: currentProject || undefined,
        permissions: {
          menu: userPerm.menu_permissions,
          function: userPerm.function_permissions,
          project: userPerm.project_permissions,
          data: userPerm.data_permissions
        }
      };
    }

    // 合并角色权限和用户特定权限
    const rolePermissions = roleTemplate ? {
      menu_permissions: roleTemplate.menu_permissions,
      function_permissions: roleTemplate.function_permissions,
      project_permissions: roleTemplate.project_permissions,
      data_permissions: roleTemplate.data_permissions
    } : DEFAULT_ROLE_PERMISSIONS[userRole];

    if (userPerm) {
      // 用户特定权限覆盖角色权限
      return {
        userId: user.id,
        userRole,
        currentProject: currentProject || undefined,
        permissions: {
          menu: [...new Set([...rolePermissions.menu_permissions, ...userPerm.menu_permissions])],
          function: [...new Set([...rolePermissions.function_permissions, ...userPerm.function_permissions])],
          project: [...new Set([...rolePermissions.project_permissions, ...userPerm.project_permissions])],
          data: [...new Set([...rolePermissions.data_permissions, ...userPerm.data_permissions])]
        }
      };
    }

    return {
      userId: user.id,
      userRole,
      currentProject: currentProject || undefined,
      permissions: {
        menu: rolePermissions.menu_permissions,
        function: rolePermissions.function_permissions,
        project: rolePermissions.project_permissions,
        data: rolePermissions.data_permissions
      }
    };
  }, [user?.id, profile?.role, currentProject, userPermissions, roleTemplates]);

  // 获取有效权限（用户权限 + 角色权限）
  const getEffectivePermissions = (userId: string, projectId?: string | null) => {
    // 获取用户特定权限
    const userPerm = userPermissions.find(
      p => p.user_id === userId && 
      (projectId ? p.project_id === projectId : p.project_id === null)
    );

    // 获取用户角色
    const user = profile;
    if (!user) {
      return { menu: [], function: [], project: [], data: [] };
    }

    const userRole = user.role as UserRole;
    const roleTemplate = roleTemplates[userRole];

    // 如果用户有特定权限且不继承角色权限
    if (userPerm && !userPerm.inherit_role) {
      return {
        menu: userPerm.menu_permissions,
        function: userPerm.function_permissions,
        project: userPerm.project_permissions,
        data: userPerm.data_permissions
      };
    }

    // 合并角色权限和用户特定权限
    const rolePermissions = roleTemplate ? {
      menu_permissions: roleTemplate.menu_permissions,
      function_permissions: roleTemplate.function_permissions,
      project_permissions: roleTemplate.project_permissions,
      data_permissions: roleTemplate.data_permissions
    } : DEFAULT_ROLE_PERMISSIONS[userRole];

    if (userPerm) {
      // 用户特定权限覆盖角色权限
      return {
        menu: [...new Set([...rolePermissions.menu_permissions, ...userPerm.menu_permissions])],
        function: [...new Set([...rolePermissions.function_permissions, ...userPerm.function_permissions])],
        project: [...new Set([...rolePermissions.project_permissions, ...userPerm.project_permissions])],
        data: [...new Set([...rolePermissions.data_permissions, ...userPerm.data_permissions])]
      };
    }

    return {
      menu: rolePermissions.menu_permissions,
      function: rolePermissions.function_permissions,
      project: rolePermissions.project_permissions,
      data: rolePermissions.data_permissions
    };
  };

  // 检查权限
  const hasPermission = useCallback((permission: string, type: PermissionType = 'function'): PermissionCheck => {
    try {
      const context = getPermissionContext;
      const permissions = context.permissions[type === 'menu' ? 'menu' : 
                                            type === 'project' ? 'project' : 
                                            type === 'data' ? 'data' : 'function'];

      const hasAccess = permissions.includes(permission);
      
      return {
        hasPermission: hasAccess,
        reason: hasAccess ? undefined : `缺少权限: ${permission}`,
        inheritedFrom: hasAccess ? 'role' : undefined
      };
    } catch (error) {
      console.error('权限检查失败:', error);
      return {
        hasPermission: false,
        reason: '权限检查失败',
        inheritedFrom: undefined
      };
    }
  }, [getPermissionContext]);

  // 检查菜单权限
  const hasMenuAccess = useCallback((menuKey: string): boolean => {
    try {
      return hasPermission(menuKey, 'menu').hasPermission;
    } catch (error) {
      console.error('菜单权限检查失败:', error);
      return false;
    }
  }, [hasPermission]);

  // 检查功能权限
  const hasFunctionAccess = useCallback((functionKey: string): boolean => {
    try {
      return hasPermission(functionKey, 'function').hasPermission;
    } catch (error) {
      console.error('功能权限检查失败:', error);
      return false;
    }
  }, [hasPermission]);

  // 检查项目权限
  const hasProjectAccess = useCallback((projectKey: string): boolean => {
    try {
      return hasPermission(projectKey, 'project').hasPermission;
    } catch (error) {
      console.error('项目权限检查失败:', error);
      return false;
    }
  }, [hasPermission]);

  // 检查数据权限
  const hasDataAccess = useCallback((dataKey: string): boolean => {
    try {
      return hasPermission(dataKey, 'data').hasPermission;
    } catch (error) {
      console.error('数据权限检查失败:', error);
      return false;
    }
  }, [hasPermission]);

  // 获取用户可访问的项目列表
  const getAccessibleProjects = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');

      if (error) throw error;

      // 根据权限过滤项目
      const hasViewAllProjects = hasProjectAccess('project.view_all');
      if (hasViewAllProjects) {
        return data || [];
      }

      // 如果只能查看分配的项目，需要从用户关联表获取
      // 目前返回空数组，因为还没有用户项目关联表
      return [];
    } catch (error) {
      console.error('获取可访问项目失败:', error);
      return [];
    }
  }, [hasProjectAccess, user?.id]);

  // 设置当前项目
  const setCurrentProjectContext = useCallback((projectId: string | null) => {
    setCurrentProject(projectId);
  }, []);

  // 刷新权限数据
  const refreshPermissions = useCallback(() => {
    loadPermissions();
  }, [loadPermissions]);

  return {
    // 状态
    loading,
    userPermissions,
    roleTemplates,
    currentProject,
    
    // 权限上下文
    permissionContext: getPermissionContext,
    
    // 权限检查方法
    hasPermission,
    hasMenuAccess,
    hasFunctionAccess,
    hasProjectAccess,
    hasDataAccess,
    
    // 工具方法
    getAccessibleProjects,
    setCurrentProjectContext,
    refreshPermissions,
    
    // 数据获取
    getEffectivePermissions
  };
}
