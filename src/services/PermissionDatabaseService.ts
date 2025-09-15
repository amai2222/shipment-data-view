// 数据库权限服务
// 文件: src/services/PermissionDatabaseService.ts

import { supabase } from '@/integrations/supabase/client';

export interface DatabasePermission {
  id: string;
  user_id: string;
  menu_permissions: string[];
  function_permissions: string[];
  project_permissions: string[];
  data_permissions: string[];
  inherit_role: boolean;
  custom_settings: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface RoleTemplate {
  id: string;
  role: string;
  menu_permissions: string[];
  function_permissions: string[];
  project_permissions: string[];
  data_permissions: string[];
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export class PermissionDatabaseService {
  // 获取用户权限
  static async getUserPermissions(userId: string): Promise<DatabasePermission | null> {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('获取用户权限失败:', error);
      throw error;
    }

    return data;
  }

  // 获取角色模板
  static async getRoleTemplate(role: string): Promise<RoleTemplate | null> {
    const { data, error } = await supabase
      .from('role_permission_templates')
      .select('*')
      .eq('role', role)
      .maybeSingle();

    if (error) {
      console.error('获取角色模板失败:', error);
      throw error;
    }

    return data;
  }

  // 获取所有角色模板
  static async getAllRoleTemplates(): Promise<RoleTemplate[]> {
    const { data, error } = await supabase
      .from('role_permission_templates')
      .select('*')
      .order('role');

    if (error) {
      console.error('获取角色模板失败:', error);
      throw error;
    }

    return data || [];
  }

  // 保存用户权限
  static async saveUserPermissions(
    userId: string,
    permissions: {
      menu_permissions: string[];
      function_permissions: string[];
      project_permissions: string[];
      data_permissions: string[];
    },
    projectId?: string,
    createdBy?: string
  ): Promise<DatabasePermission> {
    const { data, error } = await supabase
      .from('user_permissions')
      .upsert({
        user_id: userId,
        project_id: projectId || null,
        ...permissions,
        inherit_role: false,
        custom_settings: {},
        updated_at: new Date().toISOString(),
        created_by: createdBy
      }, {
        onConflict: 'user_id,project_id'
      })
      .select()
      .single();

    if (error) {
      console.error('保存用户权限失败:', error);
      throw error;
    }

    return data;
  }

  // 删除用户权限（恢复为角色默认权限）
  static async deleteUserPermissions(userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_permissions')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('删除用户权限失败:', error);
      throw error;
    }
  }

  // 获取用户有效权限（用户权限优先，否则使用角色模板）
  static async getUserEffectivePermissions(userId: string, userRole: string): Promise<{
    menu_permissions: string[];
    function_permissions: string[];
    project_permissions: string[];
    data_permissions: string[];
    source: 'user' | 'role' | 'default';
  }> {
    try {
      // 首先尝试获取用户特定权限
      const userPermissions = await this.getUserPermissions(userId);
      if (userPermissions) {
        return {
          menu_permissions: userPermissions.menu_permissions || [],
          function_permissions: userPermissions.function_permissions || [],
          project_permissions: userPermissions.project_permissions || [],
          data_permissions: userPermissions.data_permissions || [],
          source: 'user'
        };
      }

      // 如果没有用户特定权限，使用角色模板
      const roleTemplate = await this.getRoleTemplate(userRole);
      if (roleTemplate) {
        return {
          menu_permissions: roleTemplate.menu_permissions || [],
          function_permissions: roleTemplate.function_permissions || [],
          project_permissions: roleTemplate.project_permissions || [],
          data_permissions: roleTemplate.data_permissions || [],
          source: 'role'
        };
      }

      // 如果都没有，返回默认权限
      return {
        menu_permissions: [],
        function_permissions: [],
        project_permissions: [],
        data_permissions: [],
        source: 'default'
      };

    } catch (error) {
      console.error('获取用户有效权限失败:', error);
      // 返回默认权限
      return {
        menu_permissions: [],
        function_permissions: [],
        project_permissions: [],
        data_permissions: [],
        source: 'default'
      };
    }
  }

  // 批量获取用户权限
  static async getBatchUserPermissions(userIds: string[]): Promise<Record<string, DatabasePermission>> {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('*')
      .in('user_id', userIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('批量获取用户权限失败:', error);
      throw error;
    }

    // 转换为以用户ID为键的对象
    const permissionsMap: Record<string, DatabasePermission> = {};
    data?.forEach(permission => {
      permissionsMap[permission.user_id] = permission;
    });

    return permissionsMap;
  }

  // 创建或更新角色模板
  static async saveRoleTemplate(
    role: string,
    permissions: {
      menu_permissions: string[];
      function_permissions: string[];
      project_permissions: string[];
      data_permissions: string[];
    },
    description?: string
  ): Promise<RoleTemplate> {
    const { data, error } = await supabase
      .from('role_permission_templates')
      .upsert({
        role,
        ...permissions,
        description,
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'role'
      })
      .select()
      .single();

    if (error) {
      console.error('保存角色模板失败:', error);
      throw error;
    }

    return data;
  }

  // 获取权限统计信息
  static async getPermissionStats(): Promise<{
    total_users: number;
    users_with_custom_permissions: number;
    users_with_role_permissions: number;
    role_distribution: Record<string, number>;
  }> {
    const [usersResult, permissionsResult, rolesResult] = await Promise.all([
      supabase.from('profiles').select('id, role'),
      supabase.from('user_permissions').select('user_id'),
      supabase.from('profiles').select('role')
    ]);

    const totalUsers = usersResult.data?.length || 0;
    const usersWithCustomPermissions = permissionsResult.data?.length || 0;
    const usersWithRolePermissions = totalUsers - usersWithCustomPermissions;

    // 统计角色分布
    const roleDistribution: Record<string, number> = {};
    rolesResult.data?.forEach(user => {
      roleDistribution[user.role] = (roleDistribution[user.role] || 0) + 1;
    });

    return {
      total_users: totalUsers,
      users_with_custom_permissions: usersWithCustomPermissions,
      users_with_role_permissions: usersWithRolePermissions,
      role_distribution: roleDistribution
    };
  }
}

export default PermissionDatabaseService;
