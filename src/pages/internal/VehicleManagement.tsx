// PC端 - 车辆档案管理（完整功能实现）

import { useState, useEffect } from 'react';
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
  Eye,
  Save,
  X,
  Trash2,
  Copy
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
  fleet_manager_id: string | null;
  driver_fleet_manager_id: string | null;
  fleet_manager_name: string | null;
}

interface VehicleFormData {
  license_plate: string;
  vehicle_number: string;
  vehicle_type: string;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_status: string;
  load_capacity: string;
  manufacture_year: string;
  current_mileage: string;
  driving_license_expire_date: string;
  insurance_expire_date: string;
  annual_inspection_date: string;
  remarks: string;
}

const VEHICLE_TYPES = ['厢式货车', '平板车', '冷藏车', '自卸车', '牵引车', '其他'];
const VEHICLE_BRANDS = ['东风', '解放', '重汽', '福田', '江淮', '陕汽', '其他'];

export default function VehicleManagement() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fleetManagerFilter, setFleetManagerFilter] = useState('all');
  const [fleetManagers, setFleetManagers] = useState<{ id: string; full_name: string }[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [formData, setFormData] = useState<VehicleFormData>({
    license_plate: '',
    vehicle_number: '',
    vehicle_type: '',
    vehicle_brand: '',
    vehicle_model: '',
    vehicle_status: 'active',
    load_capacity: '',
    manufacture_year: new Date().getFullYear().toString(),
    current_mileage: '0',
    driving_license_expire_date: '',
    insurance_expire_date: '',
    annual_inspection_date: '',
    remarks: ''
  });

  useEffect(() => {
    loadFleetManagers();
  }, []);

  useEffect(() => {
    loadVehicles();
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

  const loadVehicles = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('internal_vehicles')
        .select(`
          *,
          driver:internal_driver_vehicle_relations(
            driver:internal_drivers(name, fleet_manager_id)
          ),
          fleet_manager:profiles!fleet_manager_id(full_name)
        `);

      if (statusFilter !== 'all') {
        query = query.eq('vehicle_status', statusFilter);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      const processedData = (data || []).map((v: any) => {
        // 优先使用车辆直接分配的车队长，如果没有则使用司机的车队长
        const vehicleFleetManager = v.fleet_manager?.full_name || null;
        const driverFleetManager = v.driver?.[0]?.driver?.fleet_manager_id 
          ? null // 需要通过司机ID查询车队长名字，这里先设为null，后面会处理
          : null;
        
        return {
          ...v,
          driver_name: v.driver?.[0]?.driver?.name || null,
          fleet_manager_id: v.fleet_manager_id || null,
          driver_fleet_manager_id: v.driver?.[0]?.driver?.fleet_manager_id || null,
          fleet_manager_name: vehicleFleetManager || null
        };
      });
      
      // 批量查询司机的车队长名字
      const driverFleetManagerIds = processedData
        .filter(v => !v.fleet_manager_name && v.driver_fleet_manager_id)
        .map(v => v.driver_fleet_manager_id)
        .filter((id, index, self) => self.indexOf(id) === index); // 去重
      
      if (driverFleetManagerIds.length > 0) {
        const { data: fleetManagers } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', driverFleetManagerIds);
        
        const fleetManagerMap = new Map(
          (fleetManagers || []).map((fm: any) => [fm.id, fm.full_name])
        );
        
        // 填充司机的车队长名字
        processedData.forEach(v => {
          if (!v.fleet_manager_name && v.driver_fleet_manager_id) {
            v.fleet_manager_name = fleetManagerMap.get(v.driver_fleet_manager_id) || null;
          }
        });
      }
      
      // ✅ 根据车队队长筛选
      let filteredData = processedData;
      if (fleetManagerFilter !== 'all') {
        filteredData = processedData.filter(v => {
          // 检查车辆直接分配的车队长
          if (v.fleet_manager_id === fleetManagerFilter) {
            return true;
          }
          // 检查司机的车队长
          if (v.driver_fleet_manager_id === fleetManagerFilter) {
            return true;
          }
          return false;
        });
      }
      
      // ✅ 排序：先按车队长名字排序，其次按驾驶员名字排序，未分配的放最下面
      filteredData.sort((a, b) => {
        // 未分配的放最下面
        const aHasDriver = a.driver_name !== null;
        const bHasDriver = b.driver_name !== null;
        if (aHasDriver !== bHasDriver) {
          return aHasDriver ? -1 : 1;
        }
        
        // 先按车队长名字排序
        const aFleetManager = a.fleet_manager_name || '';
        const bFleetManager = b.fleet_manager_name || '';
        if (aFleetManager !== bFleetManager) {
          return aFleetManager.localeCompare(bFleetManager, 'zh-CN');
        }
        
        // 其次按驾驶员名字排序
        const aDriver = a.driver_name || '';
        const bDriver = b.driver_name || '';
        return aDriver.localeCompare(bDriver, 'zh-CN');
      });
      
      setVehicles(filteredData);
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

  // 新增车辆
  const handleAddVehicle = async () => {
    try {
      const { data, error } = await supabase
        .from('internal_vehicles')
        .insert([{
          license_plate: formData.license_plate,
          vehicle_number: formData.vehicle_number,
          vehicle_type: formData.vehicle_type,
          vehicle_brand: formData.vehicle_brand,
          vehicle_model: formData.vehicle_model,
          vehicle_status: formData.vehicle_status,
          load_capacity: parseFloat(formData.load_capacity),
          manufacture_year: parseInt(formData.manufacture_year),
          current_mileage: parseInt(formData.current_mileage),
          driving_license_expire_date: formData.driving_license_expire_date || null,
          insurance_expire_date: formData.insurance_expire_date || null,
          annual_inspection_date: formData.annual_inspection_date || null,
          remarks: formData.remarks || null,
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: '新增成功',
        description: `车辆 ${formData.license_plate} 已添加`
      });

      setShowAddDialog(false);
      resetForm();
      loadVehicles();
    } catch (error: any) {
      toast({
        title: '新增失败',
        description: error.message || '无法添加车辆',
        variant: 'destructive'
      });
    }
  };

  // 编辑车辆
  const handleEditVehicle = async () => {
    if (!selectedVehicle) return;

    try {
      const { error } = await supabase
        .from('internal_vehicles')
        .update({
          license_plate: formData.license_plate,
          vehicle_number: formData.vehicle_number,
          vehicle_type: formData.vehicle_type,
          vehicle_brand: formData.vehicle_brand,
          vehicle_model: formData.vehicle_model,
          vehicle_status: formData.vehicle_status,
          load_capacity: parseFloat(formData.load_capacity),
          manufacture_year: parseInt(formData.manufacture_year),
          current_mileage: parseInt(formData.current_mileage),
          driving_license_expire_date: formData.driving_license_expire_date || null,
          insurance_expire_date: formData.insurance_expire_date || null,
          annual_inspection_date: formData.annual_inspection_date || null,
          remarks: formData.remarks || null
        })
        .eq('id', selectedVehicle.id);

      if (error) throw error;

      toast({
        title: '更新成功',
        description: `车辆 ${formData.license_plate} 已更新`
      });

      setShowEditDialog(false);
      setSelectedVehicle(null);
      loadVehicles();
    } catch (error: any) {
      toast({
        title: '更新失败',
        description: error.message || '无法更新车辆',
        variant: 'destructive'
      });
    }
  };

  // 删除车辆
  const handleDeleteVehicle = async () => {
    if (!vehicleToDelete) return;

    try {
      // 检查是否有关联的司机分配记录
      const { data: relations, error: relationError } = await supabase
        .from('internal_driver_vehicle_relations')
        .select('id')
        .eq('vehicle_id', vehicleToDelete.id)
        .is('valid_until', null);

      if (relationError) throw relationError;

      if (relations && relations.length > 0) {
        toast({
          title: '删除失败',
          description: '该车辆已分配给司机，请先解除分配后再删除',
          variant: 'destructive'
        });
        return;
      }

      const { error } = await supabase
        .from('internal_vehicles')
        .delete()
        .eq('id', vehicleToDelete.id);

      if (error) throw error;

      toast({
        title: '删除成功',
        description: `车辆 ${vehicleToDelete.license_plate} 已删除`
      });

      setShowDeleteDialog(false);
      setVehicleToDelete(null);
      loadVehicles();
    } catch (error: any) {
      toast({
        title: '删除失败',
        description: error.message || '无法删除车辆',
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      license_plate: '',
      vehicle_number: '',
      vehicle_type: '',
      vehicle_brand: '',
      vehicle_model: '',
      vehicle_status: 'active',
      load_capacity: '',
      manufacture_year: new Date().getFullYear().toString(),
      current_mileage: '0',
      driving_license_expire_date: '',
      insurance_expire_date: '',
      annual_inspection_date: '',
      remarks: ''
    });
  };

  const openEditDialog = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setFormData({
      license_plate: vehicle.license_plate,
      vehicle_number: vehicle.vehicle_number || '',
      vehicle_type: vehicle.vehicle_type,
      vehicle_brand: vehicle.vehicle_brand,
      vehicle_model: vehicle.vehicle_model,
      vehicle_status: vehicle.vehicle_status,
      load_capacity: vehicle.load_capacity.toString(),
      manufacture_year: vehicle.manufacture_year.toString(),
      current_mileage: vehicle.current_mileage.toString(),
      driving_license_expire_date: vehicle.driving_license_expire_date || '',
      insurance_expire_date: vehicle.insurance_expire_date || '',
      annual_inspection_date: vehicle.annual_inspection_date || '',
      remarks: ''
    });
    setShowEditDialog(true);
  };

  // 打开复制对话框（复制原车辆信息，除车牌号和内部编号）
  const openCopyDialog = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setFormData({
      license_plate: '', // 清空车牌号
      vehicle_number: '', // 清空内部编号
      vehicle_type: vehicle.vehicle_type,
      vehicle_brand: vehicle.vehicle_brand,
      vehicle_model: vehicle.vehicle_model,
      vehicle_status: vehicle.vehicle_status,
      load_capacity: vehicle.load_capacity.toString(),
      manufacture_year: vehicle.manufacture_year.toString(),
      current_mileage: vehicle.current_mileage.toString(),
      driving_license_expire_date: vehicle.driving_license_expire_date || '',
      insurance_expire_date: vehicle.insurance_expire_date || '',
      annual_inspection_date: vehicle.annual_inspection_date || '',
      remarks: ''
    });
    setShowCopyDialog(true);
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

  // 车辆表单组件
  const VehicleForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>车牌号 <span className="text-red-500">*</span></Label>
          <Input
            placeholder="如：云F97310"
            value={formData.license_plate}
            onChange={e => setFormData(prev => ({...prev, license_plate: e.target.value}))}
            required
          />
        </div>
        <div>
          <Label>车辆编号</Label>
          <Input
            placeholder="内部编号"
            value={formData.vehicle_number}
            onChange={e => setFormData(prev => ({...prev, vehicle_number: e.target.value}))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>车型 <span className="text-red-500">*</span></Label>
          <Select value={formData.vehicle_type} onValueChange={v => setFormData(prev => ({...prev, vehicle_type: v}))}>
            <SelectTrigger>
              <SelectValue placeholder="选择车型" />
            </SelectTrigger>
            <SelectContent>
              {VEHICLE_TYPES.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>品牌 <span className="text-red-500">*</span></Label>
          <Select value={formData.vehicle_brand} onValueChange={v => setFormData(prev => ({...prev, vehicle_brand: v}))}>
            <SelectTrigger>
              <SelectValue placeholder="选择品牌" />
            </SelectTrigger>
            <SelectContent>
              {VEHICLE_BRANDS.map(brand => (
                <SelectItem key={brand} value={brand}>{brand}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>型号</Label>
          <Input
            placeholder="如：TX450"
            value={formData.vehicle_model}
            onChange={e => setFormData(prev => ({...prev, vehicle_model: e.target.value}))}
          />
        </div>
        <div>
          <Label>载重（吨）<span className="text-red-500">*</span></Label>
          <Input
            type="number"
            placeholder="0"
            value={formData.load_capacity}
            onChange={e => setFormData(prev => ({...prev, load_capacity: e.target.value}))}
            step="0.1"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>出厂年份</Label>
          <Input
            type="number"
            value={formData.manufacture_year}
            onChange={e => setFormData(prev => ({...prev, manufacture_year: e.target.value}))}
            min="2000"
            max={new Date().getFullYear()}
          />
        </div>
        <div>
          <Label>当前里程（公里）</Label>
          <Input
            type="number"
            value={formData.current_mileage}
            onChange={e => setFormData(prev => ({...prev, current_mileage: e.target.value}))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>车辆状态</Label>
          <Select value={formData.vehicle_status} onValueChange={v => setFormData(prev => ({...prev, vehicle_status: v}))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">正常使用</SelectItem>
              <SelectItem value="maintenance">维修中</SelectItem>
              <SelectItem value="retired">已报废</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-semibold mb-3">证件信息</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>行驶证到期日期</Label>
            <Input
              type="date"
              value={formData.driving_license_expire_date}
              onChange={e => setFormData(prev => ({...prev, driving_license_expire_date: e.target.value}))}
            />
          </div>
          <div>
            <Label>保险到期日期</Label>
            <Input
              type="date"
              value={formData.insurance_expire_date}
              onChange={e => setFormData(prev => ({...prev, insurance_expire_date: e.target.value}))}
            />
          </div>
          <div>
            <Label>年检到期日期</Label>
            <Input
              type="date"
              value={formData.annual_inspection_date}
              onChange={e => setFormData(prev => ({...prev, annual_inspection_date: e.target.value}))}
            />
          </div>
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
  );

  const filteredVehiclesData = vehicles.filter(v =>
    v.license_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.vehicle_brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.driver_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statsData = {
    total: vehicles.length,
    active: vehicles.filter(v => v.vehicle_status === 'active').length,
    maintenance: vehicles.filter(v => v.vehicle_status === 'maintenance').length,
    expiring: vehicles.filter(v => 
      isExpiringSoon(v.driving_license_expire_date) || 
      isExpiringSoon(v.insurance_expire_date) ||
      isExpiringSoon(v.annual_inspection_date)
    ).length
  };

  const paginatedVehiclesData = filteredVehiclesData.slice((page - 1) * pageSize, page * pageSize);
  const totalPagesData = Math.ceil(filteredVehiclesData.length / pageSize);

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
                共 {statsData.total} 辆车辆 | 在用 {statsData.active} | 维修 {statsData.maintenance} | 证件到期 {statsData.expiring}
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
              <Button size="sm" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                新增车辆
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* 筛选器 */}
        {showFilters && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <Button variant="outline" onClick={() => { 
                setSearchTerm(''); 
                setStatusFilter('all'); 
                setFleetManagerFilter('all');
              }}>
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
                  <TableHead>车队长</TableHead>
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
                    <TableCell colSpan={11} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : paginatedVehiclesData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      暂无车辆数据
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedVehiclesData.map(vehicle => {
                    const statusConfig = getStatusConfig(vehicle.vehicle_status);
                    const StatusIcon = statusConfig.icon;
                    const hasExpiringCert = 
                      isExpiringSoon(vehicle.driving_license_expire_date) || 
                      isExpiringSoon(vehicle.insurance_expire_date) ||
                      isExpiringSoon(vehicle.annual_inspection_date);
                    
                    return (
                      <TableRow key={vehicle.id} className="hover:bg-muted/50" onClick={(e) => e.stopPropagation()}>
                        <TableCell className="font-semibold">{vehicle.license_plate}</TableCell>
                        <TableCell className="text-muted-foreground">{vehicle.vehicle_number || '-'}</TableCell>
                        <TableCell>
                          <div>{vehicle.vehicle_brand} {vehicle.vehicle_model}</div>
                          <div className="text-xs text-muted-foreground">{vehicle.manufacture_year}年</div>
                        </TableCell>
                        <TableCell>{vehicle.vehicle_type}</TableCell>
                        <TableCell className="text-center font-medium">{vehicle.load_capacity}吨</TableCell>
                        <TableCell>
                          {vehicle.fleet_manager_name || <span className="text-muted-foreground text-sm">未分配</span>}
                        </TableCell>
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
                          <div className="flex gap-1 justify-center" onClick={(e) => e.stopPropagation()}>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0 relative z-10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedVehicle(vehicle);
                                setShowDetailDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0 relative z-10"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(vehicle);
                              }}
                              title="编辑"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 relative z-10"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCopyDialog(vehicle);
                              }}
                              title="复制车辆"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 relative z-10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setVehicleToDelete(vehicle);
                                setShowDeleteDialog(true);
                              }}
                              title="删除"
                            >
                              <Trash2 className="h-4 w-4" />
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
          {!loading && filteredVehiclesData.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                显示 {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, filteredVehiclesData.length)} 条，共 {filteredVehiclesData.length} 条
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
                  <span className="text-sm">第 {page} / {totalPagesData} 页</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPagesData, p + 1))}
                  disabled={page === totalPagesData}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 新增车辆对话框 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              新增车辆
            </DialogTitle>
            <DialogDescription>
              添加新的内部车辆档案
            </DialogDescription>
          </DialogHeader>

          <VehicleForm />

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddDialog(false);
              resetForm();
            }}>
              <X className="h-4 w-4 mr-2" />
              取消
            </Button>
            <Button onClick={handleAddVehicle}>
              <Save className="h-4 w-4 mr-2" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑车辆对话框 */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        setShowEditDialog(open);
        if (!open) {
          setSelectedVehicle(null);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              编辑车辆
            </DialogTitle>
            <DialogDescription>
              修改车辆档案信息
            </DialogDescription>
          </DialogHeader>

          <VehicleForm />

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowEditDialog(false);
              setSelectedVehicle(null);
            }}>
              <X className="h-4 w-4 mr-2" />
              取消
            </Button>
            <Button onClick={handleEditVehicle}>
              <Save className="h-4 w-4 mr-2" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 复制车辆对话框 */}
      <Dialog open={showCopyDialog} onOpenChange={(open) => {
        setShowCopyDialog(open);
        if (!open) {
          setSelectedVehicle(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              复制车辆
            </DialogTitle>
            <DialogDescription>
              基于现有车辆信息创建新车辆（车牌号和内部编号需重新填写）
            </DialogDescription>
          </DialogHeader>

          <VehicleForm />

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCopyDialog(false);
              setSelectedVehicle(null);
              resetForm();
            }}>
              <X className="h-4 w-4 mr-2" />
              取消
            </Button>
            <Button onClick={handleAddVehicle}>
              <Save className="h-4 w-4 mr-2" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              确认删除
            </DialogTitle>
            <DialogDescription>
              确定要删除车辆 <strong>{vehicleToDelete?.license_plate}</strong> 吗？此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDeleteDialog(false);
              setVehicleToDelete(null);
            }}>
              <X className="h-4 w-4 mr-2" />
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteVehicle}>
              <Trash2 className="h-4 w-4 mr-2" />
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    {selectedVehicle.annual_inspection_date && (
                      <div className="flex justify-between items-center p-3 bg-muted rounded-md">
                        <div>
                          <p className="font-medium">年检到期日期</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(selectedVehicle.annual_inspection_date), 'yyyy-MM-dd')}
                          </p>
                        </div>
                        {isExpiringSoon(selectedVehicle.annual_inspection_date) && (
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
