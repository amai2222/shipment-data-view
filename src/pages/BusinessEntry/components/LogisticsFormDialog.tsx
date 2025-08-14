// 文件路径: src/pages/BusinessEntry/components/LogisticsFormDialog.tsx
// 描述: [功能完整版] 此版本包含了所有业务所需的表单字段，
//       并与最终的 `upsert_logistics_record` 数据库函数完全对接。

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LogisticsRecord, Project, PartnerChain, Driver, Location } from '../types';
import { useDebounce } from '../hooks/use-debounce';
import { ReactSelectCreatable } from './ReactSelectCreatable'; // 引入可创建的下拉框组件

type FormData = Partial<LogisticsRecord>;

interface LogisticsFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editingRecord: LogisticsRecord | null;
  projects: Project[];
  onSubmitSuccess: () => void;
}

export const LogisticsFormDialog: React.FC<LogisticsFormDialogProps> = ({
  isOpen,
  onClose,
  editingRecord,
  projects,
  onSubmitSuccess,
}) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<FormData>({});
  const [chains, setChains] = useState<PartnerChain[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);

  // --- State for Creatable Selects ---
  const [driverOptions, setDriverOptions] = useState<{ label: string; value: string; }[]>([]);
  const [locationOptions, setLocationOptions] = useState<{ label: string; value: string; }[]>([]);
  const [driverSearchTerm, setDriverSearchTerm] = useState('');
  const [locationSearchTerm, setLocationSearchTerm] = useState('');
  const debouncedDriverSearch = useDebounce(driverSearchTerm, 300);
  const debouncedLocationSearch = useDebounce(locationSearchTerm, 300);

  // 初始化或当编辑记录变化时，更新表单数据
  useEffect(() => {
    if (isOpen) {
      setFormData(editingRecord || { transport_type: '实际运输' });
    }
  }, [editingRecord, isOpen]);

  // 当项目选择变化时，加载对应的合作链路
  useEffect(() => {
    const fetchChains = async () => {
      if (!formData.project_id) {
        setChains([]);
        return;
      }
      const { data, error } = await supabase
        .from('partner_chains')
        .select('*')
        .eq('project_id', formData.project_id);
      if (error) {
        toast({ title: "加载合作链路失败", description: error.message, variant: "destructive" });
      } else {
        setChains(data || []);
      }
    };
    fetchChains();
  }, [formData.project_id, toast]);

  // --- Fetch options for Creatable Selects ---
  const fetchDrivers = useCallback(async (searchTerm: string) => {
    const { data, error } = await supabase
      .from('drivers')
      .select('name, phone, license_plate')
      .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,license_plate.ilike.%${searchTerm}%`)
      .limit(10);
    if (data) {
      setDriverOptions(data.map(d => ({
        label: `${d.name} (${d.phone}) - ${d.license_plate}`,
        value: JSON.stringify(d) // Store full object
      })));
    }
  }, []);

  const fetchLocations = useCallback(async (searchTerm: string) => {
    const { data, error } = await supabase
      .from('locations')
      .select('name')
      .ilike('name', `%${searchTerm}%`)
      .limit(10);
    if (data) {
      setLocationOptions(data.map(l => ({ label: l.name, value: l.name })));
    }
  }, []);

  useEffect(() => {
    if (debouncedDriverSearch) fetchDrivers(debouncedDriverSearch);
  }, [debouncedDriverSearch, fetchDrivers]);

  useEffect(() => {
    if (debouncedLocationSearch) fetchLocations(debouncedLocationSearch);
  }, [debouncedLocationSearch, fetchLocations]);

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleDriverSelect = (selectedOption: any) => {
      if (selectedOption) {
          try {
              const driver = JSON.parse(selectedOption.value);
              setFormData(prev => ({
                  ...prev,
                  driver_name: driver.name,
                  driver_phone: driver.phone,
                  license_plate: driver.license_plate
              }));
          } catch(e) {
              // Handle new driver creation
              setFormData(prev => ({ ...prev, driver_name: selectedOption.value }));
          }
      }
  };

  const callUpsertRpc = async (forceInsert = false) => {
    setIsSaving(true);
    try {
      if (!formData.project_id || !formData.loading_date) {
        throw new Error("项目和装货日期是必填项。");
      }

      const { data, error } = await supabase.rpc('upsert_logistics_record', {
        p_record_id: formData.id || null,
        p_project_id: formData.project_id,
        p_chain_id: formData.chain_id,
        p_driver_name: formData.driver_name,
        p_driver_phone: formData.driver_phone,
        p_license_plate: formData.license_plate,
        p_loading_location: formData.loading_location,
        p_unloading_location: formData.unloading_location,
        p_loading_date: formData.loading_date,
        p_unloading_date: formData.unloading_date,
        p_loading_weight: formData.loading_weight,
        p_unloading_weight: formData.unloading_weight,
        p_current_cost: formData.current_cost,
        p_extra_cost: formData.extra_cost,
        p_transport_type: formData.transport_type,
        p_remarks: formData.remarks,
        p_force_insert: forceInsert,
      }).single();

      if (error) throw error;

      const result = data as { status: string; message: string; record_id: string };

      if (result.status === 'duplicate') {
        setShowDuplicateConfirm(true);
      } else if (result.status === 'success') {
        toast({ title: "成功", description: result.message });
        onClose();
        onSubmitSuccess();
      } else {
        throw new Error(result.message || "发生未知错误");
      }
    } catch (error: any) {
      toast({ title: "保存失败", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = () => {
    callUpsertRpc(false);
  };

  const handleForceSubmit = () => {
    setShowDuplicateConfirm(false);
    callUpsertRpc(true);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingRecord ? '编辑运单' : '新增运单'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
            <div className="space-y-2">
              <Label>项目*</Label>
              <Select value={formData.project_id} onValueChange={(value) => handleInputChange('project_id', value)}>
                <SelectTrigger><SelectValue placeholder="选择项目" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>合作链路</Label>
              <Select value={formData.chain_id} onValueChange={(value) => handleInputChange('chain_id', value)}>
                <SelectTrigger><SelectValue placeholder="选择合作链路" /></SelectTrigger>
                <SelectContent>{chains.map(c => <SelectItem key={c.id} value={c.id}>{c.chain_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>运输类型</Label>
              <Select value={formData.transport_type} onValueChange={(value) => handleInputChange('transport_type', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="实际运输">实际运输</SelectItem>
                  <SelectItem value="退货运输">退货运输</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>司机信息 (姓名/电话/车牌)</Label>
              <ReactSelectCreatable
                options={driverOptions}
                onInputChange={setDriverSearchTerm}
                onChange={handleDriverSelect}
                placeholder="搜索或创建新司机..."
              />
            </div>
            <div className="space-y-2">
              <Label>装货地点</Label>
              <ReactSelectCreatable
                options={locationOptions}
                onInputChange={setLocationSearchTerm}
                onChange={(opt) => handleInputChange('loading_location', opt?.value)}
                placeholder="搜索或创建新地点..."
              />
            </div>
            <div className="space-y-2">
              <Label>卸货地点</Label>
               <ReactSelectCreatable
                options={locationOptions}
                onInputChange={setLocationSearchTerm}
                onChange={(opt) => handleInputChange('unloading_location', opt?.value)}
                placeholder="搜索或创建新地点..."
              />
            </div>
            <div className="space-y-2">
              <Label>装货日期*</Label>
              <Input type="date" value={formData.loading_date || ''} onChange={(e) => handleInputChange('loading_date', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>卸货日期</Label>
              <Input type="date" value={formData.unloading_date || ''} onChange={(e) => handleInputChange('unloading_date', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>装货重量</Label>
              <Input type="number" value={formData.loading_weight || ''} onChange={(e) => handleInputChange('loading_weight', e.target.value ? parseFloat(e.target.value) : null)} />
            </div>
            <div className="space-y-2">
              <Label>卸货重量</Label>
              <Input type="number" value={formData.unloading_weight || ''} onChange={(e) => handleInputChange('unloading_weight', e.target.value ? parseFloat(e.target.value) : null)} />
            </div>
            <div className="space-y-2">
              <Label>运费金额</Label>
              <Input type="number" value={formData.current_cost || ''} onChange={(e) => handleInputChange('current_cost', e.target.value ? parseFloat(e.target.value) : null)} />
            </div>
            <div className="space-y-2">
              <Label>额外费用</Label>
              <Input type="number" value={formData.extra_cost || ''} onChange={(e) => handleInputChange('extra_cost', e.target.value ? parseFloat(e.target.value) : null)} />
            </div>
            <div className="space-y-2 col-span-full">
              <Label>备注</Label>
              <Textarea value={formData.remarks || ''} onChange={(e) => handleInputChange('remarks', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">取消</Button></DialogClose>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={showDuplicateConfirm}
        onClose={() => setShowDuplicateConfirm(false)}
        onConfirm={handleForceSubmit}
        title="发现重复记录"
        description="数据库中已存在一条关键字段完全相同的记录，您确定要继续创建这条新的运单吗？"
      />
    </>
  );
};
