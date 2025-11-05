// PC端 - 内部司机管理
// 功能：管理司机档案、证件、工资设置

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/PageHeader';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Search,
  FileText,
  DollarSign,
  Truck,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Download
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

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return { label: '在职', color: 'bg-green-100 text-green-800' };
      case 'on_leave':
        return { label: '请假', color: 'bg-yellow-100 text-yellow-800' };
      case 'resigned':
        return { label: '离职', color: 'bg-gray-100 text-gray-800' };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800' };
    }
  };

  const getSalaryTypeLabel = (type: string) => {
    switch (type) {
      case 'monthly': return '月薪制';
      case 'trip_based': return '计次制';
      case 'commission': return '提成制';
      default: return type;
    }
  };

  const stats = {
    total: drivers.length,
    active: drivers.filter(d => d.employment_status === 'active').length,
    onLeave: drivers.filter(d => d.employment_status === 'on_leave').length
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="内部司机管理"
        description="管理司机档案、证件、工资设置"
        icon={Users}
        iconColor="text-blue-600"
      >
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadDrivers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            新增司机
          </Button>
        </div>
      </PageHeader>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总司机</p>
                <p className="text-3xl font-bold mt-2">{stats.total}</p>
              </div>
              <Users className="h-10 w-10 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">在职</p>
                <p className="text-3xl font-bold mt-2 text-green-600">{stats.active}</p>
              </div>
              <Users className="h-10 w-10 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">请假</p>
                <p className="text-3xl font-bold mt-2 text-yellow-600">{stats.onLeave}</p>
              </div>
              <Calendar className="h-10 w-10 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索栏 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索司机姓名、电话..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <select
                className="w-full h-10 px-3 border rounded-md"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">全部状态</option>
                <option value="active">在职</option>
                <option value="on_leave">请假</option>
                <option value="resigned">离职</option>
              </select>
            </div>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 司机列表 */}
      <Card>
        <CardHeader>
          <CardTitle>司机列表（{drivers.length}人）</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>电话</TableHead>
                <TableHead>入职日期</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>工资制度</TableHead>
                <TableHead>基本工资</TableHead>
                <TableHead>主车</TableHead>
                <TableHead>驾驶证到期</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map(driver => {
                const statusConfig = getStatusConfig(driver.employment_status);
                const isLicenseExpiring = isExpiringSoon(driver.driver_license_expire_date);
                
                return (
                  <TableRow key={driver.id}>
                    <TableCell className="font-medium">{driver.name}</TableCell>
                    <TableCell>{driver.phone}</TableCell>
                    <TableCell>{driver.hire_date ? format(new Date(driver.hire_date), 'yyyy-MM-dd') : '-'}</TableCell>
                    <TableCell>
                      <Badge className={statusConfig.color}>
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{getSalaryTypeLabel(driver.salary_calculation_type)}</TableCell>
                    <TableCell className="font-medium">¥{driver.base_salary?.toFixed(0) || 0}</TableCell>
                    <TableCell>{driver.primary_vehicle || '-'}</TableCell>
                    <TableCell>
                      {driver.driver_license_expire_date ? (
                        <div className={isLicenseExpiring ? 'text-red-600 font-medium' : ''}>
                          {format(new Date(driver.driver_license_expire_date), 'yyyy-MM-dd')}
                          {isLicenseExpiring && (
                            <span className="ml-1 text-xs">⚠️</span>
                          )}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <FileText className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            }
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
  
  function isExpiringSoon(date: string | null): boolean {
    if (!date) return false;
    const daysLeft = Math.floor((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysLeft > 0 && daysLeft <= 30;
  }
}

