// 开票申请单管理筛选器组件
// 文件路径: src/pages/InvoiceRequestManagement/components/InvoiceRequestFilterBar.tsx

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

interface InvoiceRequestFilters {
  // 基础搜索
  requestNumbers: string;
  partnerName: string;
  projectName: string;
  
  // 项目筛选
  projectId: string;
  
  // 合作方筛选
  partnerId: string;
  
  // 日期范围
  startDate: string;
  endDate: string;
  
  // 申请单状态
  requestStatus: string;
  
  // 运单开票状态
  invoiceStatus: string;
}

interface InvoiceRequestFilterBarProps {
  filters: InvoiceRequestFilters;
  onFiltersChange: (newFilters: InvoiceRequestFilters) => void;
  onSearch: () => void;
  onClear: () => void;
  loading: boolean;
  projects: Project[];
  partners: Partner[];
}

export function InvoiceRequestFilterBar({ 
  filters, 
  onFiltersChange, 
  onSearch, 
  onClear, 
  loading, 
  projects,
  partners 
}: InvoiceRequestFilterBarProps) {
  const [requestInput, setRequestInput] = useState(filters.requestNumbers);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [batchDialog, setBatchDialog] = useState<{
    isOpen: boolean;
    type: 'request' | 'partner' | 'project' | null;
  }>({ isOpen: false, type: null });

  const handleInputChange = (field: keyof Omit<InvoiceRequestFilters, 'startDate' | 'endDate'>, value: string) => {
    onFiltersChange({ ...filters, [field]: value });
  };

  const handleDateChange = (dateRange: DateRange | undefined) => {
    onFiltersChange({
      ...filters,
      startDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '',
      endDate: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : ''
    });
  };

  const handleRequestNumbersChange = (value: string) => {
    setRequestInput(value);
    handleInputChange('requestNumbers', value);
  };

  const handleRequestKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  const openBatchDialog = (type: 'request' | 'partner' | 'project') => {
    setBatchDialog({ isOpen: true, type });
  };

  const closeBatchDialog = () => {
    setBatchDialog({ isOpen: false, type: null });
  };

  const handleBatchConfirm = (values: string[]) => {
    const currentValue = requestInput;
    const newValue = currentValue ? `${currentValue}\n${values.join('\n')}` : values.join('\n');
    handleRequestNumbersChange(newValue);
    closeBatchDialog();
  };

  // 计算活跃筛选条件数量
  const activeFilterCount = [
    filters.requestNumbers,
    filters.partnerName,
    filters.projectName,
    filters.projectId !== 'all',
    filters.partnerId !== 'all',
    filters.requestStatus !== 'all',
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

          {/* 申请单状态筛选 */}
          <div className="lg:col-span-2">
            <Label className="text-sm font-medium text-blue-800 flex items-center gap-1 mb-2">
              <Building2 className="h-4 w-4" />
              申请单状态
            </Label>
            <Select value={filters.requestStatus} onValueChange={(value) => handleInputChange('requestStatus', value)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="Pending">待审核</SelectItem>
                <SelectItem value="Approved">已确认</SelectItem>
                <SelectItem value="Rejected">已拒绝</SelectItem>
                <SelectItem value="Completed">已完成</SelectItem>
                <SelectItem value="Cancelled">已取消</SelectItem>
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
            {/* 申请单号搜索 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-purple-800 flex items-center gap-1">
                <Hash className="h-4 w-4" />
                申请单号搜索
              </Label>
              <div className="flex gap-1">
                <Input
                  placeholder="输入申请单号，支持批量输入..."
                  value={requestInput}
                  onChange={(e) => handleRequestNumbersChange(e.target.value)}
                  onKeyDown={handleRequestKeyDown}
                  className="h-10 flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBatchDialog('request')}
                  className="h-10"
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 合作方筛选 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-purple-800 flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                合作方筛选
              </Label>
              <div className="flex gap-1">
                <Input
                  placeholder="合作方名称..."
                  value={filters.partnerName}
                  onChange={(e) => handleInputChange('partnerName', e.target.value)}
                  className="h-10 flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBatchDialog('partner')}
                  className="h-10"
                >
                  <Building2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 项目名称筛选 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-purple-800 flex items-center gap-1">
                <FileText className="h-4 w-4" />
                项目名称筛选
              </Label>
              <div className="flex gap-1">
                <Input
                  placeholder="项目名称..."
                  value={filters.projectName}
                  onChange={(e) => handleInputChange('projectName', e.target.value)}
                  className="h-10 flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBatchDialog('project')}
                  className="h-10"
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 运单开票状态筛选 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-purple-800 flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                运单开票状态
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
          </div>
        </div>
      )}

      {/* 批量输入对话框 */}
      <BatchInputDialog
        isOpen={batchDialog.isOpen}
        onClose={closeBatchDialog}
        onConfirm={handleBatchConfirm}
        title={
          batchDialog.type === 'request' ? '批量输入申请单号' :
          batchDialog.type === 'partner' ? '批量输入合作方名称' :
          batchDialog.type === 'project' ? '批量输入项目名称' :
          '批量输入'
        }
        placeholder={
          batchDialog.type === 'request' ? '每行一个申请单号' :
          batchDialog.type === 'partner' ? '每行一个合作方名称' :
          batchDialog.type === 'project' ? '每行一个项目名称' :
          '每行一个'
        }
        description={
          batchDialog.type === 'request' ? '输入多个申请单号，每行一个' :
          batchDialog.type === 'partner' ? '输入多个合作方名称，每行一个' :
          batchDialog.type === 'project' ? '输入多个项目名称，每行一个' :
          '输入多个项目，每行一个'
        }
        currentValue=""
      />
    </div>
  );
}
