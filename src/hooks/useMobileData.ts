// 移动端通用数据获取Hook
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useMobileData(tableName: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async (filters: any = {}) => {
    setLoading(true);
    try {
      let query = supabase.from(tableName).select('*').order('created_at', { ascending: false });
      
      if (filters.searchTerm) {
        query = query.ilike('name', `%${filters.searchTerm}%`);
      }

      const { data: result, error } = await query.limit(50);
      if (error) throw error;
      setData(result || []);
    } catch (error) {
      console.error('加载数据失败:', error);
      toast({ title: '错误', description: '加载数据失败', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tableName, toast]);

  return { data, loading, fetchData, setData };
}

