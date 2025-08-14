// 文件路径: src/pages/BusinessEntry/components/LogisticsFormDialog.tsx
// 描述: [最终修复] 此版本重构了表单的提交逻辑。
//       它现在调用全新的 `upsert_logistics_record` 数据库函数，
//       完整实现了您要求的“重复检查”、“查找或创建”和最终保存的全部流程。

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog'; // 假设您有这个确认对话框组件
import { LogisticsRecord, Project, PartnerChain, Driver, Location } from '../types';

// 定义表单数据结构
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
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);

  // 初始化或当编辑记录变化时，更新表单数据
  useEffect(() => {
    if (isOpen) {
      setFormData(editingRecord || {});
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
  
  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
        // 后端发现重复，弹出确认框
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
    callUpsertRpc(false); // 首次提交，不强制插入
  };

  const handleForceSubmit = () => {
    setShowDuplicateConfirm(false);
    callUpsertRpc(true); // 用户确认后，强制插入
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRecord ? '编辑运单' : '新增运单'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4">
            {/* 表单字段... (这里只列出关键字段作为示例) */}
            <div className="space-y-2">
              <Label>项目*</Label>
              <Select value={formData.project_id} onValueChange={(value) => handleInputChange('project_id', value)}>
                <SelectTrigger><SelectValue placeholder="选择项目" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
             <div className="space-y-2">
              <Label>合作链路</Label>
              <Select value={formData.chain_id} onValueChange={(value) => handleInputChange('chain_id', value)}>
                <SelectTrigger><SelectValue placeholder="选择合作链路" /></SelectTrigger>
                <SelectContent>
                  {chains.map(c => <SelectItem key={c.id} value={c.id}>{c.chain_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>装货日期*</Label>
              <Input type="date" value={formData.loading_date || ''} onChange={(e) => handleInputChange('loading_date', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>司机姓名</Label>
              <Input value={formData.driver_name || ''} onChange={(e) => handleInputChange('driver_name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>司机电话</Label>
              <Input value={formData.driver_phone || ''} onChange={(e) => handleInputChange('driver_phone', e.target.value)} />
            </div>
             <div className="space-y-2">
              <Label>车牌号</Label>
              <Input value={formData.license_plate || ''} onChange={(e) => handleInputChange('license_plate', e.target.value)} />
            </div>
            {/* ... 其他表单字段 ... */}
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

      {/* 重复数据确认对话框 */}
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
