import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, subDays } from 'date-fns';

// 类型定义
export interface ShipperDashboardStats {
  summary: {
    totalRecords: number;
    totalWeight: number;
    totalAmount: number;
    selfRecords: number;
    selfWeight: number;
    selfAmount: number;
    subordinatesRecords: number;
    subordinatesWeight: number;
    subordinatesAmount: number;
    activeProjects: number;
    activeDrivers: number;
  };
  pending: {
    pendingPayments: number;
    pendingInvoices: number;
    overduePayments: number;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

export interface SubordinateShipper {
  shipper_id: string;
  shipper_name: string;
  hierarchy_depth: number;
  parent_id: string | null;
  parent_name: string | null;
  record_count: number;
  total_weight: number;
  total_amount: number;
  active_projects: number;
  pending_payments: number;
  pending_invoices: number;
}

export function useShipperDashboardData() {
  const { user } = useAuth() as { user: { role: string; id: string } | null };
  const { toast } = useToast();

  // 状态管理
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<ShipperDashboardStats | null>(null);
  const [subordinates, setSubordinates] = useState<SubordinateShipper[]>([]);
  const [availableShippers, setAvailableShippers] = useState<Array<{id: string, name: string}>>([]);
  
  // 筛选器状态
  const [dateRange, setDateRange] = useState<'7days' | '30days' | 'thisMonth' | 'lastMonth'>('30days');
  const [shipperScope, setShipperScope] = useState<'all' | 'self' | 'direct'>('all');
  const [selectedShipperId, setSelectedShipperId] = useState<string | null>(null);

  // 判断用户类型和权限
  const userRole = user?.role || 'viewer';
  const isPartnerRole = userRole === 'partner';
  const currentShipperId = isPartnerRole ? null : selectedShipperId;

  // 计算日期范围
  const getDateRange = (range: string) => {
    const today = new Date();
    let startDate: Date;
    
    switch (range) {
      case '7days':
        startDate = subDays(today, 7);
        break;
      case '30days':
        startDate = subDays(today, 30);
        break;
      case 'thisMonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'lastMonth': {
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        return {
          startDate: format(lastMonth, 'yyyy-MM-dd'),
          endDate: format(lastMonthEnd, 'yyyy-MM-dd')
        };
      }
      default:
        startDate = subDays(today, 30);
    }
    
    return {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(today, 'yyyy-MM-dd')
    };
  };

  // 加载可用货主列表（非合作方角色使用）
  const loadAvailableShippers = useCallback(async () => {
    if (isPartnerRole) return;
    
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('id, name')
        .eq('partner_type', '货主')
        .eq('is_root', true)
        .order('name');
      
      if (error) throw error;
      
      setAvailableShippers(data || []);
      
      // 如果还没有选择货主，默认选择第一个
      if (!selectedShipperId && data && data.length > 0) {
        setSelectedShipperId(data[0].id);
      }
    } catch (error: unknown) {
      console.error('加载货主列表失败:', error);
    }
  }, [isPartnerRole, selectedShipperId]);

  // 加载数据
  const loadData = useCallback(async () => {
    // 合作方角色：暂时不支持（需要实现用户-合作方关联）
    if (isPartnerRole) {
      toast({
        title: '功能暂未开放',
        description: '合作方角色的货主看板功能正在开发中，请使用其他角色访问',
        variant: 'destructive'
      });
      setIsLoading(false);
      return;
    }
    
    // 非合作方角色：必须选择一个货主
    if (!isPartnerRole && !currentShipperId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const dates = getDateRange(dateRange);
      
      // 加载总体统计
      const { data: statsData, error: statsError } = await supabase.rpc(
        'get_shipper_dashboard_stats',
        {
          p_shipper_id: currentShipperId,
          p_start_date: dates.startDate,
          p_end_date: dates.endDate,
          p_include_self: shipperScope !== 'direct',
          p_include_subordinates: shipperScope !== 'self'
        }
      );

      if (statsError) throw statsError;
      setStats(statsData as unknown as ShipperDashboardStats);

      // 加载下级货主列表
      const { data: subordinatesData, error: subordinatesError } = await supabase.rpc(
        'get_subordinate_shippers_stats',
        {
          p_shipper_id: currentShipperId,
          p_start_date: dates.startDate,
          p_end_date: dates.endDate
        }
      );

      if (subordinatesError) throw subordinatesError;
      setSubordinates(subordinatesData as unknown as SubordinateShipper[] || []);

    } catch (error: unknown) {
      console.error('加载失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast({
        title: '加载失败',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [isPartnerRole, currentShipperId, dateRange, shipperScope, toast, getDateRange]);

  // 初始加载可用货主列表
  useEffect(() => {
    if (!isPartnerRole) {
      loadAvailableShippers();
    }
  }, [isPartnerRole, loadAvailableShippers]);

  // 初始加载和筛选器变化时重新加载
  useEffect(() => {
    if (currentShipperId) {
      loadData();
    }
  }, [currentShipperId, loadData]);

  return {
    user,
    isLoading,
    stats,
    subordinates,
    availableShippers,
    dateRange,
    setDateRange,
    shipperScope,
    setShipperScope,
    selectedShipperId,
    setSelectedShipperId,
    isPartnerRole,
    loadData,
  };
}

