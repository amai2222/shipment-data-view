import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Project, PartnerChain, ProjectPartner } from "@/types";

// 扩展 Project 类型，包含嵌套数据
export interface ProjectWithDetails extends Project {
  partnerChains: (PartnerChain & { partners: ProjectPartner[] })[];
}

export function useProjectsData() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  // 优化：使用React Query缓存项目数据
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects-with-details'],
    queryFn: async () => {
      const { data: projectsData, error: projectsError } = await supabase.rpc('get_projects_with_details_fixed');
      if (projectsError) throw projectsError;

      const payload = (projectsData as any) || {};
      const rawProjects: any[] = Array.isArray(payload.projects) ? payload.projects : [];
      const chainsMap: Record<string, any[]> = payload.chains || {};
      const partnersMap: Record<string, any[]> = payload.partners || {};

      const composedProjects: ProjectWithDetails[] = rawProjects.map((p: any) => {
        const chains = (chainsMap[p.id] || []).map((c: any) => ({
          ...c,
          partners: (partnersMap[p.id] || []).filter((pp: any) => pp.chainId === c.id)
        }));
        return { ...p, partnerChains: chains } as ProjectWithDetails;
      });

      return composedProjects;
    },
    staleTime: 2 * 60 * 1000, // 2分钟缓存
    cacheTime: 10 * 60 * 1000, // 10分钟保留
    refetchOnWindowFocus: false,
  });

  // 优化：使用React Query缓存合作方数据
  const { data: partners = [] } = useQuery({
    queryKey: ['partners-list'],
    queryFn: async () => {
      const { data: partnersData, error: partnersError } = await supabase
        .from('partners')
        .select('id, name, tax_rate, created_at, partner_type, parent_partner_id, hierarchy_path, hierarchy_depth, is_root')
        .order('name', { ascending: true });

      if (partnersError) throw partnersError;
      return partnersData?.map(p => ({
        ...p, 
        taxRate: Number(p.tax_rate), 
        createdAt: p.created_at,
        partnerType: p.partner_type,
        parentPartnerId: p.parent_partner_id,
        hierarchyPath: p.hierarchy_path,
        hierarchyDepth: p.hierarchy_depth,
        isRoot: p.is_root
      })) || [];
    },
    staleTime: 10 * 60 * 1000, // 10分钟缓存（合作方变化不频繁）
    cacheTime: 30 * 60 * 1000,
  });

  // 删除项目
  const deleteProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['projects-with-details'] });
      
      toast({
        title: "删除成功",
        description: "项目已成功删除。",
      });
    } catch (error: any) {
      console.error('Error deleting project:', error);
      toast({
        title: "删除失败",
        description: error.message || "无法删除项目，请重试。",
        variant: "destructive",
      });
    }
  };

  return {
    projects,
    partners,
    isLoading: isLoadingProjects,
    expandedProject,
    setExpandedProject,
    deleteProject,
    refetchProjects: () => queryClient.invalidateQueries({ queryKey: ['projects-with-details'] }),
  };
}

