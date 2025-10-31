import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users } from "lucide-react";
import { format } from 'date-fns';

interface DriverReportRow { 
  driver_name: string; 
  license_plate: string; 
  phone: string; 
  daily_trip_count: number; 
  total_trip_count: number; 
  total_tonnage: number; 
  total_driver_receivable: number; 
  total_partner_payable: number; 
}

interface DriverReportTableProps {
  data: DriverReportRow[];
  projectName: string;
  reportDate: Date;
  unit: string;
  billingTypeId: number;
}

const formatNumber = (val: number | null | undefined, unit: string = '') => 
  `${(val || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}${unit ? ' ' + unit : ''}`;

export function DriverReportTable({
  data,
  projectName,
  reportDate,
  unit,
  billingTypeId,
}: DriverReportTableProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Users className="mr-2 h-5 w-5 text-purple-500" />
          <span className="text-purple-500">司机工作量报告</span>
          <span className="ml-1 text-base font-normal text-slate-600">
            ({projectName} - {format(reportDate, "yyyy-MM-dd")})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>司机</TableHead>
              <TableHead>车牌号</TableHead>
              <TableHead>电话</TableHead>
              <TableHead className="text-right">当日出车</TableHead>
              <TableHead className="text-right">总出车</TableHead>
              {billingTypeId !== 2 && (
                <TableHead className="text-right">当日数量 ({unit})</TableHead>
              )}
              <TableHead className="text-right">司机应收 (元)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length > 0 ? (
              data.map((row) => (
                <TableRow key={row.driver_name}>
                  <TableCell className="font-medium">{row.driver_name}</TableCell>
                  <TableCell>{row.license_plate || 'N/A'}</TableCell>
                  <TableCell>{row.phone || 'N/A'}</TableCell>
                  <TableCell className="text-right">{row.daily_trip_count}</TableCell>
                  <TableCell className="text-right">{row.total_trip_count}</TableCell>
                  {billingTypeId !== 2 && (
                    <TableCell className="text-right">{formatNumber(row.total_tonnage)}</TableCell>
                  )}
                  <TableCell className="text-right text-green-600 font-semibold">
                    {formatNumber(row.total_partner_payable)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={billingTypeId !== 2 ? 7 : 6} className="h-24 text-center text-slate-500">
                  该日无司机工作记录
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

