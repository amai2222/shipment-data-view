// 重置权限服务 - 唯一可以使用硬编码权限的地方
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_ROLE_PERMISSIONS } from '@/config/permissions';
import { UserRole } from '@/types/permissions';

export class PermissionResetService {
  /**
   * 重置用户权限为角色默认权限
   * 这是唯一可以使用硬编码权限的地方
   */
  static async resetUserToRoleDefault(userId: string): Promise<void> {
    try {
      // 1. 获取用户角色
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      if (!userProfile) throw new Error('用户不存在');

      const userRole = userProfile.role as UserRole;

      // 2. 获取硬编码的默认权限（这是唯一可以使用的地方）
      const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[userRole];
      if (!defaultPermissions) {
        throw new Error(`角色 ${userRole} 的默认权限不存在`);
      }

      // 3. 删除用户的自定义权限
      const { error: deleteError } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // 4. 可选：将用户权限重置为硬编码的默认权限（如果需要强制设置）
      // 注意：这里可以选择是否要强制设置，或者让用户自然使用角色模板权限
      const { error: upsertError } = await supabase
        .from('user_permissions')
        .upsert({
          user_id: userId,
          project_id: null,
          menu_permissions: defaultPermissions.menu_permissions,
          function_permissions: defaultPermissions.function_permissions,
          project_permissions: defaultPermissions.project_permissions,
          data_permissions: defaultPermissions.data_permissions,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (upsertError) throw upsertError;

      console.log(`用户 ${userId} 的权限已重置为角色 ${userRole} 的默认权限`);
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
   * 重置角色模板为硬编码默认权限
   * 用于管理员恢复角色模板到初始状态
   */
  static async resetRoleTemplateToDefault(role: UserRole): Promise<void> {
    try {
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

      console.log(`角色模板 ${role} 已重置为默认权限`);
    } catch (error) {
      console.error('重置角色模板失败:', error);
      throw error;
    }
  }
}
