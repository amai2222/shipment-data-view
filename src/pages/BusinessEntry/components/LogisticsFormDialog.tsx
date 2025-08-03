// src/pages/BusinessEntry/components/LogisticsFormDialog.tsx

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CreatableCombobox } from "@/components/CreatableCombobox";
import { LogisticsFormData, Project, Driver, Location, PartnerChain } from '../types';

interface LogisticsFormDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  editingRecord: any;
  formData: LogisticsFormData;
  dispatch: React.Dispatch<any>;
  projects: Project[];
  filteredDrivers: Driver[];
  filteredLocations: Location[];
  partnerChains: PartnerChain[];
}

export function LogisticsFormDialog({ isOpen, onOpenChange, onSubmit, editingRecord, formData, dispatch, projects, filteredDrivers, filteredLocations, partnerChains }: LogisticsFormDialogProps) {
  const navigate = useNavigate();
  const handleInputChange = (field: keyof LogisticsFormData, value: any) => {
    dispatch({ type: 'SET_FIELD', field, payload: value });
  };

  // Defensive mapping: Ensure options are always an array before mapping.
  const driverOptions = (filteredDrivers || []).map(d => ({ value: d.id, label: `${d.name} (${d.license_plate || '无车牌'})` }));
  const locationOptions = (filteredLocations || []).map(l => ({ value: l.name, label: l.name }));
  const chainOptions = (partnerChains || []).map(c => (<SelectItem key={c.id} value={c.id}>{c.chain_name}</SelectItem>));
  const projectOptions = (projects || []).map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>));

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader><DialogTitle>{editingRecord ? "编辑运单" : "新增运单"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-4 gap-4 py-4">
          <div className="space-y-1"><Label>项目 *</Label><Select value={formData.project_id} onValueChange={(v) => handleInputChange('project_id', v)}><SelectTrigger><SelectValue placeholder="请选择项目" /></SelectTrigger><SelectContent>{projectOptions}</SelectContent></Select></div>
          <div className="space-y-1"><Label>合作链路</Label><Select value={formData.chain_id || ''} onValueChange={(v) => handleInputChange('chain_id', v)} disabled={!formData.project_id}><SelectTrigger><SelectValue placeholder="默认链路" /></SelectTrigger><SelectContent>{chainOptions}</SelectContent></Select></div>
          <div className="space-y-1"><Label>装货日期 *</Label><Input type="date" value={formData.loading_date} onChange={(e) => handleInputChange('loading_date', e.target.value)} /></div>
          <div className="space-y-1"><Label>卸货日期</Label><Input type="date" value={formData.unloading_date} onChange={(e) => handleInputChange('unloading_date', e.target.value)} /></div>
          <div className="space-y-1"><Label>司机 *</Label><CreatableCombobox options={driverOptions} value={formData.driver_id} onValueChange={(value) => { const driver = filteredDrivers.find(d => d.id === value); if (driver) { dispatch({ type: 'SET_DRIVER', payload: driver }); } else { handleInputChange('driver_id', value); handleInputChange('driver_name', value); } }} placeholder="选择或创建司机" searchPlaceholder="搜索或输入新司机..." onCreateNew={() => navigate('/drivers')} /></div>
          <div className="space-y-1"><Label>车牌号</Label><Input value={formData.license_plate || ''} onChange={(e) => handleInputChange('license_plate', e.target.value)} /></div>
          <div className="space-y-1"><Label>司机电话</Label><Input value={formData.driver_phone || ''} onChange={(e) => handleInputChange('driver_phone', e.target.value)} /></div>
          <div className="space-y-1"><Label>运输类型</Label><Select value={formData.transport_type} onValueChange={(v) => handleInputChange('transport_type', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="实际运输">实际运输</SelectItem><SelectItem value="退货">退货</SelectItem></SelectContent></Select></div>
          <div className="space-y-1"><Label>装货地点 *</Label><CreatableCombobox options={locationOptions} value={formData.loading_location} onValueChange={(value) => handleInputChange('loading_location', value)} placeholder="选择或创建地点" searchPlaceholder="搜索或输入新地点..." onCreateNew={() => navigate('/locations')} /></div>
          <div className="space-y-1"><Label>装货重量</Label><Input type="number" value={formData.loading_weight || ''} onChange={(e) => handleInputChange('loading_weight', e.target.value)} /></div>
          <div className="space-y-1"><Label>卸货地点 *</Label><CreatableCombobox options={locationOptions} value={formData.unloading_location} onValueChange={(value) => handleInputChange('unloading_location', value)} placeholder="选择或创建地点" searchPlaceholder="搜索或输入新地点..." onCreateNew={() => navigate('/locations')} /></div>
          <div className="space-y-1"><Label>卸货重量</Label><Input type="number" value={formData.unloading_weight || ''} onChange={(e) => handleInputChange('unloading_weight', e.target.value)} /></div>
          <div className="space-y-1"><Label>运费金额 (元)</Label><Input type="number" value={formData.current_cost || ''} onChange={(e) => handleInputChange('current_cost', e.target.value)} /></div>
          <div className="space-y-1"><Label>额外费用 (元)</Label><Input type="number" value={formData.extra_cost || ''} onChange={(e) => handleInputChange('extra_cost', e.target.value)} /></div>
          <div className="space-y-1 col-span-2"><Label>备注</Label><Textarea value={formData.remarks || ''} onChange={(e) => handleInputChange('remarks', e.target.value)} /></div>
          <div className="space-y-1 col-start-4"><Label>司机应收 (自动计算)</Label><Input type="number" value={formData.payable_cost || ''} disabled className="font-bold text-primary" /></div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>取消</Button>
          <Button type="submit" onClick={onSubmit}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
