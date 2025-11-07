// 司机账号关联管理
// 功能：将司机角色的用户账号与内部司机档案关联

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { PageHeader } from '@/components/PageHeader';
import {
  Users,
  Link as LinkIcon,
  Unlink,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Trash2,
  UserCog
} from 'lucide-react';

interface Driver {
  id: string;
  name: string;
  phone: string;
  employment_status: string;
  user_id: string | null;
  fleet_manager_id: string | null;
  fleet_manager_name: string | null;
}

interface DriverUser {
  id: string;
  email: string;
  phone: string;
  full_name: string;
  created_at: string;
}

interface FleetManager {
  id: string;
  full_name: string;
  email: string;
}

export default function DriverUserAssociation() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverUsers, setDriverUsers] = useState<DriverUser[]>([]);
  const [fleetManagers, setFleetManagers] = useState<FleetManager[]>([]);
  const [selectedAssociations, setSelectedAssociations] = useState<Record<string, string>>({});
  const [selectedFleetManagers, setSelectedFleetManagers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 加载司机和用户
      const { data, error } = await supabase.rpc('get_unlinked_drivers_and_users');
      
      if (error) throw error;
      
      // 加载司机列表（包含车队长信息）
      const { data: driversData } = await supabase
        .from('internal_drivers')
        .select(`
          *,
          fleet_manager:profiles!fleet_manager_id(full_name)
        `)
        .order('name');
      
      const processedDrivers = (driversData || []).map((d: any) => ({
        ...d,
        fleet_manager_name: d.fleet_manager?.full_name || null
      }));
      
      setDrivers(processedDrivers);
      setDriverUsers(data.driver_role_users || []);
      
      // 加载车队长列表
      const { data: managersData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'fleet_manager')
        .order('full_name');
      
      setFleetManagers(managersData || []);
      
      // 初始化已关联的选择
      const associations: Record<string, string> = {};
      const managers: Record<string, string> = {};
      processedDrivers.forEach((d: Driver) => {
        if (d.user_id) {
          associations[d.id] = d.user_id;
        }
        if (d.fleet_manager_id) {
          managers[d.id] = d.fleet_manager_id;
        }
      });
      setSelectedAssociations(associations);
      setSelectedFleetManagers(managers);
      
    } catch (error: any) {
      console.error('加载失败:', error);
      toast({
        title: '加载失败',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async (driverId: string, userId: string) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('link_driver_to_user', {
        p_driver_id: driverId,
        p_user_id: userId
      });
      
      if (error) throw error;
      
      if (!data.success) {
        toast({ title: '关联失败', description: data.message, variant: 'destructive' });
        return;
      }
      
      toast({ title: '关联成功', description: data.message });
      loadData();
      
    } catch (error: any) {
      toast({ title: '关联失败', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async (driverId: string) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('unlink_driver_from_user', {
        p_driver_id: driverId
      });
      
      if (error) throw error;
      
      if (!data.success) {
        toast({ title: '解除失败', description: data.message, variant: 'destructive' });
        return;
      }
      
      toast({ title: '解除成功', description: data.message });
      loadData();
      
    } catch (error: any) {
      toast({ title: '解除失败', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // 删除司机档案
  const handleDeleteDriver = async (driver: Driver) => {
    const confirmed = window.confirm(
      `确定要删除司机档案"${driver.name}"吗？\n\n此操作不会删除关联的用户账号、运单等数据，只删除司机档案。`
    );
    
    if (!confirmed) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('internal_drivers')
        .delete()
        .eq('id', driver.id);
      
      if (error) throw error;
      
      toast({ title: '删除成功', description: `司机档案"${driver.name}"已删除` });
      loadData();
      
    } catch (error: any) {
      toast({ title: '删除失败', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // 分配车队长
  const handleAssignFleetManager = async (driverId: string, managerId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('internal_drivers')
        .update({ fleet_manager_id: managerId || null })
        .eq('id', driverId);
      
      if (error) throw error;
      
      const driver = drivers.find(d => d.id === driverId);
      const manager = fleetManagers.find(m => m.id === managerId);
      
      toast({ 
        title: '分配成功', 
        description: managerId 
          ? `司机${driver?.name}已分配给车队长${manager?.full_name}`
          : `已取消司机${driver?.name}的车队长分配`
      });
      
      loadData();
      
    } catch (error: any) {
      toast({ title: '分配失败', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const getUserEmail = (userId: string) => {
    const user = driverUsers.find(u => u.id === userId);
    return user?.email || '未知用户';
  };

  const getDriverName = (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    return driver?.name || '未知司机';
  };

  const unlinkedDrivers = drivers.filter(d => !d.user_id);
  const linkedDrivers = drivers.filter(d => d.user_id);
  const unlinkedUsers = driverUsers.filter(u => !drivers.some(d => d.user_id === u.id));

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="司机账号关联"
        description="将司机角色的用户账号与内部司机档案关联"
        icon={Users}
        iconColor="text-blue-600"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 统计卡片 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">司机总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{drivers.length}</div>
            <p className="text-xs text-muted-foreground">内部司机档案</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">已关联</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{linkedDrivers.length}</div>
            <p className="text-xs text-muted-foreground">已绑定账号</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">未关联</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{unlinkedDrivers.length}</div>
            <p className="text-xs text-muted-foreground">待绑定账号</p>
          </CardContent>
        </Card>
      </div>

      {/* 未关联的司机列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>未关联的司机</CardTitle>
              <CardDescription>为这些司机关联用户账号，他们才能登录系统</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>司机姓名</TableHead>
                  <TableHead>电话</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>分配车队长</TableHead>
                  <TableHead>选择用户账号</TableHead>
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unlinkedDrivers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      所有司机都已关联账号
                    </TableCell>
                  </TableRow>
                ) : (
                  unlinkedDrivers.map(driver => (
                    <TableRow key={driver.id}>
                      <TableCell className="font-semibold">{driver.name}</TableCell>
                      <TableCell className="text-muted-foreground">{driver.phone}</TableCell>
                      <TableCell>
                        <Badge className={driver.employment_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {driver.employment_status === 'active' ? '在职' : '离职'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={selectedFleetManagers[driver.id] || 'none'}
                          onValueChange={(value) => {
                            const managerId = value === 'none' ? '' : value;
                            setSelectedFleetManagers({
                              ...selectedFleetManagers,
                              [driver.id]: value
                            });
                            handleAssignFleetManager(driver.id, managerId);
                          }}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="选择车队长" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">无（不分配）</SelectItem>
                            {fleetManagers.map(manager => (
                              <SelectItem key={manager.id} value={manager.id}>
                                {manager.full_name} - {manager.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={selectedAssociations[driver.id] || ''}
                          onValueChange={(value) => {
                            setSelectedAssociations({
                              ...selectedAssociations,
                              [driver.id]: value
                            });
                          }}
                        >
                          <SelectTrigger className="w-64">
                            <SelectValue placeholder="选择用户账号" />
                          </SelectTrigger>
                          <SelectContent>
                            {unlinkedUsers.map(user => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.email} ({user.full_name || user.phone})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-1 justify-center">
                          <Button
                            size="sm"
                            onClick={() => {
                              const userId = selectedAssociations[driver.id];
                              if (!userId) {
                                toast({ title: '请先选择用户账号', variant: 'destructive' });
                                return;
                              }
                              handleLink(driver.id, userId);
                            }}
                            disabled={!selectedAssociations[driver.id] || saving}
                          >
                            <LinkIcon className="h-4 w-4 mr-2" />
                            关联
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteDriver(driver)}
                            disabled={saving}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
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
        </CardContent>
      </Card>

      {/* 已关联的司机列表 */}
      <Card>
        <CardHeader>
          <CardTitle>已关联的司机</CardTitle>
          <CardDescription>这些司机已绑定用户账号，可以登录系统</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>司机姓名</TableHead>
                  <TableHead>司机电话</TableHead>
                  <TableHead>所属车队长</TableHead>
                  <TableHead>关联账号</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linkedDrivers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      暂无已关联的司机
                    </TableCell>
                  </TableRow>
                ) : (
                  linkedDrivers.map(driver => (
                    <TableRow key={driver.id}>
                      <TableCell className="font-semibold">{driver.name}</TableCell>
                      <TableCell className="text-muted-foreground">{driver.phone}</TableCell>
                      <TableCell>
                        {driver.fleet_manager_name ? (
                          <div className="flex items-center gap-2">
                            <UserCog className="h-4 w-4 text-blue-600" />
                            <span className="text-sm">{driver.fleet_manager_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">未分配</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm">{getUserEmail(driver.user_id!)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          已关联
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-1 justify-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUnlink(driver.id)}
                            disabled={saving}
                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          >
                            <Unlink className="h-4 w-4 mr-2" />
                            解除关联
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteDriver(driver)}
                            disabled={saving}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
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
        </CardContent>
      </Card>

      {/* 未关联的用户账号列表 */}
      {unlinkedUsers.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-5 w-5" />
              未关联的司机角色用户
            </CardTitle>
            <CardDescription>
              这些用户有司机角色但未关联司机档案，无法正常使用系统
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {unlinkedUsers.map(user => (
                <div key={user.id} className="flex items-center justify-between p-3 bg-white rounded-md border">
                  <div>
                    <p className="font-medium">{user.email}</p>
                    <p className="text-sm text-muted-foreground">
                      {user.full_name || user.phone || '未设置姓名'}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-yellow-700">
                    未关联
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

