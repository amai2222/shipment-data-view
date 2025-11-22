// 文件路径: src/pages/Drivers.tsx
// 这是最终的、完整的、修复后的代码，请直接替换

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { FormEvent, ChangeEvent } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Truck, Upload, Download, Search, Loader2, Filter, X, FileImage, CheckSquare, Square, Link, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SupabaseStorage, supabase } from "@/utils/supabase";
import { Driver, Project } from "@/types";
import * as XLSX from 'xlsx';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from "@/components/ui/badge";
import { DriverPhotoUpload, DriverPhotos } from "@/components/DriverPhotoUpload";
import { VehiclePhotoUpload, VehiclePhotos } from "@/components/VehiclePhotoUpload";
import { ShipperProjectCascadeFilter } from "@/components/ShipperProjectCascadeFilter";
import { BatchInputDialog } from "@/components/ui/BatchInputDialog";

export default function Drivers() {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // 新增筛选状态
  const [selectedShipperId, setSelectedShipperId] = useState('all');
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [availableProjects, setAvailableProjects] = useState<Array<{id: string, name: string}>>([]);
  const [photoStatus, setPhotoStatus] = useState<string>('all'); // 'all', 'complete', 'incomplete'
  const [advancedFilters, setAdvancedFilters] = useState({
    driverNames: '',
    licensePlates: '',
    phoneNumbers: '',
  });
  const [batchDialog, setBatchDialog] = useState<{
    isOpen: boolean;
    type: 'driver' | 'license' | 'phone' | null;
  }>({ isOpen: false, type: null });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: "",
    licensePlate: "",
    phone: "",
    projectIds: [] as string[],
  });
  const [driverPhotos, setDriverPhotos] = useState<DriverPhotos>({
    id_card_photos: [],
    driver_license_photos: [],
    qualification_certificate_photos: []
  });
  const [vehiclePhotos, setVehiclePhotos] = useState<VehiclePhotos>({
    driving_license_photos: [],
    transport_license_photos: []
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [pageSize, setPageSize] = useState(30); // 添加页面大小状态
  const [showAll, setShowAll] = useState(false); // 是否显示全部记录

  // 批量选择和自动关联项目相关状态
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [isSelectAll, setIsSelectAll] = useState(false); // 默认为false，非选择状态
  const [isBatchSelecting, setIsBatchSelecting] = useState(false); // 新增：是否处于批量选择模式
  const [showAssociateDialog, setShowAssociateDialog] = useState(false);
  const [associatePreview, setAssociatePreview] = useState<{
    summary: {
      total_drivers: number;
      drivers_with_projects: number;
      drivers_without_projects: number;
      total_records: number;
    };
    drivers: Array<{
      driver_name: string;
      license_plate: string;
      record_count: number;
      has_projects: boolean;
      project_names: string[];
    }>;
  } | null>(null);
  const [isAssociating, setIsAssociating] = useState(false);

  // 计算活跃筛选器数量
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedShipperId !== 'all') count++;
    if (selectedProjectId !== 'all') count++;
    if (photoStatus !== 'all') count++;
    if (advancedFilters.driverNames) count++;
    if (advancedFilters.licensePlates) count++;
    if (advancedFilters.phoneNumbers) count++;
    return count;
  }, [selectedShipperId, selectedProjectId, photoStatus, advancedFilters]);

  const clearFilters = () => {
    setSelectedShipperId('all');
    setSelectedProjectId('all');
    setPhotoStatus('all');
    setAdvancedFilters({
      driverNames: '',
      licensePlates: '',
      phoneNumbers: '',
    });
    // 清除后自动搜索
    loadData(1, '', showAll ? (totalCount || 1000) : pageSize);
  };

  const handleSearch = () => {
    loadData(1, '');
  };

  const loadData = useCallback(async (page: number, searchText: string = '', currentPageSize: number = pageSize) => {
    setIsLoading(true);
    try {
      // 先尝试加载项目数据
      if (projects.length === 0) {
        try {
          const loadedProjects = await SupabaseStorage.getProjects();
          setProjects(loadedProjects);
        } catch (projectError) {
          console.warn('项目数据加载失败，继续加载司机数据:', projectError);
          setProjects([]);
        }
      }
      
      // 准备筛选参数
      let projectIdParam: string | null = null;
      
      // 只有在明确选择了项目时才传递项目ID
      // 如果选择了"所有项目"或没有选择项目，则不传递项目ID（返回所有司机）
      if (selectedProjectId && selectedProjectId !== 'all') {
        // 如果只选择了项目（没有选择货主），直接使用项目ID
        if (!selectedShipperId || selectedShipperId === 'all') {
          projectIdParam = selectedProjectId;
        }
        // 如果选择了货主，也使用项目ID
        else if (selectedShipperId && selectedShipperId !== 'all') {
          projectIdParam = selectedProjectId;
        }
      }
      // 如果选择了货主但没有选择具体项目（选择了"所有项目"），则不传递项目ID
      // 这样会返回所有司机，不管他们是否有关联项目
      
      const photoStatusParam = photoStatus === 'all' ? null : photoStatus;
      
      // 尝试使用RPC函数加载司机数据
      try {
        const { drivers: loadedDrivers, totalCount: loadedTotalCount } = await SupabaseStorage.getDrivers(
          searchText, 
          page, 
          currentPageSize,
          {
            projectId: projectIdParam,
            photoStatus: photoStatusParam,
            driverNames: advancedFilters.driverNames || null,
            licensePlates: advancedFilters.licensePlates || null,
            phoneNumbers: advancedFilters.phoneNumbers || null,
          }
        );
        
        setDrivers(loadedDrivers || []);
        setTotalCount(loadedTotalCount);
        // 如果选择了"全部"，更新pageSize为总数
        if (showAll && loadedTotalCount > 0) {
          setPageSize(loadedTotalCount);
        }
        setTotalPages(Math.ceil(loadedTotalCount / currentPageSize));
        setCurrentPage(page);
        
      } catch (rpcError: unknown) {
        console.error('RPC函数调用失败:', rpcError);
        // 如果RPC函数失败，直接抛出错误，不要使用fallback查询
        // 因为fallback查询无法正确处理筛选条件和项目关联
        throw rpcError;
      }

    } catch (error: unknown) {
      console.error('Error loading data:', error);
      
      // 提供更详细的错误信息
      let errorMessage = "无法加载司机数据";
      if (error && typeof error === 'object' && 'message' in error) {
        const errorObj = error as { message: string };
        if (errorObj.message.includes('permission')) {
          errorMessage = "权限不足，无法访问司机数据";
        } else if (errorObj.message.includes('function')) {
          errorMessage = "数据库函数不存在，请联系管理员";
        } else if (errorObj.message.includes('connection')) {
          errorMessage = "数据库连接失败，请检查网络";
        } else {
          errorMessage = `加载失败: ${errorObj.message}`;
        }
      }
      
      toast({
        title: "加载失败",
        description: errorMessage,
        variant: "destructive",
      });
      
      // 设置空数据状态
      setDrivers([]);
      setTotalCount(0);
      setTotalPages(0);
      setCurrentPage(1);
    } finally {
      setIsLoading(false);
    }
  }, [projects.length, toast, pageSize, selectedShipperId, selectedProjectId, availableProjects, photoStatus, advancedFilters, showAll]);

  useEffect(() => {
    loadData(1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && !isLoading) {
      loadData(newPage, '');
    }
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // 重置到第一页
    loadData(1, '', newPageSize);
  };

  const resetForm = () => {
    setFormData({ name: "", licensePlate: "", phone: "", projectIds: [] });
    setDriverPhotos({
      id_card_photos: [],
      driver_license_photos: [],
      qualification_certificate_photos: []
    });
    setVehiclePhotos({
      driving_license_photos: [],
      transport_license_photos: []
    });
    setEditingDriver(null);
  };

  const handleEdit = (driver: Driver) => {
    setFormData({
      name: driver.name,
      licensePlate: driver.licensePlate,
      phone: driver.phone,
      projectIds: driver.projectIds || [],
    });
    setDriverPhotos({
      id_card_photos: driver.id_card_photos || [],
      driver_license_photos: driver.driver_license_photos || [],
      qualification_certificate_photos: driver.qualification_certificate_photos || []
    });
    setVehiclePhotos({
      driving_license_photos: driver.driving_license_photos || [],
      transport_license_photos: driver.transport_license_photos || []
    });
    setEditingDriver(driver);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.licensePlate || !formData.phone) {
      toast({ title: "请填写所有必填字段", variant: "destructive" });
      return;
    }
    try {
      const driverDataWithPhotos = {
        ...formData,
        id_card_photos: driverPhotos.id_card_photos,
        driver_license_photos: driverPhotos.driver_license_photos,
        qualification_certificate_photos: driverPhotos.qualification_certificate_photos,
        driving_license_photos: vehiclePhotos.driving_license_photos,
        transport_license_photos: vehiclePhotos.transport_license_photos
      };
      
      if (editingDriver) {
        await SupabaseStorage.updateDriver(editingDriver.id, driverDataWithPhotos);
        toast({ title: "更新成功" });
      } else {
        await SupabaseStorage.addDriver(driverDataWithPhotos);
        toast({ title: "添加成功" });
      }
      await loadData(currentPage, '');
      setIsDialogOpen(false);
      resetForm();
    } catch (error: unknown) {
      console.error('保存失败:', error);
      toast({ title: "保存失败", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await SupabaseStorage.deleteDriver(id);
      if (drivers.length === 1 && currentPage > 1) {
        await loadData(currentPage - 1, '');
      } else {
        await loadData(currentPage, '');
      }
      toast({ title: "删除成功" });
    } catch (error: unknown) {
      console.error('删除失败:', error);
      toast({ title: "删除失败", variant: "destructive" });
    }
  };

  const handleExcelImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        let importedCount = 0;
        interface ExcelRow {
          '司机姓名'?: string;
          '车牌号'?: string;
          '司机电话'?: string;
        }
        for (const row of jsonData as ExcelRow[]) {
          const driverData = {
            name: String(row['司机姓名'] || '').trim(),
            licensePlate: String(row['车牌号'] || '').trim(),
            phone: String(row['司机电话'] || '').trim(),
          };
          if (!driverData.name || !driverData.licensePlate) continue;
          await SupabaseStorage.addDriver(driverData);
          importedCount++;
        }

        toast({
          title: "导入完成",
          description: `成功导入 ${importedCount} 个司机`,
        });

        await loadData(1, '');
      } catch (error) {
        toast({ title: "导入失败", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExcelExport = () => {
    toast({
      title: "正在导出当前页数据...",
    });
    try {
      const exportData = drivers.map(driver => ({
        '司机姓名': driver.name,
        '车牌号': driver.licensePlate,
        '司机电话': driver.phone,
        '创建时间': new Date(driver.createdAt).toLocaleDateString()
      }));
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '司机列表');
      const fileName = `司机列表_第${currentPage}页_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      toast({ title: "导出失败", variant: "destructive" });
    }
  };

  // 批量选择相关函数
  const handleSelectDriver = (driverId: string) => {
    setSelectedDrivers(prev => 
      prev.includes(driverId) 
        ? prev.filter(id => id !== driverId)
        : [...prev, driverId]
    );
  };

  const handleSelectAll = () => {
    if (isSelectAll) {
      setSelectedDrivers([]);
      setIsSelectAll(false);
    } else {
      const allDriverIds = drivers.map(driver => driver.id);
      setSelectedDrivers(allDriverIds);
      setIsSelectAll(true);
    }
  };

  const handleSelectPage = () => {
    const currentPageDriverIds = drivers.map(driver => driver.id);
    setSelectedDrivers(currentPageDriverIds);
    setIsSelectAll(true);
  };

  const handleSelectAllRecords = async () => {
    try {
      // 获取所有司机的ID（不分页）
      // 准备筛选参数（与loadData中的逻辑一致）
      let projectIdParam: string | null = null;
      // 只有在明确选择了项目时才传递项目ID
      // 如果选择了"所有项目"或没有选择项目，则不传递项目ID（返回所有司机）
      if (selectedProjectId && selectedProjectId !== 'all') {
        // 如果只选择了项目（没有选择货主），直接使用项目ID
        if (!selectedShipperId || selectedShipperId === 'all') {
          projectIdParam = selectedProjectId;
        }
        // 如果选择了货主，也使用项目ID
        else if (selectedShipperId && selectedShipperId !== 'all') {
          projectIdParam = selectedProjectId;
        }
      }
      // 如果选择了货主但没有选择具体项目（选择了"所有项目"），则不传递项目ID
      // 这样会返回所有司机，不管他们是否有关联项目
      const photoStatusParam = photoStatus === 'all' ? null : photoStatus;
      
      const { drivers: allDrivers } = await SupabaseStorage.getDrivers('', 1, totalCount, {
        projectId: projectIdParam,
        photoStatus: photoStatusParam,
        driverNames: advancedFilters.driverNames || null,
        licensePlates: advancedFilters.licensePlates || null,
        phoneNumbers: advancedFilters.phoneNumbers || null,
      });
      const allDriverIds = allDrivers.map(driver => driver.id);
      setSelectedDrivers(allDriverIds);
      setIsSelectAll(true);
    } catch (error: unknown) {
      console.error('获取所有司机失败:', error);
      toast({ title: "获取所有司机失败", variant: "destructive" });
    }
  };

  const handleDeselectCurrentPage = () => {
    const currentPageDriverIds = drivers.map(driver => driver.id);
    setSelectedDrivers(prev => prev.filter(id => !currentPageDriverIds.includes(id)));
    setIsSelectAll(false);
  };

  // 切换批量选择模式
  const toggleBatchSelecting = () => {
    setIsBatchSelecting(prev => !prev);
    if (isBatchSelecting) { // 如果从选择模式退出，则清空所有选择
      setSelectedDrivers([]);
      setIsSelectAll(false);
    }
  };

  // 预览自动关联项目
  const handlePreviewAssociate = async () => {
    if (selectedDrivers.length === 0) {
      toast({ title: "请先选择要关联的司机", variant: "destructive" });
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase.rpc('preview_driver_project_association', {
        p_driver_ids: selectedDrivers
      });

      if (error) {
        console.error('预览关联失败:', error);
        throw error;
      }

      setAssociatePreview(data as typeof associatePreview);
      setShowAssociateDialog(true);
      
      // 添加调试信息
      console.log('预览数据:', data);
      console.log('司机数量:', (data as typeof associatePreview)?.drivers?.length);
      console.log('汇总信息:', (data as typeof associatePreview)?.summary);
    } catch (error: unknown) {
      console.error('预览关联失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({ 
        title: "预览关联失败", 
        description: errorMessage || "请检查数据库连接或联系管理员",
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 执行自动关联项目
  const handleExecuteAssociate = async () => {
    if (selectedDrivers.length === 0) {
      toast({ title: "请先选择要关联的司机", variant: "destructive" });
      return;
    }

    try {
      setIsAssociating(true);
      const { data, error } = await supabase.rpc('batch_associate_driver_projects', {
        p_driver_ids: selectedDrivers
      });

      if (error) throw error;

      toast({ 
        title: "自动关联完成", 
        description: data.message 
      });

      // 重新加载数据
      await loadData(currentPage, '');
      
      // 清空选择
      setSelectedDrivers([]);
      setIsSelectAll(false);
      setShowAssociateDialog(false);
    } catch (error: unknown) {
      console.error('自动关联失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({ 
        title: "自动关联失败", 
        description: errorMessage || "请检查数据库连接或联系管理员",
        variant: "destructive" 
      });
    } finally {
      setIsAssociating(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader 
        title="司机与车辆管理" 
        description="管理司机档案和车辆信息"
        icon={Truck}
        iconColor="text-orange-600"
      >
        <div className="flex items-center space-x-2">
          {/* 批量选择模式切换按钮 */}
          <Button variant="outline" onClick={toggleBatchSelecting}>
            {isBatchSelecting ? <CheckSquare className="h-4 w-4 mr-2" /> : <Square className="h-4 w-4 mr-2" />}
            {isBatchSelecting ? "退出批量选择" : "批量选择"}
            {isBatchSelecting && <ChevronDown className="h-4 w-4 ml-2" />}
          </Button>

          {/* 批量选择下拉菜单 - 只在批量选择模式下显示 */}
          {isBatchSelecting && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="ml-2">
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={handleSelectPage}>
                  选择当前页({drivers.length})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDeselectCurrentPage}>
                  取消选择当前页
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSelectAllRecords}>
                  选择所有 {totalCount} 条记录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* 批量关联按钮 - 只在选择了司机时显示 */}
          {selectedDrivers.length > 0 && (
            <>
              <Button
                variant="default"
                onClick={handlePreviewAssociate}
                disabled={isLoading}
              >
                <Link className="h-4 w-4 mr-2" />
                批量关联项目({selectedDrivers.length})
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedDrivers([]);
                  setIsSelectAll(false);
                }}
              >
                取消选择
              </Button>
            </>
          )}

          {/* 新增司机按钮 */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                新增司机
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  {editingDriver ? "编辑司机" : "新增司机"}
                </DialogTitle>
              </DialogHeader>
              
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">基本信息</TabsTrigger>
                  <TabsTrigger value="photos" className="flex items-center gap-2">
                    <FileImage className="h-4 w-4" />
                    证件照片
                  </TabsTrigger>
                  <TabsTrigger value="vehicle-photos" className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    车辆照片
                  </TabsTrigger>
                </TabsList>
                
                {/* 基本信息标签页 */}
                <TabsContent value="basic">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">司机姓名 *</Label>
                      <Input id="name" value={formData.name} onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))} placeholder="请输入司机姓名" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="licensePlate">车牌号 *</Label>
                      <Input id="licensePlate" value={formData.licensePlate} onChange={(e) => setFormData(prev => ({...prev, licensePlate: e.target.value}))} placeholder="请输入车牌号" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">司机电话 *</Label>
                      <Input id="phone" value={formData.phone} onChange={(e) => setFormData(prev => ({...prev, phone: e.target.value}))} placeholder="请输入电话号码" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="projectIds">关联项目</Label>
                      <div className="max-h-40 overflow-y-auto border rounded-md p-2">
                        {projects.map((project) => (
                          <div key={project.id} className="flex items-center space-x-2 py-1">
                            <input type="checkbox" id={`project-${project.id}`} checked={formData.projectIds.includes(project.id)} onChange={(e) => {
                              const { checked } = e.target;
                              setFormData(prev => ({ ...prev, projectIds: checked ? [...prev.projectIds, project.id] : prev.projectIds.filter(id => id !== project.id) }));
                            }} className="rounded" />
                            <Label htmlFor={`project-${project.id}`} className="text-sm">{project.name}</Label>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">选择司机可以参与的项目</p>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button>
                      <Button type="submit" className="bg-gradient-primary hover:bg-primary-hover">{editingDriver ? "更新" : "添加"}</Button>
                    </div>
                  </form>
                </TabsContent>
                
                {/* 证件照片标签页 */}
                <TabsContent value="photos">
                  <div className="space-y-4">
                    <DriverPhotoUpload
                      driverName={formData.name || '未命名司机'}
                      licensePlate={formData.licensePlate || '未知车牌'}
                      existingPhotos={driverPhotos}
                      onChange={setDriverPhotos}
                      driverId={editingDriver?.id}
                    />
                    <div className="flex justify-end space-x-2 pt-4 border-t">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>关闭</Button>
                      <Button type="button" onClick={handleSubmit} className="bg-gradient-primary hover:bg-primary-hover">
                        {editingDriver ? "更新司机信息" : "保存司机信息"}
                      </Button>
                    </div>
                  </div>
                </TabsContent>
                
                {/* 车辆照片标签页 */}
                <TabsContent value="vehicle-photos">
                  <div className="space-y-4">
                    <VehiclePhotoUpload
                      driverName={formData.name || '未命名司机'}
                      licensePlate={formData.licensePlate || '未知车牌'}
                      existingPhotos={vehiclePhotos}
                      onChange={setVehiclePhotos}
                      driverId={editingDriver?.id}
                    />
                    <div className="flex justify-end space-x-2 pt-4 border-t">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>关闭</Button>
                      <Button type="button" onClick={handleSubmit} className="bg-gradient-primary hover:bg-primary-hover">
                        {editingDriver ? "更新司机信息" : "保存司机信息"}
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
        </Dialog>
        </div>
      </PageHeader>

      <div className="space-y-6">
        <Card className="rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 border-gray-200">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold text-gray-900">司机列表 (共 {totalCount} 条记录)</CardTitle>
            <div className="flex space-x-2">
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleExcelImport} className="hidden" />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="flex items-center space-x-2"><Upload className="h-4 w-4" /><span>导入Excel</span></Button>
              <Button variant="outline" onClick={handleExcelExport} className="flex items-center space-x-2"><Download className="h-4 w-4" /><span>导出Excel</span></Button>
            </div>
          </div>
          {/* ===== 筛选器区域 ===== */}
          <CardContent className="p-4">
            {/* 常规筛选区域 - 一行布局 */}
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex-none" style={{width: '480px'}}>
                <ShipperProjectCascadeFilter
                  selectedShipperId={selectedShipperId}
                  selectedProjectId={selectedProjectId}
                  onShipperChange={(id) => {
                    setSelectedShipperId(id);
                    setSelectedProjectId('all');
                    setAvailableProjects([]);
                  }}
                  onProjectChange={(id) => {
                    setSelectedProjectId(id);
                  }}
                  onProjectsChange={(projects) => {
                    setAvailableProjects(projects);
                  }}
                />
              </div>
              
              <div className="flex-none w-36 space-y-2">
                <Label>照片状态</Label>
                <Select value={photoStatus} onValueChange={setPhotoStatus}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="has">有照片</SelectItem>
                    <SelectItem value="none">没有照片</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button variant="outline" onClick={clearFilters} className="h-10">清除</Button>
              <Button onClick={handleSearch} className="h-10 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white">
                <Search className="mr-2 h-4 w-4"/>搜索
              </Button>
              <Button variant="outline" onClick={() => setShowAdvanced(!showAdvanced)} className="h-10">
                {showAdvanced ? <><ChevronUp className="mr-1 h-4 w-4" />收起</> : <><ChevronDown className="mr-1 h-4 w-4" />高级</>}
              </Button>
            </div>
            
            {/* 高级筛选区域 */}
            {showAdvanced && (
              <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* 司机姓名筛选 */}
                  <div className="space-y-2">
                    <Label htmlFor="driverName" className="text-sm font-medium text-purple-800 flex items-center gap-1">
                      <Truck className="h-4 w-4" />
                      司机姓名
                    </Label>
                    <div className="flex gap-1">
                      <Input
                        id="driverName"
                        type="text"
                        placeholder="司机姓名，多个用逗号分隔..."
                        value={advancedFilters.driverNames}
                        onChange={(e) => setAdvancedFilters(prev => ({ ...prev, driverNames: e.target.value }))}
                        className="h-10 flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBatchDialog({ isOpen: true, type: 'driver' })}
                        className="h-10 px-2"
                        title="批量输入"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* 车牌号筛选 */}
                  <div className="space-y-2">
                    <Label htmlFor="licensePlate" className="text-sm font-medium text-purple-800 flex items-center gap-1">
                      <Truck className="h-4 w-4" />
                      车牌号
                    </Label>
                    <div className="flex gap-1">
                      <Input
                        id="licensePlate"
                        type="text"
                        placeholder="车牌号，多个用逗号分隔..."
                        value={advancedFilters.licensePlates}
                        onChange={(e) => setAdvancedFilters(prev => ({ ...prev, licensePlates: e.target.value }))}
                        className="h-10 flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBatchDialog({ isOpen: true, type: 'license' })}
                        className="h-10 px-2"
                        title="批量输入"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* 电话筛选 */}
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber" className="text-sm font-medium text-purple-800 flex items-center gap-1">
                      <Truck className="h-4 w-4" />
                      电话
                    </Label>
                    <div className="flex gap-1">
                      <Input
                        id="phoneNumber"
                        type="text"
                        placeholder="电话号码，多个用逗号分隔..."
                        value={advancedFilters.phoneNumbers}
                        onChange={(e) => setAdvancedFilters(prev => ({ ...prev, phoneNumbers: e.target.value }))}
                        className="h-10 flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBatchDialog({ isOpen: true, type: 'phone' })}
                        className="h-10 px-2"
                        title="批量输入"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <Table>
              <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
                <TableRow className="border-b border-gray-200">
          {isBatchSelecting && (
            <TableHead className="w-12">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    {isSelectAll ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={handleSelectPage}>
                    选择当前页({drivers.length})
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDeselectCurrentPage}>
                    取消选择当前页
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSelectAllRecords}>
                    选择所有 {totalCount} 条记录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableHead>
          )}
                   <TableHead>司机姓名</TableHead>
                   <TableHead>车牌号</TableHead>
                   <TableHead>司机电话</TableHead>
                   <TableHead>关联项目</TableHead>
                   <TableHead>照片状态</TableHead>
                   <TableHead>创建时间</TableHead>
                   <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={isBatchSelecting ? 8 : 7} className="text-center py-8">
                      <div className="flex justify-center items-center">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        正在加载数据...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : drivers.length > 0 ? (
                  drivers.map((driver) => (
                    <TableRow 
                      key={driver.id}
                      data-state={selectedDrivers.includes(driver.id) && "selected"}
                      onClick={() => {
                        if (isBatchSelecting) {
                          handleSelectDriver(driver.id); // 批量选择模式下点击行切换选择状态
                        } else {
                          handleEdit(driver); // 非批量选择模式下点击行编辑
                        }
                      }}
                      className={!isBatchSelecting ? "cursor-pointer hover:bg-gray-50" : ""} // 添加鼠标样式
                    >
                      {isBatchSelecting && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation(); // 阻止事件冒泡到TableRow的onClick
                              handleSelectDriver(driver.id);
                            }}
                            className="h-8 w-8 p-0"
                          >
                            {selectedDrivers.includes(driver.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{driver.name}</TableCell>
                      <TableCell className="font-mono">{driver.licensePlate}</TableCell>
                      <TableCell>{driver.phone}</TableCell>
                      <TableCell>
                        {driver.projectIds && driver.projectIds.length > 0 ? 
                          driver.projectIds.map(id => projects.find(p => p.id === id)?.name).filter(Boolean).join(', ') : 
                          '未关联特定项目'
                        }
                      </TableCell>
                      <TableCell>
                        {driver.photoStatus === 'has' ? (
                          <Badge variant="default" className="bg-green-500">有</Badge>
                        ) : (
                          <Badge variant="secondary">没有</Badge>
                        )}
                      </TableCell>
                      <TableCell>{new Date(driver.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation(); // 阻止事件冒泡到TableRow
                              handleEdit(driver);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation(); // 阻止事件冒泡到TableRow
                              handleDelete(driver.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={isBatchSelecting ? 8 : 7} className="h-24 text-center">
                      <Truck className="mx-auto h-12 w-12 text-muted-foreground" />
                      <p className="mt-2 text-muted-foreground">
                        {activeFiltersCount > 0 ? '当前筛选条件下无数据' : '暂无司机数据'}
                      </p>
                      {activeFiltersCount > 0 && (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={clearFilters}
                          className="mt-2"
                        >
                          清除筛选条件
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        
        <CardFooter>
          <div className="flex items-center justify-between w-full py-4 px-6 border-t border-gray-200 bg-white">
            {/* 左侧：统计信息 */}
            <div className="flex-1 text-sm text-slate-600">
              <span className="text-slate-600">共{totalCount} 条记录</span>
            </div>
            
            {/* 右侧：分页控制 */}
            <div className="flex items-center space-x-4">
              {/* 每页显示条数选择 */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-slate-600">每页显示</span>
                <select
                  value={showAll ? 'all' : pageSize}
                  onChange={(e) => {
                    if (e.target.value === 'all') {
                      setShowAll(true);
                      handlePageSizeChange(totalCount || 1000);
                    } else {
                      setShowAll(false);
                      handlePageSizeChange(Number(e.target.value));
                    }
                  }}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                  {totalCount > 0 && <option value="all">全部 ({totalCount})</option>}
                </select>
                <span className="text-sm text-slate-600">条</span>
              </div>
              
              {/* 分页按钮 */}
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handlePageChange(currentPage - 1)} 
                  disabled={currentPage <= 1 || isLoading}
                  className="px-3 py-1 text-sm border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors duration-150"
                >
                  上一页
                </Button>
                
                {/* 页码输入 */}
                <div className="flex items-center space-x-1">
                  <span className="text-sm text-slate-600">第</span>
                  <input
                    type="number"
                    value={currentPage}
                    onChange={(e) => {
                      const page = Number(e.target.value);
                      if (page >= 1 && page <= totalPages) {
                        handlePageChange(page);
                      }
                    }}
                    className="w-10 px-1 py-1 text-sm text-center border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    min="1"
                    max={totalPages}
                  />
                  <span className="text-sm text-slate-600">页,共{totalPages}页</span>
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handlePageChange(currentPage + 1)} 
                  disabled={currentPage >= totalPages || isLoading}
                  className="px-3 py-1 text-sm border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors duration-150"
                >
                  下一页
                </Button>
              </div>
            </div>
          </div>
        </CardFooter>
      </Card>

      {/* 自动关联项目预览对话框 */}
      <Dialog open={showAssociateDialog} onOpenChange={setShowAssociateDialog}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              自动关联项目预览
            </DialogTitle>
          </DialogHeader>
          
          {associatePreview && (
            <div className="space-y-4">
              {/* 汇总信息 */}
              <div className="bg-muted/30 p-4 rounded-lg">
                <h3 className="font-medium mb-2">关联汇总</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">总司机数：</span>
                    <span className="font-medium">{associatePreview.summary.total_drivers}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">找到项目：</span>
                    <span className="font-medium text-green-600">{associatePreview.summary.drivers_with_projects}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">未找到项目：</span>
                    <span className="font-medium text-orange-600">{associatePreview.summary.drivers_without_projects}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">总运单数：</span>
                    <span className="font-medium">{associatePreview.summary.total_records}</span>
                  </div>
                </div>
              </div>

              {/* 司机详情列表 */}
              <div className="space-y-2">
                <h3 className="font-medium">司机详情</h3>
                <div className="max-h-60 overflow-y-auto border rounded-lg">
                  {associatePreview.drivers.map((driver, index) => (
                    <div key={index} className="p-3 border-b last:border-b-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{driver.driver_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {driver.license_plate} • {driver.record_count} 条运单记录
                          </div>
                        </div>
                        <div className="text-right">
                          {driver.has_projects ? (
                            <div className="text-sm">
                              <div className="text-green-600 font-medium">找到 {driver.project_names.length} 个项目</div>
                              <div className="text-xs text-muted-foreground">
                                {driver.project_names.join(', ')}
                              </div>
                            </div>
                          ) : (
                            <div className="text-orange-600 text-sm">未找到项目</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowAssociateDialog(false)}
                >
                  取消
                </Button>
                <Button
                  onClick={handleExecuteAssociate}
                  disabled={isAssociating || associatePreview.summary.drivers_with_projects === 0}
                >
                  {isAssociating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      正在关联...
                    </>
                  ) : (
                    <>
                      <Link className="h-4 w-4 mr-2" />
                      确认关联
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 批量输入对话框 */}
      <BatchInputDialog
        isOpen={batchDialog.isOpen}
        onClose={() => setBatchDialog({ isOpen: false, type: null })}
        onConfirm={(values) => {
          const value = values.join(',');
          const type = batchDialog.type;
          if (type === 'driver') {
            setAdvancedFilters(prev => ({ ...prev, driverNames: value }));
          } else if (type === 'license') {
            setAdvancedFilters(prev => ({ ...prev, licensePlates: value }));
          } else if (type === 'phone') {
            setAdvancedFilters(prev => ({ ...prev, phoneNumbers: value }));
          }
        }}
        title={
          batchDialog.type === 'driver' ? '批量输入司机姓名' :
          batchDialog.type === 'license' ? '批量输入车牌号' :
          batchDialog.type === 'phone' ? '批量输入电话号码' : ''
        }
        description={
          batchDialog.type === 'driver' ? '支持批量输入多个司机姓名' :
          batchDialog.type === 'license' ? '支持批量输入多个车牌号' :
          batchDialog.type === 'phone' ? '支持批量输入多个电话号码' : ''
        }
        placeholder="请粘贴内容，用换行或逗号分隔..."
        initialValue={
          batchDialog.type === 'driver' ? advancedFilters.driverNames.split(',').filter(v => v.trim()) :
          batchDialog.type === 'license' ? advancedFilters.licensePlates.split(',').filter(v => v.trim()) :
          batchDialog.type === 'phone' ? advancedFilters.phoneNumbers.split(',').filter(v => v.trim()) : []
        }
      />
      </div>
    </div>
  );
}
