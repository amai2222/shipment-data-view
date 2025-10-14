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
  filters: any;
  onFiltersChange: (filters: any) => void;
  onSearch: () => void;
  onClear: () => void;
  loading: boolean;
  projects: Array<{ id: string; name: string }>;
  partners?: Array<{ id: string; name: string }>;
}

export function InvoiceRequestFilterBar({
  filters,
  onFiltersChange,
  onSearch,
  onClear,
  loading,
  projects,
  partners = []
}: InvoiceRequestFilterBarProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isBatchWaybillOpen, setIsBatchWaybillOpen] = useState(false);
  const [isBatchDriverOpen, setIsBatchDriverOpen] = useState(false);
  const [isBatchLicenseOpen, setIsBatchLicenseOpen] = useState(false);
  const [isBatchPhoneOpen, setIsBatchPhoneOpen] = useState(false);

  const handleReset = () => {
    onClear();
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
        {/* 基础筛选 */}
        <div className="grid grid-cols-10 gap-4 items-end">
          {/* 项目筛选 */}
          <div className="col-span-3">
            <Label className="text-sm font-medium">项目</Label>
            <Select value={filters.project || ''} onValueChange={(value) => onFiltersChange({...filters, project: value})}>
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
                <SelectItem value="">全部状态</SelectItem>
                <SelectItem value="Pending">待处理</SelectItem>
                <SelectItem value="Processing">处理中</SelectItem>
                <SelectItem value="Approved">已确认</SelectItem>
                <SelectItem value="Cancelled">已作废</SelectItem>
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
            <Button onClick={onSearch} className="h-10">
              <Filter className="mr-2 h-4 w-4" />
              搜索
            </Button>
            <Button variant="outline" onClick={handleReset} className="h-10">
              <X className="mr-2 h-4 w-4" />
              重置
            </Button>
          </div>
        </div>

        {/* 高级筛选切换 */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="text-sm"
          >
            <Filter className="mr-2 h-4 w-4" />
            {isAdvancedOpen ? '收起高级筛选' : '展开高级筛选'}
          </Button>
        </div>

        {/* 高级筛选面板 */}
        {isAdvancedOpen && (
          <div className="border-t pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* 运单号搜索 */}
              <div>
                <Label className="text-sm font-medium">运单号</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="输入运单号"
                    value={waybillFilter}
                    onChange={(e) => setWaybillFilter(e.target.value)}
                    className="h-10"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsBatchWaybillOpen(true)}
                    className="h-10 px-3"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* 司机搜索 */}
              <div>
                <Label className="text-sm font-medium">司机</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="输入司机姓名"
                    value={driverFilter}
                    onChange={(e) => setDriverFilter(e.target.value)}
                    className="h-10"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsBatchDriverOpen(true)}
                    className="h-10 px-3"
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* 车牌号搜索 */}
              <div>
                <Label className="text-sm font-medium">车牌号</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="输入车牌号"
                    value={licensePlateFilter}
                    onChange={(e) => setLicensePlateFilter(e.target.value)}
                    className="h-10"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsBatchLicenseOpen(true)}
                    className="h-10 px-3"
                  >
                    <Hash className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* 电话搜索 */}
              <div>
                <Label className="text-sm font-medium">电话</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="输入电话号码"
                    value={phoneFilter}
                    onChange={(e) => setPhoneFilter(e.target.value)}
                    className="h-10"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsBatchPhoneOpen(true)}
                    className="h-10 px-3"
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

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
          </div>
        )}
      </CardContent>

      {/* 批量输入对话框 */}
      <BatchInputDialog
        isOpen={isBatchWaybillOpen}
        onClose={() => setIsBatchWaybillOpen(false)}
        title="批量运单号搜索"
        placeholder="请输入运单号，每行一个"
        currentValue={waybillFilter}
        onApply={(value) => {
          setWaybillFilter(value);
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
        description="支持多个司机姓名同时搜索，每行输入一个司机姓名"
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
