// 用户管理服务层

import { supabase } from '@/integrations/supabase/client';
import { 
  User, 
  UserCreateData, 
  UserUpdateData, 
  UserBatchUpdateData, 
  UserOperationResult,
  AppRole 
} from '@/types/userManagement';

export class UserManagementService {
  // 获取所有用户
  static async getUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');

    if (error) throw new Error(`获取用户失败: ${error.message}`);
    return data || [];
  }

  // 创建用户
  static async createUser(userData: UserCreateData): Promise<UserOperationResult> {
    try {
      // 首先在 auth.users 中创建用户
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password || 'defaultPassword123!',
        email_confirm: true,
        user_metadata: {
          full_name: userData.full_name,
          role: userData.role
        }
      });

      if (authError) {
        console.error('创建认证用户失败:', authError);
        return {
          success: false,
          message: `创建用户失败: ${authError.message}`,
          error: authError.message
        };
      }

      // 然后在 profiles 表中创建用户记录
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: userData.email,
          full_name: userData.full_name,
          role: userData.role,
          phone: userData.phone,
          work_wechat_userid: userData.work_wechat_userid,
          is_active: true
        })
        .select()
        .single();

      if (profileError) {
        console.error('创建用户档案失败:', profileError);
        // 如果档案创建失败，删除认证用户
        await supabase.auth.admin.deleteUser(authData.user.id);
        return {
          success: false,
          message: `创建用户档案失败: ${profileError.message}`,
          error: profileError.message
        };
      }

      return {
        success: true,
        message: '用户创建成功',
        data: profileData
      };
    } catch (error: any) {
      console.error('创建用户异常:', error);
      return {
        success: false,
        message: `创建用户异常: ${error.message}`,
        error: error.message
      };
    }
  }

  // 更新用户信息
  static async updateUser(userData: UserUpdateData): Promise<UserOperationResult> {
    try {
      const updateData: any = {};
      
      if (userData.full_name !== undefined) updateData.full_name = userData.full_name;
      if (userData.role !== undefined) updateData.role = userData.role;
      if (userData.is_active !== undefined) updateData.is_active = userData.is_active;
      if (userData.phone !== undefined) updateData.phone = userData.phone;
      if (userData.work_wechat_userid !== undefined) updateData.work_wechat_userid = userData.work_wechat_userid;

      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userData.id)
        .select()
        .single();

      if (error) {
        console.error('更新用户失败:', error);
        return {
          success: false,
          message: `更新用户失败: ${error.message}`,
          error: error.message
        };
      }

      // 如果更新了密码
      if (userData.password) {
        const { error: passwordError } = await supabase.auth.admin.updateUserById(
          userData.id,
          { password: userData.password }
        );

        if (passwordError) {
          console.error('更新密码失败:', passwordError);
          return {
            success: false,
            message: `更新密码失败: ${passwordError.message}`,
            error: passwordError.message
          };
        }
      }

      return {
        success: true,
        message: '用户信息更新成功',
        data
      };
    } catch (error: any) {
      console.error('更新用户异常:', error);
      return {
        success: false,
        message: `更新用户异常: ${error.message}`,
        error: error.message
      };
    }
  }

  // 删除用户
  static async deleteUser(userId: string): Promise<UserOperationResult> {
    try {
      // 先删除认证用户
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      
      if (authError) {
        console.error('删除认证用户失败:', authError);
        return {
          success: false,
          message: `删除用户失败: ${authError.message}`,
          error: authError.message
        };
      }

      return {
        success: true,
        message: '用户删除成功'
      };
    } catch (error: any) {
      console.error('删除用户异常:', error);
      return {
        success: false,
        message: `删除用户异常: ${error.message}`,
        error: error.message
      };
    }
  }

  // 批量更新用户角色
  static async batchUpdateUserRoles(userIds: string[], role: AppRole): Promise<UserOperationResult> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .in('id', userIds);

      if (error) {
        console.error('批量更新用户角色失败:', error);
        return {
          success: false,
          message: `批量更新用户角色失败: ${error.message}`,
          error: error.message
        };
      }

      return {
        success: true,
        message: `已为 ${userIds.length} 个用户更新角色为 ${role}`
      };
    } catch (error: any) {
      console.error('批量更新用户角色异常:', error);
      return {
        success: false,
        message: `批量更新用户角色异常: ${error.message}`,
        error: error.message
      };
    }
  }

  // 批量更新用户状态
  static async batchUpdateUserStatus(userIds: string[], isActive: boolean): Promise<UserOperationResult> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: isActive })
        .in('id', userIds);

      if (error) {
        console.error('批量更新用户状态失败:', error);
        return {
          success: false,
          message: `批量更新用户状态失败: ${error.message}`,
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
        message: `批量更新用户状态异常: ${error.message}`,
        error: error.message
      };
    }
  }

  // 批量删除用户
  static async batchDeleteUsers(userIds: string[]): Promise<UserOperationResult> {
    try {
      // 批量删除认证用户
      for (const userId of userIds) {
        const { error } = await supabase.auth.admin.deleteUser(userId);
        if (error) {
          console.error(`删除用户 ${userId} 失败:`, error);
        }
      }

      return {
        success: true,
        message: `已删除 ${userIds.length} 个用户`
      };
    } catch (error: any) {
      console.error('批量删除用户异常:', error);
      return {
        success: false,
        message: `批量删除用户异常: ${error.message}`,
        error: error.message
      };
    }
  }
}
