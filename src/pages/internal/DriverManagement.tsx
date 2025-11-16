// PC端 - 内部司机管理（完整功能实现）

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
import { PaginationControl } from '@/components/common';
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
  Eye,
  Save,
  X,
  Upload
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
  id_card_number: string | null;
  fleet_manager_id: string | null;
  fleet_manager_name: string | null;
}

interface DriverFormData {
  name: string;
  phone: string;
  id_card_number: string;
  hire_date: string;
  employment_status: string;
  base_salary: string;
  salary_calculation_type: string;
  commission_rate: string;
  remarks: string;
}

const SALARY_TYPES = [
  { value: 'monthly', label: '月薪制', description: '固定月薪' },
  { value: 'trip_based', label: '计次制', description: '按趟次计费+提成' },
  { value: 'commission', label: '提成制', description: '纯提成' }
];

export default function DriverManagement() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fleetManagerFilter, setFleetManagerFilter] = useState('all');
  const [fleetManagers, setFleetManagers] = useState<{ id: string; full_name: string }[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [formData, setFormData] = useState<DriverFormData>({
    name: '',
    phone: '',
    id_card_number: '',
    hire_date: format(new Date(), 'yyyy-MM-dd'),
    employment_status: 'active',
    base_salary: '5000',
    salary_calculation_type: 'monthly',
    commission_rate: '10',
    remarks: ''
  });

  useEffect(() => {
    loadFleetManagers();
  }, []);

  useEffect(() => {
    loadDrivers();
  }, [statusFilter, fleetManagerFilter]);

  const loadFleetManagers = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'fleet_manager')
        .order('full_name');
      setFleetManagers(data || []);
    } catch (error) {
      console.error('加载车队队长列表失败:', error);
    }
  };

  const loadDrivers = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('internal_drivers')
        .select(`
          *,
          fleet_manager:profiles!fleet_manager_id(full_name)
        `);

      // 如果选择了车队队长，只查询该车队长的司机
      if (fleetManagerFilter !== 'all') {
        query = query.eq('fleet_manager_id', fleetManagerFilter);
      }

      // 如果使用了搜索，通过 RPC 函数查询
      if (searchTerm && fleetManagerFilter === 'all') {
        const { data, error } = await supabase.rpc('get_internal_drivers', {
          p_search: searchTerm || null,
          p_page: 1,
          p_page_size: 100
        });

        if (error) throw error;
        
        // 处理 RPC 返回的数据，需要补充车队队长和车辆信息
        const driverIds = (data || []).map((d: any) => d.id);
        if (driverIds.length > 0) {
          const { data: fullData } = await supabase
            .from('internal_drivers')
            .select(`
              *,
              fleet_manager:profiles!fleet_manager_id(full_name)
            `)
            .in('id', driverIds);
          
          const processedData = await processDriverData(fullData || []);
          setDrivers(processedData);
        } else {
          setDrivers([]);
        }
        return;
      }

      const { data, error } = await query.order('name');
      
      if (error) throw error;
      
      // 处理数据，添加车队队长和车辆信息
      const processedData = await processDriverData(data || []);
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

  // 处理司机数据，添加车队队长和车辆信息
  const processDriverData = async (drivers: any[]): Promise<Driver[]> => {
    if (!drivers || drivers.length === 0) return [];

    // 获取所有司机的车辆关联
    const driverIds = drivers.map(d => d.id);
    const { data: vehicleRelations } = await supabase
      .from('internal_driver_vehicle_relations')
      .select(`
        driver_id,
        vehicle:internal_vehicles(license_plate),
        is_primary
      `)
      .in('driver_id', driverIds)
      .eq('is_primary', true);

    // 构建司机ID到车牌号的映射
    const driverVehicleMap = new Map<string, string>();
    (vehicleRelations || []).forEach((rel: any) => {
      if (rel.vehicle?.license_plate) {
        driverVehicleMap.set(rel.driver_id, rel.vehicle.license_plate);
      }
    });

    // 处理数据
    return drivers.map((d: any) => ({
      id: d.id,
      name: d.name,
      phone: d.phone,
      hire_date: d.hire_date,
      employment_status: d.employment_status,
      base_salary: d.base_salary || 0,
      salary_calculation_type: d.salary_calculation_type,
      commission_rate: d.commission_rate,
      primary_vehicle: driverVehicleMap.get(d.id) || null,
      driver_license_expire_date: d.driver_license_expire_date,
      id_card_number: d.id_card_number,
      fleet_manager_id: d.fleet_manager_id,
      fleet_manager_name: d.fleet_manager?.full_name || null
    }));
  };

  // 新增司机
  const handleAddDriver = async () => {
    if (!formData.name || !formData.phone) {
      toast({
        title: '请填写必填项',
        description: '姓名和电话为必填项',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('internal_drivers')
        .insert([{
          name: formData.name,
          phone: formData.phone,
          id_card_number: formData.id_card_number || null,
          hire_date: formData.hire_date,
          employment_status: formData.employment_status,
          base_salary: parseFloat(formData.base_salary),
          salary_calculation_type: formData.salary_calculation_type,
          commission_rate: formData.salary_calculation_type === 'monthly' ? null : parseFloat(formData.commission_rate),
          remarks: formData.remarks || null
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: '新增成功',
        description: `司机 ${formData.name} 已添加`
      });

      setShowAddDialog(false);
      resetForm();
      loadDrivers();
    } catch (error: any) {
      toast({
        title: '新增失败',
        description: error.message || '无法添加司机',
        variant: 'destructive'
      });
    }
  };

  // 编辑司机
  const handleEditDriver = async () => {
    if (!selectedDriver) return;

    try {
      // 检查状态是否变为离职
      const isResigning = formData.employment_status === 'resigned' && selectedDriver.employment_status !== 'resigned';
      
      // 准备更新数据
      const updateData: any = {
        name: formData.name,
        phone: formData.phone,
        id_card_number: formData.id_card_number || null,
        hire_date: formData.hire_date,
        employment_status: formData.employment_status,
        base_salary: parseFloat(formData.base_salary),
        salary_calculation_type: formData.salary_calculation_type,
        commission_rate: formData.salary_calculation_type === 'monthly' ? null : parseFloat(formData.commission_rate)
      };

      // 如果状态变为离职，自动解绑车队长和车辆
      if (isResigning) {
        updateData.fleet_manager_id = null;
      }

      // 更新司机信息
      const { error: updateError } = await supabase
        .from('internal_drivers')
        .update(updateData)
        .eq('id', selectedDriver.id);

      if (updateError) throw updateError;

      // 如果状态变为离职，解绑车辆关联
      if (isResigning) {
        const { error: unbindError } = await supabase
          .from('internal_driver_vehicle_relations')
          .delete()
          .eq('driver_id', selectedDriver.id);

        if (unbindError) {
          console.error('解绑车辆失败:', unbindError);
          // 不抛出错误，因为司机信息已经更新成功
        }
      }

      toast({
        title: '更新成功',
        description: isResigning 
          ? `司机 ${formData.name} 已标记为离职，已自动解绑车队长和车辆`
          : `司机 ${formData.name} 信息已更新`
      });

      setShowEditDialog(false);
      setSelectedDriver(null);
      loadDrivers();
    } catch (error: any) {
      toast({
        title: '更新失败',
        description: error.message || '无法更新司机',
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      id_card_number: '',
      hire_date: format(new Date(), 'yyyy-MM-dd'),
      employment_status: 'active',
      base_salary: '5000',
      salary_calculation_type: 'monthly',
      commission_rate: '10',
      driver_license_number: '',
      driver_license_expire_date: '',
      qualification_certificate_expire_date: '',
      remarks: ''
    });
  };

  const openEditDialog = (driver: Driver) => {
    setSelectedDriver(driver);
    setFormData({
      name: driver.name,
      phone: driver.phone,
      id_card_number: driver.id_card_number || '',
      hire_date: driver.hire_date,
      employment_status: driver.employment_status,
      base_salary: driver.base_salary.toString(),
      salary_calculation_type: driver.salary_calculation_type,
      commission_rate: (driver.commission_rate || 10).toString(),
      remarks: driver.remarks || ''
    });
    setShowEditDialog(true);
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

  const paginatedDrivers = filteredDrivers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredDrivers.length / pageSize);
  
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // 重置到第一页
  };

  // 司机表单组件 - 使用 useMemo 避免重新创建导致输入框失去焦点
  const DriverForm = useMemo(() => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>姓名 <span className="text-red-500">*</span></Label>
          <Input
            placeholder="司机姓名"
            value={formData.name}
            onChange={e => setFormData(prev => ({...prev, name: e.target.value}))}
            required
          />
        </div>
        <div>
          <Label>电话 <span className="text-red-500">*</span></Label>
          <Input
            placeholder="手机号"
            value={formData.phone}
            onChange={e => setFormData(prev => ({...prev, phone: e.target.value}))}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>身份证号</Label>
          <Input
            placeholder="18位身份证号"
            value={formData.id_card_number}
            onChange={e => setFormData(prev => ({...prev, id_card_number: e.target.value}))}
            maxLength={18}
          />
        </div>
        <div>
          <Label>入职日期</Label>
          <Input
            type="date"
            value={formData.hire_date}
            onChange={e => setFormData(prev => ({...prev, hire_date: e.target.value}))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>在职状态</Label>
          <Select value={formData.employment_status} onValueChange={v => setFormData(prev => ({...prev, employment_status: v}))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">在职</SelectItem>
              <SelectItem value="on_leave">请假</SelectItem>
              <SelectItem value="resigned">离职</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-semibold mb-3">工资设置</h3>
        <div className="space-y-4">
          <div>
            <Label>工资制度 <span className="text-red-500">*</span></Label>
            <Select value={formData.salary_calculation_type} onValueChange={v => setFormData(prev => ({...prev, salary_calculation_type: v}))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SALARY_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label} - {type.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>基本工资（元）</Label>
              <Input
                type="number"
                placeholder="5000"
                value={formData.base_salary}
                onChange={e => setFormData(prev => ({...prev, base_salary: e.target.value}))}
                step="100"
              />
            </div>
            {formData.salary_calculation_type !== 'monthly' && (
              <div>
                <Label>提成比例（%）</Label>
                <Input
                  type="number"
                  placeholder="10"
                  value={formData.commission_rate}
                  onChange={e => setFormData(prev => ({...prev, commission_rate: e.target.value}))}
                  step="1"
                  min="0"
                  max="100"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-semibold mb-3">证件信息</h3>
        <div className="grid grid-cols-2 gap-4">
          {/* 证件信息在证件管理中维护 */}
        </div>
      </div>

      <div>
        <Label>备注</Label>
        <Textarea
          placeholder="输入备注信息..."
          value={formData.remarks}
          onChange={e => setFormData(prev => ({...prev, remarks: e.target.value}))}
          rows={3}
        />
      </div>
    </div>
  ), [formData]);

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="内部司机管理"
        description="管理司机档案、证件、工资设置"
        icon={Users}
        iconColor="text-blue-600"
      />

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
              <Button size="sm" onClick={() => setShowAddDialog(true)}>
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

              <div>
                <Label>车队队长</Label>
                <Select value={fleetManagerFilter} onValueChange={setFleetManagerFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部车队长</SelectItem>
                    {fleetManagers.map(fm => (
                      <SelectItem key={fm.id} value={fm.id}>{fm.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { 
                setSearchTerm(''); 
                setStatusFilter('all'); 
                setFleetManagerFilter('all');
              }}>
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
                  <TableHead>车队长</TableHead>
                  <TableHead>车辆</TableHead>
                  <TableHead>工资制度</TableHead>
                  <TableHead className="text-right">基本工资</TableHead>
                  <TableHead>驾驶证到期</TableHead>
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
                ) : paginatedDrivers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
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
                          {driver.fleet_manager_name || <span className="text-muted-foreground">未分配</span>}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {driver.primary_vehicle || <span className="text-muted-foreground">未分配</span>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {getSalaryType(driver.salary_calculation_type, driver.commission_rate)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ¥{driver.base_salary?.toFixed(0) || 0}
                        </TableCell>
                        <TableCell>
                          {driver.driver_license_expire_date ? (
                            <div className={isLicenseExpiring ? 'text-red-600 font-medium flex items-center gap-1' : ''}>
                              {format(new Date(driver.driver_license_expire_date), 'yyyy-MM-dd')}
                              {isLicenseExpiring && <AlertTriangle className="h-3 w-3" />}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1 justify-center" style={{ pointerEvents: 'auto' }}>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0 relative z-10"
                              style={{ pointerEvents: 'auto' }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedDriver(driver);
                                setShowDetailDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0 relative z-10"
                              style={{ pointerEvents: 'auto' }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openEditDialog(driver);
                              }}
                            >
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
            <PaginationControl
              currentPage={currentPage}
              pageSize={pageSize}
              totalPages={totalPages}
              totalCount={filteredDrivers.length}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </CardContent>
      </Card>

      {/* 新增司机对话框 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              新增司机
            </DialogTitle>
            <DialogDescription>
              添加新的内部司机档案
            </DialogDescription>
          </DialogHeader>

          {DriverForm}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddDialog(false);
              resetForm();
            }}>
              <X className="h-4 w-4 mr-2" />
              取消
            </Button>
            <Button onClick={handleAddDriver}>
              <Save className="h-4 w-4 mr-2" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑司机对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              编辑司机
            </DialogTitle>
            <DialogDescription>
              修改司机档案信息
            </DialogDescription>
          </DialogHeader>

          {DriverForm}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowEditDialog(false);
              setSelectedDriver(null);
            }}>
              <X className="h-4 w-4 mr-2" />
              取消
            </Button>
            <Button onClick={handleEditDriver}>
              <Save className="h-4 w-4 mr-2" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    <Label className="text-muted-foreground">身份证号</Label>
                    <p className="font-mono text-sm">{selectedDriver.id_card_number || '-'}</p>
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
