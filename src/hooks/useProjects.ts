import { useState, useEffect, useCallback } from 'react';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useToast } from '@/hooks/use-toast';

export interface Project {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  manager: string;
  loading_address: string;
  unloading_address: string;
  auto_code?: string;
  planned_total_tons?: number;
  finance_manager?: string;
  project_status: string;
  cargo_type: string;
  created_at: string;
}

export function useProjects() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProjects(data || []);
    } catch (error) {
      console.error('加载项目失败:', error);
      toast({
        title: "加载失败",
        description: "无法加载项目列表",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return {
    projects,
    loading,
    loadProjects
  };
}
