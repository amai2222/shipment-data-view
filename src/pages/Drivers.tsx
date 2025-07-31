import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Truck, Upload, Download } from "lucide-react";
import { FilterableDataTable } from "@/components/FilterableDataTable";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SupabaseStorage } from "@/utils/supabase";
import { Driver, Project } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from 'xlsx';

export default function Drivers() {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: "",
    licensePlate: "",
    phone: "",
    projectIds: [] as string[],
  });

  // 加载司机数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [loadedDrivers, loadedProjects] = await Promise.all([
        SupabaseStorage.getDrivers(),
        SupabaseStorage.getProjects()
      ]);
      setDrivers(loadedDrivers);
      setProjects(loadedProjects);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "加载失败",
        description: "无法加载数据",
        variant: "destructive",
      });
    }
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: "",
      licensePlate: "",
      phone: "",
      projectIds: [],
    });
    setEditingDriver(null);
  };

  // 打开编辑对话框
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

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.licensePlate || !formData.phone) {
      toast({
        title: "请填写所有字段",
        description: "所有字段都是必填的",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingDriver) {
        await SupabaseStorage.updateDriver(editingDriver.id, formData);
        toast({
          title: "更新成功",
          description: "司机信息已成功更新",
        });
      } else {
        await SupabaseStorage.addDriver(formData);
        toast({
          title: "添加成功",
          description: "新司机已成功添加",
        });
      }

      await loadData();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving driver:', error);
      toast({
        title: "保存失败",
        description: "无法保存司机信息",
        variant: "destructive",
      });
    }
  };

  // 删除司机
  const handleDelete = async (id: string) => {
    try {
      await SupabaseStorage.deleteDriver(id);
      await loadData();
      toast({
        title: "删除成功",
        description: "司机已成功删除",
      });
    } catch (error) {
      console.error('Error deleting driver:', error);
      toast({
        title: "删除失败",
        description: "无法删除司机",
        variant: "destructive",
      });
    }
  };

  // Excel导入功能
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
        let duplicateCount = 0;

        for (const row of jsonData as any[]) {
          // 检查是否已存在相同司机（姓名和车牌号）
          const existingDriver = drivers.find(d => 
            d.name === row['司机姓名'] && d.licensePlate === row['车牌号']
          );
          
          if (existingDriver) {
            duplicateCount++;
            continue;
          }

          const driverData = {
            name: row['司机姓名'] || '',
            licensePlate: row['车牌号'] || '',
            phone: row['司机电话'] || '',
          };

          // 验证必填字段
          if (!driverData.name || !driverData.licensePlate || !driverData.phone) {
            console.warn(`跳过行：缺少必填字段`, row);
            continue;
          }

          await SupabaseStorage.addDriver(driverData);
          importedCount++;
        }

        toast({
          title: "导入完成",
          description: `成功导入 ${importedCount} 个司机，跳过 ${duplicateCount} 个重复司机`,
        });

        await loadData();
      } catch (error) {
        console.error('Error importing Excel:', error);
        toast({
          title: "导入失败",
          description: "Excel文件格式不正确或数据有误",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
    
    // 清空文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Excel导出功能
  const handleExcelExport = () => {
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

      const fileName = `司机列表_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast({
        title: "导出成功",
        description: `已导出 ${drivers.length} 个司机到 ${fileName}`,
      });
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast({
        title: "导出失败",
        description: "无法导出Excel文件",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
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
                <DialogTitle>
                  {editingDriver ? "编辑司机" : "新增司机"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">司机姓名 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
                    placeholder="请输入司机姓名"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="licensePlate">车牌号 *</Label>
                  <Input
                    id="licensePlate"
                    value={formData.licensePlate}
                    onChange={(e) => setFormData(prev => ({...prev, licensePlate: e.target.value}))}
                    placeholder="请输入车牌号"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">司机电话 *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({...prev, phone: e.target.value}))}
                    placeholder="请输入电话号码"
                  />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="projectIds">关联项目</Label>
                   <div className="max-h-40 overflow-y-auto border rounded-md p-2">
                     {projects.map((project) => (
                       <div key={project.id} className="flex items-center space-x-2 py-1">
                         <input
                           type="checkbox"
                           id={`project-${project.id}`}
                           checked={formData.projectIds.includes(project.id)}
                           onChange={(e) => {
                             if (e.target.checked) {
                               setFormData(prev => ({
                                 ...prev,
                                 projectIds: [...prev.projectIds, project.id]
                               }));
                             } else {
                               setFormData(prev => ({
                                 ...prev,
                                 projectIds: prev.projectIds.filter(id => id !== project.id)
                               }));
                             }
                           }}
                           className="rounded"
                         />
                         <Label htmlFor={`project-${project.id}`} className="text-sm">
                           {project.name}
                         </Label>
                       </div>
                     ))}
                   </div>
                   <p className="text-xs text-muted-foreground">
                     选择司机可以参与的项目，不选择则可参与所有项目
                   </p>
                 </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    取消
                  </Button>
                  <Button type="submit" className="bg-gradient-primary hover:bg-primary-hover">
                    {editingDriver ? "更新" : "添加"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 司机列表 */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>司机列表 ({drivers.length} 个司机)</CardTitle>
            <div className="flex space-x-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelImport}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-2"
              >
                <Upload className="h-4 w-4" />
                <span>导入Excel</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleExcelExport}
                className="flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>导出Excel</span>
              </Button>
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
                {drivers.map((driver) => (
                  <TableRow key={driver.id}>
                     <TableCell className="font-medium">{driver.name}</TableCell>
                     <TableCell className="font-mono">{driver.licensePlate}</TableCell>
                     <TableCell>{driver.phone}</TableCell>
                     <TableCell>
                       {driver.projectIds && driver.projectIds.length > 0 ? 
                         driver.projectIds.map(id => projects.find(p => p.id === id)?.name).filter(Boolean).join(', ') : 
                         '可参与所有项目'
                       }
                     </TableCell>
                     <TableCell>{new Date(driver.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(driver)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(driver.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                 {drivers.length === 0 && (
                   <TableRow>
                     <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                       暂无司机数据
                     </TableCell>
                   </TableRow>
                 )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}