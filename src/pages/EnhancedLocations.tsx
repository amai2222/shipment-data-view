/**
 * 增强的地址管理组件
 * 集成高德地图地理编码功能
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Edit, 
  Trash2, 
  MapPin, 
  Upload, 
  Download, 
  Search, 
  Filter, 
  X, 
  RefreshCw,
  Map,
  Navigation,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  Zap,
  Target,
  BarChart3,
  Settings,
  ChevronDown,
  CheckSquare,
  Square
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SupabaseStorage } from "@/utils/supabase";
import { Location, Project } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from '@/components/PageHeader';
import { createLocationGeocodingService, LocationWithGeocoding, BatchGeocodingResult } from '@/services/LocationGeocodingService';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from 'xlsx';

export default function EnhancedLocations() {
  const { toast } = useToast();
  const [locations, setLocations] = useState<LocationWithGeocoding[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationWithGeocoding | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showGeocodingInfo, setShowGeocodingInfo] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showBatchActions, setShowBatchActions] = useState(false);
  const [geocodingStats, setGeocodingStats] = useState({
    total: 0,
    success: 0,
    pending: 0,
    failed: 0,
    retry: 0
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const geocodingService = createLocationGeocodingService(toast);
  
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    projectIds: [] as string[],
  });

  // 筛选后的地点列表
  const filteredLocations = useMemo(() => {
    let filtered = locations;

    // 搜索筛选
    if (searchQuery) {
      filtered = filtered.filter(location =>
        location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (location.address && location.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (location.formatted_address && location.formatted_address.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // 项目筛选
    if (projectFilter !== "all") {
      filtered = filtered.filter(location =>
        location.projectIds && location.projectIds.includes(projectFilter)
      );
    }

    return filtered;
  }, [locations, searchQuery, projectFilter]);

  const clearFilters = () => {
    setSearchQuery("");
    setProjectFilter("all");
  }

  const activeFiltersCount = (searchQuery ? 1 : 0) + (projectFilter !== "all" ? 1 : 0);

  // 批量选择相关函数
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedLocations(filteredLocations.map(loc => loc.id));
    } else {
      setSelectedLocations([]);
    }
  };

  const handleSelectLocation = (locationId: string, checked: boolean) => {
    if (checked) {
      setSelectedLocations(prev => [...prev, locationId]);
    } else {
      setSelectedLocations(prev => prev.filter(id => id !== locationId));
    }
  };

  const isLocationSelected = (locationId: string) => {
    return selectedLocations.includes(locationId);
  };

  // 批量操作函数
  const handleBatchGeocodingSelected = async () => {
    if (selectedLocations.length === 0) {
      toast({
        title: "请选择地点",
        description: "请先选择要地理编码的地点",
        variant: "destructive",
      });
      return;
    }

    setIsGeocoding(true);
    try {
      const result: BatchGeocodingResult = await geocodingService.batchGeocodeLocations(selectedLocations);

      toast({
        title: "批量地理编码完成",
        description: `成功: ${result.success}, 失败: ${result.failed}`,
      });

      await loadData();
      await loadGeocodingStats();
      setSelectedLocations([]);
      setSelectAll(false);
    } catch (error) {
      console.error('Batch geocoding failed:', error);
      toast({
        title: "批量地理编码失败",
        description: "网络错误或API限制",
        variant: "destructive",
      });
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleBatchDeleteSelected = async () => {
    if (selectedLocations.length === 0) {
      toast({
        title: "请选择地点",
        description: "请先选择要删除的地点",
        variant: "destructive",
      });
      return;
    }

    try {
      await Promise.all(selectedLocations.map(id => SupabaseStorage.deleteLocation(id)));
      
      toast({
        title: "批量删除成功",
        description: `已删除 ${selectedLocations.length} 个地点`,
      });

      await loadData();
      await loadGeocodingStats();
      setSelectedLocations([]);
      setSelectAll(false);
    } catch (error) {
      console.error('Batch delete failed:', error);
      toast({
        title: "批量删除失败",
        description: "无法删除选中的地点",
        variant: "destructive",
      });
    }
  };

  const handleExportSelected = () => {
    if (selectedLocations.length === 0) {
      toast({
        title: "请选择地点",
        description: "请先选择要导出的地点",
        variant: "destructive",
      });
      return;
    }

    const selectedData = locations.filter(loc => selectedLocations.includes(loc.id));
    const exportData = selectedData.map(location => ({
      '地点名称': location.name,
      '详细地址': location.formatted_address || location.address || '',
      '纬度': location.latitude || '',
      '经度': location.longitude || '',
      '省份': location.province || '',
      '城市': location.city || '',
      '区县': location.district || '',
      '地理编码状态': getGeocodingStatusText(location.geocoding_status || 'pending'),
      '创建时间': new Date(location.createdAt).toLocaleDateString()
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '地点数据');
    XLSX.writeFile(wb, `地点数据_${new Date().toISOString().split('T')[0]}.xlsx`);

    toast({
      title: "导出成功",
      description: `已导出 ${selectedLocations.length} 个地点的数据`,
    });
  };

  // 加载地点数据
  useEffect(() => {
    loadData();
    loadGeocodingStats();
  }, []);

  const loadData = async () => {
    try {
      const [loadedLocations, loadedProjects] = await Promise.all([
        SupabaseStorage.getLocations(),
        SupabaseStorage.getProjects()
      ]);
      setLocations(loadedLocations as LocationWithGeocoding[]);
      setProjects(loadedProjects);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "加载失败",
        description: "无法加载数据",
        variant: "destructive",
      });
    }
  }

  const loadGeocodingStats = async () => {
    try {
      const stats = await geocodingService.getGeocodingStats();
      setGeocodingStats(stats);
    } catch (error) {
      console.error('Error loading geocoding stats:', error);
    }
  }

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      projectIds: [],
    });
    setEditingLocation(null);
  }

  // 打开编辑对话框
  const handleEdit = (location: LocationWithGeocoding) => {
    setFormData({
      name: location.name,
      address: location.address || "",
      projectIds: location.projectIds || [],
    });
    setEditingLocation(location);
    setIsDialogOpen(true);
  }

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast({
        title: "请填写地点名称",
        description: "地点名称是必填的",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingLocation) {
        // 更新现有地点
        await SupabaseStorage.updateLocation(editingLocation.id, {
          name: formData.name,
          projectIds: formData.projectIds,
        });
        
        // 如果地址有变化，重新进行地理编码
        if (formData.address !== editingLocation.address) {
          await geocodingService.geocodeLocation(editingLocation.id, formData.address);
        }
        
        toast({
          title: "更新成功",
          description: "地点信息已成功更新",
        });
      } else {
        // 创建新地点并自动地理编码
        const result = await geocodingService.autoGeocodeNewLocation({
          name: formData.name,
          address: formData.address,
          projectIds: formData.projectIds
        });
        
        if (!result.success) {
          toast({
            title: "创建失败",
            description: result.error || "无法创建地点",
            variant: "destructive",
          });
          return;
        }
      }

      await loadData();
      await loadGeocodingStats();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving location:', error);
      toast({
        title: "保存失败",
        description: "无法保存地点信息",
        variant: "destructive",
      });
    }
  }

  // 删除地点
  const handleDelete = async (id: string) => {
    try {
      await SupabaseStorage.deleteLocation(id);
      await loadData();
      await loadGeocodingStats();
      toast({
        title: "删除成功",
        description: "地点已成功删除",
      });
    } catch (error) {
      console.error('Error deleting location:', error);
      toast({
        title: "删除失败",
        description: "无法删除地点",
        variant: "destructive",
      });
    }
  }

  // 手动地理编码
  const handleManualGeocoding = async (location: LocationWithGeocoding) => {
    setIsGeocoding(true);
    try {
      const result = await geocodingService.geocodeLocation(location.id, location.address);
      if (result.success) {
        toast({
          title: "地理编码成功",
          description: "地点坐标已更新",
        });
        await loadData();
        await loadGeocodingStats();
      } else {
        toast({
          title: "地理编码失败",
          description: result.error || "无法获取坐标信息",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Manual geocoding failed:', error);
      toast({
        title: "地理编码失败",
        description: "网络错误或API限制",
        variant: "destructive",
      });
    } finally {
      setIsGeocoding(false);
    }
  }

  // 批量地理编码
  const handleBatchGeocoding = async () => {
    setIsGeocoding(true);
    try {
      const pendingLocations = locations.filter(loc => 
        loc.geocoding_status === 'pending' || loc.geocoding_status === 'failed'
      );
      
      if (pendingLocations.length === 0) {
        toast({
          title: "无需处理",
          description: "没有待地理编码的地点",
        });
        return;
      }

      const result: BatchGeocodingResult = await geocodingService.batchGeocodeLocations(
        pendingLocations.map(loc => loc.id)
      );

      toast({
        title: "批量地理编码完成",
        description: `成功: ${result.success}, 失败: ${result.failed}`,
      });

      await loadData();
      await loadGeocodingStats();
    } catch (error) {
      console.error('Batch geocoding failed:', error);
      toast({
        title: "批量地理编码失败",
        description: "网络错误或API限制",
        variant: "destructive",
      });
    } finally {
      setIsGeocoding(false);
    }
  }

  // 重试失败的地理编码
  const handleRetryFailedGeocoding = async () => {
    setIsGeocoding(true);
    try {
      const result: BatchGeocodingResult = await geocodingService.retryFailedGeocoding();
      
      toast({
        title: "重试完成",
        description: `成功: ${result.success}, 失败: ${result.failed}`,
      });

      await loadData();
      await loadGeocodingStats();
    } catch (error) {
      console.error('Retry geocoding failed:', error);
      toast({
        title: "重试失败",
        description: "网络错误或API限制",
        variant: "destructive",
      });
    } finally {
      setIsGeocoding(false);
    }
  }

  // 获取地理编码状态图标
  const getGeocodingStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'retry':
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      default:
        return <MapPin className="h-4 w-4 text-gray-500" />;
    }
  }

  // 获取地理编码状态文本
  const getGeocodingStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return '已编码';
      case 'pending':
        return '待编码';
      case 'failed':
        return '编码失败';
      case 'retry':
        return '重试中';
      default:
        return '未知';
    }
  }

  // 获取地理编码状态颜色
  const getGeocodingStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'retry':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader 
        title="地址管理" 
        description="管理运输地点信息，支持自动地理编码"
        icon={MapPin}
        iconColor="text-blue-600"
      />

      {/* 地理编码统计卡片 */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">总地点</p>
                <p className="text-2xl font-bold">{geocodingStats.total}</p>
              </div>
              <MapPin className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">已编码</p>
                <p className="text-2xl font-bold text-green-600">{geocodingStats.success}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">待编码</p>
                <p className="text-2xl font-bold text-yellow-600">{geocodingStats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">编码失败</p>
                <p className="text-2xl font-bold text-red-600">{geocodingStats.failed}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">重试中</p>
                <p className="text-2xl font-bold text-blue-600">{geocodingStats.retry}</p>
              </div>
              <RefreshCw className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 操作栏 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm}>
                    <Plus className="h-4 w-4 mr-2" />
                    添加地点
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {editingLocation ? "编辑地点" : "添加地点"}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="name">地点名称 *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="请输入地点名称"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="address">详细地址</Label>
                      <Textarea
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="请输入详细地址（用于地理编码）"
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label htmlFor="projects">关联项目</Label>
                      <Select
                        value={formData.projectIds.length > 0 ? formData.projectIds[0] : "none"}
                        onValueChange={(value) => setFormData({ ...formData, projectIds: value && value !== "none" ? [value] : [] })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择项目" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">无关联项目</SelectItem>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        取消
                      </Button>
                      <Button type="submit">
                        {editingLocation ? "更新" : "添加"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              <div className="flex items-center space-x-2">
                {/* 批量操作下拉菜单 */}
                {selectedLocations.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        <Zap className="h-4 w-4 mr-2" />
                        批量操作 ({selectedLocations.length})
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={handleBatchGeocodingSelected}>
                        <Map className="h-4 w-4 mr-2" />
                        地理编码选中
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExportSelected}>
                        <Download className="h-4 w-4 mr-2" />
                        导出选中
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={handleBatchDeleteSelected}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        删除选中
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* 全量操作按钮 */}
                <Button
                  variant="outline"
                  onClick={handleBatchGeocoding}
                  disabled={isGeocoding || geocodingStats.pending === 0}
                >
                  {isGeocoding ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Map className="h-4 w-4 mr-2" />
                  )}
                  全部地理编码
                </Button>

                {geocodingStats.failed > 0 && (
                  <Button
                    variant="outline"
                    onClick={handleRetryFailedGeocoding}
                    disabled={isGeocoding}
                  >
                    {isGeocoding ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    重试失败
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="show-geocoding"
                checked={showGeocodingInfo}
                onCheckedChange={setShowGeocodingInfo}
              />
              <Label htmlFor="show-geocoding">显示地理编码信息</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="搜索地点名称或地址..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="筛选项目" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有项目</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {activeFiltersCount > 0 && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  清除筛选 ({activeFiltersCount})
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 批量操作状态栏 */}
      {selectedLocations.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-blue-800">
                  已选择 {selectedLocations.length} 个地点
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedLocations([]);
                    setSelectAll(false);
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  取消选择
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBatchGeocodingSelected}
                  disabled={isGeocoding}
                >
                  {isGeocoding ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Map className="h-4 w-4 mr-1" />
                  )}
                  地理编码
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 地点列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            地点列表 ({filteredLocations.length})
            {selectedLocations.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                已选择 {selectedLocations.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectAll}
                      onCheckedChange={handleSelectAll}
                      aria-label="选择全部"
                    />
                  </TableHead>
                  <TableHead>地点名称</TableHead>
                  {showGeocodingInfo && <TableHead>详细地址</TableHead>}
                  {showGeocodingInfo && <TableHead>坐标</TableHead>}
                  {showGeocodingInfo && <TableHead>地理编码状态</TableHead>}
                  <TableHead>关联项目</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="w-32">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLocations.map((location) => (
                  <TableRow key={location.id} className={isLocationSelected(location.id) ? "bg-blue-50" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={isLocationSelected(location.id)}
                        onCheckedChange={(checked) => handleSelectLocation(location.id, checked as boolean)}
                        aria-label={`选择 ${location.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{location.name}</TableCell>
                    {showGeocodingInfo && (
                      <TableCell>
                        {location.formatted_address || location.address || '-'}
                      </TableCell>
                    )}
                    {showGeocodingInfo && (
                      <TableCell>
                        {location.latitude && location.longitude ? (
                          <div className="text-sm">
                            <div>{location.latitude.toFixed(6)}</div>
                            <div>{location.longitude.toFixed(6)}</div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    )}
                    {showGeocodingInfo && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getGeocodingStatusIcon(location.geocoding_status || 'pending')}
                          <Badge className={getGeocodingStatusColor(location.geocoding_status || 'pending')}>
                            {getGeocodingStatusText(location.geocoding_status || 'pending')}
                          </Badge>
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      {location.projectIds && location.projectIds.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {location.projectIds.map((projectId) => {
                            const project = projects.find(p => p.id === projectId);
                            return project ? (
                              <Badge key={projectId} variant="outline" className="text-xs">
                                {project.name}
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">无</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(location.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(location)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        {showGeocodingInfo && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleManualGeocoding(location)}
                            disabled={isGeocoding}
                            title="手动地理编码"
                          >
                            {isGeocoding ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Map className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                        <ConfirmDialog
                          title="确认删除"
                          description={`确定要删除地点 "${location.name}" 吗？`}
                          onConfirm={() => handleDelete(location.id)}
                        >
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </ConfirmDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
