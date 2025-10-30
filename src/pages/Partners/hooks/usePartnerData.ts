// 合作方数据管理Hook
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Partner } from '@/types/projectPages';

export function usePartnerData() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPartners = useCallback(async (searchTerm: string = '') => {
    setLoading(true);
    try {
      let query = supabase.from('partners').select('*').order('name');
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      setPartners(data || []);
    } catch (error) {
      console.error('加载合作方失败:', error);
      toast({ title: '错误', description: '加载合作方失败', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createPartner = async (partner: Partial<Partner>) => {
    try {
      const { error } = await supabase.from('partners').insert(partner);
      if (error) throw error;
      toast({ title: '成功', description: '合作方创建成功' });
      return true;
    } catch (error) {
      toast({ title: '失败', description: (error as Error).message, variant: 'destructive' });
      return false;
    }
  };

  const updatePartner = async (id: string, partner: Partial<Partner>) => {
    try {
      const { error } = await supabase.from('partners').update(partner).eq('id', id);
      if (error) throw error;
      toast({ title: '成功', description: '合作方更新成功' });
      return true;
    } catch (error) {
      toast({ title: '失败', description: (error as Error).message, variant: 'destructive' });
      return false;
    }
  };

  return { partners, loading, fetchPartners, createPartner, updatePartner };
}

