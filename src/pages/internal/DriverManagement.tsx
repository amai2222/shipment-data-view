// PC端 - 内部司机管理（参考操作日志布局）

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
import {
  Users,
  Plus,
  Edit,
  Search,
  Filter,
  FileText,
  DollarSign,
  Truck,
  RefreshCw,
  Download,
  AlertTriangle,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';

interface Driver {
  id: string;
  name: string;
  phone: string;
  hire_date: string;
  employment_status: string;
  base_salary: number;
  salary_calculation_type: string;
  commission_rate: number | null;
  primary_vehicle: string | null;
  driver_license_expire_date: string | null;
}

export default function DriverManagement() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    loadDrivers();
  }, [statusFilter]);

  const loadDrivers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_internal_drivers', {
        p_search: searchTerm || null,
        p_page: 1,
        p_page_size: 100
      });

      if (error) throw error;
      setDrivers(data || []);
    } catch (error) {
      console.error('加载失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载司机数据',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">在职</Badge>;
      case 'on_leave':
        return <Badge className="bg-yellow-100 text-yellow-800">请假</Badge>;
      case 'resigned':
        return <Badge className="bg-gray-100 text-gray-800">离职</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getSalaryType = (type: string, rate: number | null) => {
    switch (type) {
      case 'monthly': return '月薪制';
      case 'trip_based': return `计次制${rate ? `+${rate}%提成` : ''}`;
      case 'commission': return `提成制${rate || 0}%`;
      default: return type;
    }
  };

  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const daysLeft = Math.floor((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysLeft > 0 && daysLeft <= 30;
  };

  const filteredDrivers = drivers.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.phone.includes(searchTerm)
  );

  const stats = {
    total: drivers.length,
    active: drivers.filter(d => d.employment_status === 'active').length,
    onLeave: drivers.filter(d => d.employment_status === 'on_leave').length
  };

  const paginatedDrivers = filteredDrivers.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(filteredDrivers.length / pageSize);

  return (
    <div className="space-y-6 p-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold">内部司机管理</h1>
        <p className="text-muted-foreground">管理司机档案、证件、工资设置</p>
      </div>

      {/* 操作栏卡片 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                司机查询
              </CardTitle>
              <CardDescription>
                共 {stats.total} 名司机 | 在职 {stats.active} | 请假 {stats.onLeave}
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
                onClick={loadDrivers}
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
                新增司机
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
                    placeholder="司机姓名、电话..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label>在职状态</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="active">在职</SelectItem>
                    <SelectItem value="on_leave">请假</SelectItem>
                    <SelectItem value="resigned">离职</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}>
                清除筛选
              </Button>
              <Button onClick={loadDrivers}>
                应用筛选
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 司机列表卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>司机列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>电话</TableHead>
                  <TableHead>入职日期</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>工资制度</TableHead>
                  <TableHead className="text-right">基本工资</TableHead>
                  <TableHead>主车</TableHead>
                  <TableHead>驾驶证到期</TableHead>
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : paginatedDrivers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      暂无司机数据
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedDrivers.map(driver => {
                    const isLicenseExpiring = isExpiringSoon(driver.driver_license_expire_date);
                    
                    return (
                      <TableRow key={driver.id} className="hover:bg-muted/50">
                        <TableCell className="font-semibold">{driver.name}</TableCell>
                        <TableCell className="text-muted-foreground">{driver.phone}</TableCell>
                        <TableCell className="text-sm">
                          {driver.hire_date ? format(new Date(driver.hire_date), 'yyyy-MM-dd') : '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(driver.employment_status)}</TableCell>
                        <TableCell className="text-sm">
                          {getSalaryType(driver.salary_calculation_type, driver.commission_rate)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ¥{driver.base_salary?.toFixed(0) || 0}
                        </TableCell>
                        <TableCell>{driver.primary_vehicle || '-'}</TableCell>
                        <TableCell>
                          {driver.driver_license_expire_date ? (
                            <div className={isLicenseExpiring ? 'text-red-600 font-medium flex items-center gap-1' : ''}>
                              {format(new Date(driver.driver_license_expire_date), 'yyyy-MM-dd')}
                              {isLicenseExpiring && <AlertTriangle className="h-3 w-3" />}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-1 justify-center">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setSelectedDriver(driver);
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
          {!loading && filteredDrivers.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                显示 {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, filteredDrivers.length)} 条，共 {filteredDrivers.length} 条
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

      {/* 司机详情对话框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          {selectedDriver && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  司机详细信息
                </DialogTitle>
                <DialogDescription>{selectedDriver.name}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">姓名</Label>
                    <p className="font-semibold">{selectedDriver.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">电话</Label>
                    <p>{selectedDriver.phone}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">入职日期</Label>
                    <p>{selectedDriver.hire_date ? format(new Date(selectedDriver.hire_date), 'yyyy-MM-dd') : '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">在职状态</Label>
                    <div className="mt-1">{getStatusBadge(selectedDriver.employment_status)}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">工资制度</Label>
                    <p>{getSalaryType(selectedDriver.salary_calculation_type, selectedDriver.commission_rate)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">基本工资</Label>
                    <p className="font-bold text-primary">¥{selectedDriver.base_salary?.toFixed(0) || 0}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">主车车牌</Label>
                    <p>{selectedDriver.primary_vehicle || '未分配'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">驾驶证到期</Label>
                    {selectedDriver.driver_license_expire_date ? (
                      <p className={isExpiringSoon(selectedDriver.driver_license_expire_date) ? 'text-red-600 font-medium' : ''}>
                        {format(new Date(selectedDriver.driver_license_expire_date), 'yyyy-MM-dd')}
                        {isExpiringSoon(selectedDriver.driver_license_expire_date) && ' ⚠️'}
                      </p>
                    ) : '-'}
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
