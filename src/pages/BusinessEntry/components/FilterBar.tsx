// 最终文件路径: src/pages/BusinessEntry/components/FilterBar.tsx

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { LogisticsFilters } from '../hooks/useLogisticsData';
import { Project } from '../types';
import { DateRange } from "react-day-picker";
import { Search, X, ChevronDown, ChevronUp, Users, Hash, Phone, FileText, Building2 } from "lucide-react";
import { useState, useEffect } from "react";
import { BatchInputDialog } from "./BatchInputDialog";
import { supabase } from "@/integrations/supabase/client";

interface Partner {
  id: string;
  name: string;
  full_name?: string;
}

interface FilterBarProps {
  filters: LogisticsFilters;
  onFiltersChange: (newFilters: LogisticsFilters) => void;
  onSearch: () => void;
  onClear: () => void;
  loading: boolean;
  projects: Project[];
}

export function FilterBar({ filters, onFiltersChange, onSearch, onClear, loading, projects }: FilterBarProps) {
  const [waybillInput, setWaybillInput] = useState(filters.waybillNumbers);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [batchDialog, setBatchDialog] = useState<{
    isOpen: boolean;
    type: 'driver' | 'license' | 'phone' | 'waybill' | null;
  }>({ isOpen: false, type: null });
  
  // 合作商和项目状态
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(filters.partnerId || '');
  const [partnerProjects, setPartnerProjects] = useState<Project[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);

  const handleInputChange = (field: keyof Omit<LogisticsFilters, 'startDate' | 'endDate'>, value: string) => {
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

  // 加载合作商列表（只加载最高级别合作商）
  const loadPartners = async () => {
    setLoadingPartners(true);
    try {
      const { data, error } = await supabase
        .from('project_partners')
        .select(`
          partner_id,
          partners (
            id,
            name,
            full_name
          )
        `)
        .eq('level', 1) // 只获取最高级别合作商
        .order('partners(name)');
      
      if (error) throw error;
      
      // 去重并格式化数据
      const uniquePartners = new Map();
      data?.forEach(item => {
        if (item.partners && !uniquePartners.has(item.partners.id)) {
          uniquePartners.set(item.partners.id, item.partners);
        }
      });
      
      setPartners(Array.from(uniquePartners.values()));
    } catch (error) {
      console.error('加载合作商失败:', error);
    } finally {
      setLoadingPartners(false);
    }
  };

  // 根据合作商加载项目（只获取该最高级别合作商的项目）
  const loadProjectsByPartner = async (partnerId: string) => {
    if (!partnerId) {
      setPartnerProjects([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('project_partners')
        .select(`
          project_id,
          projects (
            id,
            name,
            start_date,
            end_date,
            manager,
            loading_address,
            unloading_address,
            project_status
          )
        `)
        .eq('partner_id', partnerId)
        .eq('level', 1); // 只获取最高级别合作商的项目

      if (error) throw error;
      
      const projects = data?.map(item => item.projects).filter(Boolean) as Project[] || [];
      setPartnerProjects(projects);
    } catch (error) {
      console.error('加载合作商项目失败:', error);
      setPartnerProjects([]);
    }
  };

  // 合作商选择变化
  const handlePartnerChange = (partnerId: string) => {
    setSelectedPartnerId(partnerId);
    handleInputChange('projectName', ''); // 清空项目选择
    onFiltersChange({ ...filters, partnerId: partnerId === 'all' ? '' : partnerId }); // 更新合作商筛选
    loadProjectsByPartner(partnerId);
  };

  // 初始化加载合作商
  useEffect(() => {
    loadPartners();
  }, []);

  // 同步合作商选择状态
  useEffect(() => {
    if (filters.partnerId && filters.partnerId !== selectedPartnerId) {
      setSelectedPartnerId(filters.partnerId);
      loadProjectsByPartner(filters.partnerId);
    }
  }, [filters.partnerId]);

  const getCurrentValue = () => {
    const type = batchDialog.type;
    if (type === 'driver') return filters.driverName;
    if (type === 'license') return filters.licensePlate;
    if (type === 'phone') return filters.driverPhone;
    if (type === 'waybill') return waybillInput;
    return '';
  };

  const getDialogConfig = () => {
    const type = batchDialog.type;
    switch (type) {
      case 'driver':
        return {
          title: '批量输入司机姓名',
          placeholder: '请输入司机姓名，多个用逗号或换行分隔\n例如：张三,李四,王五',
          description: '支持批量输入多个司机姓名进行筛选'
        };
      case 'license':
        return {
          title: '批量输入车牌号',
          placeholder: '请输入车牌号，多个用逗号或换行分隔\n例如：京A12345,沪B67890,粤C11111',
          description: '支持批量输入多个车牌号进行筛选'
        };
      case 'phone':
        return {
          title: '批量输入司机电话',
          placeholder: '请输入司机电话，多个用逗号或换行分隔\n例如：13800138000,13900139000',
          description: '支持批量输入多个司机电话进行筛选'
        };
      case 'waybill':
        return {
          title: '批量输入运单编号',
          placeholder: '请输入运单编号，多个用逗号或换行分隔\n例如：WB001,WB002,WB003',
          description: '支持批量输入多个运单编号进行筛选'
        };
      default:
        return { title: '', placeholder: '', description: '' };
    }
  };

  const dateRangeValue: DateRange | undefined = (filters.startDate || filters.endDate)
    ? {
        from: filters.startDate ? new Date(filters.startDate) : undefined,
        to: filters.endDate ? new Date(filters.endDate) : undefined,
      }
    : undefined;

  return (
    <div className="space-y-4">
      {/* 基础筛选器 */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* 合作商选择 */}
          <div className="space-y-2">
            <Label htmlFor="partner-name" className="text-sm font-medium text-blue-800 flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              合作商（最高级别）
            </Label>
            <Select
              value={selectedPartnerId || 'all'}
              onValueChange={(value) => handlePartnerChange(value === 'all' ? '' : value)}
              disabled={loading || loadingPartners}
            >
              <SelectTrigger id="partner-name" className="h-10">
                <SelectValue placeholder="所有最高级别合作商" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有最高级别合作商</SelectItem>
                {partners.map(partner => (
                  <SelectItem key={partner.id} value={partner.id}>
                    {partner.full_name || partner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 项目名称 */}
          <div className="space-y-2">
            <Label htmlFor="project-name" className="text-sm font-medium text-blue-800 flex items-center gap-1">
              <FileText className="h-4 w-4" />
              项目名称
            </Label>
            <Select
              value={filters.projectName || 'all'}
              onValueChange={(value) => handleInputChange('projectName', value === 'all' ? '' : value)}
              disabled={loading || (selectedPartnerId ? partnerProjects.length === 0 : projects.length === 0)}
            >
              <SelectTrigger id="project-name" className="h-10">
                <SelectValue placeholder={selectedPartnerId ? "选择合作商的项目" : "所有项目"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有项目</SelectItem>
                {(selectedPartnerId ? partnerProjects : projects).map(project => (
                  <SelectItem key={project.id} value={project.name}>{project.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 日期范围 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-blue-800">日期范围</Label>
            <DateRangePicker date={dateRangeValue} setDate={handleDateChange} disabled={loading} />
          </div>

          {/* 操作按钮 */}
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={onClear} disabled={loading} className="h-10">
              清除
            </Button>
            <Button onClick={onSearch} disabled={loading} className="h-10 bg-blue-600 hover:bg-blue-700">
              <Search className="mr-1 h-4 w-4" />搜索
            </Button>
          </div>

          {/* 高级搜索按钮 */}
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="h-10 w-full"
            >
              {showAdvanced ? (
                <>
                  <ChevronUp className="mr-1 h-4 w-4" />
                  收起高级搜索
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1 h-4 w-4" />
                  高级搜索
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* 高级筛选器 - 可折叠 */}
      {showAdvanced && (
        <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* 司机 */}
            <div className="space-y-2">
              <Label htmlFor="driver-name" className="text-sm font-medium text-purple-800 flex items-center gap-1">
                <Users className="h-4 w-4" />
                司机
              </Label>
              <div className="flex gap-1">
                <Input 
                  type="text" 
                  id="driver-name" 
                  placeholder="司机姓名..." 
                  value={filters.driverName} 
                  onChange={e => handleInputChange('driverName', e.target.value)} 
                  disabled={loading}
                  className="h-10 flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBatchDialog('driver')}
                  className="h-10 px-2"
                  title="批量输入"
                >
                  <Users className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 车牌号 */}
            <div className="space-y-2">
              <Label htmlFor="license-plate" className="text-sm font-medium text-purple-800 flex items-center gap-1">
                <Hash className="h-4 w-4" />
                车牌号
              </Label>
              <div className="flex gap-1">
                <Input 
                  type="text" 
                  id="license-plate" 
                  placeholder="车牌号..." 
                  value={filters.licensePlate} 
                  onChange={e => handleInputChange('licensePlate', e.target.value)} 
                  disabled={loading}
                  className="h-10 flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBatchDialog('license')}
                  className="h-10 px-2"
                  title="批量输入"
                >
                  <Hash className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 司机电话 */}
            <div className="space-y-2">
              <Label htmlFor="driver-phone" className="text-sm font-medium text-purple-800 flex items-center gap-1">
                <Phone className="h-4 w-4" />
                司机电话
              </Label>
              <div className="flex gap-1">
                <Input 
                  type="text" 
                  id="driver-phone" 
                  placeholder="司机电话..." 
                  value={filters.driverPhone} 
                  onChange={e => handleInputChange('driverPhone', e.target.value)} 
                  disabled={loading}
                  className="h-10 flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBatchDialog('phone')}
                  className="h-10 px-2"
                  title="批量输入"
                >
                  <Phone className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 运单编号 */}
            <div className="space-y-2">
              <Label htmlFor="waybill-numbers" className="text-sm font-medium text-purple-800 flex items-center gap-1">
                <FileText className="h-4 w-4" />
                运单编号
              </Label>
              <div className="flex gap-1">
                <div className="relative flex-1">
                  <Input 
                    type="text" 
                    id="waybill-numbers" 
                    placeholder="输入运单编号，多个用逗号分隔..." 
                    value={waybillInput} 
                    onChange={e => handleWaybillNumbersChange(e.target.value)}
                    onKeyDown={handleWaybillKeyDown}
                    disabled={loading}
                    className="h-10 pr-8"
                  />
                  {waybillInput && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-6 w-6 p-0 hover:bg-purple-100"
                      onClick={() => handleWaybillNumbersChange('')}
                    >
                      <X className="h-3 w-3 text-purple-600" />
                    </Button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBatchDialog('waybill')}
                  className="h-10 px-2"
                  title="批量输入"
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-xs text-purple-600">
                💡 支持多个运单编号查询，用逗号分隔，按回车快速搜索
              </div>
            </div>

            {/* 其他平台名称 */}
            <div className="space-y-2">
              <Label htmlFor="other-platform" className="text-sm font-medium text-purple-800">其他平台名称</Label>
              <Select
                value={filters.otherPlatformName || 'all'}
                onValueChange={(value) => handleInputChange('otherPlatformName', value === 'all' ? '' : value)}
                disabled={loading}
              >
                <SelectTrigger id="other-platform" className="h-10">
                  <SelectValue placeholder="选择平台" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有平台</SelectItem>
                  <SelectItem value="本平台">本平台</SelectItem>
                  <SelectItem value="中科智运">中科智运</SelectItem>
                  <SelectItem value="中工智云">中工智云</SelectItem>
                  <SelectItem value="可乐公司">可乐公司</SelectItem>
                  <SelectItem value="盼盼集团">盼盼集团</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 磅单筛选 */}
            <div className="space-y-2">
              <Label htmlFor="has-scale-record" className="text-sm font-medium text-purple-800">磅单状态</Label>
              <Select
                value={filters.hasScaleRecord || 'all'}
                onValueChange={(value) => handleInputChange('hasScaleRecord', value === 'all' ? '' : value)}
                disabled={loading}
              >
                <SelectTrigger id="has-scale-record" className="h-10">
                  <SelectValue placeholder="选择磅单状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有运单</SelectItem>
                  <SelectItem value="yes">有磅单</SelectItem>
                  <SelectItem value="no">无磅单</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-purple-600">
                📋 筛选是否有对应磅单记录的运单
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 批量输入对话框 */}
      <BatchInputDialog
        isOpen={batchDialog.isOpen}
        onClose={closeBatchDialog}
        onConfirm={handleBatchConfirm}
        title={getDialogConfig().title}
        placeholder={getDialogConfig().placeholder}
        description={getDialogConfig().description}
        currentValue={getCurrentValue()}
      />
    </div>
  );
}
