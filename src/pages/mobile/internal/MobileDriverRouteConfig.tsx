// 移动端 - 司机项目线路配置（车队长）
// 车队长为司机配置常跑的项目和线路

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import {
  Users,
  MapPin,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  Loader2
} from 'lucide-react';

interface Driver {
  id: string;
  name: string;
  phone: string;
}

interface Project {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
}

interface DriverRoute {
  id: string;
  driver_name: string;
  project_name: string;
  is_primary_route: boolean;
  loading_locations: string[];
  unloading_locations: string[];
}

export default function MobileDriverRouteConfig() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [routes, setRoutes] = useState<DriverRoute[]>([]);
  
  const [showDialog, setShowDialog] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<string | undefined>(undefined);
  const [selectedProject, setSelectedProject] = useState<string | undefined>(undefined);
  const [selectedLoadingLocations, setSelectedLoadingLocations] = useState<string[]>([]);
  const [selectedUnloadingLocations, setSelectedUnloadingLocations] = useState<string[]>([]);
  const [isPrimaryRoute, setIsPrimaryRoute] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 加载司机
      const { data: driverData } = await supabase
        .from('internal_drivers')
        .select('id, name, phone')
        .eq('is_active', true)
        .order('name');
      setDrivers(driverData || []);

      // 加载项目
      const { data: projectData } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');
      setProjects(projectData || []);

      // 加载地点
      const { data: locationData } = await supabase
        .from('locations')
        .select('id, name')
        .order('name');
      setLocations(locationData || []);

      // 加载已配置的线路
      await loadRoutes();
    } catch (error) {
      console.error('加载失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRoutes = async () => {
    try {
      // ✅ 加载司机项目线路配置
      const { data, error } = await supabase
        .from('internal_driver_project_routes')
        .select(`
          id,
          is_primary_route,
          common_loading_location_ids,
          common_unloading_location_ids,
          driver:internal_drivers(name),
          project:projects(name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // 处理数据格式
      const processedRoutes = (data || []).map((route: any) => ({
        id: route.id,
        driver_name: route.driver?.name || '未知司机',
        project_name: route.project?.name || '未知项目',
        is_primary_route: route.is_primary_route,
        loading_locations: route.common_loading_location_ids || [],
        unloading_locations: route.common_unloading_location_ids || []
      }));
      
      setRoutes(processedRoutes);
    } catch (error) {
      console.error('加载线路配置失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载线路配置',
        variant: 'destructive'
      });
    }
  };

  const handleSave = async () => {
    if (!selectedDriver || !selectedProject) {
      toast({
        title: '请完整填写',
        description: '请选择司机和项目',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('internal_driver_project_routes')
        .insert([{
          driver_id: selectedDriver,
          project_id: selectedProject,
          is_primary_route: isPrimaryRoute,
          common_loading_location_ids: selectedLoadingLocations,
          common_unloading_location_ids: selectedUnloadingLocations
        }] as any);

      if (error) throw error;

      toast({
        title: '配置成功',
        description: '司机项目线路已配置'
      });

      setShowDialog(false);
      resetForm();
      loadRoutes();
    } catch (error: any) {
      toast({
        title: '配置失败',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedDriver('');
    setSelectedProject('');
    setSelectedLoadingLocations([]);
    setSelectedUnloadingLocations([]);
    setIsPrimaryRoute(false);
  };

  return (
    <MobileLayout>
      <div className="space-y-4 pb-6">
        {/* 页面标题 */}
        <Card className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold">司机线路配置</h2>
            <p className="text-sm text-blue-100 mt-1">为司机配置常跑的项目和线路</p>
          </CardContent>
        </Card>

        {/* 新增按钮 */}
        <Button 
          onClick={() => setShowDialog(true)}
          className="w-full h-14"
        >
          <Plus className="h-5 w-5 mr-2" />
          新增司机线路配置
        </Button>

        {/* 配置列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">已配置线路</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-sm text-muted-foreground">
              暂无配置（功能开发中）
            </div>
          </CardContent>
        </Card>

        {/* 配置对话框 */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>配置司机线路</DialogTitle>
              <DialogDescription>
                为司机配置常跑的项目和常用地点
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>选择司机</Label>
                <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择司机" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map(driver => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name} - {driver.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>选择项目</Label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择项目" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="primary" 
                  checked={isPrimaryRoute}
                  onCheckedChange={(checked) => setIsPrimaryRoute(checked as boolean)}
                />
                <Label htmlFor="primary">设为主线路</Label>
              </div>

              <div className="grid gap-2">
                <Label>常用装货地点</Label>
                <div className="text-xs text-muted-foreground mb-2">
                  可多选（司机录单时显示这些地点）
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 border rounded p-2">
                  {locations.map(loc => (
                    <div key={loc.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`load-${loc.id}`}
                        checked={selectedLoadingLocations.includes(loc.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedLoadingLocations([...selectedLoadingLocations, loc.id]);
                          } else {
                            setSelectedLoadingLocations(selectedLoadingLocations.filter(id => id !== loc.id));
                          }
                        }}
                      />
                      <Label htmlFor={`load-${loc.id}`} className="text-sm">
                        {loc.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <Label>常用卸货地点</Label>
                <div className="text-xs text-muted-foreground mb-2">
                  可多选（司机录单时显示这些地点）
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 border rounded p-2">
                  {locations.map(loc => (
                    <div key={loc.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`unload-${loc.id}`}
                        checked={selectedUnloadingLocations.includes(loc.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedUnloadingLocations([...selectedUnloadingLocations, loc.id]);
                          } else {
                            setSelectedUnloadingLocations(selectedUnloadingLocations.filter(id => id !== loc.id));
                          }
                        }}
                      />
                      <Label htmlFor={`unload-${loc.id}`} className="text-sm">
                        {loc.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                取消
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                保存配置
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MobileLayout>
  );
}

