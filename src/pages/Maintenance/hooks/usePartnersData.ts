import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Partner } from "@/types";
import { usePermissions } from "@/hooks/usePermissions";
import { useQueryClient } from '@tanstack/react-query';

interface PartnerWithProjects extends Partner {
  projects: {
    projectId: string;
    projectName: string;
    projectCode: string;
    level: number;
    taxRate: number;
  }[];
}

export function usePartnersData() {
  const { toast } = useToast();
  const { isAdmin, isFinance } = usePermissions();
  const canViewSensitive = isAdmin || isFinance;
  const queryClient = useQueryClient();
  const [partners, setPartners] = useState<PartnerWithProjects[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'货主' | '合作商' | '资方' | '本公司'>('货主');
  const [showDetails, setShowDetails] = useState(false);

  const fetchPartners = useCallback(async () => {
    setIsLoading(true);
    try {
      let data: any, error: any;
      if (canViewSensitive) {
        ({ data, error } = await supabase
          .from('partners')
          .select(`
            id, name, tax_rate, partner_type, created_at,
            partner_bank_details ( full_name, tax_number, company_address, bank_account, bank_name, branch_name ),
            project_partners (
              level, tax_rate,
              projects ( id, name, auto_code )
            )
          `)
          .order('name', { ascending: true }));
      } else {
        ({ data, error } = await supabase
          .from('partners')
          .select(`
            id, name, full_name, tax_rate, partner_type, created_at,
            project_partners (
              level,
              projects ( id, name, auto_code )
            )
          `)
          .order('name', { ascending: true }));
      }

      if (error) throw error;

      const formattedData: PartnerWithProjects[] = data.map((item: any) => {
        const bankDetails = Array.isArray(item.partner_bank_details) 
          ? item.partner_bank_details[0] 
          : item.partner_bank_details;
        
        return {
          id: item.id,
          name: item.name,
          fullName: bankDetails?.full_name || '',
          bankAccount: bankDetails?.bank_account || '',
          bankName: bankDetails?.bank_name || '',
          branchName: bankDetails?.branch_name || '',
          taxNumber: bankDetails?.tax_number || '',
          companyAddress: bankDetails?.company_address || '',
          taxRate: Number(item.tax_rate) || 0,
          partnerType: item.partner_type,
          createdAt: item.created_at,
          projects: (item.project_partners || [])
            .map((pp: any) => ({
              projectId: pp.projects?.id || '',
              projectName: pp.projects?.name || '',
              projectCode: pp.projects?.auto_code || '',
              level: pp.level,
              taxRate: Number(pp.tax_rate) || 0
            }))
            .filter((p: any) => p.projectId)
        };
      });

      setPartners(formattedData);
    } catch (error: any) {
      console.error('Error fetching partners:', error);
      toast({
        title: '加载失败',
        description: error.message || '无法加载合作方数据',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [canViewSensitive, toast]);

  const deletePartner = async (partnerId: string) => {
    try {
      const { error } = await supabase
        .from('partners')
        .delete()
        .eq('id', partnerId);

      if (error) throw error;

      toast({
        title: "删除成功",
        description: "合作方已成功删除。",
      });

      queryClient.invalidateQueries({ queryKey: ['partners-list'] });
      fetchPartners();
    } catch (error: any) {
      console.error('Error deleting partner:', error);
      toast({
        title: "删除失败",
        description: error.message || "无法删除合作方，请重试。",
        variant: "destructive",
      });
    }
  };

  return {
    partners,
    isLoading,
    activeTab,
    setActiveTab,
    showDetails,
    setShowDetails,
    canViewSensitive,
    fetchPartners,
    deletePartner,
  };
}

