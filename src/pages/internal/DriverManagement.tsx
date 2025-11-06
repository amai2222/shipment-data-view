// PC端 - 内部司机管理（桌面完整版）

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
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
  FileText,
  DollarSign,
  Truck,
  RefreshCw,
  Download,
  AlertTriangle
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

  if (loading && drivers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">加载司机数据中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 顶部操作栏 */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-semibold">内部司机管理</h1>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-muted-foreground">总司机</span>
                <span className="font-semibold">{stats.total}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-muted-foreground">在职</span>
                <span className="font-semibold text-green-600">{stats.active}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-muted-foreground">请假</span>
                <span className="font-semibold text-yellow-600">{stats.onLeave}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadDrivers} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" />
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              新增司机
            </Button>
          </div>
        </div>
      </div>

      {/* 筛选和搜索栏 */}
      <div className="border-b bg-card px-6 py-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索司机姓名、电话..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
          </div>
          <select
            className="h-9 px-3 border rounded-md bg-background text-sm min-w-[140px]"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">全部状态</option>
            <option value="active">在职</option>
            <option value="on_leave">请假</option>
            <option value="resigned">离职</option>
          </select>
        </div>
      </div>

      {/* 主内容区 - 表格 */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[100px]">姓名</TableHead>
                <TableHead>电话</TableHead>
                <TableHead>入职日期</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>工资制度</TableHead>
                <TableHead className="text-right">基本工资</TableHead>
                <TableHead>主车</TableHead>
                <TableHead>驾驶证到期</TableHead>
                <TableHead className="text-center w-[120px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDrivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    暂无司机数据
                  </TableCell>
                </TableRow>
              ) : (
                filteredDrivers.map(driver => {
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
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <FileText className="h-4 w-4" />
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
      </div>

      {/* 底部统计 */}
      <div className="border-t bg-card px-6 py-3">
        <div className="flex items-center justify-between text-sm">
          <div className="text-muted-foreground">
            共 {filteredDrivers.length} 名司机
          </div>
        </div>
      </div>
    </div>
  );
}
