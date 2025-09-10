// 增强的权限管理Hook

import { useState, useEffect, useMemo } from 'react';
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
import { DEFAULT_ROLE_PERMISSIONS } from '@/config/permissions';

export function useAdvancedPermissions() {
  const { user, profile } = useAuth();
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [roleTemplates, setRoleTemplates] = useState<Record<UserRole, RolePermissionTemplate>>({});
  const [loading, setLoading] = useState(true);
  const [currentProject, setCurrentProject] = useState<string | null>(null);

  // 加载用户权限数据
  useEffect(() => {
    if (user) {
      loadPermissions();
    }
  }, [user]);

  const loadPermissions = async () => {
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

      if (userPermsResult.error) throw userPermsResult.error;
      if (roleTemplatesResult.error) throw roleTemplatesResult.error;

      setUserPermissions(userPermsResult.data || []);
      
      // 转换为以角色为键的对象
      const templates: Record<UserRole, RolePermissionTemplate> = {} as any;
      roleTemplatesResult.data?.forEach(template => {
        templates[template.role] = template;
      });
      setRoleTemplates(templates);
      
    } catch (error) {
      console.error('加载权限数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

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
    const effectivePermissions = getEffectivePermissions(user.id, currentProject);

    return {
      userId: user.id,
      userRole,
      currentProject: currentProject || undefined,
      permissions: effectivePermissions
    };
  }, [user, profile, currentProject, userPermissions, roleTemplates]);

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
      menu: roleTemplate.menu_permissions,
      function: roleTemplate.function_permissions,
      project: roleTemplate.project_permissions,
      data: roleTemplate.data_permissions
    } : DEFAULT_ROLE_PERMISSIONS[userRole];

    if (userPerm) {
      // 用户特定权限覆盖角色权限
      return {
        menu: [...new Set([...rolePermissions.menu, ...userPerm.menu_permissions])],
        function: [...new Set([...rolePermissions.function, ...userPerm.function_permissions])],
        project: [...new Set([...rolePermissions.project, ...userPerm.project_permissions])],
        data: [...new Set([...rolePermissions.data, ...userPerm.data_permissions])]
      };
    }

    return rolePermissions;
  };

  // 检查权限
  const hasPermission = (permission: string, type: PermissionType = 'function'): PermissionCheck => {
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
  };

  // 检查菜单权限
  const hasMenuAccess = (menuKey: string): boolean => {
    return hasPermission(menuKey, 'menu').hasPermission;
  };

  // 检查功能权限
  const hasFunctionAccess = (functionKey: string): boolean => {
    return hasPermission(functionKey, 'function').hasPermission;
  };

  // 检查项目权限
  const hasProjectAccess = (projectKey: string): boolean => {
    return hasPermission(projectKey, 'project').hasPermission;
  };

  // 检查数据权限
  const hasDataAccess = (dataKey: string): boolean => {
    return hasPermission(dataKey, 'data').hasPermission;
  };

  // 获取用户可访问的项目列表
  const getAccessibleProjects = async () => {
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

      // 如果只能查看分配的项目，需要从用户项目关联表获取
      const { data: userProjects, error: userProjectsError } = await supabase
        .from('user_projects')
        .select('project_id, projects(id, name)')
        .eq('user_id', user?.id);

      if (userProjectsError) throw userProjectsError;

      return userProjects?.map(up => up.projects).filter(Boolean) || [];
    } catch (error) {
      console.error('获取可访问项目失败:', error);
      return [];
    }
  };

  // 设置当前项目
  const setCurrentProjectContext = (projectId: string | null) => {
    setCurrentProject(projectId);
  };

  // 刷新权限数据
  const refreshPermissions = () => {
    loadPermissions();
  };

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
