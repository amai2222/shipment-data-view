// 付款申请数据管理Hook
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PaymentFilters } from '@/types/paymentRequest';

const PAGE_SIZE = 50;

export function usePaymentData() {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1 });
  const { toast } = useToast();

  const fetchReportData = useCallback(async (filters: PaymentFilters) => {
    setLoading(true);
    try {
      const statusArray = filters.paymentStatus === 'all' ? null : [filters.paymentStatus];
      
      const { data, error } = await supabase.rpc('get_payment_request_data', {
        p_project_id: filters.projectId === 'all' ? null : filters.projectId,
        p_start_date: filters.startDate || null,
        p_end_date: filters.endDate || null,
        p_payment_status_array: statusArray,
        p_partner_id: filters.partnerId === 'all' ? null : filters.partnerId,
        p_driver_name: filters.driverName || null,
        p_license_plate: filters.licensePlate || null,
        p_driver_phone: filters.driverPhone || null,
        p_waybill_numbers: filters.waybillNumbers || null,
        p_other_platform_name: filters.otherPlatformName || null,
        p_page_size: PAGE_SIZE,
        p_page_number: pagination.currentPage,
      });

      if (error) throw error;
      setReportData(data);
      setPagination(prev => ({ 
        ...prev, 
        totalPages: Math.ceil(((data as any)?.count || 0) / PAGE_SIZE) || 1 
      }));
    } catch (error) {
      console.error('加载付款申请数据失败:', error);
      toast({ 
        title: '错误', 
        description: `加载数据失败: ${(error as any).message}`, 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  }, [pagination.currentPage, toast]);

  return {
    reportData,
    loading,
    pagination,
    setPagination,
    fetchReportData
  };
}

