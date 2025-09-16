// 最终文件路径: src/pages/BusinessEntry/index.tsx
// 描述: [最终完整版] 修复了分页栏布局，使其保持单行显示，并完成了分页控件的汉化。

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search, Plus, MoreHorizontal, ArrowUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

import { Project, LogisticsRecord } from './types';
import { useLogisticsData, INITIAL_FILTERS, TotalSummary, LogisticsFilters } from './hooks/useLogisticsData';
import { FilterBar } from './components/FilterBar';
import { LogisticsFormDialog } from './components/LogisticsFormDialog';
import { WaybillDetailDialog } from '@/components/WaybillDetailDialog';
import TransportDocumentGenerator from '@/components/TransportDocumentGenerator';

const formatCurrency = (value: number | null | undefined): string => {
  if (value == null || isNaN(value)) return '¥0.00';
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
  }).format(value);
};

const SummaryDisplay = ({ totalSummary, activeFilters }: { totalSummary: TotalSummary, activeFilters: LogisticsFilters }) => {
  const summaryTitle = useMemo(() => {
    const parts: string[] = [];
    if (activeFilters.projectName) { parts.push(`项目: ${activeFilters.projectName}`); }
    if (activeFilters.driverName) { parts.push(`司机: ${activeFilters.driverName}`); }
    if (activeFilters.licensePlate) { parts.push(`车牌: ${activeFilters.licensePlate}`); }
    if (activeFilters.driverPhone) { parts.push(`电话: ${activeFilters.driverPhone}`); }
    if (activeFilters.startDate && activeFilters.endDate) { parts.push(`日期: ${activeFilters.startDate} 至 ${activeFilters.endDate}`); }
    else if (activeFilters.startDate) { parts.push(`日期: 从 ${activeFilters.startDate}`); }
    else if (activeFilters.endDate) { parts.push(`日期: 截至 ${activeFilters.endDate}`); }
    if (parts.length === 0) { return "全部记录合计"; }
    return `${parts.join(' | ')} 合计`;
  }, [activeFilters]);

  return (
    <div className="flex items-center justify-start gap-x-6 rounded-lg border p-4 text-sm font-medium flex-nowrap overflow-x-auto scrollbar-thin">
      <span className="font-bold whitespace-nowrap">{summaryTitle}:</span>
      <span className="whitespace-nowrap">{totalSummary.actualCount}实际 / {totalSummary.returnCount}退货</span>
      <span className="whitespace-nowrap">司机运费: <span className="font-bold text-primary">{formatCurrency(totalSummary.totalCurrentCost)}</span></span>
      <span className="whitespace-nowrap">额外费用: <span className="font-bold text-orange-600">{formatCurrency(totalSummary.totalExtraCost)}</span></span>
      <span className="whitespace-nowrap">司机应收: <span className="font-bold text-green-600">{formatCurrency(totalSummary.totalDriverPayableCost)}</span></span>
      {totalSummary.totalWeightLoading > 0 && (
        <span className="whitespace-nowrap">计重合计: 装 <span className="font-bold text-primary">{totalSummary.totalWeightLoading.toFixed(2)}吨</span> / 卸 <span className="font-bold text-primary">{totalSummary.totalWeightUnloading.toFixed(2)}吨</span></span>
      )}
      {totalSummary.totalTripsLoading > 0 && (
        <span className="whitespace-nowrap">计车合计: <span className="font-bold text-primary">{totalSummary.totalTripsLoading.toFixed(0)}车</span></span>
      )}
      {totalSummary.totalVolumeLoading > 0 && (
        <span className="whitespace-nowrap">计体积合计: 装 <span className="font-bold text-primary">{totalSummary.totalVolumeLoading.toFixed(2)}立方</span> / 卸 <span className="font-bold text-primary">{totalSummary.totalVolumeUnloading.toFixed(2)}立方</span></span>
      )}
    </div>
  );
};

