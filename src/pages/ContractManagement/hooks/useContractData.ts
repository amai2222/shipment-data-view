// 合同管理数据Hook
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Contract } from '@/types/managementPages';

export function useContractData() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchContracts = useCallback(async (filters: any = {}) => {
    setLoading(true);
    try {
      let query = supabase.from('contracts').select('*').order('created_at', { ascending: false });
      
      if (filters.searchTerm) {
        query = query.or(`contract_number.ilike.%${filters.searchTerm}%,title.ilike.%${filters.searchTerm}%`);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      setContracts(data || []);
    } catch (error) {
      console.error('加载合同数据失败:', error);
      toast({ title: '错误', description: '加载合同数据失败', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createContract = async (contract: Partial<Contract>) => {
    try {
      const { error } = await supabase.from('contracts').insert(contract);
      if (error) throw error;
      toast({ title: '成功', description: '合同创建成功' });
      return true;
    } catch (error) {
      toast({ title: '失败', description: (error as Error).message, variant: 'destructive' });
      return false;
    }
  };

  const updateContract = async (id: string, contract: Partial<Contract>) => {
    try {
      const { error } = await supabase.from('contracts').update(contract).eq('id', id);
      if (error) throw error;
      toast({ title: '成功', description: '合同更新成功' });
      return true;
    } catch (error) {
      toast({ title: '失败', description: (error as Error).message, variant: 'destructive' });
      return false;
    }
  };

  const deleteContract = async (id: string) => {
    try {
      const { error } = await supabase.from('contracts').delete().eq('id', id);
      if (error) throw error;
      toast({ title: '成功', description: '合同删除成功' });
      return true;
    } catch (error) {
      toast({ title: '失败', description: (error as Error).message, variant: 'destructive' });
      return false;
    }
  };

  return { contracts, loading, fetchContracts, createContract, updateContract, deleteContract };
}

