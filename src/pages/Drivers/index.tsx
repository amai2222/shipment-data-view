// 司机管理 - 完整重构版本
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/PageHeader';
import { Users, Plus, Edit, Trash2, Search } from 'lucide-react';
import { useDriverData } from './hooks/useDriverData';
import { useDebounce } from '@/hooks/useDebounce';
import { LoadingState } from '@/components/common';

export default function Drivers() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const { drivers, loading, fetchDrivers, deleteDriver } = useDriverData();

  useEffect(() => {
    fetchDrivers(debouncedSearch);
  }, [debouncedSearch, fetchDrivers]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title="司机管理" description="管理司机信息" icon={Users} iconColor="text-blue-600" />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>司机列表 ({drivers.length})</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索司机姓名、电话、车牌..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                添加司机
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <LoadingState /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>电话</TableHead>
                  <TableHead>车牌号</TableHead>
                  <TableHead>银行账号</TableHead>
                  <TableHead>地址</TableHead>
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((driver: any) => (
                  <TableRow key={driver.id}>
                    <TableCell className="font-medium">{driver.name}</TableCell>
                    <TableCell>{driver.phone || '-'}</TableCell>
                    <TableCell className="font-mono">{driver.license_plate || '-'}</TableCell>
                    <TableCell className="font-mono text-sm">{driver.bank_account || '-'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{driver.address || '-'}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => deleteDriver(driver.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
