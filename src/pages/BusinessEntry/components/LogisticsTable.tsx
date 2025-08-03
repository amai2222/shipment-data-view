// 文件路径: src/pages/BusinessEntry/components/LogisticsTable.tsx
// 描述: [BwxPy 最终复原版] 严格遵从您的指令。已在前端恢复“司机应收=运费+额外费”的动态计算逻辑。

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LogisticsRecord, PaginationState } from '../types';

interface LogisticsTableProps {
  records: LogisticsRecord[];
  loading: boolean;
  pagination: PaginationState;
  setPagination: React.Dispatch<React.SetStateAction<PaginationState>>;
  onDelete: (id: string, autoNumber: string) => void;
  onView: (record: LogisticsRecord) => void;
}

export const LogisticsTable = ({ records, loading, pagination, setPagination, onDelete, onView }: LogisticsTableProps) => {
  
  const handlePageChange = (newPage: number) => {
    setPagination(p => ({ ...p, currentPage: newPage }));
  };

  const formatRoute = (loadingLoc: string, unloadingLoc:string) => {
    const start = (loadingLoc || '未知').slice(0, 2);
    const end = (unloadingLoc || '未知').slice(0, 2);
    return `${start} → ${end}`;
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return '¥0.00';
    return `¥${value.toFixed(2)}`;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">运单编号</TableHead>
              <TableHead>项目</TableHead>
              <TableHead>司机</TableHead>
              <TableHead className="w-[120px]">车牌号</TableHead>
              <TableHead className="w-[130px]">司机电话</TableHead>
              <TableHead className="w-[120px]">路线</TableHead>
              <TableHead>装/卸重量 (吨)</TableHead>
              <TableHead>运费 (元)</TableHead>
              <TableHead>额外费 (元)</TableHead>
              <TableHead className="font-bold">司机应收 (元)</TableHead>
              <TableHead className="w-[100px]">状态</TableHead>
              <TableHead className="w-[80px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={12} className="h-24 text-center">
                  <div className="flex justify-center items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    正在加载数据...
                  </div>
                </TableCell>
              </TableRow>
            ) : records.length > 0 ? (
              records.map((record) => {
                // [核心修复] 恢复您被我删除的前端动态计算逻辑
                const driverPayable = (record.current_cost || 0) + (record.extra_cost || 0);

                return (
                  <TableRow 
                    key={record.id} 
                    onClick={() => onView(record)}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="font-mono">{record.auto_number}</TableCell>
                    <TableCell>{record.project_name}</TableCell>
                    <TableCell>{record.driver_name}</TableCell>
                    <TableCell>{record.license_plate || '未填写'}</TableCell>
                    <TableCell className="font-mono">{record.driver_phone || '未填写'}</TableCell>
                    <TableCell>{formatRoute(record.loading_location, record.unloading_location)}</TableCell>
                    <TableCell>{record.loading_weight || '-'} / {record.unloading_weight || '-'}</TableCell>
                    <TableCell className="font-mono">{formatCurrency(record.current_cost)}</TableCell>
                    <TableCell className="font-mono text-orange-600">{formatCurrency(record.extra_cost)}</TableCell>
                    {/* [核心修复] 使用刚刚在前端计算出的值 */}
                    <TableCell className="font-mono font-bold text-primary">{formatCurrency(driverPayable)}</TableCell>
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
                <TableCell colSpan={12} className="h-24 text-center">
                  没有找到匹配的记录。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
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
