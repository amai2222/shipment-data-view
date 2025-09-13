import { useState, useEffect, useCallback } from 'react';

export interface AuditLogFilters {
  startDate?: string;
  endDate?: string;
  action?: string;
  userId?: string;
  permissionType?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  permission_type: string;
  permission_key: string;
  user_id: string;
  target_user_id?: string;
  target_project_id?: string;
  old_value?: any;
  new_value?: any;
  reason?: string;
  created_at: string;
  created_by: string;
  user_name?: string;
  user_email?: string;
  target_user_name?: string;
  target_user_email?: string;
  created_by_name?: string;
  created_by_email?: string;
}

export function useAuditLogs() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadAuditLogs = async (filters?: {
    startDate?: string;
    endDate?: string;
    action?: string;
    userId?: string;
    permissionType?: string;
  }) => {
    setLoading(true);
    setError(null);
    
    try {
      // 简化的模拟审计日志数据
      const mockAuditLogs: AuditLog[] = [
        {
          id: '1',
          action: 'grant_permission',
          permission_type: 'menu',
          permission_key: 'business.entry',
          user_id: 'user1',
          created_at: new Date().toISOString(),
          created_by: 'admin',
          user_name: '示例用户',
          user_email: 'user@example.com',
          created_by_name: '管理员',
          created_by_email: 'admin@example.com'
        }
      ];

      setAuditLogs(mockAuditLogs);
    } catch (err) {
      console.error('Error loading audit logs:', err);
      setError('加载审计日志失败');
    } finally {
      setLoading(false);
    }
  };

  const createAuditLog = async (logData: Omit<AuditLog, 'id' | 'created_at' | 'created_by'>) => {
    try {
      const newLog: AuditLog = {
        ...logData,
        id: Date.now().toString(),
        created_at: new Date().toISOString(),
        created_by: 'current_user'
      };
      
      setAuditLogs(prev => [newLog, ...prev]);
      return { success: true };
    } catch (err) {
      console.error('Error creating audit log:', err);
      return { success: false, error: '创建审计日志失败' };
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  // 获取操作选项
  const getActionOptions = useCallback(() => {
    return [
      { value: 'create', label: '创建' },
      { value: 'update', label: '更新' },
      { value: 'delete', label: '删除' },
      { value: 'view', label: '查看' },
      { value: 'export', label: '导出' },
      { value: 'import', label: '导入' }
    ];
  }, []);

  // 获取权限类型选项
  const getPermissionTypeOptions = useCallback(() => {
    return [
      { value: 'menu', label: '菜单权限' },
      { value: 'function', label: '功能权限' },
      { value: 'project', label: '项目权限' },
      { value: 'data', label: '数据权限' }
    ];
  }, []);

  return {
    auditLogs,
    loading,
    error,
    loadAuditLogs,
    createAuditLog,
    totalCount,
    page,
    setPage,
    pageSize,
    getActionOptions,
    getPermissionTypeOptions
  };
}