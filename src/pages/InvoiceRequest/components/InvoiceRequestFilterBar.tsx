import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CalendarIcon, Filter, X, FileText, Users, Hash, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { BatchInputDialog } from '@/pages/BusinessEntry/components/BatchInputDialog';

interface InvoiceRequestFilterBarProps {
  projectFilter: string;
  setProjectFilter: (value: string) => void;
  partnerFilter: string;
  setPartnerFilter: (value: string) => void;
  invoiceStatusFilter: string;
  setInvoiceStatusFilter: (value: string) => void;
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  waybillNumberFilter: string;
  setWaybillNumberFilter: (value: string) => void;
  driverFilter: string;
  setDriverFilter: (value: string) => void;
  licensePlateFilter: string;
  setLicensePlateFilter: (value: string) => void;
  phoneFilter: string;
  setPhoneFilter: (value: string) => void;
  projects: Array<{ id: string; name: string }>;
  partners: Array<{ id: string; name: string }>;
  onApplyFilters: () => void;
  onClearFilters: () => void;
}

export function InvoiceRequestFilterBar({
  projectFilter,
  setProjectFilter,
  partnerFilter,
  setPartnerFilter,
  invoiceStatusFilter,
  setInvoiceStatusFilter,
  dateRange,
  setDateRange,
  waybillNumberFilter,
  setWaybillNumberFilter,
  driverFilter,
  setDriverFilter,
  licensePlateFilter,
  setLicensePlateFilter,
  phoneFilter,
  setPhoneFilter,
  projects,
  partners,
  onApplyFilters,
  onClearFilters
}: InvoiceRequestFilterBarProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isBatchWaybillOpen, setIsBatchWaybillOpen] = useState(false);
  const [isBatchDriverOpen, setIsBatchDriverOpen] = useState(false);
  const [isBatchLicenseOpen, setIsBatchLicenseOpen] = useState(false);
  const [isBatchPhoneOpen, setIsBatchPhoneOpen] = useState(false);

  const invoiceStatusOptions = [
    { value: '', label: '全部状态' },
    { value: 'Uninvoiced', label: '未开票' },
    { value: 'Processing', label: '开票中' },
    { value: 'Invoiced', label: '已开票' }
  ];

  const hasActiveFilters = projectFilter || partnerFilter || invoiceStatusFilter || 
    dateRange?.from || waybillNumberFilter || driverFilter || 
    licensePlateFilter || phoneFilter;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          开票申请筛选
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 基本搜索 */}
        <div className="grid grid-cols-10 gap-4 items-end">
          {/* 项目筛选 */}
          <div className="col-span-3">
            <Label className="text-sm font-medium">项目</Label>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="选择项目" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部项目</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 开票状态 */}
          <div className="col-span-2">
            <Label className="text-sm font-medium">开票状态</Label>
            <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent>
                {invoiceStatusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 装货日期范围 */}
          <div className="col-span-3">
            <Label className="text-sm font-medium">装货日期范围</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-10 w-full justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "yyyy-MM-dd")} -{" "}
                        {format(dateRange.to, "yyyy-MM-dd")}
                      </>
                    ) : (
                      format(dateRange.from, "yyyy-MM-dd")
                    )
                  ) : (
                    <span>选择日期范围</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* 操作按钮 */}
          <div className="col-span-2 flex gap-2">
            <Button onClick={onApplyFilters} className="h-10">
              应用筛选
            </Button>
            {hasActiveFilters && (
              <Button variant="outline" onClick={onClearFilters} className="h-10">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* 高级搜索 */}
        <div className="space-y-3">
          <Button
            variant="outline"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="w-full"
          >
            <Filter className="mr-2 h-4 w-4" />
            {isAdvancedOpen ? '收起高级搜索' : '展开高级搜索'}
          </Button>

          {isAdvancedOpen && (
            <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* 合作方筛选 */}
                <div>
                  <Label className="text-sm font-medium">合作方</Label>
                  <Select value={partnerFilter} onValueChange={setPartnerFilter}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="选择合作方" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">全部合作方</SelectItem>
                      {partners.map((partner) => (
                        <SelectItem key={partner.id} value={partner.id}>
                          {partner.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 运单号搜索 */}
                <div>
                  <Label className="text-sm font-medium">运单号</Label>
                  <Input
                    value={waybillNumberFilter}
                    onChange={(e) => setWaybillNumberFilter(e.target.value)}
                    placeholder="输入运单号"
                    className="h-10"
                  />
                </div>
              </div>

              <Separator />

              {/* 批量搜索 */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700">批量搜索</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setIsBatchWaybillOpen(true)}
                    className="h-10 justify-start"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    批量运单号
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsBatchDriverOpen(true)}
                    className="h-10 justify-start"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    批量司机
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsBatchLicenseOpen(true)}
                    className="h-10 justify-start"
                  >
                    <Hash className="mr-2 h-4 w-4" />
                    批量车牌
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsBatchPhoneOpen(true)}
                    className="h-10 justify-start"
                  >
                    <Phone className="mr-2 h-4 w-4" />
                    批量电话
                  </Button>
                </div>
              </div>

              {/* 单个搜索 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">司机</Label>
                  <Input
                    value={driverFilter}
                    onChange={(e) => setDriverFilter(e.target.value)}
                    placeholder="输入司机姓名"
                    className="h-10"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">车牌号</Label>
                  <Input
                    value={licensePlateFilter}
                    onChange={(e) => setLicensePlateFilter(e.target.value)}
                    placeholder="输入车牌号"
                    className="h-10"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 活动筛选器显示 */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-500">活动筛选器:</span>
            {projectFilter && (
              <Badge variant="secondary" className="gap-1">
                项目: {projects.find(p => p.id === projectFilter)?.name}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setProjectFilter('')} />
              </Badge>
            )}
            {partnerFilter && (
              <Badge variant="secondary" className="gap-1">
                合作方: {partners.find(p => p.id === partnerFilter)?.name}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setPartnerFilter('')} />
              </Badge>
            )}
            {invoiceStatusFilter && (
              <Badge variant="secondary" className="gap-1">
                状态: {invoiceStatusOptions.find(s => s.value === invoiceStatusFilter)?.label}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setInvoiceStatusFilter('')} />
              </Badge>
            )}
            {dateRange?.from && (
              <Badge variant="secondary" className="gap-1">
                日期: {format(dateRange.from, "MM-dd")} - {dateRange.to ? format(dateRange.to, "MM-dd") : "至今"}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setDateRange(undefined)} />
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      {/* 批量输入对话框 */}
      <BatchInputDialog
        isOpen={isBatchWaybillOpen}
        onClose={() => setIsBatchWaybillOpen(false)}
        title="批量运单号搜索"
        placeholder="请输入运单号，每行一个"
        currentValue={waybillNumberFilter}
        onApply={(value) => {
          setWaybillNumberFilter(value);
          setIsBatchWaybillOpen(false);
        }}
        description="支持多个运单号同时搜索，每行输入一个运单号"
      />

      <BatchInputDialog
        isOpen={isBatchDriverOpen}
        onClose={() => setIsBatchDriverOpen(false)}
        title="批量司机搜索"
        placeholder="请输入司机姓名，每行一个"
        currentValue={driverFilter}
        onApply={(value) => {
          setDriverFilter(value);
          setIsBatchDriverOpen(false);
        }}
        description="支持多个司机同时搜索，每行输入一个司机姓名"
      />

      <BatchInputDialog
        isOpen={isBatchLicenseOpen}
        onClose={() => setIsBatchLicenseOpen(false)}
        title="批量车牌搜索"
        placeholder="请输入车牌号，每行一个"
        currentValue={licensePlateFilter}
        onApply={(value) => {
          setLicensePlateFilter(value);
          setIsBatchLicenseOpen(false);
        }}
        description="支持多个车牌号同时搜索，每行输入一个车牌号"
      />

      <BatchInputDialog
        isOpen={isBatchPhoneOpen}
        onClose={() => setIsBatchPhoneOpen(false)}
        title="批量电话搜索"
        placeholder="请输入电话号码，每行一个"
        currentValue={phoneFilter}
        onApply={(value) => {
          setPhoneFilter(value);
          setIsBatchPhoneOpen(false);
        }}
        description="支持多个电话号码同时搜索，每行输入一个电话号码"
      />
    </Card>
  );
}
