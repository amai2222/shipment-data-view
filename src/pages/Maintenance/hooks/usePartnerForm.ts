import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Partner } from "@/types";
import { useQueryClient } from '@tanstack/react-query';

interface FormData {
  name: string;
  fullName: string;
  bankAccount: string;
  bankName: string;
  branchName: string;
  taxNumber: string;
  companyAddress: string;
  taxRate: number;
  partnerType: '货主' | '合作商' | '资方' | '本公司';
}

export function usePartnerForm(reloadData: () => void) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    fullName: '',
    bankAccount: '',
    bankName: '',
    branchName: '',
    taxNumber: '',
    companyAddress: '',
    taxRate: 0,
    partnerType: '货主'
  });

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      fullName: '',
      bankAccount: '',
      bankName: '',
      branchName: '',
      taxNumber: '',
      companyAddress: '',
      taxRate: 0,
      partnerType: '货主'
    });
    setEditingPartner(null);
  }, []);

  const handleEdit = (partner: Partner) => {
    setFormData({
      name: partner.name,
      fullName: partner.fullName || '',
      bankAccount: partner.bankAccount || '',
      bankName: partner.bankName || '',
      branchName: partner.branchName || '',
      taxNumber: partner.taxNumber || '',
      companyAddress: partner.companyAddress || '',
      taxRate: partner.taxRate || 0,
      partnerType: partner.partnerType || '货主'
    });
    setEditingPartner(partner);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast({
        title: "表单验证失败",
        description: "请填写合作方名称",
        variant: "destructive",
      });
      return;
    }

    try {
      const partnerData = {
        name: formData.name,
        tax_rate: formData.taxRate,
        partner_type: formData.partnerType
      };

      let partnerId: string;

      if (editingPartner) {
        const { error: updateError } = await supabase
          .from('partners')
          .update(partnerData)
          .eq('id', editingPartner.id);

        if (updateError) throw updateError;
        partnerId = editingPartner.id;
      } else {
        const { data: newPartner, error: insertError } = await supabase
          .from('partners')
          .insert(partnerData)
          .select()
          .single();

        if (insertError) throw insertError;
        partnerId = newPartner.id;
      }

      // 更新银行详情
      if (formData.fullName || formData.bankAccount || formData.taxNumber) {
        const bankData = {
          partner_id: partnerId,
          full_name: formData.fullName || null,
          bank_account: formData.bankAccount || null,
          bank_name: formData.bankName || null,
          branch_name: formData.branchName || null,
          tax_number: formData.taxNumber || null,
          company_address: formData.companyAddress || null
        };

        const { data: existing } = await supabase
          .from('partner_bank_details')
          .select('id')
          .eq('partner_id', partnerId)
          .single();

        if (existing) {
          await supabase
            .from('partner_bank_details')
            .update(bankData)
            .eq('partner_id', partnerId);
        } else {
          await supabase
            .from('partner_bank_details')
            .insert(bankData);
        }
      }

      toast({
        title: editingPartner ? "更新成功" : "添加成功",
        description: editingPartner ? "合作方信息已成功更新。" : "新合作方已成功添加。",
      });

      setIsDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['partners-list'] });
      reloadData();
    } catch (error: any) {
      console.error('Error saving partner:', error);
      toast({
        title: editingPartner ? "更新失败" : "添加失败",
        description: error.message || "操作失败，请重试。",
        variant: "destructive",
      });
    }
  };

  return {
    isDialogOpen,
    setIsDialogOpen,
    editingPartner,
    formData,
    setFormData,
    resetForm,
    handleEdit,
    handleSubmit,
  };
}

