// 合同权限服务层
// 文件: src/services/contractPermissionService.ts

import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { 
  ContractPermission, 
  ContractOwnerPermission, 
  CategoryPermissionTemplate,
  ContractPermissionChange,
  ContractPermissionSyncStatus,
  ContractPermissionStats,
  CreateContractPermissionParams,
  UpdateContractPermissionParams
} from '@/types/permissions';

export class ContractPermissionService {
  // 获取用户有效权限
  static async getUserContractPermissions(
    userId: string, 
    contractId?: string
  ): Promise<ContractPermission[]> {
    const { data, error } = await supabase
      .rpc('get_user_contract_permissions', {
        p_user_id: userId,
        p_contract_id: contractId
      });

    if (error) {
      console.error('获取用户合同权限失败:', error);
      throw error;
    }

    return data || [];
  }

  // 检查用户是否有特定权限
  static async hasContractPermission(
    userId: string,
    contractId: string,
    permissionType: string
  ): Promise<boolean> {
    const { data, error } = await supabase
      .rpc('has_contract_permission', {
        p_user_id: userId,
        p_contract_id: contractId,
        p_permission_type: permissionType
      });

      if (error) {
      console.error('检查合同权限失败:', error);
      throw error;
      }

      return data || false;
  }

  // 获取合同的所有权限
  static async getContractPermissions(contractId: string): Promise<ContractPermission[]> {
      const { data, error } = await supabase
      .rpc('get_contract_permissions', {
        p_contract_id: contractId
      });

      if (error) {
      console.error('获取合同权限失败:', error);
      throw error;
      }

      return data || [];
  }

  // 获取合同所有者权限
  static async getContractOwnerPermissions(contractId: string): Promise<ContractOwnerPermission[]> {
      const { data, error } = await supabase
      .rpc('get_contract_owner_permissions', {
        p_contract_id: contractId
      });

      if (error) {
      console.error('获取合同所有者权限失败:', error);
      throw error;
      }

      return data || [];
  }

  // 获取合同分类权限模板
  static async getCategoryPermissionTemplates(category?: string): Promise<CategoryPermissionTemplate[]> {
      const { data, error } = await supabase
      .rpc('get_contract_category_permission_templates', {
        p_category: category
      });

      if (error) {
      console.error('获取分类权限模板失败:', error);
      throw error;
    }

    return data || [];
  }

  // 创建合同权限
  static async createContractPermission(params: CreateContractPermissionParams): Promise<string> {
      const { data, error } = await supabase
      .rpc('create_contract_permission', {
        p_contract_id: params.contract_id,
        p_user_id: params.user_id,
        p_role_id: params.role_id,
        p_department_id: params.department_id,
        p_permission_type: params.permission_type,
        p_expires_at: params.expires_at,
        p_description: params.description
      });

      if (error) {
      console.error('创建合同权限失败:', error);
      throw error;
      }

      return data;
  }

  // 更新合同权限
  static async updateContractPermission(params: UpdateContractPermissionParams): Promise<boolean> {
    const { data, error } = await supabase
      .rpc('update_contract_permission', {
        p_permission_id: params.permission_id,
        p_permission_type: params.permission_type,
        p_expires_at: params.expires_at,
        p_description: params.description,
        p_is_active: params.is_active
      });

      if (error) {
      console.error('更新合同权限失败:', error);
      throw error;
    }

    return data;
  }

  // 删除合同权限
  static async deleteContractPermission(permissionId: string): Promise<boolean> {
      const { data, error } = await supabase
      .rpc('delete_contract_permission', {
        p_permission_id: permissionId
      });

      if (error) {
      console.error('删除合同权限失败:', error);
      throw error;
    }

    return data;
  }

  // 设置合同所有者权限
  static async setContractOwnerPermission(
    contractId: string,
    ownerId: string,
    permissions: string[] = ['view', 'edit', 'delete', 'download', 'manage']
  ): Promise<string> {
    const { data, error } = await supabase
      .rpc('set_contract_owner_permission', {
        p_contract_id: contractId,
        p_owner_id: ownerId,
        p_permissions: permissions
      });

    if (error) {
      console.error('设置合同所有者权限失败:', error);
      throw error;
    }

    return data;
  }

