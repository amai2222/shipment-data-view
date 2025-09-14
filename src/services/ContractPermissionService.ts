import { supabase } from '@/integrations/supabase/client';

export interface ContractPermission {
  id: string;
  contract_id: string;
  user_id?: string;
  role_id?: string;
  department_id?: string;
  permission_type: 'view' | 'download' | 'edit' | 'delete' | 'manage' | 'sensitive' | 'approve' | 'archive' | 'audit';
  granted_by?: string;
  granted_at: string;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContractAccessLog {
  id: string;
  contract_id: string;
  user_id: string;
  action: string;
  ip_address?: string;
  user_agent?: string;
  accessed_at: string;
  details?: any;
}

export interface PermissionTemplate {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export class ContractPermissionService {
  /**
   * 检查用户是否有特定合同权限
   */
  static async hasPermission(
    userId: string,
    contractId: string,
    permissionType: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('check_contract_permission', {
        p_user_id: userId,
        p_contract_id: contractId,
        p_permission_type: permissionType
      });

      if (error) {
        console.error('权限检查失败:', error);
        return false;
      }

      return data || false;
    } catch (error) {
      console.error('权限检查异常:', error);
      return false;
    }
  }

  /**
   * 获取用户的所有合同权限
   */
  static async getUserContractPermissions(userId: string): Promise<ContractPermission[]> {
    try {
      const { data, error } = await supabase
        .from('contract_permissions')
        .select(`
          *,
          contracts!inner(contract_number, counterparty_company, our_company)
        `)
        .or(`user_id.eq.${userId},role_id.in.(select role from profiles where id = ${userId})`)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('获取用户权限失败:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('获取用户权限异常:', error);
      return [];
    }
  }

  /**
   * 获取合同的所有权限
   */
  static async getContractPermissions(contractId: string): Promise<ContractPermission[]> {
    try {
      const { data, error } = await supabase
        .from('contract_permissions')
        .select(`
          *,
          profiles!contract_permissions_user_id_fkey(full_name, email),
          granter:profiles!contract_permissions_granted_by_fkey(full_name)
        `)
        .eq('contract_id', contractId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('获取合同权限失败:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('获取合同权限异常:', error);
      return [];
    }
  }

  /**
   * 创建合同权限
   */
  static async createPermission(permission: Partial<ContractPermission>): Promise<ContractPermission | null> {
    try {
      const { data, error } = await supabase
        .from('contract_permissions')
        .insert({
          ...permission,
          granted_by: (await supabase.auth.getUser()).data.user?.id,
          granted_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('创建权限失败:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('创建权限异常:', error);
      return null;
    }
  }

  /**
   * 更新合同权限
   */
  static async updatePermission(
    permissionId: string,
    updates: Partial<ContractPermission>
  ): Promise<ContractPermission | null> {
    try {
      const { data, error } = await supabase
        .from('contract_permissions')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', permissionId)
        .select()
        .single();

      if (error) {
        console.error('更新权限失败:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('更新权限异常:', error);
      return null;
    }
  }

  /**
   * 删除合同权限
   */
  static async deletePermission(permissionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('contract_permissions')
        .delete()
        .eq('id', permissionId);

      if (error) {
        console.error('删除权限失败:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('删除权限异常:', error);
      return false;
    }
  }

  /**
   * 批量创建权限
   */
  static async createBulkPermissions(permissions: Partial<ContractPermission>[]): Promise<ContractPermission[]> {
    try {
      const grantedBy = (await supabase.auth.getUser()).data.user?.id;
      const permissionsWithMetadata = permissions.map(permission => ({
        ...permission,
        granted_by: grantedBy,
        granted_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('contract_permissions')
        .insert(permissionsWithMetadata)
        .select();

      if (error) {
        console.error('批量创建权限失败:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('批量创建权限异常:', error);
      return [];
    }
  }

  /**
   * 批量更新权限状态
   */
  static async updateBulkPermissionStatus(
    permissionIds: string[],
    isActive: boolean
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('contract_permissions')
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString()
        })
        .in('id', permissionIds);

      if (error) {
        console.error('批量更新权限状态失败:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('批量更新权限状态异常:', error);
      return false;
    }
  }

  /**
   * 记录合同访问日志
   */
  static async logAccess(
    contractId: string,
    userId: string,
    action: string,
    details?: any
  ): Promise<void> {
    try {
      await supabase.rpc('log_contract_access', {
        p_contract_id: contractId,
        p_user_id: userId,
        p_action: action,
        p_details: details
      });
    } catch (error) {
      console.error('记录访问日志失败:', error);
    }
  }

  /**
   * 获取合同访问历史
   */
  static async getContractAccessHistory(
    contractId: string,
    limit: number = 100
  ): Promise<ContractAccessLog[]> {
    try {
      const { data, error } = await supabase
        .from('contract_access_logs')
        .select(`
          *,
          profiles!inner(full_name, email)
        `)
        .eq('contract_id', contractId)
        .order('accessed_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('获取访问历史失败:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('获取访问历史异常:', error);
      return [];
    }
  }

  /**
   * 获取权限模板列表
   */
  static async getPermissionTemplates(): Promise<PermissionTemplate[]> {
    try {
      const { data, error } = await supabase
        .from('contract_permission_templates')
        .select('*')
        .order('name');

      if (error) {
        console.error('获取权限模板失败:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('获取权限模板异常:', error);
      return [];
    }
  }

  /**
   * 创建权限模板
   */
  static async createPermissionTemplate(template: Partial<PermissionTemplate>): Promise<PermissionTemplate | null> {
    try {
      const { data, error } = await supabase
        .from('contract_permission_templates')
        .insert(template)
        .select()
        .single();

      if (error) {
        console.error('创建权限模板失败:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('创建权限模板异常:', error);
      return null;
    }
  }

  /**
   * 获取部门列表
   */
  static async getDepartments(): Promise<Department[]> {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('获取部门列表失败:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('获取部门列表异常:', error);
      return [];
    }
  }

  /**
   * 获取权限统计信息
   */
  static async getPermissionStats(): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('contract_permission_stats')
        .select('*')
        .order('total_permissions', { ascending: false });

      if (error) {
        console.error('获取权限统计失败:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('获取权限统计异常:', error);
      return [];
    }
  }

  /**
   * 获取用户权限汇总
   */
  static async getUserPermissionSummary(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('user_contract_permissions_summary')
        .select('*')
        .order('total_permissions', { ascending: false });

      if (error) {
        console.error('获取用户权限汇总失败:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('获取用户权限汇总异常:', error);
      return [];
    }
  }

  /**
   * 检查权限是否过期
   */
  static isPermissionExpired(permission: ContractPermission): boolean {
    if (!permission.expires_at) return false;
    return new Date(permission.expires_at) < new Date();
  }

  /**
   * 获取权限类型显示信息
   */
  static getPermissionTypeInfo(type: string) {
    const permissionTypes = [
      { value: 'view', label: '查看', icon: 'Eye', color: 'bg-blue-100 text-blue-800' },
      { value: 'download', label: '下载', icon: 'Download', color: 'bg-green-100 text-green-800' },
      { value: 'edit', label: '编辑', icon: 'Edit', color: 'bg-yellow-100 text-yellow-800' },
      { value: 'delete', label: '删除', icon: 'Trash2', color: 'bg-red-100 text-red-800' },
      { value: 'manage', label: '管理', icon: 'Settings', color: 'bg-purple-100 text-purple-800' },
      { value: 'sensitive', label: '敏感信息', icon: 'Shield', color: 'bg-orange-100 text-orange-800' },
      { value: 'approve', label: '审批', icon: 'CheckCircle', color: 'bg-indigo-100 text-indigo-800' },
      { value: 'archive', label: '归档', icon: 'Building', color: 'bg-gray-100 text-gray-800' },
      { value: 'audit', label: '审计', icon: 'BarChart3', color: 'bg-pink-100 text-pink-800' }
    ];

    return permissionTypes.find(t => t.value === type) || permissionTypes[0];
  }

  /**
   * 获取目标显示名称
   */
  static getTargetDisplayName(permission: ContractPermission): string {
    if (permission.user_id) return '用户权限';
    if (permission.role_id) return '角色权限';
    if (permission.department_id) return '部门权限';
    return '未知';
  }

  /**
   * 获取目标类型
   */
  static getTargetType(permission: ContractPermission): string {
    if (permission.user_id) return '用户';
    if (permission.role_id) return '角色';
    if (permission.department_id) return '部门';
    return '未知';
  }
}

// 权限检查Hook
export function useContractPermission(contractId: string, permissionType: string) {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !contractId) {
      setHasPermission(false);
      setLoading(false);
      return;
    }

    const checkPermission = async () => {
      setLoading(true);
      const permission = await ContractPermissionService.hasPermission(
        user.id,
        contractId,
        permissionType
      );
      setHasPermission(permission);
      setLoading(false);
    };

    checkPermission();
  }, [user, contractId, permissionType]);

  return { hasPermission, loading };
}

// 权限管理Hook
export function useContractPermissionManager(contractId?: string) {
  const [permissions, setPermissions] = useState<ContractPermission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadPermissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = contractId 
        ? await ContractPermissionService.getContractPermissions(contractId)
        : await ContractPermissionService.getUserContractPermissions(user?.id || '');
      
      setPermissions(data);
    } catch (err) {
      setError('加载权限失败');
      console.error('加载权限失败:', err);
    } finally {
      setLoading(false);
    }
  }, [contractId, user?.id]);

  const createPermission = useCallback(async (permission: Partial<ContractPermission>) => {
    try {
      const newPermission = await ContractPermissionService.createPermission(permission);
      if (newPermission) {
        setPermissions(prev => [newPermission, ...prev]);
        return true;
      }
      return false;
    } catch (err) {
      console.error('创建权限失败:', err);
      return false;
    }
  }, []);

  const updatePermission = useCallback(async (
    permissionId: string,
    updates: Partial<ContractPermission>
  ) => {
    try {
      const updatedPermission = await ContractPermissionService.updatePermission(
        permissionId,
        updates
      );
      if (updatedPermission) {
        setPermissions(prev => 
          prev.map(p => p.id === permissionId ? updatedPermission : p)
        );
        return true;
      }
      return false;
    } catch (err) {
      console.error('更新权限失败:', err);
      return false;
    }
  }, []);

  const deletePermission = useCallback(async (permissionId: string) => {
    try {
      const success = await ContractPermissionService.deletePermission(permissionId);
      if (success) {
        setPermissions(prev => prev.filter(p => p.id !== permissionId));
        return true;
      }
      return false;
    } catch (err) {
      console.error('删除权限失败:', err);
      return false;
    }
  }, []);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  return {
    permissions,
    loading,
    error,
    loadPermissions,
    createPermission,
    updatePermission,
    deletePermission
  };
}
