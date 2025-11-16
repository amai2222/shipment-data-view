// PC端 - 车辆状态（参考操作日志布局）

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { PageHeader } from '@/components/PageHeader';
import { PaginationControl } from '@/components/common';
import {
  Truck,
  CheckCircle,
  Wrench,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';

export default function VehicleStatus() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('internal_vehicles')
        .select('license_plate, vehicle_status, current_mileage, updated_at')
        .order('license_plate');
      setVehicles(data || []);
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return { label: '正常使用', color: 'bg-green-100 text-green-800', icon: CheckCircle };
      case 'maintenance':
        return { label: '维修中', color: 'bg-yellow-100 text-yellow-800', icon: Wrench };
      case 'retired':
        return { label: '已报废', color: 'bg-gray-100 text-gray-800', icon: AlertTriangle };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800', icon: Truck };
    }
  };

  const stats = {
    active: vehicles.filter(v => v.vehicle_status === 'active').length,
    maintenance: vehicles.filter(v => v.vehicle_status === 'maintenance').length,
    retired: vehicles.filter(v => v.vehicle_status === 'retired').length
  };

  const paginatedVehicles = vehicles.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(vehicles.length / pageSize);
  
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // 重置到第一页
  };

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="车辆状态"
        description="实时查看车辆运行状态和里程信息"
        icon={Truck}
        iconColor="text-green-600"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                车辆状态监控
              </CardTitle>
              <CardDescription>
                正常 {stats.active} | 维修 {stats.maintenance} | 报废 {stats.retired}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadVehicles} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>状态列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>车牌号</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">当前里程</TableHead>
                  <TableHead>最后更新</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : paginatedVehicles.map((v, i) => {
                  const config = getStatusConfig(v.vehicle_status);
                  const Icon = config.icon;
                  return (
                    <TableRow key={i} className="hover:bg-muted/50">
                      <TableCell className="font-semibold">{v.license_plate}</TableCell>
                      <TableCell>
                        <Badge className={config.color}>
                          <Icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {v.current_mileage ? `${(v.current_mileage / 10000).toFixed(1)}万公里` : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {v.updated_at ? format(new Date(v.updated_at), 'yyyy-MM-dd HH:mm') : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {!loading && vehicles.length > 0 && (
            <PaginationControl
              currentPage={currentPage}
              pageSize={pageSize}
              totalPages={totalPages}
              totalCount={vehicles.length}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