  // 获取权限统计信息
  static async getContractPermissionStats(contractId?: string): Promise<ContractPermissionStats> {
      const { data, error } = await supabase
      .rpc('get_contract_permission_stats', {
        p_contract_id: contractId
      });

      if (error) {
      console.error('获取权限统计失败:', error);
      throw error;
    }

    return data?.[0] || {
      total_permissions: 0,
      active_permissions: 0,
      expired_permissions: 0,
      user_permissions: 0,
      role_permissions: 0,
      department_permissions: 0,
      owner_permissions: 0,
      by_permission_type: {},
      by_category: {}
    };
  }

  // 获取权限同步状态
  static async getContractPermissionSyncStatus(): Promise<ContractPermissionSyncStatus[]> {
      const { data, error } = await supabase
      .rpc('get_contract_permission_sync_status');

      if (error) {
      console.error('获取权限同步状态失败:', error);
      throw error;
      }

      return data || [];
  }

  // 刷新权限缓存
  static async refreshContractPermissionCache(): Promise<void> {
    const { error } = await supabase
      .rpc('refresh_contract_permission_cache');

      if (error) {
      console.error('刷新权限缓存失败:', error);
      throw error;
    }
  }

  // 订阅合同权限变更
  static subscribeToContractPermissionChanges(
    callback: (payload: ContractPermissionChange) => void
  ) {
    const channel = supabase
      .channel('contract_permissions_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'contract_permissions' 
        },
        (payload) => {
          callback({
            table: payload.table,
            operation: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            contract_id: payload.new?.contract_id || payload.old?.contract_id,
            user_id: payload.new?.user_id || payload.old?.user_id,
            role_id: payload.new?.role_id || payload.old?.role_id,
            department_id: payload.new?.department_id || payload.old?.department_id,
            permission_type: payload.new?.permission_type || payload.old?.permission_type,
            timestamp: new Date().toISOString()
          });
        }
      )
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'contract_owner_permissions' 
        },
        (payload) => {
          callback({
            table: payload.table,
            operation: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            contract_id: payload.new?.contract_id || payload.old?.contract_id,
            user_id: payload.new?.owner_id || payload.old?.owner_id,
            timestamp: new Date().toISOString()
          });
        }
      )
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'contract_category_permission_templates' 
        },
        (payload) => {
          callback({
            table: payload.table,
            operation: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            timestamp: new Date().toISOString()
          });
        }
      )
      .subscribe();

    return channel;
  }

  // 取消订阅
  static unsubscribeFromContractPermissionChanges(channel: any) {
    if (channel) {
      supabase.removeChannel(channel);
    }
  }

  // 批量操作权限
  static async batchUpdatePermissions(
    updates: Array<{
      id: string;
      is_active?: boolean;
      expires_at?: string;
    }>
  ): Promise<boolean[]> {
    const results: boolean[] = [];
    
    for (const update of updates) {
      try {
        const result = await this.updateContractPermission({
          permission_id: update.id,
          is_active: update.is_active,
          expires_at: update.expires_at
        });
        results.push(result);
      } catch (error) {
        console.error('批量更新权限失败:', error);
        results.push(false);
      }
    }
    
    return results;
  }

  // 批量删除权限
  static async batchDeletePermissions(permissionIds: string[]): Promise<boolean[]> {
    const results: boolean[] = [];
    
    for (const id of permissionIds) {
      try {
        const result = await this.deleteContractPermission(id);
        results.push(result);
      } catch (error) {
        console.error('批量删除权限失败:', error);
        results.push(false);
      }
    }
    
    return results;
  }

  // 检查权限过期
  static async checkExpiredPermissions(): Promise<ContractPermission[]> {
    const { data, error } = await supabase
      .from('contract_permissions')
      .select('*')
      .eq('is_active', true)
      .not('expires_at', 'is', null)
      .lt('expires_at', new Date().toISOString());

    if (error) {
      console.error('检查过期权限失败:', error);
      throw error;
    }

    return data || [];
  }

  // 自动过期权限
  static async autoExpirePermissions(): Promise<number> {
    const expiredPermissions = await this.checkExpiredPermissions();
    let expiredCount = 0;

    for (const permission of expiredPermissions) {
      try {
        await this.updateContractPermission({
          permission_id: permission.id,
          is_active: false
        });
        expiredCount++;
      } catch (error) {
        console.error('自动过期权限失败:', error);
      }
    }

    return expiredCount;
  }
}

export default ContractPermissionService;

// 同时提供命名导出
export { ContractPermissionService };