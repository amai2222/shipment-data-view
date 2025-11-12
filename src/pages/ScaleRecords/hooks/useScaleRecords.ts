import { useState, useEffect, useCallback } from 'react';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useToast } from '@/hooks/use-toast';
import { convertChinaDateToUTCDate } from '@/utils/dateUtils';

interface ScaleRecord {
  id: string;
  project_id: string;
  project_name: string;
  loading_date: string;
  trip_number: number;
  valid_quantity: number | null;
  billing_type_id: number;
  image_urls: string[];
  license_plate: string | null;
  driver_name: string | null;
  created_at: string;
  logistics_number: string | null;
}

interface FilterState {
  projectId: string;
  startDate: string;
  endDate: string;
  licensePlate: string;
}

const PAGE_SIZE = 15;

export function useScaleRecords() {
  const [records, setRecords] = useState<ScaleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  const loadRecords = useCallback(async (filters: FilterState, page: number = 1) => {
    setLoading(true);
    try {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('scale_records')
        .select('*', { count: 'exact' })
        .order('loading_date', { ascending: false })
        .order('trip_number', { ascending: false });

      if (filters.projectId && filters.projectId !== 'all') {
        query = query.eq('project_id', filters.projectId);
      }
      // 将中国时区的日期转换为 UTC 日期（用于数据库查询）
      // filters.startDate 和 filters.endDate 存储的是中国时区的日期字符串（如 "2025-11-02"）
      if (filters.startDate) {
        const [year, month, day] = filters.startDate.split('-').map(Number);
        const chinaDate = new Date(year, month - 1, day);
        const utcStartDate = convertChinaDateToUTCDate(chinaDate);
        query = query.gte('loading_date', utcStartDate);
      }
      if (filters.endDate) {
        const [year, month, day] = filters.endDate.split('-').map(Number);
        const chinaDate = new Date(year, month - 1, day);
        const utcEndDate = convertChinaDateToUTCDate(chinaDate);
        query = query.lte('loading_date', utcEndDate);
      }
      if (filters.licensePlate) {
        query = query.ilike('license_plate', `%${filters.licensePlate}%`);
      }
      
      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      
      setRecords(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error loading records:', error);
      toast({ 
        title: "错误", 
        description: "加载磅单记录失败", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const deleteRecord = useCallback(async (recordId: string, imageUrls: string[] = []) => {
    try {
      // 删除云存储图片
      if (imageUrls.length > 0) {
        const { error: functionError } = await supabase.functions.invoke('qiniu-delete', { 
          body: { urls: imageUrls } 
        });
        if (functionError) throw new Error("删除云存储图片失败");
      }

      // 删除数据库记录
      const { error: dbError } = await supabase
        .from('scale_records')
        .delete()
        .eq('id', recordId);

      if (dbError) throw dbError;

      toast({ title: "成功", description: "磅单记录已删除" });
      return true;
    } catch (error) {
      console.error("Delete record error:", error);
      toast({ 
        title: "删除失败", 
        description: "操作失败，请检查控制台错误信息。", 
        variant: "destructive" 
      });
      return false;
    }
  }, [toast]);

  const bulkDeleteRecords = useCallback(async (recordIds: string[]) => {
    try {
      const { data: recordsToDelete, error: fetchError } = await supabase
        .from('scale_records')
        .select('image_urls')
        .in('id', recordIds);
      
      if (fetchError) throw fetchError;

      const urlsToDelete = recordsToDelete.flatMap(r => r.image_urls).filter(Boolean);
      if (urlsToDelete.length > 0) {
        const { error: functionError } = await supabase.functions.invoke('qiniu-delete', { 
          body: { urls: urlsToDelete } 
        });
        if (functionError) throw new Error("删除云存储图片失败");
      }

      const { error: dbError } = await supabase
        .from('scale_records')
        .delete()
        .in('id', recordIds);
      
      if (dbError) throw dbError;

      toast({ 
        title: "成功", 
        description: `已成功删除 ${recordIds.length} 条记录。` 
      });
      return true;
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast({ 
        title: "删除失败", 
        description: "操作失败，请检查控制台错误信息。", 
        variant: "destructive" 
      });
      return false;
    }
  }, [toast]);

  const loadWaybillDetail = useCallback(async (logisticsNumber: string) => {
    try {
      const { data, error } = await supabase
        .from('logistics_records')
        .select(`
          *,
          partner_chains(chain_name),
          projects(name)
        `)
        .eq('auto_number', logisticsNumber)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error loading waybill:', error);
      toast({ 
        title: "错误", 
        description: "加载运单详情失败", 
        variant: "destructive" 
      });
      return null;
    }
  }, [toast]);

  return {
    records,
    loading,
    totalCount,
    currentPage,
    setCurrentPage,
    loadRecords,
    deleteRecord,
    bulkDeleteRecords,
    loadWaybillDetail,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(totalCount / PAGE_SIZE)
  };
}
