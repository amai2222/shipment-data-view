import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LocalStorage } from "@/utils/storage";
import { Project } from "@/types";

export default function Projects() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
    manager: "",
    loadingAddress: "",
    unloadingAddress: "",
  });

  // 加载项目数据
  useEffect(() => {
    const loadData = () => setProjects(LocalStorage.getProjects());
    loadData();
    // 添加存储变化监听器
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, []);

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

  // 提交表单
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.startDate || !formData.endDate || !formData.manager || !formData.loadingAddress || !formData.unloadingAddress) {
      toast({
        title: "请填写所有字段",
        description: "所有字段都是必填的",
        variant: "destructive",
      });
      return;
    }

    // 自动将装货地址和卸货地址添加到地址库
    const existingLocations = LocalStorage.getLocations();
    const loadingLocationExists = existingLocations.some(loc => loc.name === formData.loadingAddress);
    const unloadingLocationExists = existingLocations.some(loc => loc.name === formData.unloadingAddress);

    if (!loadingLocationExists) {
      LocalStorage.addLocation({ name: formData.loadingAddress });
    }
    
    if (!unloadingLocationExists) {
      LocalStorage.addLocation({ name: formData.unloadingAddress });
    }

    if (editingProject) {
      LocalStorage.updateProject(editingProject.id, formData);
      toast({
        title: "更新成功",
        description: "项目信息已成功更新，相关地址已自动加入地址库",
      });
    } else {
      LocalStorage.addProject(formData);
      toast({
        title: "添加成功",
        description: "新项目已成功添加，相关地址已自动加入地址库",
      });
    }

    setProjects(LocalStorage.getProjects());
    setIsDialogOpen(false);
    resetForm();
  };

  // 删除项目
  const handleDelete = (id: string) => {
    LocalStorage.deleteProject(id);
    setProjects(LocalStorage.getProjects());
    toast({
      title: "删除成功",
      description: "项目已成功删除",
    });
  };

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
            <p className="opacity-90">管理所有物流项目的基本信息</p>
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate">项目开始日期 *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({...prev, startDate: e.target.value}))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">项目结束日期 *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({...prev, endDate: e.target.value}))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manager">项目负责人 *</Label>
                  <Input
                    id="manager"
                    value={formData.manager}
                    onChange={(e) => setFormData(prev => ({...prev, manager: e.target.value}))}
                    placeholder="请输入负责人姓名"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loadingAddress">装货地址 *</Label>
                  <Input
                    id="loadingAddress"
                    value={formData.loadingAddress}
                    onChange={(e) => setFormData(prev => ({...prev, loadingAddress: e.target.value}))}
                    placeholder="请输入装货地址"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unloadingAddress">卸货地址 *</Label>
                  <Input
                    id="unloadingAddress"
                    value={formData.unloadingAddress}
                    onChange={(e) => setFormData(prev => ({...prev, unloadingAddress: e.target.value}))}
                    placeholder="请输入卸货地址"
                  />
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
                    {editingProject ? "更新" : "添加"}
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
          <CardTitle>项目列表</CardTitle>
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
                    <TableCell>{new Date(project.createdAt).toLocaleDateString()}</TableCell>
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
                          onClick={() => handleDelete(project.id)}
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
                      暂无项目数据
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