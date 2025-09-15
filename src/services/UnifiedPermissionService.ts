// 统一的权限计算服务
// 文件: src/services/UnifiedPermissionService.ts

import { supabase } from '@/integrations/supabase/client';

export interface UserPermissionData {
  user_id: string;
  menu_permissions: string[];
  function_permissions: string[];
  project_permissions: string[];
  data_permissions: string[];
  source: 'user' | 'role' | 'default';
}

export interface RoleTemplateData {
  role: string;
  menu_permissions: string[];
  function_permissions: string[];
  project_permissions: string[];
  data_permissions: string[];
}

export class UnifiedPermissionService {
  /**
   * 获取用户的有效权限（统一计算逻辑）
   */
  static async getUserEffectivePermissions(userId: string): Promise<UserPermissionData> {
    try {
      // 1. 获取用户信息
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (userError) throw userError;
      if (!user) throw new Error('用户不存在');

      // 2. 获取用户自定义权限
      const { data: userPermissions, error: userPermError } = await supabase
        .from('user_permissions')
        .select('menu_permissions, function_permissions, project_permissions, data_permissions')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (userPermError && userPermError.code !== 'PGRST116') {
        throw userPermError;
      }

      // 3. 获取角色模板权限
      const { data: roleTemplate, error: roleError } = await supabase
        .from('role_permission_templates')
        .select('menu_permissions, function_permissions, project_permissions, data_permissions')
        .eq('role', user.role)
        .single();

      if (roleError) throw roleError;

      // 4. 计算有效权限（用户权限优先，否则使用角色模板）
      if (userPermissions) {
        return {
          user_id: userId,
          menu_permissions: userPermissions.menu_permissions || [],
          function_permissions: userPermissions.function_permissions || [],
          project_permissions: userPermissions.project_permissions || [],
          data_permissions: userPermissions.data_permissions || [],
          source: 'user'
        };
      } else if (roleTemplate) {
        return {
          user_id: userId,
          menu_permissions: roleTemplate.menu_permissions || [],
          function_permissions: roleTemplate.function_permissions || [],
          project_permissions: roleTemplate.project_permissions || [],
          data_permissions: roleTemplate.data_permissions || [],
          source: 'role'
        };
      } else {
        return {
          user_id: userId,
          menu_permissions: [],
          function_permissions: [],
          project_permissions: [],
          data_permissions: [],
          source: 'default'
        };
      }
    } catch (error) {
      console.error('获取用户有效权限失败:', error);
      throw error;
    }
  }

  /**
   * 批量获取用户有效权限
   */
  static async getBatchUserEffectivePermissions(userIds: string[]): Promise<Map<string, UserPermissionData>> {
    if (userIds.length === 0) return new Map();

    try {
      const result = new Map<string, UserPermissionData>();

      // 并行获取所有用户的权限
      const promises = userIds.map(userId => this.getUserEffectivePermissions(userId));
      const permissions = await Promise.all(promises);

      permissions.forEach(permission => {
        result.set(permission.user_id, permission);
      });

      return result;
    } catch (error) {
      console.error('批量获取用户有效权限失败:', error);
      return new Map();
    }
  }

  /**
   * 计算权限总数
   */
  static calculatePermissionTotal(permissions: UserPermissionData): number {
    return (
      permissions.menu_permissions.length +
      permissions.function_permissions.length +
      permissions.project_permissions.length +
      permissions.data_permissions.length
    );
  }

  /**
   * 获取权限统计信息
   */
  static getPermissionStats(permissions: UserPermissionData): {
    total: number;
    menu: number;
    function: number;
    project: number;
    data: number;
    source: string;
  } {
    return {
      total: this.calculatePermissionTotal(permissions),
      menu: permissions.menu_permissions.length,
      function: permissions.function_permissions.length,
      project: permissions.project_permissions.length,
      data: permissions.data_permissions.length,
      source: permissions.source
    };
  }

  /**
   * 获取所有角色模板
   */
  static async getAllRoleTemplates(): Promise<Map<string, RoleTemplateData>> {
    try {
      const { data, error } = await supabase
        .from('role_permission_templates')
        .select('role, menu_permissions, function_permissions, project_permissions, data_permissions');

      if (error) throw error;

      const templateMap = new Map<string, RoleTemplateData>();
      data?.forEach(template => {
        templateMap.set(template.role, {
          role: template.role,
          menu_permissions: template.menu_permissions || [],
          function_permissions: template.function_permissions || [],
          project_permissions: template.project_permissions || [],
          data_permissions: template.data_permissions || []
        });
      });

      return templateMap;
    } catch (error) {
      console.error('获取角色模板失败:', error);
      return new Map();
    }
  }
}
