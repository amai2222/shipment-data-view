// 地点管理数据Hook
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Location } from '@/types/managementPages';

export function useLocationData() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchLocations = useCallback(async (searchTerm: string = '') => {
    setLoading(true);
    try {
      let query = supabase.from('locations').select('*').order('name');
      
      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('加载地点数据失败:', error);
      toast({ title: '错误', description: '加载地点数据失败', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createLocation = async (location: Partial<Location>) => {
    try {
      const { error } = await supabase.from('locations').insert(location);
      if (error) throw error;
      toast({ title: '成功', description: '地点添加成功' });
      return true;
    } catch (error) {
      toast({ title: '失败', description: (error as Error).message, variant: 'destructive' });
      return false;
    }
  };

  const updateLocation = async (id: string, location: Partial<Location>) => {
    try {
      const { error } = await supabase.from('locations').update(location).eq('id', id);
      if (error) throw error;
      toast({ title: '成功', description: '地点更新成功' });
      return true;
    } catch (error) {
      toast({ title: '失败', description: (error as Error).message, variant: 'destructive' });
      return false;
    }
  };

  const deleteLocation = async (id: string) => {
    try {
      const { error } = await supabase.from('locations').delete().eq('id', id);
      if (error) throw error;
      toast({ title: '成功', description: '地点删除成功' });
      return true;
    } catch (error) {
      toast({ title: '失败', description: (error as Error).message, variant: 'destructive' });
      return false;
    }
  };

  return { locations, loading, fetchLocations, createLocation, updateLocation, deleteLocation };
}

