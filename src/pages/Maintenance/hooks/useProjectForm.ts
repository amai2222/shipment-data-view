import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ProjectWithDetails } from "./useProjectsData";

interface FormData {
  name: string;
  startDate: string;
  endDate: string;
  manager: string;
  loadingAddress: string;
  unloadingAddress: string;
  financeManager: string;
  plannedTotalTons: string;
  projectStatus: string;
  cargoType: string;
  effectiveQuantityType: "min_value" | "loading" | "unloading";
}

interface PartnerChain {
  id: string;
  dbId?: string;
  chainName: string;
  description?: string;
  billingTypeId?: number | null;
  isDefault?: boolean;
  partners: Array<{
    id: string;
    dbId?: string;
    partnerId: string;
    level: number;
    taxRate: number;
    calculationMethod: "tax" | "profit";
    profitRate?: number;
    partnerName?: string;
  }>;
}

export function useProjectForm(refetchProjects: () => void) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<FormData>({
    name: "",
    startDate: "",
    endDate: "",
    manager: "",
    loadingAddress: "",
    unloadingAddress: "",
    financeManager: "",
    plannedTotalTons: "",
    projectStatus: "进行中",
    cargoType: "货品",
    effectiveQuantityType: "min_value",
  });

  const [selectedChains, setSelectedChains] = useState<PartnerChain[]>([]);
  const [originalChains, setOriginalChains] = useState<PartnerChain[]>([]);

  const resetForm = useCallback(() => {
    setFormData({
      name: "",
      startDate: "",
      endDate: "",
      manager: "",
      loadingAddress: "",
      unloadingAddress: "",
      financeManager: "",
      plannedTotalTons: "",
      projectStatus: "进行中",
      cargoType: "货品",
      effectiveQuantityType: "min_value",
    });
    setSelectedChains([]);
    setOriginalChains([]);
    setEditingProject(null);
  }, []);

  const handleEdit = (project: ProjectWithDetails) => {
    setFormData({
      name: project.name,
      startDate: project.startDate,
      endDate: project.endDate,
      manager: project.manager,
      loadingAddress: project.loadingAddress,
      unloadingAddress: project.unloadingAddress,
      financeManager: project.financeManager || "",
      plannedTotalTons: project.plannedTotalTons?.toString() || "",
      projectStatus: (project as any).projectStatus || "进行中",
      cargoType: (project as any).cargoType || "货品",
      effectiveQuantityType: (project as any).effectiveQuantityType || "min_value",
    });

    const mappedChains = (project.partnerChains || []).map(chain => ({
      id: chain.id || crypto.randomUUID(),
      dbId: chain.id,
      chainName: chain.chainName || "默认链路",
      description: chain.description,
      billingTypeId: chain.billingTypeId,
      isDefault: chain.isDefault,
      partners: (chain.partners || []).map(pp => ({
        id: pp.id || crypto.randomUUID(),
        dbId: pp.id,
        partnerId: pp.partnerId,
        level: pp.level,
        taxRate: pp.taxRate,
        calculationMethod: pp.calculationMethod as "tax" | "profit",
        profitRate: pp.profitRate,
        partnerName: pp.partnerName,
      }))
    }));

    setSelectedChains(mappedChains);
    setOriginalChains(JSON.parse(JSON.stringify(mappedChains)));
    setEditingProject(project);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.startDate || !formData.manager) {
      toast({
        title: "表单验证失败",
        description: "请填写所有必填字段（项目名称、开始日期、项目负责人）",
        variant: "destructive",
      });
      return;
    }

    if (selectedChains.length === 0) {
      toast({
        title: "缺少合作链路",
        description: "请至少添加一条合作链路",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const projectPayload: any = {
        name: formData.name,
        start_date: formData.startDate,
        end_date: formData.endDate,
        manager: formData.manager,
        loading_address: formData.loadingAddress,
        unloading_address: formData.unloadingAddress,
        finance_manager: formData.financeManager || null,
        planned_total_tons: formData.plannedTotalTons ? parseFloat(formData.plannedTotalTons) : null,
        project_status: formData.projectStatus,
        cargo_type: formData.cargoType,
        effective_quantity_type: formData.effectiveQuantityType,
      };

      let projectId: string;

      if (editingProject) {
        const { error: updateError } = await supabase
          .from('projects')
          .update(projectPayload)
          .eq('id', editingProject.id);

        if (updateError) throw updateError;
        projectId = editingProject.id;
      } else {
        const { data: newProject, error: insertError } = await supabase
          .from('projects')
          .insert(projectPayload)
          .select()
          .single();

        if (insertError) throw insertError;
        projectId = newProject.id;
      }

      // 处理合作链路
      if (editingProject) {
        const chainsToDelete = originalChains.filter(
          oc => !selectedChains.some(sc => sc.dbId && sc.dbId === oc.dbId)
        );
        
        for (const chain of chainsToDelete) {
          if (chain.dbId) {
            await supabase.from('partner_chains').delete().eq('id', chain.dbId);
          }
        }
      }

      for (const chain of selectedChains) {
        let chainId = chain.dbId;

        if (chainId) {
          await supabase
            .from('partner_chains')
            .update({
              chain_name: chain.chainName,
              description: chain.description,
              billing_type_id: chain.billingTypeId,
              is_default: chain.isDefault || false,
            })
            .eq('id', chainId);
        } else {
          const { data: newChain, error: chainError } = await supabase
            .from('partner_chains')
            .insert({
              project_id: projectId,
              chain_name: chain.chainName,
              description: chain.description,
              billing_type_id: chain.billingTypeId,
              is_default: chain.isDefault || false,
            })
            .select()
            .single();

          if (chainError) throw chainError;
          chainId = newChain.id;
        }

        if (chainId) {
          const originalPartners = originalChains
            .find(oc => oc.dbId === chain.dbId)?.partners || [];
          
          const partnersToDelete = originalPartners.filter(
            op => !chain.partners.some(p => p.dbId && p.dbId === op.dbId)
          );

          for (const partner of partnersToDelete) {
            if (partner.dbId) {
              await supabase.from('project_partners').delete().eq('id', partner.dbId);
            }
          }

          for (const partner of chain.partners) {
            const partnerPayload = {
              chain_id: chainId,
              partner_id: partner.partnerId,
              level: partner.level,
              tax_rate: partner.taxRate,
              calculation_method: partner.calculationMethod,
              profit_rate: partner.profitRate || null,
            };

            if (partner.dbId) {
              await supabase
                .from('project_partners')
                .update(partnerPayload)
                .eq('id', partner.dbId);
            } else {
              await supabase.from('project_partners').insert(partnerPayload);
            }
          }
        }
      }

      toast({
        title: editingProject ? "更新成功" : "添加成功",
        description: editingProject 
          ? "项目信息已成功更新。" 
          : "新项目已成功添加。",
      });

      setIsDialogOpen(false);
      resetForm();
      refetchProjects();
    } catch (error: any) {
      console.error('Error saving project:', error);
      toast({
        title: editingProject ? "更新失败" : "添加失败",
        description: error.message || "操作失败，请重试。",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isDialogOpen,
    setIsDialogOpen,
    editingProject,
    isSubmitting,
    formData,
    setFormData,
    selectedChains,
    setSelectedChains,
    resetForm,
    handleEdit,
    handleSubmit,
  };
}

