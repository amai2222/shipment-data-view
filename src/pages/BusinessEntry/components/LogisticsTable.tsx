// 正确路径: src/pages/BusinessEntry/components/LogisticsTable.tsx

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Trash2, Loader2 } from "lucide-react"; // [核心移除] - 移除了 Edit 图标
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LogisticsRecord } from '../types';

interface LogisticsTableProps {
  records: LogisticsRecord[];
  loading: boolean;
  summary: any;
  pagination: { currentPage: number; totalPages: number; };
  setPagination: React.Dispatch<React.SetStateAction<{ currentPage: number; totalPages: number; }>>;
  // [核心移除] - 移除了 onEdit prop
  onDelete: (id: string) => void;
  onView: (record: LogisticsRecord) => void;
}

export function LogisticsTable({ records, loading, summary, pagination, setPagination, onDelete, onView }: LogisticsTableProps) {
  const { currentPage, totalPages } = pagination;

  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            {/* [核心移除] - 调整表头，因为操作列变窄 */}
            <TableRow>
              <TableHead>运单编号</TableHead><TableHead>项目</TableHead><TableHead>合作链路</TableHead>
              <TableHead>司机</TableHead><TableHead>路线</TableHead><TableHead>装货日期</TableHead>
              <TableHead>运费</TableHead><TableHead>额外费</TableHead><TableHead>司机应收</TableHead>
              <TableHead className="text-right w-[50px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={10} className="text-center h-24"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
            ) : records.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center h-24">在当前筛选条件下没有找到记录</TableCell></TableRow>
            ) : (
              records.map((record) => (
                <TableRow key={record.id} onClick={() => onView(record)} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-mono">{record.auto_number}</TableCell>
                  <TableCell>{record.project_name}</TableCell>
                  <TableCell>{record.chain_name || '默认'}</TableCell>
                  <TableCell>{record.driver_name}</TableCell>
                  <TableCell>{record.loading_location} → {record.unloading_location}</TableCell>
                  <TableCell>{record.loading_date ? record.loading_date.split('T')[0] : '-'}</TableCell>
                  <TableCell className="font-mono">{record.current_cost != null ? `¥${record.current_cost.toFixed(2)}` : '-'}</TableCell>
                  <TableCell className="font-mono text-orange-600">{record.extra_cost != null ? `¥${record.extra_cost.toFixed(2)}` : '-'}</TableCell>
                  <TableCell className="font-mono text-green-600 font-semibold">{record.payable_cost != null ? `¥${record.payable_cost.toFixed(2)}` : '-'}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {/* [核心移除] - 移除了编辑按钮 */}
                    <ConfirmDialog title="确认删除" description={`您确定要删除运单 ${record.auto_number} 吗？此操作不可恢复。`} onConfirm={() => onDelete(record.id)}>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </ConfirmDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination>
        <PaginationContent>
          <PaginationItem><Button variant="outline" size="sm" onClick={() => setPagination(p => ({ ...p, currentPage: Math.max(1, p.currentPage - 1) }))} disabled={currentPage <= 1 || loading}>上一页</Button></PaginationItem>
          <PaginationItem><span className="p-2 text-sm">第 {currentPage} 页 / 共 {totalPages} 页</span></PaginationItem>
          <PaginationItem><Button variant="outline" size="sm" onClick={() => setPagination(p => ({ ...p, currentPage: Math.min(totalPages, p.currentPage + 1) }))} disabled={currentPage >= totalPages || loading}>下一页</Button></PaginationItem>
        </PaginationContent>
      </Pagination>

      <div className="flex items-center justify-end space-x-6 rounded-lg border p-4 text-sm font-medium">
        <span>当前页合计:</span>
        <span className="font-bold">装: <span className="text-primary">{summary.totalLoadingWeight.toFixed(2)}吨</span></span>
        <span className="font-bold">卸: <span className="text-primary">{summary.totalUnloadingWeight.toFixed(2)}吨</span></span>
        <span className="font-bold">{summary.actualCount}实际 / {summary.returnCount}退货</span>
        <span>司机运费: <span className="font-bold text-primary">¥{summary.totalCurrentCost.toFixed(2)}</span></span>
        <span>额外费用: <span className="font-bold text-orange-600">¥{summary.totalExtraCost.toFixed(2)}</span></span>
        <span>司机应收: <span className="font-bold text-green-600">¥{summary.totalDriverPayableCost.toFixed(2)}</span></span>
      </div>
    </>
  );
}
