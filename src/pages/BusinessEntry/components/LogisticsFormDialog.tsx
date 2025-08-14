// 文件路径: src/pages/BusinessEntry/components/LogisticsFormDialog.tsx
// 描述: [功能优化] 此版本根据用户要求，将司机和地点的输入框
//       从可创建的复合输入框（ReactSelectCreatable）修改为标准的下拉菜单（Select）。
//       下拉菜单中的选项会根据所选项目动态加载，只显示与该项目相关的司机和地点。

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
import { LogisticsRecord, Project, PartnerChain, Driver, Location, BillingType } from '../types';

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
  const [billingTypes, setBillingTypes] = useState<BillingType[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);

  // [新] 为下拉菜单提供数据源
  const [projectDrivers, setProjectDrivers] = useState<Driver[]>([]);
  const [projectLocations, setProjectLocations] = useState<string[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);


  // 初始化或当编辑记录变化时，更新表单数据
  useEffect(() => {
    if (isOpen) {
      setFormData(editingRecord || { transport_type: '实际运输' });
    }
  }, [editingRecord, isOpen]);

  // 当弹窗打开时，获取所有计费模式
  useEffect(() => {
    const fetchBillingTypes = async () => {
      const { data, error } = await supabase.from('billing_types').select('*');
      if (error) {
        toast({ title: "加载计费模式失败", description: error.message, variant: "destructive" });
      } else {
        setBillingTypes(data || []);
      }
    };
    if (isOpen) {
      fetchBillingTypes();
    }
  }, [isOpen, toast]);

  // 当项目选择变化时，加载对应的合作链路、司机和地点
  useEffect(() => {
    const fetchProjectSpecificData = async () => {
      if (!formData.project_id) {
        setChains([]);
        setProjectDrivers([]);
        setProjectLocations([]);
        return;
      }

      setIsLoadingOptions(true);

      // 并行获取数据
      const [chainsRes, driversRes, locationsRes] = await Promise.all([
        supabase.from('partner_chains').select('*').eq('project_id', formData.project_id),
        supabase.rpc('get_distinct_drivers_for_project', { p_project_id: formData.project_id }),
        supabase.rpc('get_distinct_locations_for_project', { p_project_id: formData.project_id })
      ]);

      // 处理合作链路
      if (chainsRes.error) {
        toast({ title: "加载合作链路失败", description: chainsRes.error.message, variant: "destructive" });
      } else {
        setChains(chainsRes.data || []);
      }

      // 处理司机
      if (driversRes.error) {
        toast({ title: "加载项目司机失败", description: driversRes.error.message, variant: "destructive" });
      } else {
        setProjectDrivers(driversRes.data || []);
      }

      // 处理地点
      if (locationsRes.error) {
        toast({ title: "加载项目地点失败", description: locationsRes.error.message, variant: "destructive" });
      } else {
        setProjectLocations(locationsRes.data || []);
      }
      
      setIsLoadingOptions(false);
    };

    fetchProjectSpecificData();
  }, [formData.project_id, toast]);

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // [新] 当从下拉菜单选择司机时，自动填充相关信息
  const handleDriverSelect = (driverId: string) => {
    const selectedDriver = projectDrivers.find(d => d.id === driverId);
    if (selectedDriver) {
      setFormData(prev => ({
        ...prev,
        driver_id: selectedDriver.id,
        driver_name: selectedDriver.name,
        driver_phone: selectedDriver.phone,
        license_plate: selectedDriver.license_plate
      }));
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

  const handleSubmit = () => { callUpsertRpc(false); };
  const handleForceSubmit = () => { setShowDuplicateConfirm(false); callUpsertRpc(true); };

  const selectedChain = chains.find(c => c.id === formData.chain_id);
  const selectedBillingTypeName = billingTypes.find(bt => bt.billing_type_id === selectedChain?.billing_type_id)?.name;

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
              <Select value={formData.chain_id} onValueChange={(value) => handleInputChange('chain_id', value)} disabled={!formData.project_id}>
                <SelectTrigger><SelectValue placeholder="选择合作链路" /></SelectTrigger>
                <SelectContent>{chains.map(c => <SelectItem key={c.id} value={c.id}>{c.chain_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>计费模式 (自动关联)</Label>
              <Input value={selectedBillingTypeName || '选择链路后自动确定'} disabled className="font-medium" />
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
            
            {/* [修改] 司机信息改为下拉菜单 */}
            <div className="space-y-2 col-span-2">
              <Label>司机信息</Label>
              <Select onValueChange={handleDriverSelect} value={formData.driver_id} disabled={!formData.project_id || isLoadingOptions}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingOptions ? "加载中..." : "选择项目关联的司机"} />
                </SelectTrigger>
                <SelectContent>
                  {projectDrivers.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} ({d.phone}) - {d.license_plate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* [修改] 地点改为下拉菜单 */}
            <div className="space-y-2">
              <Label>装货地点</Label>
              <Select onValueChange={(value) => handleInputChange('loading_location', value)} value={formData.loading_location} disabled={!formData.project_id || isLoadingOptions}>
                 <SelectTrigger>
                  <SelectValue placeholder={isLoadingOptions ? "加载中..." : "选择项目关联的地点"} />
                </SelectTrigger>
                <SelectContent>
                  {projectLocations.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>卸货地点</Label>
              <Select onValueChange={(value) => handleInputChange('unloading_location', value)} value={formData.unloading_location} disabled={!formData.project_id || isLoadingOptions}>
                 <SelectTrigger>
                  <SelectValue placeholder={isLoadingOptions ? "加载中..." : "选择项目关联的地点"} />
                </SelectTrigger>
                <SelectContent>
                  {projectLocations.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
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
