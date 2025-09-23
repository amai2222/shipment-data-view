// 文件路径: src/pages/Drivers.tsx
// 这是最终的、完整的、修复后的代码，请直接替换

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Truck, Upload, Download, Search, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SupabaseStorage } from "@/utils/supabase";
import { Driver, Project } from "@/types";
import * as XLSX from 'xlsx';

const PAGE_SIZE = 30;

export default function Drivers() {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [quickFilter, setQuickFilter] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: "",
    licensePlate: "",
    phone: "",
    projectIds: [] as string[],
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = useCallback(async (page: number, filter: string) => {
    setIsLoading(true);
    try {
      if (projects.length === 0) {
        const loadedProjects = await SupabaseStorage.getProjects();
        setProjects(loadedProjects);
      }
      
      const { drivers: loadedDrivers, totalCount: loadedTotalCount } = await SupabaseStorage.getDrivers(filter, page, PAGE_SIZE);
      
      setDrivers(loadedDrivers || []);
      setTotalCount(loadedTotalCount);
      setTotalPages(Math.ceil(loadedTotalCount / PAGE_SIZE));
      setCurrentPage(page);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "加载失败",
        description: "无法加载司机数据",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [projects.length, toast]);

  useEffect(() => {
    const handler = setTimeout(() => {
      loadData(1, quickFilter);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [quickFilter, loadData]);

  useEffect(() => {
    loadData(1, "");
  }, []);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && !isLoading) {
      loadData(newPage, quickFilter);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", licensePlate: "", phone: "", projectIds: [] });
    setEditingDriver(null);
  };

  const handleEdit = (driver: Driver) => {
    setFormData({
      name: driver.name,
      licensePlate: driver.licensePlate,
      phone: driver.phone,
      projectIds: driver.projectIds || [],
    });
    setEditingDriver(driver);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.licensePlate || !formData.phone) {
      toast({ title: "请填写所有必填字段", variant: "destructive" });
      return;
    }
    try {
      if (editingDriver) {
        await SupabaseStorage.updateDriver(editingDriver.id, formData);
        toast({ title: "更新成功" });
      } else {
        await SupabaseStorage.addDriver(formData);
        toast({ title: "添加成功" });
      }
      await loadData(currentPage, quickFilter);
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast({ title: "保存失败", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await SupabaseStorage.deleteDriver(id);
      if (drivers.length === 1 && currentPage > 1) {
        await loadData(currentPage - 1, quickFilter);
      } else {
        await loadData(currentPage, quickFilter);
      }
      toast({ title: "删除成功" });
    } catch (error) {
      toast({ title: "删除失败", variant: "destructive" });
    }
  };

  const handleExcelImport = (event: React.ChangeEvent<HTMLInputElement>) => {
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
        for (const row of jsonData as any[]) {
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

        await loadData(1, "");
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

  return (
    <div className="space-y-8 p-4 md:p-6">
      <div className="bg-gradient-primary p-6 rounded-lg shadow-primary text-primary-foreground">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2 flex items-center">
              <Truck className="mr-2" />
              司机与车辆管理
            </h1>
            <p className="opacity-90">管理司机档案和车辆信息</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                新增司机
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editingDriver ? "编辑司机" : "新增司机"}</DialogTitle>
              </DialogHeader>
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
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>司机列表 (共 {totalCount} 条记录)</CardTitle>
            <div className="flex space-x-2">
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleExcelImport} className="hidden" />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="flex items-center space-x-2"><Upload className="h-4 w-4" /><span>导入Excel</span></Button>
              <Button variant="outline" onClick={handleExcelExport} className="flex items-center space-x-2"><Download className="h-4 w-4" /><span>导出Excel</span></Button>
            </div>
          </div>
          <div className="mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="按姓名、车牌、电话模糊搜索..." value={quickFilter} onChange={(e) => setQuickFilter(e.target.value)} className="pl-10" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                   <TableHead>司机姓名</TableHead>
                   <TableHead>车牌号</TableHead>
                   <TableHead>司机电话</TableHead>
                   <TableHead>关联项目</TableHead>
                   <TableHead>创建时间</TableHead>
                   <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex justify-center items-center">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        正在加载数据...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : drivers.length > 0 ? (
                  drivers.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell className="font-medium">{driver.name}</TableCell>
                      <TableCell className="font-mono">{driver.licensePlate}</TableCell>
                      <TableCell>{driver.phone}</TableCell>
                      <TableCell>
                        {driver.projectIds && driver.projectIds.length > 0 ? 
                          driver.projectIds.map(id => projects.find(p => p.id === id)?.name).filter(Boolean).join(', ') : 
                          '未关联特定项目'
                        }
                      </TableCell>
                      <TableCell>{new Date(driver.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(driver)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="outline" size="sm" onClick={() => handleDelete(driver.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {quickFilter ? "没有找到匹配的司机" : "暂无司机数据"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter>
          <div className="flex items-center justify-between w-full text-sm text-muted-foreground">
            <div>
              第 {totalPages > 0 ? currentPage : 0} / {totalPages} 页
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1 || isLoading}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages || isLoading}
              >
                下一页
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
