// 司机列表表格组件
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Phone, Car } from 'lucide-react';
import type { Driver } from '@/types/managementPages';

interface DriverTableProps {
  drivers: Driver[];
  onEdit: (driver: Driver) => void;
  onDelete: (id: string) => void;
}

export function DriverTable({ drivers, onEdit, onDelete }: DriverTableProps) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>姓名</TableHead>
            <TableHead>
              <div className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                电话
              </div>
            </TableHead>
            <TableHead>
              <div className="flex items-center gap-1">
                <Car className="h-4 w-4" />
                车牌号
              </div>
            </TableHead>
            <TableHead>身份证号</TableHead>
            <TableHead>银行账号</TableHead>
            <TableHead>地址</TableHead>
            <TableHead className="text-center">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {drivers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                暂无司机数据
              </TableCell>
            </TableRow>
          ) : (
            drivers.map((driver) => (
              <TableRow key={driver.id} className="hover:bg-muted/50">
                <TableCell className="font-medium">{driver.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {driver.phone || '-'}
                    {driver.phone && (
                      <Badge variant="outline" className="text-xs">已验证</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono">{driver.license_plate || '-'}</TableCell>
                <TableCell className="font-mono text-sm">{driver.id_number || '-'}</TableCell>
                <TableCell className="font-mono text-sm">{driver.bank_account || '-'}</TableCell>
                <TableCell className="max-w-[200px] truncate text-sm">{driver.address || '-'}</TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(driver)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => onDelete(driver.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

