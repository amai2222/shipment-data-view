// 开票申请筛选器组件 - 基于运单管理的FilterBar
// 文件路径: src/pages/InvoiceRequest/components/InvoiceFilterBar.tsx

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { Search, X, ChevronDown, ChevronUp, Users, Hash, Phone, FileText, Building2 } from "lucide-react";
import { useState, useEffect } from "react";
import { BatchInputDialog } from "@/pages/BusinessEntry/components/BatchInputDialog";
import { supabase } from "@/integrations/supabase/client";

interface Partner {
  id: string;
  name: string;
  full_name?: string;
}

interface Project {
  id: string;
  name: string;
}

interface InvoiceFilters {
  // 基础搜索
  waybillNumbers: string;
  driverName: string;
  licensePlate: string;
  driverPhone: string;
  
  // 项目筛选
  projectId: string;
  
  // 合作方筛选
  partnerId: string;
  
  // 日期范围
  startDate: string;
  endDate: string;
  
  // 开票状态
  invoiceStatus: string;
}

interface InvoiceFilterBarProps {
  filters: InvoiceFilters;
  onFiltersChange: (newFilters: InvoiceFilters) => void;
  onSearch: () => void;
  onClear: () => void;
  loading: boolean;
  projects: Project[];
}

export function InvoiceFilterBar({ filters, onFiltersChange, onSearch, onClear, loading, projects }: InvoiceFilterBarProps) {
  const [waybillInput, setWaybillInput] = useState(filters.waybillNumbers);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [batchDialog, setBatchDialog] = useState<{
    isOpen: boolean;
    type: 'driver' | 'license' | 'phone' | 'waybill' | null;
  }>({ isOpen: false, type: null });
  
  // 合作商和项目状态
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [partnerProjects, setPartnerProjects] = useState<Project[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);

  const handleInputChange = (field: keyof Omit<InvoiceFilters, 'startDate' | 'endDate'>, value: string) => {
    onFiltersChange({ ...filters, [field]: value });
  };

  const handleDateChange = (dateRange: DateRange | undefined) => {
    onFiltersChange({
      ...filters,
      startDate: dateRange?.from ? dateRange.from.toISOString().split('T')[0] : '',
      endDate: dateRange?.to ? dateRange.to.toISOString().split('T')[0] : '',
    });
  };

  const handleWaybillNumbersChange = (value: string) => {
    setWaybillInput(value);
    onFiltersChange({ ...filters, waybillNumbers: value });
  };

  const handleWaybillKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearch();
    }
  };

  const openBatchDialog = (type: 'driver' | 'license' | 'phone' | 'waybill') => {
    setBatchDialog({ isOpen: true, type });
  };

  const closeBatchDialog = () => {
    setBatchDialog({ isOpen: false, type: null });
  };

  const handleBatchConfirm = (values: string[]) => {
    const value = values.join(',');
    const type = batchDialog.type;
    
    if (type === 'driver') {
      handleInputChange('driverName', value);
    } else if (type === 'license') {
      handleInputChange('licensePlate', value);
    } else if (type === 'phone') {
      handleInputChange('driverPhone', value);
    } else if (type === 'waybill') {
      handleWaybillNumbersChange(value);
    }
    
    closeBatchDialog();
  };

  // 加载合作商列表
  const loadPartners = async () => {
    setLoadingPartners(true);
    try {
      const { data: partnersData, error: partnersError } = await supabase
        .from('partners')
        .select('id, name, full_name')
        .order('name');
      
      if (partnersError) throw partnersError;
      setPartners(partnersData || []);
    } catch (error) {
      console.error('加载合作商失败:', error);
    } finally {
      setLoadingPartners(false);
    }
  };

  // 加载合作方关联的项目
  const loadPartnerProjects = async (partnerId: string) => {
    if (!partnerId) {
      setPartnerProjects([]);
      return;
    }

    try {
      const { data: projectData, error: projectError } = await supabase
        .from('project_partners')
        .select(`
          projects!inner(id, name)
        `)
        .eq('partner_id', partnerId);

      if (projectError) throw projectError;

      const projects = projectData?.map(item => ({
        id: (item.projects as any).id,
        name: (item.projects as any).name
      })) || [];

      setPartnerProjects(projects);
    } catch (error) {
      console.error('加载合作方项目失败:', error);
      setPartnerProjects([]);
    }
  };

  useEffect(() => {
    loadPartners();
  }, []);

  useEffect(() => {
    if (filters.partnerId) {
      loadPartnerProjects(filters.partnerId);
    } else {
      setPartnerProjects([]);
    }
  }, [filters.partnerId]);

  // 计算活跃筛选条件数量
  const activeFilterCount = [
    filters.waybillNumbers,
    filters.driverName,
    filters.licensePlate,
    filters.driverPhone,
    filters.projectId !== 'all',
    filters.partnerId !== 'all',
    filters.invoiceStatus !== 'all',
    filters.startDate,
    filters.endDate
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* 主筛选栏 - 紧凑布局 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 items-end">
          {/* 项目筛选 */}
          <div className="lg:col-span-2">
            <Label className="text-sm font-medium text-blue-800 flex items-center gap-1 mb-2">
              <FileText className="h-4 w-4" />
              项目筛选
            </Label>
            <Select value={filters.projectId} onValueChange={(value) => handleInputChange('projectId', value)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="选择项目" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部项目</SelectItem>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 开票状态筛选 */}
          <div className="lg:col-span-2">
            <Label className="text-sm font-medium text-blue-800 flex items-center gap-1 mb-2">
              <Building2 className="h-4 w-4" />
              开票状态
            </Label>
            <Select value={filters.invoiceStatus} onValueChange={(value) => handleInputChange('invoiceStatus', value)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="选择开票状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="Uninvoiced">未开票</SelectItem>
                <SelectItem value="Processing">开票中</SelectItem>
                <SelectItem value="Invoiced">已开票</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 日期范围筛选 */}
          <div className="lg:col-span-2">
            <Label className="text-sm font-medium text-blue-800 mb-2">装货日期范围</Label>
            <DateRangePicker
              value={{
                from: filters.startDate ? new Date(filters.startDate) : undefined,
                to: filters.endDate ? new Date(filters.endDate) : undefined,
              }}
              onChange={handleDateChange}
              placeholder="选择日期范围"
            />
          </div>

          {/* 操作按钮组 */}
          <div className="lg:col-span-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="h-10 flex items-center gap-1"
            >
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              高级筛选
              {activeFilterCount > 0 && (
                <span className="ml-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            
            <Button onClick={onSearch} disabled={loading} className="h-10 bg-blue-600 hover:bg-blue-700">
              <Search className="mr-1 h-4 w-4" />
              搜索
            </Button>
            
            <Button variant="outline" onClick={onClear} className="h-10">
              <X className="mr-1 h-4 w-4" />
              清空
            </Button>
          </div>
        </div>
      </div>

      {/* 高级筛选面板 */}
      {showAdvanced && (
        <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* 运单号搜索 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-purple-800 flex items-center gap-1">
                <Hash className="h-4 w-4" />
                运单号搜索
              </Label>
              <div className="flex gap-1">
                <Input
                  placeholder="输入运单号，支持批量输入..."
                  value={waybillInput}
                  onChange={(e) => handleWaybillNumbersChange(e.target.value)}
                  onKeyDown={handleWaybillKeyDown}
                  className="h-10 flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBatchDialog('waybill')}
                  className="h-10"
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 司机信息筛选 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-purple-800 flex items-center gap-1">
                <Users className="h-4 w-4" />
                司机姓名
              </Label>
              <div className="flex gap-1">
                <Input
                  placeholder="司机姓名..."
                  value={filters.driverName}
                  onChange={(e) => handleInputChange('driverName', e.target.value)}
                  className="h-10 flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBatchDialog('driver')}
                  className="h-10"
                >
                  <Users className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-purple-800 flex items-center gap-1">
                <Hash className="h-4 w-4" />
                车牌号
              </Label>
              <div className="flex gap-1">
                <Input
                  placeholder="车牌号..."
                  value={filters.licensePlate}
                  onChange={(e) => handleInputChange('licensePlate', e.target.value)}
                  className="h-10 flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBatchDialog('license')}
                  className="h-10"
                >
                  <Hash className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-purple-800 flex items-center gap-1">
                <Phone className="h-4 w-4" />
                司机电话
              </Label>
              <div className="flex gap-1">
                <Input
                  placeholder="司机电话..."
                  value={filters.driverPhone}
                  onChange={(e) => handleInputChange('driverPhone', e.target.value)}
                  className="h-10 flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBatchDialog('phone')}
                  className="h-10"
                >
                  <Phone className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 合作方筛选 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-purple-800 flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                合作方筛选
              </Label>
              <Select value={filters.partnerId} onValueChange={(value) => handleInputChange('partnerId', value)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="选择合作方" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部合作方</SelectItem>
                  {partners.map(partner => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.full_name || partner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* 批量输入对话框 */}
      <BatchInputDialog
        isOpen={batchDialog.isOpen}
        onClose={closeBatchDialog}
        onConfirm={handleBatchConfirm}
        title={
          batchDialog.type === 'driver' ? '批量输入司机姓名' :
          batchDialog.type === 'license' ? '批量输入车牌号' :
          batchDialog.type === 'phone' ? '批量输入司机电话' :
          '批量输入运单号'
        }
        placeholder={
          batchDialog.type === 'driver' ? '每行一个司机姓名' :
          batchDialog.type === 'license' ? '每行一个车牌号' :
          batchDialog.type === 'phone' ? '每行一个司机电话' :
          '每行一个运单号'
        }
        description={
          batchDialog.type === 'driver' ? '输入多个司机姓名，每行一个' :
          batchDialog.type === 'license' ? '输入多个车牌号，每行一个' :
          batchDialog.type === 'phone' ? '输入多个司机电话，每行一个' :
          '输入多个运单号，每行一个'
        }
        currentValue=""
      />
    </div>
  );
}
