// 项目数据管理Hook
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Project } from '@/types/projectPages';

export function useProjectData() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchProjects = useCallback(async (searchTerm: string = '') => {
    setLoading(true);
    try {
      let query = supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,auto_code.ilike.%${searchTerm}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('加载项目失败:', error);
      toast({ title: '错误', description: '加载项目失败', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createProject = async (project: Partial<Project>) => {
    try {
      const { error } = await supabase.from('projects').insert(project);
      if (error) throw error;
      toast({ title: '成功', description: '项目创建成功' });
      return true;
    } catch (error) {
      toast({ title: '失败', description: (error as Error).message, variant: 'destructive' });
      return false;
    }
  };

  const updateProject = async (id: string, project: Partial<Project>) => {
    try {
      const { error } = await supabase.from('projects').update(project).eq('id', id);
      if (error) throw error;
      toast({ title: '成功', description: '项目更新成功' });
      return true;
    } catch (error) {
      toast({ title: '失败', description: (error as Error).message, variant: 'destructive' });
      return false;
    }
  };

  return { projects, loading, fetchProjects, createProject, updateProject };
}

