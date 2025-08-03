// 正确路径: src/pages/BusinessEntry/components/LogisticsFormDialog.tsx

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { AsyncCreatableCombobox, Option } from './AsyncCreatableCombobox';
import { LogisticsFormData, Project, PartnerChain, Driver } from '../types';

interface LogisticsFormDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  editingRecord: any;
  formData: LogisticsFormData;
  dispatch: React.Dispatch<any>;
  projects: Project[];
  partnerChains: PartnerChain[];
}

export function LogisticsFormDialog({ isOpen, onOpenChange, onSubmit, isSubmitting, editingRecord, formData, dispatch, projects, partnerChains }: LogisticsFormDialogProps) {
  const handleInputChange = (field: keyof LogisticsFormData, value: any) => {
    dispatch({ type: 'SET_FIELD', field, payload: value });
  };

  const handleDriverChange = (option: Option | null, rawValue: string) => {
    if (option) {
      dispatch({ type: 'SET_DRIVER', payload: option as unknown as Driver });
    } else {
      dispatch({ type: 'SET_FIELD', field: 'driver_name', payload: rawValue });
      dispatch({ type: 'SET_FIELD', field: 'driver_id', payload: rawValue });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader><DialogTitle>{editingRecord ? "编辑运单" : "新增运单"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-4 gap-x-6 gap-y-4 py-4">
          <div className="col-span-1 space-y-1"><Label>项目 *</Label><Select value={formData.project_id} onValueChange={(v) => handleInputChange('project_id', v)} disabled={isSubmitting}><SelectTrigger><SelectValue placeholder="请选择项目" /></SelectTrigger><SelectContent>{(projects || []).map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent></Select></div>
          <div className="col-span-1 space-y-1"><Label>合作链路</Label><Select value={formData.chain_id || ''} onValueChange={(v) => handleInputChange('chain_id', v)} disabled={!formData.project_id || isSubmitting}><SelectTrigger><SelectValue placeholder="默认链路" /></SelectTrigger><SelectContent>{(partnerChains || []).map(c => (<SelectItem key={c.id} value={c.id}>{c.chain_name}</SelectItem>))}</SelectContent></Select></div>
          <div className="col-span-1 space-y-1"><Label>装货日期 *</Label><Input type="date" value={formData.loading_date} onChange={(e) => handleInputChange('loading_date', e.target.value)} disabled={isSubmitting} /></div>
          <div className="col-span-1 space-y-1"><Label>卸货日期</Label><Input type="date" value={formData.unloading_date} onChange={(e) => handleInputChange('unloading_date', e.target.value)} disabled={isSubmitting} /></div>
          
          <div className="col-span-1 space-y-1">
            <Label>司机 *</Label>
            {/* [核心重写] - 传递 projectId */}
            <AsyncCreatableCombobox value={formData.driver_name} onValueChange={handleDriverChange} tableName="drivers" searchColumn="name" placeholder="选择或创建司机" searchPlaceholder="搜索司机..." projectId={formData.project_id} disabled={isSubmitting} />
          </div>
          <div className="col-span-1 space-y-1"><Label>车牌号</Label><Input value={formData.license_plate || ''} onChange={(e) => handleInputChange('license_plate', e.target.value)} disabled={isSubmitting} /></div>
          <div className="col-span-1 space-y-1"><Label>司机电话</Label><Input value={formData.driver_phone || ''} onChange={(e) => handleInputChange('driver_phone', e.target.value)} disabled={isSubmitting} /></div>
          <div className="col-span-1 space-y-1"><Label>运输类型</Label><Select value={formData.transport_type} onValueChange={(v) => handleInputChange('transport_type', v)} disabled={isSubmitting}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="实际运输">实际运输</SelectItem><SelectItem value="退货">退货</SelectItem></SelectContent></Select></div>
          
          <div className="col-span-1 space-y-1">
            <Label>装货地点 *</Label>
            {/* [核心重写] - 传递 projectId */}
            <AsyncCreatableCombobox value={formData.loading_location} onValueChange={(_, rawValue) => handleInputChange('loading_location', rawValue)} tableName="locations" searchColumn="name" placeholder="选择或创建地点" searchPlaceholder="搜索地点..." projectId={formData.project_id} disabled={isSubmitting} />
          </div>
          <div className="col-span-1 space-y-1"><Label>装货重量</Label><Input type="number" placeholder="吨" value={formData.loading_weight || ''} onChange={(e) => handleInputChange('loading_weight', e.target.value)} disabled={isSubmitting} /></div>
          
          <div className="col-span-1 space-y-1">
            <Label>卸货地点 *</Label>
            {/* [核心重写] - 传递 projectId */}
            <AsyncCreatableCombobox value={formData.unloading_location} onValueChange={(_, rawValue) => handleInputChange('unloading_location', rawValue)} tableName="locations" searchColumn="name" placeholder="选择或创建地点" searchPlaceholder="搜索地点..." projectId={formData.project_id} disabled={isSubmitting} />
          </div>
          <div className="col-span-1 space-y-1"><Label>卸货重量</Label><Input type="number" placeholder="吨" value={formData.unloading_weight || ''} onChange={(e) => handleInputChange('unloading_weight', e.target.value)} disabled={isSubmitting} /></div>
          <div className="col-span-1 space-y-1"><Label>运费金额 (元)</Label><Input type="number" value={formData.current_cost || ''} onChange={(e) => handleInputChange('current_cost', e.target.value)} disabled={isSubmitting} /></div>
          <div className="col-span-1 space-y-1"><Label>额外费用 (元)</Label><Input type="number" value={formData.extra_cost || ''} onChange={(e) => handleInputChange('extra_cost', e.target.value)} disabled={isSubmitting} /></div>
          <div className="col-span-2 row-span-2 space-y-1"><Label>备注</Label><Textarea className="h-24" value={formData.remarks || ''} onChange={(e) => handleInputChange('remarks', e.target.value)} disabled={isSubmitting} /></div>
          <div className="col-span-2 space-y-1 self-end"><Label>司机应收 (自动计算)</Label><Input type="number" value={formData.payable_cost || ''} disabled className="font-bold text-primary" /></div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>取消</Button>
          <Button type="submit" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
