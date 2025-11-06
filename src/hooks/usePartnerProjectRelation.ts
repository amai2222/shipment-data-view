// 合作方-项目关系管理Hook
// 文件路径: src/hooks/usePartnerProjectRelation.ts
// 描述: 提供合作方和项目关系的统一管理接口

import { useState, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// 类型定义
export interface Partner {
  id: string;
  name: string;
  full_name?: string;
}

export interface Project {
  id: string;
  name: string;
  start_date?: string;
  end_date?: string;
  manager?: string;
  loading_address?: string;
  unloading_address?: string;
  project_status?: string;
}

export interface PartnerProjectRelation {
  partner_id: string;
  project_id: string;
  level: number;
  partner: Partner;
  project: Project;
}

export interface UsePartnerProjectRelationReturn {
  // 状态
  partners: Partner[];
  projects: Project[];
  partnerProjects: Project[];
  loadingPartners: boolean;
  loadingProjects: boolean;
  
  // 方法
  loadAllPartners: () => Promise<void>;
  loadProjectsByPartner: (partnerId: string) => Promise<void>;
  loadAllProjects: () => Promise<void>;
  getPartnerLevelInProject: (partnerId: string, projectId: string) => Promise<number | null>;
  getProjectPartners: (projectId: string) => Promise<PartnerProjectRelation[]>;
  isPartnerHighestLevel: (partnerId: string, projectId: string) => Promise<boolean>;
}

export function usePartnerProjectRelation(): UsePartnerProjectRelationReturn {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [partnerProjects, setPartnerProjects] = useState<Project[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const { toast } = useToast();

  // 加载每个项目的最高级合作商
  const loadAllPartners = useCallback(async () => {
    setLoadingPartners(true);
    try {
      // 首先检查partners表是否有数据
      const { data: partnersData, error: partnersError } = await supabase
        .from('partners')
        .select('id, name, full_name')
        .order('name');
      
      if (partnersError) throw partnersError;
      
      // 然后检查project_partners表是否有数据
      const { data: projectPartnersData, error: projectPartnersError } = await supabase
        .from('project_partners')
        .select(`
          partner_id,
          project_id,
          level,
          partners (
            id,
            name,
            full_name
          )
        `)
        .order('level', { ascending: false });
      
      if (projectPartnersError) {
        // 如果project_partners表没有数据，使用partners表的数据
        setPartners(partnersData || []);
        return;
      }
      
      if (!projectPartnersData || projectPartnersData.length === 0) {
        // 如果project_partners表为空，使用partners表的数据
        setPartners(partnersData || []);
        return;
      }
      
      // 按项目分组，找到每个项目的最高级别合作商
      const projectMaxLevels = new Map();
      projectPartnersData.forEach((item: any) => {
        if (item.project_id) {
          const currentMax = projectMaxLevels.get(item.project_id) || 0;
          if (item.level > currentMax) {
            projectMaxLevels.set(item.project_id, item.level);
          }
        }
      });
      
      // 获取每个项目最高级别的合作商
      const highestLevelPartners = new Map();
      projectPartnersData.forEach((item: any) => {
        if (item.project_id && item.partners) {
          const projectMaxLevel = projectMaxLevels.get(item.project_id);
          if (item.level === projectMaxLevel) {
            // 使用合作商ID作为key（确保每个合作商实体只显示一次）
            if (!highestLevelPartners.has(item.partners.id)) {
              highestLevelPartners.set(item.partners.id, {
                id: item.partners.id,
                name: item.partners.name,  // 使用简称
                full_name: item.partners.full_name
              });
            }
          }
        }
      });
      
      const partnersArray = Array.from(highestLevelPartners.values());
      setPartners(partnersArray);
      
    } catch (error) {
      console.error('加载合作商失败:', error);
      toast({
        title: "错误",
        description: "加载合作商失败",
        variant: "destructive"
      });
    } finally {
      setLoadingPartners(false);
    }
  }, [toast]);

  // 根据合作商加载项目
  const loadProjectsByPartner = useCallback(async (partnerId: string) => {
    if (!partnerId) {
      setPartnerProjects([]);
      return;
    }

    setLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from('project_partners')
        .select(`
          project_id,
          projects (
            id,
            name,
            start_date,
            end_date,
            manager,
            loading_address,
            unloading_address,
            project_status
          )
        `)
        .eq('partner_id', partnerId);

      if (error) throw error;
      
      // 去重并格式化数据
      const uniqueProjects = new Map();
      data?.forEach((item: any) => {
        if (item.projects && !uniqueProjects.has(item.projects.id)) {
          uniqueProjects.set(item.projects.id, item.projects);
        }
      });
      
      setPartnerProjects(Array.from(uniqueProjects.values()));
    } catch (error) {
      console.error('加载合作商项目失败:', error);
      toast({
        title: "错误",
        description: "加载合作商项目失败",
        variant: "destructive"
      });
      setPartnerProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, [toast]);

  // 加载所有项目
  const loadAllProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, start_date, end_date, manager, loading_address, unloading_address, project_status')
        .order('name');
      
      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('加载项目失败:', error);
      toast({
        title: "错误",
        description: "加载项目失败",
        variant: "destructive"
      });
    } finally {
      setLoadingProjects(false);
    }
  }, [toast]);

  // 获取合作商在特定项目中的级别
  const getPartnerLevelInProject = useCallback(async (partnerId: string, projectId: string): Promise<number | null> => {
    try {
      const { data, error } = await supabase
        .from('project_partners')
        .select('level')
        .eq('partner_id', partnerId)
        .eq('project_id', projectId)
        .single();
      
      if (error) return null;
      return (data as any)?.level || null;
    } catch (error) {
      console.error('获取合作商级别失败:', error);
      return null;
    }
  }, []);

  // 获取项目的所有合作商（按级别排序）
  const getProjectPartners = useCallback(async (projectId: string): Promise<PartnerProjectRelation[]> => {
    try {
      const { data, error } = await supabase
        .from('project_partners')
        .select(`
          partner_id,
          project_id,
          level,
          partners (
            id,
            name,
            full_name
          ),
          projects (
            id,
            name,
            start_date,
            end_date,
            manager,
            loading_address,
            unloading_address,
            project_status
          )
        `)
        .eq('project_id', projectId)
        .order('level', { ascending: false });
      
      if (error) throw error;
      
      return data?.map((item: any) => ({
        partner_id: item.partner_id,
        project_id: item.project_id,
        level: item.level,
        partner: item.partners,
        project: item.projects
      })) || [];
    } catch (error) {
      console.error('获取项目合作商失败:', error);
      return [];
    }
  }, []);

  // 判断合作商是否为项目中的最高级别
  const isPartnerHighestLevel = useCallback(async (partnerId: string, projectId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('project_partners')
        .select('level')
        .eq('project_id', projectId)
        .order('level', { ascending: false })
        .limit(1);
      
      if (error) return false;
      
      const maxLevel = (data as any)?.[0]?.level || 0;
      const partnerLevel = await getPartnerLevelInProject(partnerId, projectId);
      
      return partnerLevel === maxLevel;
    } catch (error) {
      console.error('判断合作商级别失败:', error);
      return false;
    }
  }, [getPartnerLevelInProject]);

  return {
    // 状态
    partners,
    projects,
    partnerProjects,
    loadingPartners,
    loadingProjects,
    
    // 方法
    loadAllPartners,
    loadProjectsByPartner,
    loadAllProjects,
    getPartnerLevelInProject,
    getProjectPartners,
    isPartnerHighestLevel,
  };
}
