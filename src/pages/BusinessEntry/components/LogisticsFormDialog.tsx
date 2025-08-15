// 最终文件路径: src/pages/BusinessEntry/components/LogisticsFormDialog.tsx

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LogisticsRecord, Project } from '../types';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

interface Driver { id: string; name: string; license_plate: string | null; phone: string | null; }
interface Location { id: string; name: string; }
interface PartnerChain { id: string; chain_name: string; billing_type_id: number | null; is_default: boolean; }
interface LogisticsFormDialogProps { isOpen: boolean; onClose: () => void; editingRecord?: LogisticsRecord | null; projects: Project[]; onSubmitSuccess: () => void; }

// [修改] FormData 现在存储 ID
interface FormData {
  projectId: string;
  chainId: string;
  driverId: string;
  loadingLocationId: string;
  unloadingLocationId: string;
  loadingDate: Date | undefined;
  unloadingDate: Date | undefined;
  licensePlate: string;
  driverPhone: string;
  loading_weight: string;
  unloading_weight: string;
  transportType: string;
  currentCost: string;
  extraCost: string;
  remarks: string;
}

const INITIAL_FORM_DATA: FormData = {
  projectId: '',
  chainId: '',
  driverId: '',
  loadingLocationId: '',
  unloadingLocationId: '',
  loadingDate: new Date(),
  unloadingDate: new Date(),
  licensePlate: '',
  driverPhone: '',
  loading_weight: '',
  unloading_weight: '',
  transportType: '实际运输',
  currentCost: '',
  extraCost: '',
  remarks: '',
};

