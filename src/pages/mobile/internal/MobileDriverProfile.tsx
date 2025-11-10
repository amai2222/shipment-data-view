// 移动端 - 司机档案管理（车队长）

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import {
  User,
  Plus,
  Search,
  Edit,
  Phone,
  Calendar,
  DollarSign,
  Truck,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

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
  id_card_number: string | null;
}

export default function MobileDriverProfile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    setLoading(true);
    try {
      // 只加载当前车队长管理的司机
      const { data, error } = await supabase
        .from('internal_drivers')
        .select(`
          *,
          vehicle:internal_driver_vehicle_relations(
            vehicle:internal_vehicles(license_plate)
          )
        `)
        .eq('fleet_manager_id', user?.id || '')
        .order('name');
      
      if (error) throw error;
      
      // 处理关联数据
      const processedData = (data || []).map((d: any) => ({
        ...d,
        primary_vehicle: d.vehicle?.[0]?.vehicle?.license_plate || null
      }));
      
      setDrivers(processedData);
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
      case 'monthly':
        return '月薪制';
      case 'trip_based':
        return `计次制${rate ? `+${rate}%提成` : ''}`;
      case 'commission':
        return `提成制${rate || 0}%`;
      default:
        return type;
    }
  };

  const filteredDrivers = drivers.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.phone.includes(searchTerm) ||
    d.primary_vehicle?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: drivers.length,
    active: drivers.filter(d => d.employment_status === 'active').length,
    onLeave: drivers.filter(d => d.employment_status === 'on_leave').length,
    resigned: drivers.filter(d => d.employment_status === 'resigned').length
  };

  return (
    <MobileLayout title="司机档案" showBack={true}>
      <div className="space-y-4 pb-20">
        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-2">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
              <div className="text-xs text-blue-600 mt-1">总司机</div>
            </CardContent>
          </Card>
          
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{stats.active}</div>
              <div className="text-xs text-green-600 mt-1">在职</div>
            </CardContent>
          </Card>
          
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-yellow-700">{stats.onLeave}</div>
              <div className="text-xs text-yellow-600 mt-1">请假</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-gray-700">{stats.resigned}</div>
              <div className="text-xs text-gray-600 mt-1">离职</div>
            </CardContent>
          </Card>
        </div>

        {/* 搜索和新增 */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索姓名、电话、车牌..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={() => navigate('/m/internal/add-driver')}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={loadDrivers}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* 司机列表 */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : filteredDrivers.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              暂无司机数据
            </div>
          ) : (
            filteredDrivers.map(driver => (
              <Card key={driver.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* 姓名和状态 */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xl font-bold">{driver.name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                          <Phone className="h-3 w-3" />
                          {driver.phone}
                        </div>
                      </div>
                      {getStatusBadge(driver.employment_status)}
                    </div>

                    {/* 车辆信息 */}
                    {driver.primary_vehicle && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Truck className="h-4 w-4" />
                        <span>主车：{driver.primary_vehicle}</span>
                      </div>
                    )}

                    {/* 薪资信息 */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <DollarSign className="h-4 w-4" />
                        <span>{getSalaryType(driver.salary_calculation_type, driver.commission_rate)}</span>
                      </div>
                      <div className="font-semibold">
                        ¥{driver.base_salary.toFixed(0)}/月
                      </div>
                    </div>

                    {/* 入职日期 */}
                    {driver.hire_date && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>入职：{format(new Date(driver.hire_date), 'yyyy-MM-dd')}</span>
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          // 可以导航到编辑页面或详情页面
                          toast({
                            title: '功能开发中',
                            description: '司机编辑功能即将上线'
                          });
                        }}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => navigate('/m/internal/vehicle-driver-detail')}
                      >
                        查看详情
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </MobileLayout>
  );
}

