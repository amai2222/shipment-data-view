import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { BatchInputDialog } from '@/pages/BusinessEntry/components/BatchInputDialog';
import { 
  Filter, 
  Search, 
  X, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  CheckCircle, 
  Users,
  Car,
  Phone,
  Building,
  DollarSign,
  Calendar as CalendarIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface InvoiceFilters {
  projectId: string;
  invoiceStatus: string;
  startDate: string;
  endDate: string;
  waybillNumbers?: string;
  driverName?: string;
  licensePlate?: string;
  driverPhone?: string;
  driverReceivable?: string;
}

interface InvoiceRequestFilterBarProps {
  filters: InvoiceFilters;
  onFiltersChange: (filters: InvoiceFilters) => void;
  onSearch: () => void;
  onClear: () => void;
  loading: boolean;
  projects: Array<{ id: string; name: string }>;
}

export function InvoiceRequestFilterBar({
  filters,
  onFiltersChange,
  onSearch,
  onClear,
  loading,
  projects
}: InvoiceRequestFilterBarProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isBatchWaybillOpen, setIsBatchWaybillOpen] = useState(false);
  const [isBatchDriverOpen, setIsBatchDriverOpen] = useState(false);
  const [isBatchLicenseOpen, setIsBatchLicenseOpen] = useState(false);
  const [isBatchPhoneOpen, setIsBatchPhoneOpen] = useState(false);
  const [isBatchReceivableOpen, setIsBatchReceivableOpen] = useState(false);

  const handleReset = () => {
    onClear();
  };

  // 日期范围处理
  const dateRangeValue = {
    from: filters.startDate ? new Date(filters.startDate) : undefined,
    to: filters.endDate ? new Date(filters.endDate) : undefined
  };

  const handleDateChange = (range: { from?: Date; to?: Date } | undefined) => {
    onFiltersChange({
      ...filters,
      startDate: range?.from ? format(range.from, 'yyyy-MM-dd') : '',
      endDate: range?.to ? format(range.to, 'yyyy-MM-dd') : ''
    });
  };


  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          开票申请筛选
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* 基础筛选条件 - 参考运单管理布局 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          {/* 项目筛选 */}
          <div className="space-y-2">
            <Label htmlFor="project-filter" className="text-sm font-medium text-blue-800 flex items-center gap-1">
              <FileText className="h-4 w-4" />
              项目
            </Label>
            <Select value={filters.projectId || 'all'} onValueChange={(value) => onFiltersChange({...filters, projectId: value === 'all' ? '' : value})}>
              <SelectTrigger id="project-filter" className="h-10">
                <SelectValue placeholder="全部项目" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部项目</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 开票状态 */}
          <div className="space-y-2">
            <Label htmlFor="status-filter" className="text-sm font-medium text-blue-800 flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              开票状态
            </Label>
            <Select value={filters.invoiceStatus || 'all'} onValueChange={(value) => onFiltersChange({...filters, invoiceStatus: value === 'all' ? '' : value})}>
              <SelectTrigger id="status-filter" className="h-10">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="Uninvoiced">未开票</SelectItem>
                <SelectItem value="Processing">开票中</SelectItem>
                <SelectItem value="Invoiced">已开票</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 日期范围 */}
          <div className="space-y-2 relative z-10">
            <Label htmlFor="date-range-picker" className="text-sm font-medium text-blue-800 flex items-center gap-1">
              <CalendarIcon className="h-4 w-4" />
              日期范围
            </Label>
            <div className="w-full">
              <DateRangePicker 
                date={dateRangeValue} 
                setDate={handleDateChange} 
                disabled={loading}
                className="w-full"
              />
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={handleReset} disabled={loading} className="h-10">
              清除
            </Button>
          </div>
        </div>

        {/* 高级搜索按钮和搜索按钮 */}
        <div className="flex items-end gap-2">
          <Button
            variant="outline"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="h-10 flex-1"
          >
            {isAdvancedOpen ? (
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
          <Button onClick={onSearch} disabled={loading} className="h-10 bg-blue-600 hover:bg-blue-700">
            <Search className="mr-1 h-4 w-4" />搜索
          </Button>
        </div>

        {/* 高级筛选面板 - 参考运单管理布局 */}
        {isAdvancedOpen && (
          <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {/* 运单号搜索 */}
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
                      value={filters.waybillNumbers || ''} 
                      onChange={e => onFiltersChange({...filters, waybillNumbers: e.target.value})}
                      disabled={loading}
                      className="h-10 pr-8"
                    />
                    {(filters.waybillNumbers || '') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1 h-6 w-6 p-0 hover:bg-purple-100"
                        onClick={() => onFiltersChange({...filters, waybillNumbers: ''})}
                      >
                        <X className="h-3 w-3 text-purple-600" />
                      </Button>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsBatchWaybillOpen(true)}
                    className="h-10 px-2"
                    title="批量输入"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-xs text-purple-600">
                  💡 支持多个运单编号查询，用逗号分隔
                </div>
              </div>

              {/* 司机搜索 */}
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
                    value={filters.driverName || ''} 
                    onChange={e => onFiltersChange({...filters, driverName: e.target.value})} 
                    disabled={loading}
                    className="h-10 flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsBatchDriverOpen(true)}
                    className="h-10 px-2"
                    title="批量输入"
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* 车牌号搜索 */}
              <div className="space-y-2">
                <Label htmlFor="license-plate" className="text-sm font-medium text-purple-800 flex items-center gap-1">
                  <Car className="h-4 w-4" />
                  车牌号
                </Label>
                <div className="flex gap-1">
                  <Input 
                    type="text" 
                    id="license-plate" 
                    placeholder="车牌号..." 
                    value={filters.licensePlate || ''} 
                    onChange={e => onFiltersChange({...filters, licensePlate: e.target.value})} 
                    disabled={loading}
                    className="h-10 flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsBatchLicenseOpen(true)}
                    className="h-10 px-2"
                    title="批量输入"
                  >
                    <Car className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* 司机电话搜索 */}
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
                    value={filters.driverPhone || ''} 
                    onChange={e => onFiltersChange({...filters, driverPhone: e.target.value})} 
                    disabled={loading}
                    className="h-10 flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsBatchPhoneOpen(true)}
                    className="h-10 px-2"
                    title="批量输入"
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* 司机应收搜索 */}
              <div className="space-y-2">
                <Label htmlFor="driver-receivable" className="text-sm font-medium text-purple-800 flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  司机应收
                </Label>
                <div className="flex gap-1">
                  <div className="relative flex-1">
                    <Input 
                      type="text" 
                      id="driver-receivable" 
                      placeholder="输入司机应收金额，多个用逗号分隔..." 
                      value={filters.driverReceivable || ''} 
                      onChange={e => onFiltersChange({...filters, driverReceivable: e.target.value})}
                      disabled={loading}
                      className="h-10"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsBatchReceivableOpen(true)}
                    className="h-10 px-2"
                    title="批量输入"
                  >
                    <DollarSign className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-xs text-purple-600">
                  💡 支持多个司机应收金额查询，用逗号分隔，按回车快速搜索
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 批量输入对话框 */}
        <BatchInputDialog
          isOpen={isBatchWaybillOpen}
          onClose={() => setIsBatchWaybillOpen(false)}
          onApply={(value) => onFiltersChange({...filters, waybillNumbers: value})}
          title="批量输入运单编号"
          placeholder="输入运单编号，每行一个"
          description="支持多个运单编号，每行输入一个编号"
          currentValue={filters.waybillNumbers || ''}
        />

        <BatchInputDialog
          isOpen={isBatchDriverOpen}
          onClose={() => setIsBatchDriverOpen(false)}
          onApply={(value) => onFiltersChange({...filters, driverName: value})}
          title="批量输入司机姓名"
          placeholder="输入司机姓名，每行一个"
          description="支持多个司机姓名，每行输入一个姓名"
          currentValue={filters.driverName || ''}
        />

        <BatchInputDialog
          isOpen={isBatchLicenseOpen}
          onClose={() => setIsBatchLicenseOpen(false)}
          onApply={(value) => onFiltersChange({...filters, licensePlate: value})}
          title="批量输入车牌号"
          placeholder="输入车牌号，每行一个"
          description="支持多个车牌号，每行输入一个车牌号"
          currentValue={filters.licensePlate || ''}
        />

        <BatchInputDialog
          isOpen={isBatchPhoneOpen}
          onClose={() => setIsBatchPhoneOpen(false)}
          onApply={(value) => onFiltersChange({...filters, driverPhone: value})}
          title="批量输入司机电话"
          placeholder="输入司机电话，每行一个"
          description="支持多个司机电话，每行输入一个电话"
          currentValue={filters.driverPhone || ''}
        />

        <BatchInputDialog
          isOpen={isBatchReceivableOpen}
          onClose={() => setIsBatchReceivableOpen(false)}
          onApply={(value) => onFiltersChange({...filters, driverReceivable: value})}
          title="批量输入司机应收金额"
          placeholder="输入司机应收金额，每行一个"
          description="支持多个司机应收金额，每行输入一个金额"
          currentValue={filters.driverReceivable || ''}
        />
      </CardContent>
    </Card>
  );
}