const PageSummaryFooter = ({ records }: { records: LogisticsRecord[] }) => {
  const pageSummary = useMemo(() => {
    return records.reduce((acc, record) => {
      acc.currentCost += record.current_cost || 0;
      acc.extraCost += record.extra_cost || 0;
      acc.payableCost += record.payable_cost || 0;
      return acc;
    }, { currentCost: 0, extraCost: 0, payableCost: 0 });
  }, [records]);

  return (
    <div className="text-sm text-muted-foreground whitespace-nowrap">
      <span className="font-bold">本页合计:</span>
      <span className="ml-2">运费 {formatCurrency(pageSummary.currentCost)}</span>
      <span className="ml-2">额外 {formatCurrency(pageSummary.extraCost)}</span>
      <span className="ml-2">应付款司机 <span className="font-semibold text-primary">{formatCurrency(pageSummary.payableCost)}</span></span>
    </div>
  );
};

const LogisticsTable = ({ records, loading, pagination, setPagination, onDelete, onView, onEdit, sortField, sortDirection, onSort, onPageSizeChange }: {
  records: LogisticsRecord[];
  loading: boolean;
  pagination: { currentPage: number; totalPages: number; totalCount: number; pageSize: number; };
  setPagination: React.Dispatch<React.SetStateAction<any>>;
  onDelete: (id: string) => void;
  onView: (record: LogisticsRecord) => void;
  onEdit: (record: LogisticsRecord) => void;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
  onPageSizeChange: (pageSize: number) => void;
}) => {
  const { isAdmin } = usePermissions();

  const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <Button variant="ghost" onClick={() => onSort(field)} className="px-2 py-1 h-auto -ml-2">
      {children}
      <ArrowUpDown className="ml-2 h-3 w-3" />
    </Button>
  );

  const getBillingUnit = (billingTypeId: number | null | undefined) => {
    switch (billingTypeId) {
      case 1: return '吨';
      case 2: return '车';
      case 3: return '立方';
      default: return '吨';
    }
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      setPagination((p: any) => ({ ...p, currentPage: page }));
    }
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead><SortableHeader field="auto_number">运单编号</SortableHeader></TableHead>
            <TableHead><SortableHeader field="project_name">项目</SortableHeader></TableHead>
            <TableHead><SortableHeader field="loading_date">装货日期</SortableHeader></TableHead>
            <TableHead><SortableHeader field="driver_name">司机信息</SortableHeader></TableHead>
            <TableHead>路线</TableHead>
            <TableHead>数量</TableHead>
            <TableHead><SortableHeader field="current_cost">运费/额外费</SortableHeader></TableHead>
            <TableHead><SortableHeader field="payable_cost">司机应收</SortableHeader></TableHead>
            <TableHead>状态</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={10} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></TableCell></TableRow>
          ) : records.length === 0 ? (
            <TableRow><TableCell colSpan={10} className="text-center h-24">没有找到任何记录。</TableCell></TableRow>
          ) : (
            records.map((record) => {
              const billingTypeId = record.billing_type_id || 1;
              const unit = getBillingUnit(billingTypeId);
              return (
                <TableRow 
                  key={record.id} 
                  onClick={() => onView(record)}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell className="font-mono">{record.auto_number}</TableCell>
                  <TableCell>{record.project_name}</TableCell>
                  <TableCell>{record.loading_date ? record.loading_date.substring(0, 10) : 'N/A'}</TableCell>
                  <TableCell>
                    {[record.driver_name, record.license_plate, record.driver_phone].filter(Boolean).join(' - ')}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="text-sm inline-flex items-center gap-1">
                      <span className="font-medium">
                        {record.loading_location?.split('|').map((loc, index) => (
                          <span key={index}>
                            {loc.substring(0, 2)}
                            {index < record.loading_location.split('|').length - 1 && ','}
                          </span>
                        ))}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium">
                        {record.unloading_location?.split('|').map((loc, index) => (
                          <span key={index}>
                            {loc.substring(0, 2)}
                            {index < record.unloading_location.split('|').length - 1 && ','}
                          </span>
                        ))}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    {billingTypeId === 2 ? (
                      `${record.loading_weight?.toFixed(0) || '0'} ${unit}`
                    ) : (
                      `${record.loading_weight?.toFixed(2) || '0.00'} / ${record.unloading_weight?.toFixed(2) || '0.00'} ${unit}`
                    )}
                  </TableCell>
                  <TableCell>
                    {`${formatCurrency(record.current_cost)} / ${record.extra_cost || 0}`}
                  </TableCell>
                  <TableCell className="font-bold text-primary">{formatCurrency(record.payable_cost)}</TableCell>
                  <TableCell>
                    <Badge variant={record.transport_type === '实际运输' ? 'default' : 'secondary'}>
                      {record.transport_type}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView(record)}>查看详情</DropdownMenuItem>
                        {isAdmin && <DropdownMenuItem onClick={() => onEdit(record)}>编辑</DropdownMenuItem>}
                        {isAdmin && <DropdownMenuItem className="text-red-600" onClick={() => onDelete(record.id)}>删除</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      {/* 汉化分页组件 */}
      <div className="flex items-center justify-between p-4 border-t">
        <div className="flex items-center gap-4">
          {records.length > 0 && <PageSummaryFooter records={records} />}
          <div className="text-sm text-muted-foreground whitespace-nowrap">共 {pagination.totalCount} 条记录</div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* 每页显示数量选择器 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">每页显示</span>
            <Select value={pagination.pageSize.toString()} onValueChange={(value) => onPageSizeChange(parseInt(value))}>
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">条</span>
          </div>

          {/* 分页导航 */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage <= 1}
            >
              上一页
            </Button>
            
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">第</span>
              <Input
                type="number"
                min="1"
                max={pagination.totalPages}
                value={pagination.currentPage}
                onChange={(e) => {
                  const page = parseInt(e.target.value);
                  if (page >= 1 && page <= pagination.totalPages) {
                    handlePageChange(page);
                  }
                }}
                className="w-12 h-8 text-center"
              />
              <span className="text-sm text-muted-foreground">页，共 {pagination.totalPages} 页</span>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage >= pagination.totalPages}
            >
              下一页
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const StaleDataPrompt = () => (
  <div className="text-center py-10 border rounded-lg bg-muted/20">
    <Search className="mx-auto h-12 w-12 text-muted-foreground" />
    <h3 className="mt-2 text-sm font-semibold text-foreground">筛选条件已更改</h3>
    <p className="mt-1 text-sm text-muted-foreground">请点击“搜索”按钮以查看最新结果。</p>
  </div>
);

export default function BusinessEntry() {
  const { toast } = useToast();
  const { isAdmin } = usePermissions();
  const [projects, setProjects] = useState<Project[]>([]);
  const [viewingRecord, setViewingRecord] = useState<LogisticsRecord | null>(null);
  const [uiFilters, setUiFilters] = useState(INITIAL_FILTERS);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LogisticsRecord | null>(null);
  const { records, loading, activeFilters, setActiveFilters, pagination, setPagination, totalSummary, handleDelete, refetch, sortField, sortDirection, handleSort, handlePageSizeChange } = useLogisticsData();
  const isSummaryStale = useMemo(() => JSON.stringify(uiFilters) !== JSON.stringify(activeFilters), [uiFilters, activeFilters]);

  const loadInitialOptions = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('projects').select('id, name, start_date, end_date, manager, loading_address, unloading_address, project_status');
      if (error) throw error;
      setProjects(data || []);
    } catch (error) { toast({ title: "错误", description: "加载项目列表失败", variant: "destructive" }); }
  }, [toast]);

  useEffect(() => { loadInitialOptions(); }, [loadInitialOptions]);

  const handleSearch = () => {
    setActiveFilters(uiFilters);
    if (pagination.currentPage !== 1) { setPagination(p => ({ ...p, currentPage: 1 })); }
  };

  const handleClearSearch = () => {
    setUiFilters(INITIAL_FILTERS);
    setActiveFilters(INITIAL_FILTERS);
    if (pagination.currentPage !== 1) { setPagination(p => ({ ...p, currentPage: 1 })); }
  };

  const exportToExcel = async () => {
    toast({ title: "导出", description: "正在准备导出全部筛选结果..." });
    try {
      let query = supabase.from('logistics_records_view').select('*');
      if (activeFilters.projectName) query = query.eq('project_name', activeFilters.projectName);
      if (activeFilters.driverName) query = query.ilike('driver_name', `%${activeFilters.driverName}%`);
      if (activeFilters.licensePlate) query = query.ilike('license_plate', `%${activeFilters.licensePlate}%`);
      if (activeFilters.driverPhone) query = query.ilike('driver_phone', `%${activeFilters.driverPhone}%`);
      if (activeFilters.startDate) query = query.gte('loading_date', activeFilters.startDate);
      if (activeFilters.endDate) query = query.lte('loading_date', activeFilters.endDate);
      
      const { data, error } = await query.order('created_at', { ascending: false }).limit(10000);
      if (error) throw error;

      const dataToExport = data.map((r: any) => ({
        '运单编号': r.auto_number, '项目名称': r.project_name, '合作链路': r.chain_name || '默认', '司机姓名': r.driver_name, '车牌号': r.license_plate, '司机电话': r.driver_phone, '装货地点': r.loading_location, '卸货地点': r.unloading_location, '装货日期': r.loading_date, '卸货日期': r.unloading_date, '运输类型': r.transport_type, '装货重量': r.loading_weight, '卸货重量': r.unloading_weight, '运费金额': r.current_cost, '额外费用': r.extra_cost, '司机应收': r.payable_cost, '备注': r.remarks,
      }));
      
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "运单记录");
      XLSX.writeFile(wb, "运单记录.xlsx");
      toast({ title: "成功", description: `已成功导出 ${data.length} 条记录！` });
    } catch(e: any) {
      toast({ title: "错误", description: `导出失败: ${e.message}`, variant: "destructive" });
    }
  };

  const handleOpenAddDialog = () => {
    setEditingRecord(null);
    setIsFormDialogOpen(true);
  };

  const handleOpenEditDialog = (record: LogisticsRecord) => {
    setEditingRecord(record);
    setIsFormDialogOpen(true);
  };

  const handleFormDialogClose = () => {
    setIsFormDialogOpen(false);
    setEditingRecord(null);
  };

  const handleFormSubmitSuccess = () => {
    refetch();
  };

  // 生成运输单据
  const handleGenerateDocument = (record: LogisticsRecord) => {
    const generator = TransportDocumentGenerator({ record });
    generator();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">运单管理</h1>
          <p className="text-muted-foreground">查询、导入、导出和管理所有运单记录</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button onClick={handleOpenAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              新增运单
            </Button>
          )}
          <Button onClick={exportToExcel} disabled={loading}><Download className="mr-2 h-4 w-4" />导出数据</Button>
        </div>
      </div>
      <FilterBar filters={uiFilters} onFiltersChange={setUiFilters} onSearch={handleSearch} onClear={handleClearSearch} loading={loading} projects={projects} />
      {!isSummaryStale && !loading && (<SummaryDisplay totalSummary={totalSummary} activeFilters={activeFilters} />)}
      {isSummaryStale ? (<StaleDataPrompt />) : (<LogisticsTable records={records} loading={loading} pagination={pagination} setPagination={setPagination} onDelete={handleDelete} onView={setViewingRecord} onEdit={handleOpenEditDialog} onGenerateDocument={handleGenerateDocument} sortField={sortField} sortDirection={sortDirection} onSort={handleSort} onPageSizeChange={handlePageSizeChange} />)}
      <LogisticsFormDialog
        isOpen={isFormDialogOpen}
        onClose={handleFormDialogClose}
        editingRecord={editingRecord}
        projects={projects}
        onSubmitSuccess={handleFormSubmitSuccess}
      />
      <WaybillDetailDialog 
        isOpen={!!viewingRecord} 
        onClose={() => setViewingRecord(null)} 
        record={viewingRecord} 
      />
    </div>
  );
}
