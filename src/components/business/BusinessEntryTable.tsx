import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";

interface LogisticsRecord {
  id: string;
  auto_number: string;
  project_id: string;
  project_name: string;
  chain_id: string | null;
  chain_name: string | null;
  driver_id: string;
  driver_name: string;
  loading_location: string;
  unloading_location: string;
  loading_date: string;
  unloading_date: string | null;
  loading_weight: number | null;
  unloading_weight: number | null;
  current_cost: number | null;
  payable_cost: number | null;
  license_plate: string | null;
  driver_phone: string | null;
  transport_type: string | null;
  extra_cost: number | null;
  remarks: string | null;
}

interface BusinessEntryTableProps {
  records: LogisticsRecord[];
  loading: boolean;
  onEdit: (record: LogisticsRecord) => void;
  onDelete: (id: string) => void;
  onViewDetails: (record: LogisticsRecord) => void;
}

export function BusinessEntryTable({
  records,
  loading,
  onEdit,
  onDelete,
  onViewDetails
}: BusinessEntryTableProps) {
  if (loading) {
    return (
      <div className="border rounded-lg">
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="border rounded-lg">
        <div className="p-8 text-center text-muted-foreground">
          暂无运单记录
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">运单号</TableHead>
            <TableHead>项目名称</TableHead>
            <TableHead>司机姓名</TableHead>
            <TableHead>装货地点</TableHead>
            <TableHead>卸货地点</TableHead>
            <TableHead>装货日期</TableHead>
            <TableHead>装货重量</TableHead>
            <TableHead>卸货重量</TableHead>
            <TableHead>运输类型</TableHead>
            <TableHead>运费金额</TableHead>
            <TableHead>额外费用</TableHead>
            <TableHead>司机应付</TableHead>
            <TableHead className="w-[120px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow 
              key={record.id} 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onViewDetails(record)}
            >
              <TableCell className="font-mono text-sm">{record.auto_number}</TableCell>
              <TableCell>{record.project_name}</TableCell>
              <TableCell>{record.driver_name}</TableCell>
              <TableCell>{record.loading_location}</TableCell>
              <TableCell>{record.unloading_location}</TableCell>
              <TableCell>{record.loading_date}</TableCell>
              <TableCell>{record.loading_weight ? `${record.loading_weight}吨` : '-'}</TableCell>
              <TableCell>{record.unloading_weight ? `${record.unloading_weight}吨` : '-'}</TableCell>
              <TableCell>
                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                  record.transport_type === '实际运输' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-orange-100 text-orange-800'
                }`}>
                  {record.transport_type || '实际运输'}
                </span>
              </TableCell>
              <TableCell>{record.current_cost ? `¥${record.current_cost.toFixed(2)}` : '-'}</TableCell>
              <TableCell>{record.extra_cost ? `¥${record.extra_cost.toFixed(2)}` : '-'}</TableCell>
              <TableCell>{record.payable_cost ? `¥${record.payable_cost.toFixed(2)}` : '-'}</TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(record)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(record.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}