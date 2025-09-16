// 文件路径: src/pages/BusinessEntry/components/LogisticsTable.tsx
// 描述: [最终修正版] 实现了单排显示、列合并、动态数量单位和统一的财务格式化。

import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Loader2, ChevronsUpDown, ChevronUp, ChevronDown, Edit, FileText, CheckSquare, Square } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LogisticsRecord, PaginationState } from '../types';
import { RouteDisplay } from '@/components/RouteDisplay';
import { TransportDocumentGenerator, generatePrintVersion } from '@/components/TransportDocumentGenerator';

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
}

export const LogisticsTable = ({ records, loading, pagination, setPagination, onDelete, onView, onEdit, sortField, sortDirection, onSort, onPageSizeChange, billingTypes = {}, onBatchAction, isBatchMode = false, onToggleBatchMode }: LogisticsTableProps) => {
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  
  const handlePageChange = (newPage: number) => {
    setPagination(p => ({ ...p, currentPage: newPage }));
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

  const handleSelectAll = () => {
    if (selectedRecords.size === records.length) {
      setSelectedRecords(new Set());
    } else {
      setSelectedRecords(new Set(records.map(r => r.id)));
    }
  };

  const handleSelectCurrentPage = () => {
    const currentPageRecords = records.map(r => r.id);
    const allCurrentPageSelected = currentPageRecords.every(id => selectedRecords.has(id));
    
    if (allCurrentPageSelected) {
      // 取消选择当前页所有记录
      const newSelected = new Set(selectedRecords);
      currentPageRecords.forEach(id => newSelected.delete(id));
      setSelectedRecords(newSelected);
    } else {
      // 选择当前页所有记录
      const newSelected = new Set(selectedRecords);
      currentPageRecords.forEach(id => newSelected.add(id));
      setSelectedRecords(newSelected);
    }
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
      case 1: return `${loading.toFixed(2)} / ${unloading.toFixed(2)} 吨`;
      case 2: return `1 车`;
      case 3: return `${loading.toFixed(2)} / ${unloading.toFixed(2)} 立方`;
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectCurrentPage}
                className="text-blue-600 border-blue-300"
              >
                {records.every(r => selectedRecords.has(r.id)) ? '取消当页' : '当页全选'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="text-blue-600 border-blue-300"
              >
                全部记录
              </Button>
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

      <div className="rounded-md border overflow-x-auto">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              {isBatchMode && (
                <TableHead className="w-[50px] min-w-[50px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectCurrentPage}
                    className="h-8 w-8 p-0"
                    title={records.every(r => selectedRecords.has(r.id)) ? '取消当页全选' : '当页全选'}
                  >
                    {records.every(r => selectedRecords.has(r.id)) ? (
                      <CheckSquare className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </Button>
                </TableHead>
              )}
              <SortableHeader field="auto_number" className="w-[140px] min-w-[120px]">运单编号</SortableHeader>
              <SortableHeader field="project_name" className="w-[120px] min-w-[100px]">项目</SortableHeader>
              <SortableHeader field="loading_date" className="w-[100px] min-w-[80px]">装货日期</SortableHeader>
              <SortableHeader field="driver_name" className="w-[180px] min-w-[150px]">司机信息</SortableHeader>
              <SortableHeader field="loading_location" className="w-[160px] min-w-[140px]">路线</SortableHeader>
              <SortableHeader field="loading_weight" className="w-[140px] min-w-[120px]">数量</SortableHeader>
              <SortableHeader field="current_cost" className="w-[140px] min-w-[120px]">运费/额外费</SortableHeader>
              <SortableHeader field="driver_payable_cost" className="w-[120px] min-w-[100px]">司机应收</SortableHeader>
              {/* 隐藏状态列 */}
              {/* <SortableHeader field="transport_type" className="w-[100px]">状态</SortableHeader> */}
              <TableHead className="w-[120px] min-w-[100px] text-center">运输单据</TableHead>
              <TableHead className="w-[80px] min-w-[60px] text-right">操作</TableHead>
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
                    // [修改] 添加 whitespace-nowrap 以实现单排显示
                    className={`hover:bg-muted/50 whitespace-nowrap ${isBatchMode ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    {isBatchMode && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSelectRecord(record.id)}
                          className="h-8 w-8 p-0"
                        >
                          {selectedRecords.has(record.id) ? (
                            <CheckSquare className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    )}
                    <TableCell className="font-mono">{record.auto_number}</TableCell>
                    <TableCell>{record.project_name}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(record.loading_date).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{record.driver_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {record.license_plate || '未填写'} | {record.driver_phone || '未填写'}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap min-w-[160px] w-[160px]" style={{ whiteSpace: 'nowrap', minWidth: '160px', width: '160px' }}>
                      <RouteDisplay 
                        loadingLocation={record.loading_location}
                        unloadingLocation={record.unloading_location}
                        variant="compact"
                      />
                    </TableCell>
                    {/* [修改] 使用统一的显示函数 */}
                    <TableCell className="font-mono text-sm">{getQuantityDisplay(record)}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatCurrency(record.current_cost)} / {formatCurrency(record.extra_cost)}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-semibold text-primary">
                      {formatCurrency(driverPayable)}
                    </TableCell>
                    {/* 隐藏状态列 */}
                    {/* <TableCell>
                      <span className={`px-2 py-1 text-xs rounded-full ${record.transport_type === '退货运输' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                        {record.transport_type}
                      </span>
                    </TableCell> */}
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          try {
                            // 生成运输单据PDF预览
                            const printHTML = generatePrintVersion(record);
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
                        className="text-blue-600 border-blue-300 hover:bg-blue-50"
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        单据
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            className="h-8 w-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="sr-only">打开菜单</span>
                            <MoreHorizontal className="h-4 w-4" />
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
            <tfoot className="bg-muted/50 font-medium whitespace-nowrap">
              <TableRow>
                <TableCell className="font-semibold">合计</TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell className="text-center font-semibold">{records.length} 条运单</TableCell>
                <TableCell></TableCell>
                <TableCell className="font-semibold font-mono text-xs">
                  {summaryTotals.weight.loading > 0 && <div>计重: {summaryTotals.weight.loading.toFixed(2)} / {summaryTotals.weight.unloading.toFixed(2)} 吨</div>}
                  {summaryTotals.trips.count > 0 && <div>计车: {summaryTotals.trips.count} 车</div>}
                  {summaryTotals.volume.loading > 0 && <div>计体积: {summaryTotals.volume.loading.toFixed(2)} / {summaryTotals.volume.unloading.toFixed(2)} 立方</div>}
                </TableCell>
                <TableCell className="font-semibold font-mono">
                  {formatCurrency(summaryTotals.currentCost)} / {formatCurrency(summaryTotals.extraCost)}
                </TableCell>
                <TableCell className="font-semibold font-mono text-primary">
                  {formatCurrency(summaryTotals.driverPayable)}
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
      <div className="flex items-center justify-between py-4 px-4 bg-gray-50 border-t">
        {/* 左侧：本页合计信息 */}
        <div className="flex-1 text-sm text-gray-700">
          <span className="font-medium">本页合计:</span>
          <span className="ml-2">运费 {formatCurrency(summaryTotals.currentCost)}</span>
          <span className="ml-2">额外 {formatCurrency(summaryTotals.extraCost)}</span>
          <span className="ml-2">应付款司机 {formatCurrency(summaryTotals.driverPayable)}</span>
          <span className="ml-2 font-medium">共{pagination.totalCount} 条记录</span>
        </div>
        
        {/* 右侧：分页控制 */}
        <div className="flex items-center space-x-4">
          {/* 每页显示条数选择 */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700">每页显示</span>
            <select
              value={pagination.pageSize}
              onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-700">条</span>
          </div>
          
          {/* 分页按钮 */}
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handlePageChange(pagination.currentPage - 1)} 
              disabled={pagination.currentPage <= 1}
              className="px-3 py-1 text-sm"
            >
              上一页
            </Button>
            
            {/* 页码输入 */}
            <div className="flex items-center space-x-1">
              <span className="text-sm text-gray-700">第</span>
              <input
                type="number"
                value={pagination.currentPage}
                onChange={(e) => {
                  const page = Number(e.target.value);
                  if (page >= 1 && page <= Math.ceil(pagination.totalCount / pagination.pageSize)) {
                    handlePageChange(page);
                  }
                }}
                className="w-12 px-2 py-1 text-sm text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                max={Math.ceil(pagination.totalCount / pagination.pageSize)}
              />
              <span className="text-sm text-gray-700">页,共{Math.ceil(pagination.totalCount / pagination.pageSize)}页</span>
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handlePageChange(pagination.currentPage + 1)} 
              disabled={pagination.currentPage >= Math.ceil(pagination.totalCount / pagination.pageSize)}
              className="px-3 py-1 text-sm"
            >
              下一页
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
