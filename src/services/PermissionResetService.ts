// 重置权限服务 - 从数据库读取角色模板权限，不使用硬编码
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { UserRole } from '@/types/permission';

export class PermissionResetService {
  /**
   * 重置用户权限为角色模板权限（从数据库读取）
   * 不再使用硬编码权限，而是从数据库读取最新的角色模板权限
   */
  static async resetUserToRoleDefault(userId: string): Promise<void> {
    try {
      // 1. 获取用户角色
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      if (!userProfile) throw new Error('用户不存在');

      const userRole = userProfile.role as UserRole;

      // 2. 从数据库获取角色模板的最新权限
      const { data: roleTemplate, error: templateError } = await supabase
        .from('role_permission_templates')
        .select('menu_permissions, function_permissions, project_permissions, data_permissions')
        .eq('role', userRole)
        .single();

      if (templateError) {
        console.warn(`角色 ${userRole} 的模板不存在，跳过权限重置`);
        return;
      }

      if (!roleTemplate) {
        throw new Error(`角色 ${userRole} 的权限模板不存在`);
      }

      // 3. 删除用户的自定义权限
      const { error: deleteError } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // 4. 将用户权限重置为角色模板权限（从数据库读取）
      const { error: upsertError } = await supabase
        .from('user_permissions')
        .upsert({
          user_id: userId,
          project_id: null,
          menu_permissions: roleTemplate.menu_permissions || [],
          function_permissions: roleTemplate.function_permissions || [],
          project_permissions: roleTemplate.project_permissions || [],
          data_permissions: roleTemplate.data_permissions || [],
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (upsertError) throw upsertError;

      console.log(`用户 ${userId} 的权限已重置为角色 ${userRole} 的模板权限（从数据库读取）`);
    } catch (error) {
      console.error('重置用户权限失败:', error);
      throw error;
    }
  }

  /**
   * 批量重置多个用户权限
   */
  static async resetMultipleUsersToRoleDefault(userIds: string[]): Promise<void> {
    try {
      const resetPromises = userIds.map(userId => 
        this.resetUserToRoleDefault(userId)
      );
      
      await Promise.all(resetPromises);
      console.log(`已重置 ${userIds.length} 个用户的权限`);
    } catch (error) {
      console.error('批量重置用户权限失败:', error);
      throw error;
    }
  }

  /**
   * 重置角色模板为系统默认权限
   * 注意：这个方法仍然使用硬编码，但仅用于系统初始化或紧急恢复
   * 正常情况下应该通过角色模板管理界面修改权限
   */
  static async resetRoleTemplateToSystemDefault(role: UserRole): Promise<void> {
    try {
      // 导入硬编码权限（仅用于系统初始化）
      const { DEFAULT_ROLE_PERMISSIONS } = await import('@/config/permissions');
      
      const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[role];
      if (!defaultPermissions) {
        throw new Error(`角色 ${role} 的默认权限不存在`);
      }

      const { error } = await supabase
        .from('role_permission_templates')
        .upsert({
          role,
          name: role,
          menu_permissions: defaultPermissions.menu_permissions,
          function_permissions: defaultPermissions.function_permissions,
          project_permissions: defaultPermissions.project_permissions,
          data_permissions: defaultPermissions.data_permissions,
          updated_at: new Date().toISOString()
        }, { onConflict: 'role' });

      if (error) throw error;

      console.log(`角色模板 ${role} 已重置为系统默认权限（仅用于系统初始化）`);
    } catch (error) {
      console.error('重置角色模板失败:', error);
      throw error;
    }
  }
}
