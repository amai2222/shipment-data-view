// 文件路径: src/pages/BusinessEntry/components/LogisticsTable.tsx
// 描述: [a8ibs] 运单表格组件，已根据您的要求完成功能升级。

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Trash2, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LogisticsRecord, PaginationState } from '../types';

// 定义组件接收的属性
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

  // [修改] 路线格式化函数，将长地址提炼为简称
  const formatRoute = (loadingLoc: string, unloadingLoc: string) => {
    const start = (loadingLoc || '未知').slice(0, 2);
    const end = (unloadingLoc || '未知').slice(0, 2);
    return `${start} → ${end}`;
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
              {/* [新增] 增加车牌号和司机电话的表头 */}
              <TableHead className="w-[120px]">车牌号</TableHead>
              <TableHead className="w-[130px]">司机电话</TableHead>
              <TableHead className="w-[120px]">路线</TableHead>
              <TableHead>装/卸重量 (吨)</TableHead>
              <TableHead>司机应收 (元)</TableHead>
              <TableHead className="w-[100px]">状态</TableHead>
              <TableHead className="w-[80px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center">
                  <div className="flex justify-center items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    正在加载数据...
                  </div>
                </TableCell>
              </TableRow>
            ) : records.length > 0 ? (
              records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-mono">{record.auto_number}</TableCell>
                  <TableCell>{record.project_name}</TableCell>
                  <TableCell>{record.driver_name}</TableCell>
                  {/* [新增] 渲染车牌号和司机电话，并提供'未填写'作为后备显示 */}
                  <TableCell>{record.license_plate || '未填写'}</TableCell>
                  <TableCell className="font-mono">{record.driver_phone || '未填写'}</TableCell>
                  {/* [修改] 使用新的格式化函数来显示路线 */}
                  <TableCell>{formatRoute(record.loading_location, record.unloading_location)}</TableCell>
                  <TableCell>{record.loading_weight} / {record.unloading_weight}</TableCell>
                  <TableCell className="font-semibold text-primary font-mono">¥{record.driver_payable_cost.toFixed(2)}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs rounded-full ${record.transport_type === '退货运输' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                      {record.transport_type}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">打开菜单</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView(record)}>
                          <Eye className="mr-2 h-4 w-4" />
                          查看详情
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
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center">
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(pagination.currentPage - 1)}
          disabled={pagination.currentPage <= 1}
        >
          上一页
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(pagination.currentPage + 1)}
          disabled={pagination.currentPage >= Math.ceil(pagination.totalCount / pagination.pageSize)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
};
