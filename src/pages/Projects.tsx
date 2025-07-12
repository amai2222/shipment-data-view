import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Package, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SupabaseStorage } from "@/utils/supabase";
import { Project, Location } from "@/types";

export default function Projects() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
    manager: "",
    loadingAddress: "",
    unloadingAddress: "",
  });

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [loadedProjects, loadedLocations] = await Promise.all([
        SupabaseStorage.getProjects(),
        SupabaseStorage.getLocations()
      ]);
      setProjects(loadedProjects);
      setLocations(loadedLocations);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "数据加载失败",
        description: "无法从数据库加载数据，请重试。",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: "",
      startDate: "",
      endDate: "",
      manager: "",
      loadingAddress: "",
      unloadingAddress: "",
    });
    setEditingProject(null);
  };

  // 打开编辑对话框
  const handleEdit = (project: Project) => {
    setFormData({
      name: project.name,
      startDate: project.startDate,
      endDate: project.endDate,
      manager: project.manager,
      loadingAddress: project.loadingAddress,
      unloadingAddress: project.unloadingAddress,
    });
    setEditingProject(project);
    setIsDialogOpen(true);
  };

  // 查找或创建地址
  const findOrCreateLocation = async (address: string) => {
    const existingLocation = locations.find(loc => loc.name === address);
    if (existingLocation) {
      return existingLocation;
    }
    
    // 创建新地址
    const newLocation = await SupabaseStorage.findOrCreateLocation(address);
    return newLocation;
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.startDate || !formData.endDate || !formData.manager || !formData.loadingAddress || !formData.unloadingAddress) {
      toast({
        title: "请填写所有字段",
        description: "所有字段都是必填的",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      // 先确保装货和卸货地址存在于地址库中
      await findOrCreateLocation(formData.loadingAddress);
      await findOrCreateLocation(formData.unloadingAddress);

      if (editingProject) {
        await SupabaseStorage.updateProject(editingProject.id, formData);
        toast({
          title: "项目更新成功",
          description: `项目 "${formData.name}" 已更新，相关地址已自动加入地址库`,
        });
      } else {
        await SupabaseStorage.addProject(formData);
        toast({
          title: "项目创建成功",
          description: `项目 "${formData.name}" 已创建，相关地址已自动加入地址库`,
        });
      }

      // 重新加载数据
      await loadData();
      
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving project:', error);
      toast({
        title: "操作失败",
        description: "创建或更新项目时出现错误",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 删除项目
  const handleDelete = async (id: string, name: string) => {
    try {
      await SupabaseStorage.deleteProject(id);
      await loadData();
      toast({
        title: "项目删除成功",
        description: `项目"${name}"已从列表中移除`,
      });
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: "删除失败",
        description: "删除项目时出现错误",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">加载项目数据中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div className="bg-gradient-primary p-6 rounded-lg shadow-primary text-primary-foreground">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2 flex items-center">
              <Package className="mr-2" />
              项目管理
            </h1>
            <p className="opacity-90">管理所有物流项目的基本信息（Supabase数据库）</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                新增项目
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  {editingProject ? "编辑项目" : "新增项目"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">项目名称 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
                    placeholder="请输入项目名称"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate">项目开始日期 *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({...prev, startDate: e.target.value}))}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">项目结束日期 *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({...prev, endDate: e.target.value}))}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manager">项目负责人 *</Label>
                  <Input
                    id="manager"
                    value={formData.manager}
                    onChange={(e) => setFormData(prev => ({...prev, manager: e.target.value}))}
                    placeholder="请输入负责人姓名"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loadingAddress">装货地址 *</Label>
                  <Input
                    id="loadingAddress"
                    value={formData.loadingAddress}
                    onChange={(e) => setFormData(prev => ({...prev, loadingAddress: e.target.value}))}
                    placeholder="请输入装货地址（自动加入地址库）"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unloadingAddress">卸货地址 *</Label>
                  <Input
                    id="unloadingAddress"
                    value={formData.unloadingAddress}
                    onChange={(e) => setFormData(prev => ({...prev, unloadingAddress: e.target.value}))}
                    placeholder="请输入卸货地址（自动加入地址库）"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    取消
                  </Button>
                  <Button type="submit" className="bg-gradient-primary hover:bg-primary-hover" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {editingProject ? "更新中..." : "添加中..."}
                      </>
                    ) : (
                      editingProject ? "更新" : "添加"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 项目列表 */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>项目列表 ({projects.length} 个项目)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目名称</TableHead>
                  <TableHead>开始日期</TableHead>
                  <TableHead>结束日期</TableHead>
                  <TableHead>项目负责人</TableHead>
                  <TableHead>装货地址</TableHead>
                  <TableHead>卸货地址</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell>{project.startDate}</TableCell>
                    <TableCell>{project.endDate}</TableCell>
                    <TableCell>{project.manager}</TableCell>
                    <TableCell>{project.loadingAddress}</TableCell>
                    <TableCell>{project.unloadingAddress}</TableCell>
                    <TableCell>{new Date(project.createdAt).toLocaleDateString('zh-CN')}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(project)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(project.id, project.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {projects.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      暂无项目数据，请点击"新增项目"开始添加
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