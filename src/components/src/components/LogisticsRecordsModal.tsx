// 文件路径: src/components/LogisticsRecordsModal.tsx
// 描述: 用于显示每日运单详情的弹窗组件。

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Record {
  id: string;
  auto_number: string;
  driver_name: string;
  license_plate: string;
  loading_weight: number;
  unloading_weight: number;
  current_cost: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  records: Record[];
}

const formatNumber = (val: number | null | undefined) => (val || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

export const LogisticsRecordsModal = ({ isOpen, onClose, date, records }: Props) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>运单详情</DialogTitle>
          <DialogDescription>
            日期: {date}，共 {records.length} 条记录
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>运单号</TableHead>
                <TableHead>司机</TableHead>
                <TableHead>车牌</TableHead>
                <TableHead className="text-right">装货重量 (吨)</TableHead>
                <TableHead className="text-right">卸货重量 (吨)</TableHead>
                <TableHead className="text-right">应收 (元)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length > 0 ? (
                records.map(record => (
                  <TableRow key={record.id}>
                    <TableCell className="font-mono">{record.auto_number}</TableCell>
                    <TableCell>{record.driver_name}</TableCell>
                    <TableCell>{record.license_plate}</TableCell>
                    <TableCell className="text-right">{formatNumber(record.loading_weight)}</TableCell>
                    <TableCell className="text-right">{formatNumber(record.unloading_weight)}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">{formatNumber(record.current_cost)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">该日无运单记录</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
};
