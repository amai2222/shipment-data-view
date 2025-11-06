import { useState, useEffect, useCallback } from 'react';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
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
      
      // 构建查询条件 - 只查询需要的字段
      let query = supabase
        .from('permission_audit_logs')
        .select('id, user_id, action, permission_type, permission_key, target_user_id, target_project_id, old_value, new_value, reason, created_at, created_by')
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

      if (error) {
        console.error('查询操作日志失败:', error);
        throw error;
      }

      // 获取所有相关的用户ID
      const userIds = new Set<string>();
      data?.forEach(log => {
        userIds.add(log.user_id);
        if (log.target_user_id) userIds.add(log.target_user_id);
        if (log.created_by) userIds.add(log.created_by);
      });

      // 批量获取用户信息
      let userMap = new Map<string, { full_name: string; email: string }>();
      if (userIds.size > 0) {
        const { data: users, error: usersError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', Array.from(userIds));

        if (!usersError && users) {
          users.forEach(user => {
            userMap.set(user.id, { full_name: user.full_name || '未知用户', email: user.email || '' });
          });
        }
      }

      // 处理数据，添加用户信息
      const processedData = data?.map(log => {
        const user = userMap.get(log.user_id) || { full_name: '未知用户', email: '' };
        const targetUser = log.target_user_id ? userMap.get(log.target_user_id) : null;
        const createdByUser = userMap.get(log.created_by) || { full_name: '未知用户', email: '' };

        return {
          ...log,
          user_name: user.full_name,
          user_email: user.email,
          target_user_name: targetUser?.full_name || '',
          target_user_email: targetUser?.email || '',
          created_by_name: createdByUser.full_name,
          created_by_email: createdByUser.email
        };
      }) || [];

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

  // 检查表是否存在并创建示例数据
  const checkAndInitializeAuditLogs = useCallback(async () => {
    try {
      // 先尝试查询表是否存在
      const { data, error } = await supabase
        .from('permission_audit_logs')
        .select('id')
        .limit(1);

      if (error) {
        console.error('permission_audit_logs表不存在或无法访问:', error);
        return;
      }

      // 如果没有数据，创建一些示例数据
      if (!data || data.length === 0) {
        
        // 获取当前用户ID
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 创建示例日志
        const sampleLogs = [
          {
            user_id: user.id,
            action: 'grant',
            permission_type: 'menu',
            permission_key: 'dashboard',
            reason: '系统初始化',
            created_by: user.id
          },
          {
            user_id: user.id,
            action: 'modify',
            permission_type: 'function',
            permission_key: 'data.create',
            reason: '权限配置',
            created_by: user.id
          }
        ];

        const { error: insertError } = await supabase
          .from('permission_audit_logs')
          .insert(sampleLogs);

        if (insertError) {
          console.error('创建示例数据失败:', insertError);
        }
      }
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
