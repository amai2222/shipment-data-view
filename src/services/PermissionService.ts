// 权限管理服务层 - 统一数据操作

import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { 
  User, 
  Project, 
  RoleTemplate, 
  UserPermission, 
  AppRole, 
  SaveResult 
} from '@/types/permission';

export class PermissionService {
  // 获取所有用户
  static async getUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');

    if (error) throw new Error(`获取用户失败: ${error.message}`);
    return data || [];
  }

  // 获取所有项目
  static async getProjects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('name');

    if (error) throw new Error(`获取项目失败: ${error.message}`);
    return data || [];
  }

  // 获取所有角色模板
  static async getRoleTemplates(): Promise<Record<AppRole, RoleTemplate>> {
    const { data, error } = await supabase
      .from('role_permission_templates')
      .select('*')
      .order('role');

    if (error) throw new Error(`获取角色模板失败: ${error.message}`);
    
    const templates = data || [];
    const templateMap = {} as Record<AppRole, RoleTemplate>;
    
    templates.forEach(template => {
      templateMap[template.role] = template;
    });
    
    return templateMap;
  }

  // 获取所有用户权限
  static async getUserPermissions(): Promise<UserPermission[]> {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('*');

    if (error) throw new Error(`获取用户权限失败: ${error.message}`);
    return data || [];
  }

  // 保存角色模板
  static async saveRoleTemplate(template: Partial<RoleTemplate>): Promise<SaveResult> {
    try {
      const { data, error } = await supabase
        .from('role_permission_templates')
        .upsert(template, {
          onConflict: 'role'
        })
        .select()
        .single();

      if (error) {
        console.error('保存角色模板失败:', error);
        return {
          success: false,
          message: `保存失败: ${error.message}`,
          error: error.message
        };
      }

      return {
        success: true,
        message: '角色模板保存成功',
        data
      };
    } catch (error: any) {
      console.error('保存角色模板异常:', error);
      return {
        success: false,
        message: `保存异常: ${error.message}`,
        error: error.message
      };
    }
  }

  // 保存用户权限
  static async saveUserPermission(permission: Partial<UserPermission>): Promise<SaveResult> {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .upsert(permission, {
          onConflict: 'user_id,project_id'
        })
        .select()
        .single();

      if (error) {
        console.error('保存用户权限失败:', error);
        return {
          success: false,
          message: `保存失败: ${error.message}`,
          error: error.message
        };
      }

      return {
        success: true,
        message: '用户权限保存成功',
        data
      };
    } catch (error: any) {
      console.error('保存用户权限异常:', error);
      return {
        success: false,
        message: `保存异常: ${error.message}`,
        error: error.message
      };
    }
  }

  // 删除用户权限
  static async deleteUserPermission(userId: string, projectId?: string): Promise<SaveResult> {
    try {
      const query = supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId);

      if (projectId) {
        query.eq('project_id', projectId);
      } else {
        query.is('project_id', null);
      }

      const { error } = await query;

      if (error) {
        console.error('删除用户权限失败:', error);
        return {
          success: false,
          message: `删除失败: ${error.message}`,
          error: error.message
        };
      }

      return {
        success: true,
        message: '用户权限删除成功'
      };
    } catch (error: any) {
      console.error('删除用户权限异常:', error);
      return {
        success: false,
        message: `删除异常: ${error.message}`,
        error: error.message
      };
    }
  }

  // 批量更新用户角色
  static async batchUpdateUserRoles(userIds: string[], role: AppRole): Promise<SaveResult> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .in('id', userIds);

      if (error) {
        console.error('批量更新用户角色失败:', error);
        return {
          success: false,
          message: `更新失败: ${error.message}`,
          error: error.message
        };
      }

      return {
        success: true,
        message: `已为 ${userIds.length} 个用户更新角色`
      };
    } catch (error: any) {
      console.error('批量更新用户角色异常:', error);
      return {
        success: false,
        message: `更新异常: ${error.message}`,
        error: error.message
      };
    }
  }

  // 批量更新用户状态
  static async batchUpdateUserStatus(userIds: string[], isActive: boolean): Promise<SaveResult> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: isActive })
        .in('id', userIds);

      if (error) {
        console.error('批量更新用户状态失败:', error);
        return {
          success: false,
          message: `更新失败: ${error.message}`,
          error: error.message
        };
      }

      return {
        success: true,
        message: `已${isActive ? '启用' : '禁用'} ${userIds.length} 个用户`
      };
    } catch (error: any) {
      console.error('批量更新用户状态异常:', error);
      return {
        success: false,
        message: `更新异常: ${error.message}`,
        error: error.message
      };
    }
  }
}
