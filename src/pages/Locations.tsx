import { useState, useEffect, useRef, useMemo } from "react";
import type { FormEvent, ChangeEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, MapPin, Upload, Download, Search, Filter, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SupabaseStorage, supabase } from "@/utils/supabase";
import { Location, Project } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from 'xlsx';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from "@/components/ui/badge";

export default function Locations() {
  const { toast } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: "",
    nickname: "",
    projectIds: [] as string[],
  });

  // 筛选后的地点列表
  const filteredLocations = useMemo(() => {
    let filtered = locations;

    // 搜索筛选
    if (searchQuery) {
      filtered = filtered.filter(location =>
        location.name.toLowerCase().includes(searchQuery.toLowerCase())
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
  }

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: "",
      nickname: "",
      projectIds: [],
    });
    setEditingLocation(null);
  }

  // 打开编辑对话框
  const handleEdit = (location: Location) => {
    setFormData({
      name: location.name,
      nickname: location.nickname || "",
      projectIds: location.projectIds || [],
    });
    setEditingLocation(location);
    setIsDialogOpen(true);
  }

  // 提交表单
  const handleSubmit = async (e: FormEvent) => {
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
        await SupabaseStorage.updateLocation(editingLocation.id, formData);
        toast({
          title: "更新成功",
          description: "地点信息已成功更新",
        });
      } else {
        await SupabaseStorage.addLocation(formData);
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
  }

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
  }

  // Excel导入功能
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
          }

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
    }
    reader.readAsArrayBuffer(file);
    
    // 清空文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

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
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader 
        title="地点管理" 
        description="统一管理所有装卸货地点"
        icon={MapPin}
        iconColor="text-green-600"
      >
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
                   <Label htmlFor="nickname">昵称</Label>
                   <Input
                     id="nickname"
                     value={formData.nickname}
                     onChange={(e) => setFormData(prev => ({...prev, nickname: e.target.value}))}
                     placeholder="请输入地点昵称（可选）"
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
                     选择地点可用于的项目，不选择则可用于所有项目
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
                    {editingLocation ? "更新" : "添加"}
                  </Button>
                </div>
              </form>
            </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="space-y-6">

      {/* 地点列表 */}
      <Card className="rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 border-gray-200">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
          <div className="flex items-center justify-between">
            <CardTitle>地点列表 ({filteredLocations.length} / {locations.length} 个地点)</CardTitle>
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

          {/* 搜索和筛选区域 */}
          <div className="mt-4 space-y-3">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="按地点名称搜索..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="pl-10" 
              />
            </div>

            {/* 筛选器按钮和状态 */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="relative"
              >
                <Filter className="h-4 w-4 mr-2" />
                高级筛选
                {activeFiltersCount > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 min-w-[20px] px-1">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>

              {activeFiltersCount > 0 && (
                <>
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    清除筛选
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    显示 {filteredLocations.length} / {locations.length} 条
                  </span>
                </>
              )}
            </div>

            {/* 筛选选项（可展开/收起） */}
            {showFilters && (
              <Card className="bg-blue-50/30 border-blue-200 rounded-lg">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>按项目筛选</Label>
                      <Select value={projectFilter} onValueChange={setProjectFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部项目</SelectItem>
                          {projects.map(project => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
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
                {filteredLocations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      <MapPin className="mx-auto h-12 w-12 text-muted-foreground" />
                      <p className="mt-2 text-muted-foreground">
                        {activeFiltersCount > 0 ? '当前筛选条件下无数据' : '暂无地点数据'}
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
                ) : filteredLocations.map((location) => (
                   <TableRow key={location.id}>
                    <TableCell className="font-medium">{location.name}</TableCell>
                    <TableCell>
                      {location.projectIds && location.projectIds.length > 0 ? 
                        location.projectIds.map(id => projects.find(p => p.id === id)?.name).filter(Boolean).join(', ') : 
                        '可用于所有项目'
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
                        <ConfirmDialog 
                          title="确认删除"
                          description={`您确定要删除地点 "${location.name}" 吗？`}
                          onConfirm={() => handleDelete(location.id)}
                        >
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:text-destructive"
                            aria-label={`删除地点 ${location.name}`}
                            title={`删除地点 ${location.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </ConfirmDialog>
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
    </div>
  );
}
