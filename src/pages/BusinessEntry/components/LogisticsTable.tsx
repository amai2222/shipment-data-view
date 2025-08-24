// 文件路径: src/pages/BusinessEntry/components/LogisticsTable.tsx
// 描述: [最终修正版] 实现了单排显示、列合并、动态数量单位和统一的财务格式化。

import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Loader2, ChevronsUpDown, ChevronUp, ChevronDown, Edit } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LogisticsRecord, PaginationState } from '../types';

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
  billingTypes?: { [key: number]: string };
}

export const LogisticsTable = ({ records, loading, pagination, setPagination, onDelete, onView, onEdit, sortField, sortDirection, onSort, billingTypes = {} }: LogisticsTableProps) => {
  
  const handlePageChange = (newPage: number) => {
    setPagination(p => ({ ...p, currentPage: newPage }));
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
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader field="auto_number" className="w-[120px]">运单编号</SortableHeader>
              <SortableHeader field="project_name">项目</SortableHeader>
              <SortableHeader field="loading_date" className="w-[100px]">装货日期</SortableHeader>
              <SortableHeader field="driver_name">司机信息</SortableHeader>
              <SortableHeader field="loading_location" className="w-[120px]">路线</SortableHeader>
              {/* [修改] 合并为单一的“数量”列 */}
              <SortableHeader field="loading_weight" className="w-[150px]">数量</SortableHeader>
              <SortableHeader field="current_cost" className="w-[120px]">运费/额外费</SortableHeader>
              <SortableHeader field="driver_payable_cost" className="w-[100px]">司机应收</SortableHeader>
              <SortableHeader field="transport_type" className="w-[100px]">状态</SortableHeader>
              <TableHead className="w-[80px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                {/* [修改] 更新 colSpan */}
                <TableCell colSpan={10} className="h-24 text-center">
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
                    onClick={() => onView(record)}
                    // [修改] 添加 whitespace-nowrap 以实现单排显示
                    className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                  >
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
                    <TableCell>{formatRoute(record.loading_location, record.unloading_location)}</TableCell>
                    {/* [修改] 使用统一的显示函数 */}
                    <TableCell className="font-mono text-sm">{getQuantityDisplay(record)}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatCurrency(record.current_cost)} / {formatCurrency(record.extra_cost)}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-semibold text-primary">
                      {formatCurrency(driverPayable)}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs rounded-full ${record.transport_type === '退货运输' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                        {record.transport_type}
                      </span>
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
                {/* [修改] 更新 colSpan */}
                <TableCell colSpan={10} className="h-24 text-center">
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
                <TableCell></TableCell>
                <TableCell></TableCell>
              </TableRow>
            </tfoot>
          )}
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          第 {pagination.currentPage} 页 / 共 {Math.ceil(pagination.totalCount / pagination.pageSize)} 页 (总计 {pagination.totalCount} 条记录)
        </div>
        <Button variant="outline" size="sm" onClick={() => handlePageChange(pagination.currentPage - 1)} disabled={pagination.currentPage <= 1}>上一页</Button>
        <Button variant="outline" size="sm" onClick={() => handlePageChange(pagination.currentPage + 1)} disabled={pagination.currentPage >= Math.ceil(pagination.totalCount / pagination.pageSize)}>下一页</Button>
      </div>
    </div>
  );
};
