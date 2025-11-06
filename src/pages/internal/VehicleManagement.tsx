// PC端 - 车辆档案管理（参考操作日志布局）

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
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
import {
  Truck,
  Plus,
  Edit,
  Search,
  Filter,
  FileText,
  AlertTriangle,
  CheckCircle,
  Wrench,
  RefreshCw,
  Download,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';

interface Vehicle {
  id: string;
  license_plate: string;
  vehicle_number: string;
  vehicle_type: string;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_status: string;
  load_capacity: number;
  manufacture_year: number;
  current_mileage: number;
  driving_license_expire_date: string | null;
  insurance_expire_date: string | null;
  annual_inspection_date: string | null;
  driver_name: string | null;
}

export default function VehicleManagement() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    loadVehicles();
  }, [statusFilter]);

  const loadVehicles = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('internal_vehicles')
        .select(`
          *,
          driver:internal_driver_vehicle_relations(
            driver:internal_drivers(name)
          )
        `)
        .order('license_plate');

      if (statusFilter !== 'all') {
        query = query.eq('vehicle_status', statusFilter);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      const processedData = (data || []).map((v: any) => ({
        ...v,
        driver_name: v.driver?.[0]?.driver?.name || null
      }));
      
      setVehicles(processedData);
    } catch (error) {
      console.error('加载失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载车辆数据',
        variant: 'destructive'
      });
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

  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const daysLeft = Math.floor((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysLeft > 0 && daysLeft <= 30;
  };

  const filteredVehicles = vehicles.filter(v =>
    v.license_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.vehicle_brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.driver_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: vehicles.length,
    active: vehicles.filter(v => v.vehicle_status === 'active').length,
    maintenance: vehicles.filter(v => v.vehicle_status === 'maintenance').length,
    expiring: vehicles.filter(v => 
      isExpiringSoon(v.driving_license_expire_date) || 
      isExpiringSoon(v.insurance_expire_date) ||
      isExpiringSoon(v.annual_inspection_date)
    ).length
  };

  const paginatedVehicles = filteredVehicles.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(filteredVehicles.length / pageSize);

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="车辆档案管理"
        description="管理内部车辆档案、证件、维保记录"
        icon={Truck}
        iconColor="text-blue-600"
      />

      {/* 操作栏卡片 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                车辆查询
              </CardTitle>
              <CardDescription>
                共 {stats.total} 辆车辆 | 在用 {stats.active} | 维修 {stats.maintenance} | 证件到期 {stats.expiring}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                {showFilters ? '隐藏' : '显示'}筛选
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadVehicles}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                导出
              </Button>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                新增车辆
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* 筛选器 */}
        {showFilters && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>搜索</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="车牌号、品牌、司机..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label>车辆状态</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="active">正常使用</SelectItem>
                    <SelectItem value="maintenance">维修中</SelectItem>
                    <SelectItem value="retired">已报废</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>显示数量</Label>
                <Select value={pageSize.toString()} disabled>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20条/页</SelectItem>
                    <SelectItem value="50">50条/页</SelectItem>
                    <SelectItem value="100">100条/页</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}>
                清除筛选
              </Button>
              <Button onClick={loadVehicles}>
                应用筛选
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 车辆列表卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>车辆列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>车牌号</TableHead>
                  <TableHead>车辆编号</TableHead>
                  <TableHead>品牌型号</TableHead>
                  <TableHead>车型</TableHead>
                  <TableHead className="text-center">载重</TableHead>
                  <TableHead>驾驶员</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">里程</TableHead>
                  <TableHead className="text-center">证件状态</TableHead>
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : paginatedVehicles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      暂无车辆数据
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedVehicles.map(vehicle => {
                    const statusConfig = getStatusConfig(vehicle.vehicle_status);
                    const StatusIcon = statusConfig.icon;
                    const hasExpiringCert = 
                      isExpiringSoon(vehicle.driving_license_expire_date) || 
                      isExpiringSoon(vehicle.insurance_expire_date) ||
                      isExpiringSoon(vehicle.annual_inspection_date);
                    
                    return (
                      <TableRow key={vehicle.id} className="hover:bg-muted/50">
                        <TableCell className="font-semibold">{vehicle.license_plate}</TableCell>
                        <TableCell className="text-muted-foreground">{vehicle.vehicle_number || '-'}</TableCell>
                        <TableCell>
                          <div>{vehicle.vehicle_brand} {vehicle.vehicle_model}</div>
                          <div className="text-xs text-muted-foreground">{vehicle.manufacture_year}年</div>
                        </TableCell>
                        <TableCell>{vehicle.vehicle_type}</TableCell>
                        <TableCell className="text-center font-medium">{vehicle.load_capacity}吨</TableCell>
                        <TableCell>
                          {vehicle.driver_name || <span className="text-muted-foreground text-sm">未分配</span>}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusConfig.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {vehicle.current_mileage ? 
                            <span className="text-sm">{(vehicle.current_mileage / 10000).toFixed(1)}万公里</span> : 
                            '-'
                          }
                        </TableCell>
                        <TableCell className="text-center">
                          {hasExpiringCert ? (
                            <Badge className="bg-red-100 text-red-700">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              即将到期
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600">
                              正常
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-1 justify-center">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setSelectedVehicle(vehicle);
                                setShowDetailDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* 分页 */}
          {!loading && filteredVehicles.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                显示 {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, filteredVehicles.length)} 条，共 {filteredVehicles.length} 条
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  上一页
                </Button>
                <div className="flex items-center gap-2">
                  <span className="text-sm">第 {page} / {totalPages} 页</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 车辆详情对话框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          {selectedVehicle && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  车辆详细信息
                </DialogTitle>
                <DialogDescription>
                  {selectedVehicle.license_plate}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">车牌号</Label>
                    <p className="font-semibold">{selectedVehicle.license_plate}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">车辆编号</Label>
                    <p>{selectedVehicle.vehicle_number || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">品牌型号</Label>
                    <p>{selectedVehicle.vehicle_brand} {selectedVehicle.vehicle_model}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">车型</Label>
                    <p>{selectedVehicle.vehicle_type}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">载重</Label>
                    <p className="font-medium">{selectedVehicle.load_capacity}吨</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">出厂年份</Label>
                    <p>{selectedVehicle.manufacture_year}年</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">当前驾驶员</Label>
                    <p>{selectedVehicle.driver_name || '未分配'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">当前里程</Label>
                    <p>
                      {selectedVehicle.current_mileage ? 
                        `${(selectedVehicle.current_mileage / 10000).toFixed(1)}万公里` : 
                        '-'
                      }
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Label className="text-lg font-semibold">证件信息</Label>
                  <div className="grid grid-cols-1 gap-3 mt-3">
                    {selectedVehicle.driving_license_expire_date && (
                      <div className="flex justify-between items-center p-3 bg-muted rounded-md">
                        <div>
                          <p className="font-medium">行驶证到期日期</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(selectedVehicle.driving_license_expire_date), 'yyyy-MM-dd')}
                          </p>
                        </div>
                        {isExpiringSoon(selectedVehicle.driving_license_expire_date) && (
                          <Badge className="bg-red-100 text-red-700">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            即将到期
                          </Badge>
                        )}
                      </div>
                    )}
                    {selectedVehicle.insurance_expire_date && (
                      <div className="flex justify-between items-center p-3 bg-muted rounded-md">
                        <div>
                          <p className="font-medium">保险到期日期</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(selectedVehicle.insurance_expire_date), 'yyyy-MM-dd')}
                          </p>
                        </div>
                        {isExpiringSoon(selectedVehicle.insurance_expire_date) && (
                          <Badge className="bg-red-100 text-red-700">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            即将到期
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
