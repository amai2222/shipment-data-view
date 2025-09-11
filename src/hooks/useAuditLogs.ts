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
      
      // 构建查询条件
      let query = supabase
        .from('permission_audit_logs')
        .select(`
          *,
          user:profiles!permission_audit_logs_user_id_fkey(full_name, email),
          target_user:profiles!permission_audit_logs_target_user_id_fkey(full_name, email),
          created_by_user:profiles!permission_audit_logs_created_by_fkey(full_name, email)
        `)
        .order('created_at', { ascending: false });

      // 应用过滤条件
      if (filters.action) {
        query = query.eq('action', filters.action);
      }
      if (filters.permission_type) {
        query = query.eq('permission_type', filters.permission_type);
      }
      if (filters.user_id) {
        query = query.eq('user_id', filters.user_id);
      }
      if (filters.target_user_id) {
        query = query.eq('target_user_id', filters.target_user_id);
      }
      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to);
      }

      // 分页
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      // 处理数据，添加用户信息
      const processedData = data?.map(log => ({
        ...log,
        user_name: log.user?.full_name || '未知用户',
        user_email: log.user?.email || '',
        target_user_name: log.target_user?.full_name || '',
        target_user_email: log.target_user?.email || '',
        created_by_name: log.created_by_user?.full_name || '未知用户',
        created_by_email: log.created_by_user?.email || ''
      })) || [];

      setAuditLogs(processedData);
      setTotalCount(count || 0);
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
      const { data, error } = await supabase
        .from('permission_audit_logs')
        .select('action')
        .not('action', 'is', null);

      if (error) throw error;

      const actions = [...new Set(data?.map(item => item.action) || [])];
      return actions;
    } catch (error) {
      console.error('获取操作类型失败:', error);
      return [];
    }
  }, []);

  // 获取权限类型选项
  const getPermissionTypeOptions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('permission_audit_logs')
        .select('permission_type')
        .not('permission_type', 'is', null);

      if (error) throw error;

      const types = [...new Set(data?.map(item => item.permission_type) || [])];
      return types;
    } catch (error) {
      console.error('获取权限类型失败:', error);
      return [];
    }
  }, []);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

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
