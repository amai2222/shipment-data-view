// 最终文件路径: src/pages/BusinessEntry/components/FilterBar.tsx

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { LogisticsFilters } from '../hooks/useLogisticsData';
import { Project } from '../types';
import { DateRange } from "react-day-picker";
import { X } from "lucide-react";

// 图标占位符组件（兼容性处理）
const Search = ({ className }: { className?: string }) => <span className={className}>🔍</span>;
const ChevronDown = ({ className }: { className?: string }) => <span className={className}>▼</span>;
const ChevronUp = ({ className }: { className?: string }) => <span className={className}>▲</span>;
const Users = ({ className }: { className?: string }) => <span className={className}>👥</span>;
const Hash = ({ className }: { className?: string }) => <span className={className}>#</span>;
const Phone = ({ className }: { className?: string }) => <span className={className}>📞</span>;
const FileText = ({ className }: { className?: string }) => <span className={className}>📄</span>;
const Building2 = ({ className }: { className?: string }) => <span className={className}>🏢</span>;
import { useState, useEffect } from "react";
import { BatchInputDialog } from "./BatchInputDialog";
import { supabase } from "@/integrations/supabase/client";
import { ShipperProjectCascadeFilter } from "@/components/ShipperProjectCascadeFilter";

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
  
  // 货主和项目级联筛选
  const [selectedShipperId, setSelectedShipperId] = useState('all');
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  
  // 动态平台选项状态
  const [platformOptions, setPlatformOptions] = useState<{
    platform_name: string;
    usage_count: number;
  }[]>([]);

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

  // 加载动态平台选项（从数据库获取已使用的平台名称）
  const loadPlatformOptions = async () => {
    try {
      const { data, error } = await supabase.rpc('get_all_used_platforms');
      
      if (error) {
        console.error('加载平台选项失败:', error);
        return;
      }
      
      if (data) {
        // 过滤掉固定平台列表中已有的平台，避免重复
        const fixedPlatforms = ['本平台', '中科智运', '中工智云', '可乐公司', '盼盼集团'];
        const dynamicPlatforms = (data as { platform_name: string; usage_count: number }[]).filter(
          (p) => !fixedPlatforms.includes(p.platform_name)
        );
        setPlatformOptions(dynamicPlatforms);
        console.log('✅ 加载动态平台选项:', dynamicPlatforms);
      }
    } catch (error) {
      console.error('加载平台选项异常:', error);
    }
  };
  
  // 加载合作商列表（获取所有项目的最高级别合作商）
  const loadPartners = async () => {
    setLoadingPartners(true);
    try {
      // 首先检查partners表是否有数据
      const { data: partnersData, error: partnersError } = await supabase
        .from('partners')
        .select('id, name, full_name')
        .order('name');
      
      if (partnersError) throw partnersError;
      
      console.log('partners表数据:', partnersData);
      
      // 然后检查project_partners表是否有数据
      const { data: projectPartnersData, error: projectPartnersError } = await supabase
        .from('project_partners')
        .select(`
          partner_id,
          project_id,
          level,
          partners (
            id,
            name,
            full_name
          )
        `)
        .order('level', { ascending: false });
      
      if (projectPartnersError) {
        console.warn('project_partners表查询失败:', projectPartnersError);
        // 如果project_partners表没有数据，使用partners表的数据
        setPartners(partnersData || []);
        return;
      }
      
      console.log('project_partners表数据:', projectPartnersData);
      
      if (!projectPartnersData || projectPartnersData.length === 0) {
        // 如果project_partners表没有数据，使用partners表的数据
        console.log('project_partners表为空，使用partners表数据');
        setPartners(partnersData || []);
        return;
      }
      
      // 按项目分组，找到每个项目的最高级别合作商
      const projectMaxLevels = new Map();
      projectPartnersData.forEach(item => {
        if (item.project_id) {
          const currentMax = projectMaxLevels.get(item.project_id) || 0;
          if (item.level > currentMax) {
            projectMaxLevels.set(item.project_id, item.level);
          }
        }
      });
      
      console.log('每个项目的最高级别:', Object.fromEntries(projectMaxLevels));
      
      // 获取每个项目最高级别的合作商
      const highestLevelPartners = new Map();
      projectPartnersData.forEach(item => {
        if (item.project_id && item.partners) {
          const projectMaxLevel = projectMaxLevels.get(item.project_id);
          if (item.level === projectMaxLevel) {
            // 使用合作商ID作为key（确保每个合作商实体只显示一次）
            if (!highestLevelPartners.has(item.partners.id)) {
              highestLevelPartners.set(item.partners.id, {
                id: item.partners.id,
                name: item.partners.name,  // 使用简称
                full_name: item.partners.full_name
              });
            }
          }
        }
      });
      
      const partnersArray = Array.from(highestLevelPartners.values());
      console.log('每个项目最高级别合作商:', partnersArray);
      setPartners(partnersArray);
      
    } catch (error) {
      console.error('加载合作商失败:', error);
    } finally {
      setLoadingPartners(false);
    }
  };

  // 根据合作商加载项目（获取该合作商的所有项目，不限级别）
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
        .eq('partner_id', partnerId); // 获取该合作商的所有项目，不限级别

      if (error) throw error;
      
      // 去重并格式化数据
      const uniqueProjects = new Map();
      data?.forEach(item => {
        if (item.projects && !uniqueProjects.has(item.projects.id)) {
          uniqueProjects.set(item.projects.id, item.projects);
        }
      });
      
      setPartnerProjects(Array.from(uniqueProjects.values()));
    } catch (error) {
      console.error('加载合作商项目失败:', error);
      setPartnerProjects([]);
    }
  };

  // 合作商选择变化
  const handlePartnerChange = (partnerId: string) => {
    setSelectedPartnerId(partnerId);
    handleInputChange('projectName', ''); // 清空项目选择
    // 不更新合作商筛选，只用于动态加载项目
    loadProjectsByPartner(partnerId);
  };

  // 初始化加载合作商
  useEffect(() => {
    loadPartners();
    loadPlatformOptions(); // 加载动态平台选项
  }, []);

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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* 货主-项目级联筛选器（占2列） */}
          <div className="lg:col-span-2">
            <ShipperProjectCascadeFilter
              selectedShipperId={selectedShipperId}
              selectedProjectId={selectedProjectId}
              onShipperChange={(id) => {
                setSelectedShipperId(id);
                setSelectedProjectId('all');
                handleInputChange('projectName', '');
              }}
              onProjectChange={(id) => {
                setSelectedProjectId(id);
                if (id === 'all') {
                  handleInputChange('projectName', '');
                } else {
                  const project = projects.find(p => p.id === id);
                  if (project) {
                    handleInputChange('projectName', project.name);
                  }
                }
              }}
            />
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
            <Button onClick={onSearch} disabled={loading} className="h-10 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md text-white">
              <Search className="mr-1 h-4 w-4" />
              搜索
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="h-10"
            >
              {showAdvanced ? (
                <>
                  <ChevronUp className="mr-1 h-4 w-4" />
                  收起
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1 h-4 w-4" />
                  高级
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
                  
                  {/* 固定平台列表 */}
                  <SelectItem value="本平台">本平台</SelectItem>
                  <SelectItem value="中科智运">中科智运</SelectItem>
                  <SelectItem value="中工智云">中工智云</SelectItem>
                  <SelectItem value="可乐公司">可乐公司</SelectItem>
                  <SelectItem value="盼盼集团">盼盼集团</SelectItem>
                  
                  {/* 动态平台列表（从数据库获取） */}
                  {platformOptions.length > 0 && (
                    <>
                      {/* 分隔线提示 */}
                      <SelectItem value="---" disabled className="text-xs text-purple-400">
                        ─── 其他平台 ───
                      </SelectItem>
                      {platformOptions.map((platform) => (
                        <SelectItem 
                          key={platform.platform_name} 
                          value={platform.platform_name}
                        >
                          {platform.platform_name} ({platform.usage_count}条)
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              <div className="text-xs text-purple-600">
                📊 固定平台: 5个 {platformOptions.length > 0 && `| 其他平台: ${platformOptions.length}个`}
              </div>
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
