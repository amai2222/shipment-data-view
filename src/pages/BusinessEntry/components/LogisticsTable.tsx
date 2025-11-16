// 文件路径: src/pages/BusinessEntry/components/LogisticsTable.tsx
// 描述: [最终修正版] 实现了单排显示、列合并、动态数量单位和统一的财务格式化。

import { useMemo, useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Loader2, ChevronsUpDown, ChevronUp, ChevronDown, Edit, FileText, CheckSquare, Square } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LogisticsRecord, PaginationState } from '../types';
import { RouteDisplay } from '@/components/RouteDisplay';
import { TransportDocumentGenerator, generatePrintVersion } from '@/components/TransportDocumentGenerator';
import { useAllFilteredRecords } from '../hooks/useAllFilteredRecords';
import { LogisticsFilters } from '../hooks/useLogisticsData';
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyDisplay } from "@/components/CurrencyDisplay";

interface LogisticsTableProps {
  records: LogisticsRecord[];
  loading: boolean;
  pagination: PaginationState;
  setPagination: React.Dispatch<React.SetStateAction<PaginationState>>;
  onDelete: (id: string, autoNumber: string) => void;
  onView: (record: LogisticsRecord) => void;
  onEdit: (record: LogisticsRecord) => void;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (field: string) => void;
  onPageSizeChange?: (pageSize: number) => void;
  billingTypes?: { [key: number]: string };
  onBatchAction?: (selectedIds: string[], action: string) => void;
  isBatchMode?: boolean;
  onToggleBatchMode?: () => void;
  activeFilters: LogisticsFilters; // 新增：当前活跃的筛选条件
  onSelectionChange?: (selectedIds: string[]) => void; // 新增：选中状态改变回调
}

