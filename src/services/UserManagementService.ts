// 用户管理服务层

import { supabase } from '@/integrations/supabase/client';
import { 
  User, 
  UserCreateData, 
  UserUpdateData, 
  UserBatchUpdateData, 
  UserOperationResult
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
      // 如果需要更新密码，调用密码更新 Edge Function
      if (userData.password) {
        const { data: passwordData, error: passwordError } = await supabase.functions.invoke('update-user-password', {
          body: {
            userId: userData.id,
            newPassword: userData.password
          }
        });

        if (passwordError || !passwordData?.success) {
          console.error('更新密码失败:', passwordError || passwordData?.error);
          return {
            success: false,
            message: passwordData?.error || passwordError?.message || '更新密码失败',
            error: passwordData?.error || passwordError?.message
          };
        }
      }

      // 调用用户信息更新 Edge Function
      const updatePayload: any = {
        userId: userData.id
      };
      
      if (userData.email !== undefined) updatePayload.email = userData.email;
      if (userData.full_name !== undefined) updatePayload.full_name = userData.full_name;
      if (userData.role !== undefined) updatePayload.role = userData.role;
      if (userData.is_active !== undefined) updatePayload.is_active = userData.is_active;
      if (userData.phone !== undefined) updatePayload.phone = userData.phone;
      if (userData.work_wechat_userid !== undefined) updatePayload.work_wechat_userid = userData.work_wechat_userid;

      const { data, error } = await supabase.functions.invoke('update-user', {
        body: updatePayload
      });

      if (error || !data?.success) {
        console.error('更新用户信息失败:', error || data?.error);
        return {
          success: false,
          message: data?.error || error?.message || '更新用户信息失败',
          error: data?.error || error?.message
        };
      }

      return {
        success: true,
        message: data.message || '用户信息更新成功',
        data: data.data
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
  static async deleteUser(userId: string, hardDelete: boolean = false): Promise<UserOperationResult> {
    try {
      // 调用删除用户 Edge Function
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: {
          userId,
          hardDelete
        }
      });

      if (error || !data?.success) {
        console.error('删除用户失败:', error || data?.error);
        return {
          success: false,
          message: data?.error || error?.message || '删除用户失败',
          error: data?.error || error?.message
        };
      }

      return {
        success: true,
        message: data.message || '用户删除成功',
        data: data.data
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
  static async batchDeleteUsers(userIds: string[], hardDelete: boolean = false): Promise<UserOperationResult> {
    try {
      // 批量删除用户（调用 Edge Function）
      const results = [];
      for (const userId of userIds) {
        const { data, error } = await supabase.functions.invoke('delete-user', {
          body: {
            userId,
            hardDelete
          }
        });
        
        if (error || !data?.success) {
          console.error(`删除用户 ${userId} 失败:`, error || data?.error);
          results.push({ userId, success: false, error: error?.message || data?.error });
        } else {
          results.push({ userId, success: true });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      return {
        success: failureCount === 0,
        message: failureCount === 0 
          ? `已${hardDelete ? '永久删除' : '停用'} ${successCount} 个用户`
          : `${successCount} 个用户${hardDelete ? '删除' : '停用'}成功，${failureCount} 个失败`,
        data: { results, successCount, failureCount }
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