export function LogisticsFormDialog({ isOpen, onClose, editingRecord, projects, onSubmitSuccess }: LogisticsFormDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [chains, setChains] = useState<PartnerChain[]>([]);
  const [loading, setLoading] = useState(false);

  const selectedChain = useMemo(() => chains.find(c => c.id === formData.chainId), [chains, formData.chainId]);
  const billingTypeId = selectedChain?.billing_type_id || 1;

  const quantityLabel = useMemo(() => {
    if (billingTypeId === 2) return '发车次数';
    if (billingTypeId === 3) return '体积(立方)';
    return '重量(吨)';
  }, [billingTypeId]);

  const driverReceivable = useMemo(() => {
    const current = parseFloat(formData.currentCost) || 0;
    const extra = parseFloat(formData.extraCost) || 0;
    return current + extra;
  }, [formData.currentCost, formData.extraCost]);

  useEffect(() => {
    if (isOpen) {
      if (editingRecord) {
        populateFormWithRecord(editingRecord);
      } else {
        setFormData(INITIAL_FORM_DATA);
      }
    }
  }, [isOpen, editingRecord]);

  useEffect(() => {
    if (formData.projectId) {
      loadProjectSpecificData(formData.projectId);
    } else {
      setChains([]);
      setDrivers([]);
      setLocations([]);
      setFormData(prev => ({ ...prev, chainId: '', driverId: '', loadingLocationId: '', unloadingLocationId: '' }));
    }
  }, [formData.projectId]);

  useEffect(() => {
    if (chains.length > 0) {
      if (editingRecord && editingRecord.chain_id) {
        setFormData(prev => ({ ...prev, chainId: editingRecord.chain_id || '' }));
      } else if (!editingRecord) {
        const defaultChain = chains.find(c => c.is_default);
        if (defaultChain) setFormData(prev => ({ ...prev, chainId: defaultChain.id }));
      }
    }
  }, [chains, editingRecord]);

  const loadProjectSpecificData = async (projectId: string) => {
    try {
      const [driversRes, locationsRes, chainsRes] = await Promise.all([
        supabase.rpc('get_drivers_for_project', { p_project_id: projectId }),
        supabase.rpc('get_locations_for_project', { p_project_id: projectId }),
        supabase.from('partner_chains').select('id, chain_name, billing_type_id, is_default').eq('project_id', projectId)
      ]);

      if (driversRes.error) throw driversRes.error;
      if (locationsRes.error) throw locationsRes.error;
      if (chainsRes.error) throw chainsRes.error;

      setDrivers(driversRes.data || []);
      setLocations(locationsRes.data || []);
      setChains(chainsRes.data || []);
    } catch (error) {
      toast({ title: "错误", description: "加载项目关联数据失败", variant: "destructive" });
    }
  };

  const populateFormWithRecord = (record: LogisticsRecord) => {
    setFormData({
      projectId: record.project_id || '',
      chainId: record.chain_id || '',
      driverId: record.driver_id || '',
      loadingLocationId: record.loading_location_id || '',
      unloadingLocationId: record.unloading_location_id || '',
      loadingDate: record.loading_date ? new Date(record.loading_date) : new Date(),
      unloadingDate: record.unloading_date ? new Date(record.unloading_date) : new Date(),
      licensePlate: record.license_plate || '',
      driverPhone: record.driver_phone || '',
      loading_weight: record.loading_weight?.toString() || '',
      unloading_weight: record.unloading_weight?.toString() || '',
      transportType: record.transport_type || '实际运输',
      currentCost: record.current_cost?.toString() || '',
      extraCost: record.extra_cost?.toString() || '',
      remarks: record.remarks || '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectId || !formData.driverId || !formData.loadingLocationId || !formData.unloadingLocationId || !formData.loadingDate) {
      toast({ title: "验证失败", description: "项目、司机和地点等必填项不能为空。", variant: "destructive" });
      return;
    }
    setLoading(true);

    try {
      const p_record = {
        project_id: formData.projectId,
        chain_id: formData.chainId,
        driver_id: formData.driverId,
        loading_location_id: formData.loadingLocationId,
        unloading_location_id: formData.unloadingLocationId,
        loading_date: formData.loadingDate.toISOString(),
        unloading_date: formData.unloadingDate ? formData.unloadingDate.toISOString() : null,
        license_plate: formData.licensePlate,
        driver_phone: formData.driverPhone,
        loading_weight: formData.loading_weight,
        unloading_weight: formData.unloading_weight,
        transport_type: formData.transportType,
        current_cost: formData.currentCost,
        extra_cost: formData.extraCost,
        remarks: formData.remarks,
      };

      if (editingRecord) {
        const { error } = await supabase.rpc('update_single_logistics_record', { p_record_id: editingRecord.id, p_record });
        if (error) throw error;
        toast({ title: "成功", description: "运单已更新" });
      } else {
        const { error } = await supabase.rpc('create_single_logistics_record', { p_record });
        if (error) throw error;
        toast({ title: "成功", description: "运单已创建" });
      }
      onSubmitSuccess();
      onClose();
    } catch (error: any) {
      toast({ title: "保存失败", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // [新增] 当选择司机时，自动填充车牌和电话
  const handleDriverSelect = (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    setFormData(prev => ({
      ...prev,
      driverId: driverId,
      licensePlate: driver?.license_plate || '',
      driverPhone: driver?.phone || ''
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editingRecord ? '编辑运单' : '新增运单'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ... 项目和合作链路部分保持不变 ... */}
            <div>
              <Label>项目 *</Label>
              <Select value={formData.projectId} onValueChange={(value) => setFormData(prev => ({ ...prev, projectId: value }))}>
                <SelectTrigger><SelectValue placeholder="选择项目" /></SelectTrigger>
                <SelectContent>{projects.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>合作链路</Label>
              <Select value={formData.chainId} onValueChange={(value) => setFormData(prev => ({ ...prev, chainId: value }))} disabled={!formData.projectId}>
                <SelectTrigger><SelectValue placeholder="选择合作链路" /></SelectTrigger>
                <SelectContent>{chains.map((c) => (<SelectItem key={c.id} value={c.id}>{c.chain_name}{c.is_default ? ' (默认)' : ''}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            {/* ... 日期部分保持不变 ... */}
            <div>
              <Label>装货日期 *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.loadingDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.loadingDate ? format(formData.loadingDate, "yyyy年MM月dd日", { locale: zhCN }) : "选择日期"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={formData.loadingDate} onSelect={(date) => setFormData(prev => ({ ...prev, loadingDate: date }))} initialFocus locale={zhCN} /></PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>卸货日期</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.unloadingDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.unloadingDate ? format(formData.unloadingDate, "yyyy年MM月dd日", { locale: zhCN }) : "选择日期"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={formData.unloadingDate} onSelect={(date) => setFormData(prev => ({ ...prev, unloadingDate: date }))} initialFocus locale={zhCN} /></PopoverContent>
              </Popover>
            </div>
            
            {/* [修改] 司机改为下拉选择 */}
            <div>
              <Label>司机 *</Label>
              <Select value={formData.driverId} onValueChange={handleDriverSelect} disabled={!formData.projectId}>
                <SelectTrigger><SelectValue placeholder="选择司机" /></SelectTrigger>
                <SelectContent>{drivers.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name} - {d.license_plate || '无车牌'}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>车牌号</Label>
              <Input value={formData.licensePlate} onChange={(e) => setFormData(prev => ({ ...prev, licensePlate: e.target.value }))} placeholder="选择司机后自动填充" />
            </div>
            <div>
              <Label>司机电话</Label>
              <Input value={formData.driverPhone} onChange={(e) => setFormData(prev => ({ ...prev, driverPhone: e.target.value }))} placeholder="选择司机后自动填充" />
            </div>
            {/* ... 运输类型保持不变 ... */}
            <div>
              <Label>运输类型</Label>
              <Select value={formData.transportType} onValueChange={(value) => setFormData(prev => ({ ...prev, transportType: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="实际运输">实际运输</SelectItem><SelectItem value="退货">退货</SelectItem></SelectContent>
              </Select>
            </div>

            {/* [修改] 地点改为下拉选择 */}
            <div>
              <Label>装货地点 *</Label>
              <Select value={formData.loadingLocationId} onValueChange={(value) => setFormData(p => ({ ...p, loadingLocationId: value }))} disabled={!formData.projectId}>
                <SelectTrigger><SelectValue placeholder="选择装货地点" /></SelectTrigger>
                <SelectContent>{locations.map((l) => (<SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>卸货地点 *</Label>
              <Select value={formData.unloadingLocationId} onValueChange={(value) => setFormData(p => ({ ...p, unloadingLocationId: value }))} disabled={!formData.projectId}>
                <SelectTrigger><SelectValue placeholder="选择卸货地点" /></SelectTrigger>
                <SelectContent>{locations.map((l) => (<SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>
          {/* ... 后续表单部分保持不变 ... */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>装货{quantityLabel} *</Label>
              <Input type="number" step="0.01" value={formData.loading_weight} onChange={(e) => setFormData(prev => ({ ...prev, loading_weight: e.target.value }))} placeholder={`输入装货${quantityLabel}`} />
            </div>
            <div>
              <Label>卸货{quantityLabel}</Label>
              <Input type="number" step="0.01" value={formData.unloading_weight} onChange={(e) => setFormData(prev => ({ ...prev, unloading_weight: e.target.value }))} placeholder={`输入卸货${quantityLabel}`} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>运费(元) *</Label>
              <Input type="number" step="0.01" min="0" value={formData.currentCost} onChange={(e) => setFormData(prev => ({ ...prev, currentCost: e.target.value }))} placeholder="输入运费" />
            </div>
            <div>
              <Label>额外费(元)</Label>
              <Input type="number" step="0.01" value={formData.extraCost} onChange={(e) => setFormData(prev => ({ ...prev, extraCost: e.target.value }))} placeholder="输入额外费用，支持负数" />
            </div>
          </div>
          <div>
            <Label className="font-semibold">司机应收(元)</Label>
            <div className="mt-1 px-3 py-2 bg-muted rounded-md font-mono text-primary font-semibold text-lg">¥{driverReceivable.toFixed(2)}</div>
          </div>
          <div>
            <Label>备注</Label>
            <Textarea value={formData.remarks} onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))} placeholder="输入备注信息" rows={3} />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}><X className="mr-2 h-4 w-4" />取消</Button>
            <Button type="submit" disabled={loading}><Save className="mr-2 h-4 w-4" />{loading ? '保存中...' : '保存'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
