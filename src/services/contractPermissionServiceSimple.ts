// 简化的合同权限服务层（用于测试导入）
// 文件: src/services/contractPermissionServiceSimple.ts

import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';

export class ContractPermissionServiceSimple {
  // 获取用户有效权限
  static async getUserContractPermissions(
    userId: string, 
    contractId?: string
  ) {
    try {
      const { data, error } = await supabase
        .from('contract_permissions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        console.error('获取用户合同权限失败:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('获取用户合同权限失败:', error);
      return [];
    }
  }

  // 检查用户是否有特定权限
  static async hasContractPermission(
    userId: string,
    contractId: string,
    permissionType: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('contract_permissions')
        .select('id')
        .eq('user_id', userId)
        .eq('contract_id', contractId)
        .eq('permission_type', permissionType)
        .eq('is_active', true)
        .limit(1);

      if (error) {
        console.error('检查合同权限失败:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('检查合同权限失败:', error);
      return false;
    }
  }

  // 创建合同权限
  static async createContractPermission(params: {
    contract_id: string;
    user_id?: string;
    role_id?: string;
    department_id?: string;
    permission_type: string;
    expires_at?: string;
    description?: string;
  }): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('contract_permissions')
        .insert({
          ...params,
          granted_by: (await supabase.auth.getUser()).data.user?.id,
          expires_at: params.expires_at || null
        })
        .select('id')
        .single();

      if (error) {
        console.error('创建合同权限失败:', error);
        throw error;
      }

      return data.id;
    } catch (error) {
      console.error('创建合同权限失败:', error);
      throw error;
    }
  }

  // 更新合同权限
  static async updateContractPermission(
    permissionId: string,
    updates: {
      permission_type?: string;
      expires_at?: string;
      description?: string;
      is_active?: boolean;
    }
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('contract_permissions')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', permissionId);

      if (error) {
        console.error('更新合同权限失败:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('更新合同权限失败:', error);
      return false;
    }
  }

  // 删除合同权限
  static async deleteContractPermission(permissionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('contract_permissions')
        .delete()
        .eq('id', permissionId);

      if (error) {
        console.error('删除合同权限失败:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('删除合同权限失败:', error);
      return false;
    }
  }
}

export default ContractPermissionServiceSimple;
