// 批量查询服务 - 优化数据库请求
// 文件: src/services/BatchQueryService.ts

import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';

export interface BatchUserPermissions {
  user_id: string;
  menu_permissions: string[];
  function_permissions: string[];
  project_permissions: string[];
  data_permissions: string[];
  created_at: string;
}

export interface BatchUserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  work_wechat_userid: string | null;
  work_wechat_name: string | null;
  phone: string | null;
}

export class BatchQueryService {
  // 批量获取用户权限
  static async getBatchUserPermissions(userIds: string[]): Promise<Map<string, BatchUserPermissions>> {
    if (userIds.length === 0) return new Map();

    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('user_id, menu_permissions, function_permissions, project_permissions, data_permissions, created_at')
        .in('user_id', userIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('批量获取用户权限失败:', error);
        throw error;
      }

      // 去重并返回最新记录
      const latestPermissions = new Map<string, BatchUserPermissions>();
      data?.forEach(perm => {
        if (!latestPermissions.has(perm.user_id)) {
          latestPermissions.set(perm.user_id, perm);
        }
      });

      return latestPermissions;
    } catch (error) {
      console.error('批量查询用户权限失败:', error);
      return new Map();
    }
  }

  // 批量获取用户信息
  static async getBatchUserProfiles(userIds: string[]): Promise<Map<string, BatchUserProfile>> {
    if (userIds.length === 0) return new Map();

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, is_active, work_wechat_userid, work_wechat_name, phone')
        .in('id', userIds);

      if (error) {
        console.error('批量获取用户信息失败:', error);
        throw error;
      }

      const userMap = new Map<string, BatchUserProfile>();
      data?.forEach(user => {
        userMap.set(user.id, user);
      });

      return userMap;
    } catch (error) {
      console.error('批量查询用户信息失败:', error);
      return new Map();
    }
  }

  // 批量获取角色模板
  static async getBatchRoleTemplates(roles: string[]): Promise<Map<string, any>> {
    if (roles.length === 0) return new Map();

    try {
      const { data, error } = await supabase
        .from('role_permission_templates')
        .select('role, menu_permissions, function_permissions, project_permissions, data_permissions')
        .in('role', roles);

      if (error) {
        console.error('批量获取角色模板失败:', error);
        throw error;
      }

      const templateMap = new Map();
      data?.forEach(template => {
        templateMap.set(template.role, template);
      });

      return templateMap;
    } catch (error) {
      console.error('批量查询角色模板失败:', error);
      return new Map();
    }
  }

  // 批量获取用户有效权限（优化版本 - 使用 RPC 函数）
  static async getBatchUserEffectivePermissions(
    userIds: string[]
  ): Promise<Map<string, {
    menu_permissions: string[];
    function_permissions: string[];
    project_permissions: string[];
    data_permissions: string[];
    source: 'user' | 'role' | 'default';
  }>> {
    if (userIds.length === 0) return new Map();

    try {
      // ✅ 优化：使用 RPC 函数一次性查询所有用户权限
      const { data, error } = await supabase.rpc('get_batch_user_effective_permissions_1121', {
        p_user_ids: userIds
      });

      if (error) {
        console.error('RPC 批量查询用户权限失败:', error);
        throw error;
      }

      const result = new Map();
      
      // 将返回的 JSONB 数组转换为 Map
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          result.set(item.user_id, {
            menu_permissions: item.menu_permissions || [],
            function_permissions: item.function_permissions || [],
            project_permissions: item.project_permissions || [],
            data_permissions: item.data_permissions || [],
            source: item.source || 'default'
          });
        });
      }

      return result;
    } catch (error) {
      console.error('批量获取用户有效权限失败:', error);
      
      // ⚠️ 降级方案：如果 RPC 函数不可用，使用旧的实现
      console.warn('降级到旧的批量查询方法...');
      try {
        const [userProfiles, userPermissions] = await Promise.all([
          this.getBatchUserProfiles(userIds),
          this.getBatchUserPermissions(userIds)
        ]);

        const roles = Array.from(userProfiles.values()).map(user => user.role);
        const roleTemplates = await this.getBatchRoleTemplates(roles);

        const result = new Map();

        for (const userId of userIds) {
          const user = userProfiles.get(userId);
          if (!user) continue;

          const userPermission = userPermissions.get(userId);
          const roleTemplate = roleTemplates.get(user.role);

          if (userPermission) {
            result.set(userId, {
              menu_permissions: userPermission.menu_permissions || [],
              function_permissions: userPermission.function_permissions || [],
              project_permissions: userPermission.project_permissions || [],
              data_permissions: userPermission.data_permissions || [],
              source: 'user' as const
            });
          } else if (roleTemplate) {
            result.set(userId, {
              menu_permissions: roleTemplate.menu_permissions || [],
              function_permissions: roleTemplate.function_permissions || [],
              project_permissions: roleTemplate.project_permissions || [],
              data_permissions: roleTemplate.data_permissions || [],
              source: 'role' as const
            });
          } else {
            result.set(userId, {
              menu_permissions: [],
              function_permissions: [],
              project_permissions: [],
              data_permissions: [],
              source: 'default' as const
            });
          }
        }

        return result;
      } catch (fallbackError) {
        console.error('降级查询也失败:', fallbackError);
        return new Map();
      }
    }
  }
}
