// 审核页面通用数据管理Hook
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useAuditData(rpcFunctionName: string) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const { toast } = useToast();

  const fetchRequests = useCallback(async (filters: any, currentPage: number, pageSize: number) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc(rpcFunctionName, {
        ...filters,
        p_limit: pageSize,
        p_offset: (currentPage - 1) * pageSize
      });

      if (error) throw error;

      const requestsData = (data as any[]) || [];
      setRequests(requestsData);

      if (requestsData.length > 0) {
        const total = requestsData[0].total_count || 0;
        setTotalCount(total);
        setTotalPages(Math.ceil(total / pageSize));
      } else {
        setTotalCount(0);
        setTotalPages(0);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      toast({ title: '错误', description: '加载数据失败', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [rpcFunctionName, toast]);

  return { requests, loading, totalCount, totalPages, fetchRequests, setRequests };
}

