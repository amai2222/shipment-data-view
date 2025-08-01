// 文件路径: src/components/business/BusinessEntryEditModal.tsx
// 【绝对纯净最终版】- 已移除所有调试标记，确保语法完整，并包含空值保护

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// --- 类型定义 ---
interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (isForced?: boolean) => void;
  formData: any;
  setFormData: (field: string, value: any) => void;
  projects?: { id: string; name: string }[];
  drivers?: { id: string; name: string }[];
  locations?: { name: string }[];
  partners?: { name: string }[];
  isEditing: boolean;
}

// --- 主组件 ---
export function BusinessEntryEditModal({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  projects,
  drivers,
  locations,
  partners,
  isEditing,
}: EditModalProps) {

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] grid-rows-[auto_1fr_auto] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "编辑运单" : "新增运单"}</DialogTitle>
          <DialogDescription>
            请填写运单的详细信息。所有带 * 的字段为必填项。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 overflow-y-auto px-6">
          {/* 项目名称 (必填) */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="project_name" className="text-right">项目名称 *</Label>
            <Select required value={formData.project_name || ''} onValueChange={(value) => setFormData('project_name', value)}>
              <SelectTrigger className="col-span-3"><SelectValue placeholder="选择项目" /></SelectTrigger>
              <SelectContent>
                {(projects || []).map((p) => (
                  <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 司机姓名 (必填) */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="driver_name" className="text-right">司机姓名 *</Label>
            <Select required value={formData.driver_name || ''} onValueChange={(value) => setFormData('driver_name', value)}>
              <SelectTrigger className="col-span-3"><SelectValue placeholder="选择司机" /></SelectTrigger>
              <SelectContent>
                {(drivers || []).map((d) => (
                  <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* 装货地点 (必填) */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="loading_location" className="text-right">装货地点 *</Label>
            <Select required value={formData.loading_location || ''} onValueChange={(value) => setFormData('loading_location', value)}>
              <SelectTrigger className="col-span-3"><SelectValue placeholder="选择装货地" /></SelectTrigger>
              <SelectContent>
                {(locations || []).map((l, index) => (
                  <SelectItem key={`${l.name}-${index}`} value={l.name}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 卸货地点 (必填) */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="unloading_location" className="text-right">卸货地点 *</Label>
            <Select required value={formData.unloading_location || ''} onValueChange={(value) => setFormData('unloading_location', value)}>
              <SelectTrigger className="col-span-3"><SelectValue placeholder="选择卸货地" /></SelectTrigger>
              <SelectContent>
                {(locations || []).map((l, index) => (
                  <SelectItem key={`${l.name}-${index}`} value={l.name}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 装货日期 (必填) */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="loading_date" className="text-right">装货日期 *</Label>
            <Input id="loading_date" type="date" required value={formData.loading_date || ''} onChange={(e) => setFormData('loading_date', e.target.value)} className="col-span-3" />
          </div>

          {/* 装货重量 (必填) */}
          <div className="grid grid-cols-4 items-center gap-4">
            {/* 这就是之前出错的地方，已修正 */}
            <Label htmlFor="loading_weight" className="text-right">装货重量(吨) *</Label>
            <Input id="loading_weight" type="number" required placeholder="例如: 30.5" value={formData.loading_weight || ''} onChange={(e) => setFormData('loading_weight', e.target.valueAsNumber || null)} className="col-span-3" />
          </div>

          {/* 车牌号 */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="license_plate" className="text-right">车牌号</Label>
            <Input id="license_plate" placeholder="例如: 京A88888" value={formData.license_plate || ''} onChange={(e) => setFormData('license_plate', e.target.value)} className="col-span-3" />
          </div>

          {/* 合作方 */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="cooperative_partner" className="text-right">合作方</Label>
            <Select value={formData.cooperative_partner || ''} onValueChange={(value) => setFormData('cooperative_partner', value)}>
              <SelectTrigger className="col-span-3"><SelectValue placeholder="选择合作方" /></SelectTrigger>
              <SelectContent>
                {(partners || []).map((p, index) => (
                  <SelectItem key={`${p.name}-${index}`} value={p.name}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* 其他可选字段 */}
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="unloading_date" className="text-right">卸货日期</Label>
            <Input id="unloading_date" type="date" value={formData.unloading_date || ''} onChange={(e) => setFormData('unloading_date', e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="unloading_weight" className="text-right">卸货重量(吨)</Label>
            <Input id="unloading_weight" type="number" placeholder="例如: 29.8" value={formData.unloading_weight || ''} onChange={(e) => setFormData('unloading_weight', e.target.valueAsNumber || null)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="current_cost" className="text-right">现付成本(元)</Label>
            <Input id="current_cost" type="number" placeholder="输入金额" value={formData.current_cost || ''} onChange={(e) => setFormData('current_cost', e.target.valueAsNumber || null)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="payable_cost" className="text-right">应付成本(元)</Label>
            <Input id="payable_cost" type="number" placeholder="输入金额" value={formData.payable_cost || ''} onChange={(e) => setFormData('payable_cost', e.target.valueAsNumber || null)} className="col-span-3" />
          </div>

          {/* 备注 */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="remarks" className="text-right pt-2">备注</Label>
            <Textarea id="remarks" placeholder="输入备注信息" value={formData.remarks || ''} onChange={(e) => setFormData('remarks', e.target.value)} className="col-span-3" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={() => onSubmit()}>{isEditing ? "保存更改" : "创建运单"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
