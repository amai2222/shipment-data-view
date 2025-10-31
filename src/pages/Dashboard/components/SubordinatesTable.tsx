import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface SubordinateShipper {
  shipper_id: string;
  shipper_name: string;
  hierarchy_depth: number;
  parent_id: string | null;
  parent_name: string | null;
  record_count: number;
  total_weight: number;
  total_amount: number;
  active_projects: number;
  pending_payments: number;
  pending_invoices: number;
}

interface SubordinatesTableProps {
  data: SubordinateShipper[];
}

// 格式化数字
const formatNumber = (num: number) => {
  if (num >= 10000) return `${(num / 10000).toFixed(2)}万`;
  return num.toLocaleString('zh-CN');
};

// 格式化金额
const formatCurrency = (num: number) => {
  if (num >= 10000) return `¥${(num / 10000).toFixed(2)}万`;
  return `¥${num.toLocaleString('zh-CN')}`;
};

// 格式化重量
const formatWeight = (num: number) => {
  return `${num.toFixed(2)}吨`;
};

export function SubordinatesTable({ data }: SubordinatesTableProps) {
  if (data.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>下级货主</CardTitle>
        <CardDescription>下级货主的运单统计</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>货主名称</TableHead>
              <TableHead>层级</TableHead>
              <TableHead>运单数</TableHead>
              <TableHead>总重量</TableHead>
              <TableHead>总金额</TableHead>
              <TableHead>活跃项目</TableHead>
              <TableHead>待付款</TableHead>
              <TableHead>待开票</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((shipper) => (
              <TableRow key={shipper.shipper_id}>
                <TableCell className="font-medium">{shipper.shipper_name}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    第{shipper.hierarchy_depth}级
                  </Badge>
                </TableCell>
                <TableCell>{formatNumber(shipper.record_count)}</TableCell>
                <TableCell>{formatWeight(shipper.total_weight)}</TableCell>
                <TableCell>{formatCurrency(shipper.total_amount)}</TableCell>
                <TableCell>{shipper.active_projects}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {shipper.pending_payments}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {shipper.pending_invoices}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

