// 司机管理数据Hook
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Driver } from '@/types/managementPages';

export function useDriverData() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchDrivers = useCallback(async (searchTerm: string = '') => {
    setLoading(true);
    try {
      let query = supabase.from('drivers').select('*').order('created_at', { ascending: false });
      
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,license_plate.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDrivers(data || []);
    } catch (error) {
      console.error('加载司机数据失败:', error);
      toast({ title: '错误', description: '加载司机数据失败', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createDriver = async (driver: Partial<Driver>) => {
    try {
      const { error } = await supabase.from('drivers').insert(driver);
      if (error) throw error;
      toast({ title: '成功', description: '司机添加成功' });
      return true;
    } catch (error) {
      toast({ title: '失败', description: (error as Error).message, variant: 'destructive' });
      return false;
    }
  };

  const updateDriver = async (id: string, driver: Partial<Driver>) => {
    try {
      const { error } = await supabase.from('drivers').update(driver).eq('id', id);
      if (error) throw error;
      toast({ title: '成功', description: '司机更新成功' });
      return true;
    } catch (error) {
      toast({ title: '失败', description: (error as Error).message, variant: 'destructive' });
      return false;
    }
  };

  const deleteDriver = async (id: string) => {
    try {
      const { error } = await supabase.from('drivers').delete().eq('id', id);
      if (error) throw error;
      toast({ title: '成功', description: '司机删除成功' });
      return true;
    } catch (error) {
      toast({ title: '失败', description: (error as Error).message, variant: 'destructive' });
      return false;
    }
  };

  return { drivers, loading, fetchDrivers, createDriver, updateDriver, deleteDriver };
}

