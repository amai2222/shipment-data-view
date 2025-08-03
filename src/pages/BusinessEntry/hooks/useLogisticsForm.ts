// src/pages/BusinessEntry/hooks/useLogisticsForm.ts

import { useState, useReducer, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LogisticsRecord, LogisticsFormData, Project, Driver } from '../types';

// ... (BLANK_FORM_DATA 和 formReducer 保持不变)
const BLANK_FORM_DATA: LogisticsFormData = {
  project_id: "", chain_id: null, driver_id: "", driver_name: "", loading_location: "", unloading_location: "",
  loading_date: new Date().toISOString().split('T')[0], unloading_date: new Date().toISOString().split('T')[0],
  loading_weight: null, unloading_weight: null, current_cost: null, license_plate: "", driver_phone: "",
  transport_type: "实际运输", extra_cost: null, payable_cost: null, remarks: ""
};
type FormAction =
  | { type: 'SET_FIELD'; field: keyof LogisticsFormData; payload: any }
  | { type: 'SET_DRIVER'; payload: Driver }
  | { type: 'CALCULATE_PAYABLE' }
  | { type: 'RESET'; payload: Partial<LogisticsFormData> }
  | { type: 'LOAD_RECORD'; payload: LogisticsRecord };
const formReducer = (state: LogisticsFormData, action: FormAction): LogisticsFormData => {
  switch (action.type) {
    case 'SET_FIELD': return { ...state, [action.field]: action.payload };
    case 'SET_DRIVER': return { ...state, driver_id: action.payload.id, driver_name: action.payload.name, license_plate: action.payload.license_plate, driver_phone: action.payload.phone };
    case 'CALCULATE_PAYABLE': { const currentCost = parseFloat(state.current_cost || '0'); const extraCost = parseFloat(state.extra_cost || '0'); const total = currentCost + extraCost; return { ...state, payable_cost: total > 0 ? total.toFixed(2) : null }; }
    case 'RESET': return { ...BLANK_FORM_DATA, ...action.payload };
    case 'LOAD_RECORD': { const record = action.payload; return { project_id: record.project_id, chain_id: record.chain_id || null, driver_id: record.driver_id, driver_name: record.driver_name, loading_location: record.loading_location, unloading_location: record.unloading_location, loading_date: record.loading_date.split('T')[0], unloading_date: (record.unloading_date || record.loading_date).split('T')[0], loading_weight: record.loading_weight?.toString() || null, unloading_weight: record.unloading_weight?.toString() || null, current_cost: record.current_cost?.toString() || null, license_plate: record.license_plate, driver_phone: record.driver_phone, transport_type: record.transport_type || '实际运输', extra_cost: record.extra_cost?.toString() || null, payable_cost: record.payable_cost?.toString() || null, remarks: record.remarks }; }
    default: return state;
  }
};


export function useLogisticsForm(projects: Project[], onFormSuccess: () => void) {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LogisticsRecord | null>(null);
  const [formData, dispatch] = useReducer(formReducer, BLANK_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ... (其他 useEffect 保持不变)
  useEffect(() => { dispatch({ type: 'CALCULATE_PAYABLE' }); }, [formData.current_cost, formData.extra_cost]);
  useEffect(() => { if (formData.loading_date && !formData.unloading_date) { dispatch({ type: 'SET_FIELD', field: 'unloading_date', payload: formData.loading_date }); } }, [formData.loading_date, formData.unloading_date]);

  const handleOpenModal = useCallback((record: LogisticsRecord | null = null) => {
    if (record) {
      setEditingRecord(record);
      dispatch({ type: 'LOAD_RECORD', payload: record });
    } else {
      const latestProject = projects.length > 0 ? [...projects].sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''))[0] : null;
      setEditingRecord(null);
      dispatch({ type: 'RESET', payload: { project_id: latestProject ? latestProject.id : "" } });
    }
    setIsModalOpen(true);
  }, [projects]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const projectName = projects.find(p => p.id === formData.project_id)?.name;
    if (!projectName || !formData.driver_name || !formData.loading_location || !formData.unloading_location) {
      toast({ title: "错误", description: "项目、司机和地点为必填项", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    try {
      // [核心重写] - 调用新的RPC函数处理司机和地点
      const { data: driverId, error: driverError } = await supabase.rpc('get_or_create_driver_and_link_project', {
        p_driver_name: formData.driver_name, p_license_plate: formData.license_plate,
        p_phone: formData.driver_phone, p_project_id: formData.project_id
      });
      if (driverError) throw driverError;

      await Promise.all([
        supabase.rpc('get_or_create_location_and_link_project', { p_location_name: formData.loading_location, p_project_id: formData.project_id }),
        supabase.rpc('get_or_create_location_and_link_project', { p_location_name: formData.unloading_location, p_project_id: formData.project_id })
      ]);

      const recordData = {
        p_project_id: formData.project_id, p_project_name: projectName, p_chain_id: formData.chain_id || null,
        p_driver_id: driverId, // 使用返回的ID
        p_driver_name: formData.driver_name, p_loading_location: formData.loading_location, p_unloading_location: formData.unloading_location,
        p_loading_date: formData.loading_date, p_unloading_date: formData.unloading_date || formData.loading_date,
        p_loading_weight: formData.loading_weight ? parseFloat(formData.loading_weight) : null,
        p_unloading_weight: formData.unloading_weight ? parseFloat(formData.unloading_weight) : null,
        p_current_cost: formData.current_cost ? parseFloat(formData.current_cost) : null,
        p_license_plate: formData.license_plate, p_driver_phone: formData.driver_phone, p_transport_type: formData.transport_type,
        p_extra_cost: formData.extra_cost ? parseFloat(formData.extra_cost) : null, p_remarks: formData.remarks
      };

      if (editingRecord) {
        await supabase.rpc('update_logistics_record_with_costs', { p_record_id: editingRecord.id, ...recordData });
        toast({ title: "成功", description: "运单记录已更新" });
      } else {
        await supabase.rpc('add_logistics_record_with_costs', recordData);
        toast({ title: "成功", description: "新运单已添加" });
      }
      setIsModalOpen(false);
      onFormSuccess();
    } catch (error: any) {
      toast({ title: "操作失败", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isModalOpen, editingRecord, formData, dispatch, handleOpenModal, setIsModalOpen, handleSubmit, isSubmitting,
  };
}
