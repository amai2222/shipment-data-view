import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CreatableCombobox } from "@/components/CreatableCombobox";

interface Project {
  id: string;
  name: string;
  start_date: string;
}

interface Driver {
  id: string;
  name: string;
  license_plate: string | null;
  phone: string | null;
}

interface Location {
  id: string;
  name: string;
}

interface PartnerChain {
  id: string;
  chain_name: string;
}

interface FormData {
  project_id: string;
  chain_id: string;
  driver_id: string;
  driver_name: string;
  loading_location: string;
  unloading_location: string;
  loading_date: string;
  unloading_date: string;
  loading_weight: number | null;
  unloading_weight: number | null;
  current_cost: number | null;
  license_plate: string;
  driver_phone: string;
  transport_type: string;
  extra_cost: number | null;
  payable_cost: number | null;
  remarks: string;
}

interface BusinessEntryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  formData: FormData;
  onInputChange: (field: string, value: any) => void;
  projects: Project[];
  filteredDrivers: Driver[];
  filteredLocations: Location[];
  partnerChains: PartnerChain[];
  editingRecord: any;
  viewingRecord: any;
}

export function BusinessEntryEditModal({
  isOpen,
  onClose,
  onSubmit,
  formData,
  onInputChange,
  projects,
  filteredDrivers,
  filteredLocations,
  partnerChains,
  editingRecord,
  viewingRecord
}: BusinessEntryEditModalProps) {
  const isViewMode = viewingRecord && !editingRecord;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isViewMode ? '查看运单详情' : editingRecord ? '编辑运单' : '新增运单'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="project">项目名称</Label>
            <Select
              value={formData.project_id}
              onValueChange={(value) => onInputChange('project_id', value)}
              disabled={isViewMode}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择项目" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chain">合作链路</Label>
            <Select
              value={formData.chain_id}
              onValueChange={(value) => onInputChange('chain_id', value)}
              disabled={isViewMode}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择合作链路" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">无</SelectItem>
                {partnerChains.map((chain) => (
                  <SelectItem key={chain.id} value={chain.id}>
                    {chain.chain_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="driver">司机</Label>
            {isViewMode ? (
              <Input
                value={formData.driver_name}
                disabled
              />
            ) : (
              <CreatableCombobox
                options={filteredDrivers.map(d => ({ value: d.id, label: d.name }))}
                value={formData.driver_id}
                onValueChange={(value) => onInputChange('driver_id', value)}
                placeholder="选择或输入司机姓名"
                searchPlaceholder="搜索司机..."
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="license_plate">车牌号</Label>
            <Input
              id="license_plate"
              value={formData.license_plate}
              onChange={(e) => onInputChange('license_plate', e.target.value)}
              placeholder="输入车牌号"
              disabled={isViewMode}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="loading_location">装货地点</Label>
            {isViewMode ? (
              <Input
                value={formData.loading_location}
                disabled
              />
            ) : (
              <CreatableCombobox
                options={filteredLocations.map(l => ({ value: l.name, label: l.name }))}
                value={formData.loading_location}
                onValueChange={(value) => onInputChange('loading_location', value)}
                placeholder="选择或输入装货地点"
                searchPlaceholder="搜索地点..."
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="unloading_location">卸货地点</Label>
            {isViewMode ? (
              <Input
                value={formData.unloading_location}
                disabled
              />
            ) : (
              <CreatableCombobox
                options={filteredLocations.map(l => ({ value: l.name, label: l.name }))}
                value={formData.unloading_location}
                onValueChange={(value) => onInputChange('unloading_location', value)}
                placeholder="选择或输入卸货地点"
                searchPlaceholder="搜索地点..."
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="loading_date">装货日期</Label>
            <Input
              id="loading_date"
              type="date"
              value={formData.loading_date}
              onChange={(e) => onInputChange('loading_date', e.target.value)}
              disabled={isViewMode}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unloading_date">卸货日期</Label>
            <Input
              id="unloading_date"
              type="date"
              value={formData.unloading_date}
              onChange={(e) => onInputChange('unloading_date', e.target.value)}
              disabled={isViewMode}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="loading_weight">装货重量(吨)</Label>
            <Input
              id="loading_weight"
              type="number"
              step="0.01"
              value={formData.loading_weight || ''}
              onChange={(e) => onInputChange('loading_weight', e.target.value ? parseFloat(e.target.value) : null)}
              placeholder="输入装货重量"
              disabled={isViewMode}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unloading_weight">卸货重量(吨)</Label>
            <Input
              id="unloading_weight"
              type="number"
              step="0.01"
              value={formData.unloading_weight || ''}
              onChange={(e) => onInputChange('unloading_weight', e.target.value ? parseFloat(e.target.value) : null)}
              placeholder="输入卸货重量"
              disabled={isViewMode}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="current_cost">运费金额</Label>
            <Input
              id="current_cost"
              type="number"
              step="0.01"
              value={formData.current_cost || ''}
              onChange={(e) => onInputChange('current_cost', e.target.value ? parseFloat(e.target.value) : null)}
              placeholder="输入运费金额"
              disabled={isViewMode}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="extra_cost">额外费用</Label>
            <Input
              id="extra_cost"
              type="number"
              step="0.01"
              value={formData.extra_cost || ''}
              onChange={(e) => onInputChange('extra_cost', e.target.value ? parseFloat(e.target.value) : null)}
              placeholder="输入额外费用"
              disabled={isViewMode}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="transport_type">运输类型</Label>
            <Select
              value={formData.transport_type}
              onValueChange={(value) => onInputChange('transport_type', value)}
              disabled={isViewMode}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择运输类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="实际运输">实际运输</SelectItem>
                <SelectItem value="退货">退货</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="driver_phone">司机电话</Label>
            <Input
              id="driver_phone"
              value={formData.driver_phone}
              onChange={(e) => onInputChange('driver_phone', e.target.value)}
              placeholder="输入司机电话"
              disabled={isViewMode}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="remarks">备注</Label>
            <Textarea
              id="remarks"
              value={formData.remarks}
              onChange={(e) => onInputChange('remarks', e.target.value)}
              placeholder="输入备注信息"
              disabled={isViewMode}
            />
          </div>

          {formData.payable_cost && (
            <div className="space-y-2 md:col-span-2">
              <Label>司机应付金额</Label>
              <div className="text-lg font-semibold text-primary">
                ¥{parseFloat(formData.payable_cost.toString()).toFixed(2)}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            {isViewMode ? '关闭' : '取消'}
          </Button>
          {!isViewMode && (
            <Button onClick={onSubmit}>
              {editingRecord ? '更新' : '保存'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}