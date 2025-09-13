import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  permission_type: string;
  permission_key: string;
  target_user_id?: string;
  target_project_id?: string;
  old_value?: any;
  new_value?: any;
  reason?: string;
  created_at: string;
  created_by: string;
  // 关联的用户信息
  user_name?: string;
  user_email?: string;
  target_user_name?: string;
  target_user_email?: string;
  created_by_name?: string;
  created_by_email?: string;
}

export interface AuditLogFilters {
  action?: string;
  permission_type?: string;
  user_id?: string;
  target_user_id?: string;
  date_from?: string;
  date_to?: string;
}

export function useAuditLogs() {
  const { toast } = useToast();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const loadAuditLogs = useCallback(async (filters: AuditLogFilters = {}) => {
    try {
      setLoading(true);
      
      // 由于 permission_audit_logs 表不存在，使用模拟数据
      console.log('permission_audit_logs 表不存在，使用模拟数据');
      
      // 模拟一些审计日志数据
      const mockLogs: AuditLog[] = [
        {
          id: '1',
          user_id: 'user1',
          action: 'grant',
          permission_type: 'menu',
          permission_key: 'dashboard',
          reason: '权限配置',
          created_at: new Date().toISOString(),
          created_by: 'admin',
          user_name: '示例用户',
          user_email: 'user@example.com',
          created_by_name: '管理员',
          created_by_email: 'admin@example.com'
        }
      ];
      
      // 应用过滤器（简化版）
      let filteredLogs = mockLogs;
      if (filters.action) {
        filteredLogs = filteredLogs.filter(log => log.action === filters.action);
      }
      if (filters.permission_type) {
        filteredLogs = filteredLogs.filter(log => log.permission_type === filters.permission_type);
      }
      
      setAuditLogs(filteredLogs);
      setTotalCount(filteredLogs.length);
    } catch (error) {
      console.error('加载操作日志失败:', error);
      toast({
        title: "加载失败",
        description: "无法加载操作日志",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, toast]);

  // 获取操作类型选项
  const getActionOptions = useCallback(async () => {
    try {
      // 由于表不存在，返回模拟选项
      return ['grant', 'revoke', 'modify', 'inherit'];
    } catch (error) {
      console.error('获取操作类型失败:', error);
      return [];
    }
  }, []);

  // 获取权限类型选项
  const getPermissionTypeOptions = useCallback(async () => {
    try {
      // 由于表不存在，返回模拟选项
      return ['menu', 'function', 'project', 'data'];
    } catch (error) {
      console.error('获取权限类型失败:', error);
      return [];
    }
  }, []);

  // 检查表是否存在并创建示例数据
  const checkAndInitializeAuditLogs = useCallback(async () => {
    try {
      // 由于 permission_audit_logs 表不存在，跳过初始化
      console.log('permission_audit_logs 表不存在，跳过初始化');
    } catch (error) {
      console.error('初始化操作日志失败:', error);
    }
  }, []);

  useEffect(() => {
    checkAndInitializeAuditLogs().then(() => {
      loadAuditLogs();
    });
  }, [checkAndInitializeAuditLogs, loadAuditLogs]);

  return {
    auditLogs,
    loading,
    totalCount,
    page,
    setPage,
    pageSize,
    loadAuditLogs,
    getActionOptions,
    getPermissionTypeOptions
  };
}
