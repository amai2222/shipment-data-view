import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, MapPin, Upload, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SupabaseStorage } from "@/utils/supabase";
import { Location, Project } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from 'xlsx';

export default function Locations() {
  const { toast } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: "",
    projectId: "no-project",
  });

  // 加载地点数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [loadedLocations, loadedProjects] = await Promise.all([
        SupabaseStorage.getLocations(),
        SupabaseStorage.getProjects()
      ]);
      setLocations(loadedLocations);
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
      projectId: "no-project",
    });
    setEditingLocation(null);
  };

  // 打开编辑对话框
  const handleEdit = (location: Location) => {
    setFormData({
      name: location.name,
      projectId: location.projectId || "no-project",
    });
    setEditingLocation(location);
    setIsDialogOpen(true);
  };

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
      const locationData = {
        ...formData,
        projectId: formData.projectId === "no-project" ? undefined : formData.projectId
      };
      
      if (editingLocation) {
        await SupabaseStorage.updateLocation(editingLocation.id, locationData);
        toast({
          title: "更新成功",
          description: "地点信息已成功更新",
        });
      } else {
        await SupabaseStorage.addLocation(locationData);
        toast({
          title: "添加成功",
          description: "新地点已成功添加",
        });
      }

      await loadData();
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
  };

  // 删除地点
  const handleDelete = async (id: string) => {
    try {
      await SupabaseStorage.deleteLocation(id);
      await loadData();
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
          // 检查是否已存在相同地点名称
          const existingLocation = locations.find(l => l.name === row['地点名称']);
          
          if (existingLocation) {
            duplicateCount++;
            continue;
          }

          const locationData = {
            name: row['地点名称'] || '',
          };

          // 验证必填字段
          if (!locationData.name) {
            console.warn(`跳过行：缺少地点名称`, row);
            continue;
          }

          await SupabaseStorage.addLocation(locationData);
          importedCount++;
        }

        toast({
          title: "导入完成",
          description: `成功导入 ${importedCount} 个地点，跳过 ${duplicateCount} 个重复地点`,
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
      const exportData = locations.map(location => ({
        '地点名称': location.name,
        '创建时间': new Date(location.createdAt).toLocaleDateString()
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '地点列表');

      const fileName = `地点列表_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast({
        title: "导出成功",
        description: `已导出 ${locations.length} 个地点到 ${fileName}`,
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
              <MapPin className="mr-2" />
              地点管理
            </h1>
            <p className="opacity-90">统一管理所有装卸货地点</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                新增地点
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  {editingLocation ? "编辑地点" : "新增地点"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">地点名称 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
                    placeholder="请输入地点名称"
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="projectId">关联项目</Label>
                   <Select value={formData.projectId} onValueChange={(value) => setFormData(prev => ({...prev, projectId: value}))}>
                     <SelectTrigger>
                       <SelectValue placeholder="选择项目（可选）" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="no-project">无项目关联</SelectItem>
                       {projects.map((project) => (
                         <SelectItem key={project.id} value={project.id}>
                           {project.name}
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
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
                    {editingLocation ? "更新" : "添加"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 地点列表 */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>地点列表 ({locations.length} 个地点)</CardTitle>
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
                   <TableHead>地点名称</TableHead>
                   <TableHead>关联项目</TableHead>
                   <TableHead>创建时间</TableHead>
                   <TableHead>操作</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => (
                   <TableRow key={location.id}>
                     <TableCell className="font-medium">{location.name}</TableCell>
                     <TableCell>
                       {location.projectId ? 
                         projects.find(p => p.id === location.projectId)?.name || '项目不存在' : 
                         '无项目关联'
                       }
                     </TableCell>
                     <TableCell>{new Date(location.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(location)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(location.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                 {locations.length === 0 && (
                   <TableRow>
                     <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                       暂无地点数据
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