export const LogisticsTable = ({ records, loading, pagination, setPagination, onDelete, onView, onEdit, sortField, sortDirection, onSort, onPageSizeChange, billingTypes = {}, onBatchAction, isBatchMode = false, onToggleBatchMode, activeFilters, onSelectionChange }: LogisticsTableProps) => {
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [allFilteredRecordIds, setAllFilteredRecordIds] = useState<string[]>([]);
  const { getAllFilteredRecordIds, loading: loadingAllRecords } = useAllFilteredRecords();
  
  // 当筛选条件改变时，清空缓存的记录ID
  useEffect(() => {
    setAllFilteredRecordIds([]);
    setSelectedRecords(new Set()); // 清空选中状态
    if (onSelectionChange) onSelectionChange([]);
  }, [activeFilters, onSelectionChange]);

  // 当选中状态改变时，通知父组件
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(Array.from(selectedRecords));
    }
  }, [selectedRecords, onSelectionChange]);
  
  const handlePageChange = (newPage: number) => {
    setPagination((p: PaginationState) => ({ 
      ...p, 
      page: newPage, 
      size: p.size,
      currentPage: newPage,
      totalPages: p.totalPages,
      totalCount: p.totalCount,
      pageSize: p.pageSize
    }));
  };

  // 批量选择处理函数
  const handleSelectRecord = (recordId: string) => {
    const newSelected = new Set(selectedRecords);
    if (newSelected.has(recordId)) {
      newSelected.delete(recordId);
    } else {
      newSelected.add(recordId);
    }
    setSelectedRecords(newSelected);
  };

  const handleSelectAll = async () => {
    // 如果还没有获取所有筛选记录，先获取
    if (allFilteredRecordIds.length === 0) {
      const result = await getAllFilteredRecordIds(activeFilters);
      if (result) {
        setAllFilteredRecordIds(result.recordIds);
        // 选择所有筛选记录
        setSelectedRecords(new Set(result.recordIds));
      }
      return; // 获取完成后直接返回，不执行后续逻辑
    }
    
    // 检查是否所有记录都已选择
    const allSelected = allFilteredRecordIds.length > 0 && allFilteredRecordIds.every(id => selectedRecords.has(id));
    
    if (allSelected) {
      // 取消选择所有记录
      setSelectedRecords(new Set());
    } else {
      // 选择所有筛选记录
      setSelectedRecords(new Set(allFilteredRecordIds));
    }
  };

  const handleSelectPage = (select = true) => {
    const currentPageIds = records.map(r => r.id);
    setSelectedRecords(prev => {
      const newSet = new Set(prev);
      if (select) {
        currentPageIds.forEach(id => newSet.add(id));
      } else {
        currentPageIds.forEach(id => newSet.delete(id));
      }
      return newSet;
    });
  };

  const handleBatchAction = (action: string) => {
    if (onBatchAction && selectedRecords.size > 0) {
      onBatchAction(Array.from(selectedRecords), action);
    }
  };

  const toggleBatchMode = () => {
    if (onToggleBatchMode) {
      onToggleBatchMode();
    }
    if (isBatchMode) {
      setSelectedRecords(new Set());
    }
  };

  const formatRoute = (loadingLoc: string, unloadingLoc:string) => {
    const start = (loadingLoc || '未知').slice(0, 2);
    const end = (unloadingLoc || '未知').slice(0, 2);
    return `${start} → ${end}`;
  };

  // [修改] 升级为标准的财务格式化函数
  const formatCurrency = (value: number | null | undefined): string => {
    if (value == null || isNaN(value)) return '¥0.00';
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(value);
  };

  // [新增] 统一的数量显示函数，根据 billing_type_id 动态返回带单位的字符串
  const getQuantityDisplay = (record: LogisticsRecord) => {
    const billingTypeId = record.billing_type_id || 1;
    const loading = record.loading_weight || 0;
    const unloading = record.unloading_weight || 0;
    switch (billingTypeId) {
      case 1: return `${(loading || 0).toFixed(2)} / ${(unloading || 0).toFixed(2)} 吨`;
      case 2: return `1 车`;
      case 3: return `${(loading || 0).toFixed(2)} / ${(unloading || 0).toFixed(2)} 立方`;
      default: return '-';
    }
  };

  // [新增] 使用 useMemo 优化合计行计算
  const summaryTotals = useMemo(() => {
    const totals = {
      weight: { loading: 0, unloading: 0 },
      trips: { count: 0 },
      volume: { loading: 0, unloading: 0 },
      currentCost: 0,
      extraCost: 0,
      driverPayable: 0,
    };

    records.forEach(r => {
      const billingTypeId = r.billing_type_id || 1;
      if (billingTypeId === 1) {
        totals.weight.loading += r.loading_weight || 0;
        totals.weight.unloading += r.unloading_weight || 0;
      } else if (billingTypeId === 2) {
        totals.trips.count += 1;
      } else if (billingTypeId === 3) {
        totals.volume.loading += r.loading_weight || 0;
        totals.volume.unloading += r.unloading_weight || 0;
      }
      totals.currentCost += r.current_cost || 0;
      totals.extraCost += r.extra_cost || 0;
      totals.driverPayable += (r.current_cost || 0) + (r.extra_cost || 0);
    });

    return totals;
  }, [records]);

  const SortableHeader = ({ field, children, className }: { field: string, children: React.ReactNode, className?: string }) => {
    const getSortIcon = () => {
      if (sortField !== field) return <ChevronsUpDown className="ml-1 h-4 w-4 opacity-50" />;
      return sortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />;
    };

    return (
      <TableHead 
        className={`cursor-pointer hover:bg-muted/50 select-none ${className || ''}`}
        onClick={() => onSort?.(field)}
      >
        <div className="flex items-center">
          {children}
          {getSortIcon()}
        </div>
      </TableHead>
    );
  };

  return (
    <div className="space-y-4">
      {/* 批量操作工具栏 */}
      {isBatchMode && (
        <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-blue-700">
              已选择 {selectedRecords.size} 条记录
            </span>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="text-blue-600 border-blue-300">
                    <CheckSquare className="h-3 w-3 mr-1" />
                    选择操作
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => handleSelectPage(true)}>
                    选择当前页 ({records.length})
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleSelectPage(false)}>
                    取消选择当前页
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleSelectAll} disabled={loadingAllRecords}>
                    {loadingAllRecords ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        加载中...
                      </>
                    ) : (
                      <>
                        选择所有 {allFilteredRecordIds.length > 0 ? allFilteredRecordIds.length : '筛选'} 条记录
                      </>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBatchAction('generatePDF')}
              disabled={selectedRecords.size === 0}
              className="text-green-600 border-green-300"
            >
              <FileText className="h-4 w-4 mr-2" />
              批量生成PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleBatchMode}
              className="text-gray-600"
            >
              退出批量模式
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 shadow-lg overflow-x-auto bg-white">
        <Table className="w-full">
          <TableHeader className="bg-gradient-to-r from-slate-50 to-blue-50 border-b border-gray-200">
            <TableRow className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50">
              {isBatchMode && (
                <TableHead className="min-w-[50px] bg-gradient-to-r from-slate-100 to-blue-100 border-r border-blue-200">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-blue-100 rounded-md"
                      >
                        <Checkbox 
                          checked={records.length > 0 && records.every(r => selectedRecords.has(r.id))}
                          className="h-3.5 w-3.5"
                        />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => handleSelectPage(true)}>
                        选择当前页 ({records.length})
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleSelectPage(false)}>
                        取消选择当前页
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={handleSelectAll} disabled={loadingAllRecords}>
                        {loadingAllRecords ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            加载中...
                          </>
                        ) : (
                          <>
                            选择所有 {allFilteredRecordIds.length > 0 ? allFilteredRecordIds.length : '筛选'} 条记录
                          </>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableHead>
              )}
              <SortableHeader field="auto_number" className="min-w-[120px] font-semibold text-slate-800 text-sm py-4">运单编号</SortableHeader>
              <SortableHeader field="project_name" className="min-w-[100px] font-semibold text-slate-800 text-sm py-4">项目</SortableHeader>
              <SortableHeader field="loading_date" className="min-w-[100px] font-semibold text-slate-800 text-sm py-4">装货日期</SortableHeader>
              <SortableHeader field="driver_name" className="min-w-[160px] font-semibold text-slate-800 text-sm py-4">司机信息</SortableHeader>
              <SortableHeader field="loading_location" className="min-w-[140px] font-semibold text-slate-800 text-sm py-4">路线</SortableHeader>
              <SortableHeader field="loading_weight" className="min-w-[120px] font-semibold text-slate-800 text-sm py-4">数量</SortableHeader>
              <SortableHeader field="current_cost" className="min-w-[120px] font-semibold text-slate-800 text-sm py-4">运费/额外费</SortableHeader>
              <SortableHeader field="payable_cost" className="min-w-[100px] font-semibold text-slate-800 text-sm py-4">司机应收</SortableHeader>
              {/* 隐藏状态列 */}
              {/* <SortableHeader field="transport_type" className="w-[100px]">状态</SortableHeader> */}
              <TableHead className="min-w-[100px] text-center font-semibold text-slate-800 text-sm py-4">运输单据</TableHead>
              <TableHead className="min-w-[60px] text-right font-semibold text-slate-800 text-sm py-4">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                {/* [修改] 更新 colSpan - 隐藏状态列后减少1 */}
                <TableCell colSpan={isBatchMode ? 11 : 10} className="h-24 text-center">
                  <div className="flex justify-center items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    正在加载数据...
                  </div>
                </TableCell>
              </TableRow>
            ) : records.length > 0 ? (
              records.map((record) => {
                const driverPayable = (record.current_cost || 0) + (record.extra_cost || 0);
                return (
                  <TableRow 
                    key={record.id} 
                    onClick={() => !isBatchMode && onView(record)}
                    className={`hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 whitespace-nowrap border-b border-gray-100 transition-all duration-200 py-2 ${isBatchMode ? 'cursor-default' : 'cursor-pointer'} ${records.indexOf(record) % 2 === 0 ? 'bg-white' : 'bg-blue-50/50'}`}
                  >
                    {isBatchMode && (
                      <TableCell onClick={(e) => e.stopPropagation()} className="border-r border-blue-200 py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSelectRecord(record.id)}
                          className="h-6 w-6 p-0 hover:bg-blue-100 rounded-md"
                        >
                          {selectedRecords.has(record.id) ? (
                            <CheckSquare className="h-3.5 w-3.5 text-blue-600" />
                          ) : (
                            <Square className="h-3.5 w-3.5 text-gray-500" />
                          )}
                        </Button>
                      </TableCell>
                    )}
                    <TableCell className="font-mono text-sm text-slate-800 py-2">{record.auto_number}</TableCell>
                    <TableCell className="text-sm text-slate-700 py-2">{record.project_name}</TableCell>
                    <TableCell className="text-xs text-slate-600 py-2">
                      {new Date(record.loading_date).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                    </TableCell>
                    <TableCell className="text-sm py-2">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-slate-800">{record.driver_name}</span>
                        <span className="text-slate-400">|</span>
                        <span className="text-xs text-slate-600 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                          {record.license_plate || '未填写'}
                        </span>
                        <span className="text-slate-400">|</span>
                        <span className="text-xs text-slate-600 font-mono">
                          {record.driver_phone || '未填写'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap min-w-[140px] text-sm py-2">
                      <RouteDisplay 
                        loadingLocation={record.loading_location}
                        unloadingLocation={record.unloading_location}
                        variant="compact"
                      />
                    </TableCell>
                    {/* [修改] 使用统一的显示函数 */}
                    <TableCell className="font-mono text-sm text-slate-700 py-2">{getQuantityDisplay(record)}</TableCell>
                    <TableCell className="text-sm text-slate-700 py-2">
                      <CurrencyDisplay value={record.current_cost} /> / <CurrencyDisplay value={record.extra_cost} />
                    </TableCell>
                    <TableCell className="text-sm text-blue-600 py-2">
                      <CurrencyDisplay value={driverPayable} className="text-blue-600" />
                    </TableCell>
                    {/* 隐藏状态列 */}
                    {/* <TableCell>
                      <span className={`px-2 py-1 text-xs rounded-full ${record.transport_type === '退货运输' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                        {record.transport_type}
                      </span>
                    </TableCell> */}
                    <TableCell className="text-center py-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            // 生成运输单据PDF预览
                            const printHTML = await generatePrintVersion(record);
                            const previewWindow = window.open('', '_blank', 'width=1000,height=800,scrollbars=yes');
                            if (previewWindow) {
                              previewWindow.document.write(printHTML);
                              previewWindow.document.close();
                            } else {
                              alert('无法打开预览窗口，请检查浏览器弹窗设置');
                            }
                          } catch (error) {
                            console.error('生成PDF失败:', error);
                            const errorMessage = error instanceof Error ? error.message : '未知错误';
                            alert(`生成PDF失败: ${errorMessage}，请重试`);
                          }
                        }}
                        className="text-blue-600 border-blue-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:border-blue-400 transition-all duration-200 font-medium px-3 py-1.5 rounded-lg shadow-sm"
                      >
                        <FileText className="h-3.5 w-3.5 mr-1.5" />
                        单据
                      </Button>
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            className="h-7 w-7 p-0 hover:bg-gradient-to-r hover:from-slate-100 hover:to-gray-100 transition-all duration-200 rounded-md"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="sr-only">打开菜单</span>
                            <MoreHorizontal className="h-4 w-4 text-slate-600" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(record);
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            <span>编辑</span>
                          </DropdownMenuItem>
                          <ConfirmDialog
                            title="确认删除"
                            description={`您确定要删除运单 "${record.auto_number}" 吗？此操作不可撤销。`}
                            onConfirm={() => onDelete(record.id, record.auto_number)}
                          >
                            <div className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>删除</span>
                            </div>
                          </ConfirmDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                {/* [修改] 更新 colSpan - 隐藏状态列后减少1 */}
                <TableCell colSpan={isBatchMode ? 11 : 10} className="h-24 text-center">
                  没有找到匹配的记录。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
              
          {/* [重构] 合计行逻辑 */}
          {records.length > 0 && (
            <tfoot className="border-t border-gray-200">
              <TableRow className="hover:bg-transparent">
                <TableCell className="text-slate-600 text-sm py-3">合计</TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell className="text-center text-slate-600 text-sm py-3">{records.length} 条运单</TableCell>
                <TableCell></TableCell>
                <TableCell className="font-mono text-xs text-slate-500 py-3">
                  {summaryTotals.weight.loading > 0 && <div>计重: {summaryTotals.weight.loading.toFixed(2)} / {summaryTotals.weight.unloading.toFixed(2)} 吨</div>}
                  {summaryTotals.trips.count > 0 && <div>计车: {summaryTotals.trips.count} 车</div>}
                  {summaryTotals.volume.loading > 0 && <div>计体积: {summaryTotals.volume.loading.toFixed(2)} / {summaryTotals.volume.unloading.toFixed(2)} 立方</div>}
                </TableCell>
                <TableCell className="text-slate-500 py-3">
                  <CurrencyDisplay value={summaryTotals.currentCost} /> / <CurrencyDisplay value={summaryTotals.extraCost} />
                </TableCell>
                <TableCell className="text-slate-600 py-3">
                  <CurrencyDisplay value={summaryTotals.driverPayable} />
                </TableCell>
                {/* 隐藏状态列 */}
                {/* <TableCell></TableCell> */}
                <TableCell></TableCell>
                <TableCell></TableCell>
              </TableRow>
            </tfoot>
          )}
        </Table>
      </div>
      {/* 完整的分页控件 */}
      <div className="flex items-center justify-between py-4 px-6 border-t border-gray-200 bg-white">
        {/* 左侧：本页合计信息 */}
        <div className="flex-1 text-sm text-slate-600">
          <span className="text-slate-600">本页合计:</span>
          <span className="ml-3 text-slate-700">运费 <CurrencyDisplay value={summaryTotals.currentCost} /></span>
          <span className="ml-3 text-slate-700">额外 <CurrencyDisplay value={summaryTotals.extraCost} /></span>
          <span className="ml-3 text-slate-700">应付款司机 <CurrencyDisplay value={summaryTotals.driverPayable} /></span>
          <span className="ml-3 text-slate-600">共{pagination.totalCount} 条记录</span>
        </div>
        
        {/* 右侧：分页控制 */}
        <div className="flex items-center space-x-4">
          {/* 每页显示条数选择 */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-600">每页显示</span>
            <select
              value={pagination.pageSize}
              onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-slate-600">条</span>
          </div>
          
          {/* 分页按钮 */}
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handlePageChange(pagination.currentPage - 1)} 
              disabled={pagination.currentPage <= 1}
              className="px-3 py-1 text-sm border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors duration-150"
            >
              上一页
            </Button>
            
            {/* 页码输入 */}
            <div className="flex items-center space-x-1">
              <span className="text-sm text-slate-600">第</span>
              <input
                type="number"
                value={pagination.currentPage}
                onChange={(e) => {
                  const page = Number(e.target.value);
                  if (page >= 1 && page <= Math.ceil(pagination.totalCount / pagination.pageSize)) {
                    handlePageChange(page);
                  }
                }}
                className="w-10 px-1 py-1 text-sm text-center border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                min="1"
                max={Math.ceil(pagination.totalCount / pagination.pageSize)}
              />
              <span className="text-sm text-slate-600">页,共{Math.ceil(pagination.totalCount / pagination.pageSize)}页</span>
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handlePageChange(pagination.currentPage + 1)} 
              disabled={pagination.currentPage >= Math.ceil(pagination.totalCount / pagination.pageSize)}
              className="px-3 py-1 text-sm border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors duration-150"
            >
              下一页
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
