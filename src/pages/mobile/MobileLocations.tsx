import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { 
  Plus, 
  Search, 
  MapPin, 
  Edit,
  Trash2,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SupabaseStorage, supabase } from "@/utils/supabase";
import { Location, Project } from "@/types";
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { MobileCard } from '@/components/mobile/MobileCard';

export default function MobileLocations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    projectIds: [] as string[]
  });

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
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
        description: "无法加载地点数据",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ 
      name: '', 
      projectIds: [] 
    });
    setEditingLocation(null);
  };

  const handleEdit = (location: Location) => {
    setFormData({
      name: location.name,
      projectIds: location.projectIds || [],
    });
    setEditingLocation(location);
    setShowAddDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({ 
        title: "请填写地点名称", 
        description: "地点名称是必填的",
        variant: "destructive" 
      });
      return;
    }

    try {
      if (editingLocation) {
        await SupabaseStorage.updateLocation(editingLocation.id, formData);
        toast({ title: "更新成功" });
      } else {
        await SupabaseStorage.addLocation(formData);
        toast({ title: "添加成功" });
      }
      
      await loadData();
      setShowAddDialog(false);
      resetForm();
    } catch (error) {
      console.error('Error saving location:', error);
      toast({ 
        title: "保存失败", 
        variant: "destructive" 
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await SupabaseStorage.deleteLocation(id);
      await loadData();
      toast({ title: "删除成功" });
    } catch (error) {
      console.error('Error deleting location:', error);
      toast({ 
        title: "删除失败", 
        variant: "destructive" 
      });
    } finally {
      setShowDeleteDialog(null);
    }
  };

  const filteredLocations = locations.filter(location =>
    location.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MobileLayout>
      <div className="space-y-4">
        {/* 搜索和添加 */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索地点名称..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-8 w-8 p-0"
                onClick={() => setSearchTerm('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <Dialog open={showAddDialog} onOpenChange={(open) => {
            setShowAddDialog(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                新增地点
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingLocation ? '编辑地点' : '新增地点'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">地点名称 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="请输入地点名称"
                  />
                </div>
                
                <div>
                  <Label>关联项目</Label>
                  <div className="max-h-32 overflow-y-auto border rounded-md p-2 mt-1">
                    {projects.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        暂无项目
                      </p>
                    ) : (
                      projects.map((project) => (
                        <div key={project.id} className="flex items-center space-x-2 py-1">
                          <input
                            type="checkbox"
                            id={`project-${project.id}`}
                            checked={formData.projectIds.includes(project.id)}
                            onChange={(e) => {
                              const { checked } = e.target;
                              setFormData(prev => ({
                                ...prev,
                                projectIds: checked
                                  ? [...prev.projectIds, project.id]
                                  : prev.projectIds.filter(id => id !== project.id)
                              }));
                            }}
                            className="rounded"
                          />
                          <Label htmlFor={`project-${project.id}`} className="text-sm">
                            {project.name}
                          </Label>
                        </div>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    选择地点可用于的项目，不选择则可用于所有项目
                  </p>
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowAddDialog(false)}
                    className="flex-1"
                  >
                    取消
                  </Button>
                  <Button type="submit" className="flex-1">
                    {editingLocation ? '更新' : '添加'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* 地点列表 */}
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredLocations.length === 0 ? (
          <MobileCard>
            <CardContent className="text-center py-8">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchTerm ? "没有找到符合条件的地点" : "暂无地点数据"}
              </p>
            </CardContent>
          </MobileCard>
        ) : (
          <div className="space-y-3">
            {filteredLocations.map((location) => (
              <MobileCard key={location.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        {location.name}
                      </CardTitle>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(location)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDeleteDialog(location.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {location.projectIds && location.projectIds.length > 0 ? (
                    <div>
                      <span className="text-sm text-muted-foreground">关联项目</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {location.projectIds.map(projectId => {
                          const project = projects.find(p => p.id === projectId);
                          return project ? (
                            <span 
                              key={projectId} 
                              className="inline-block bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs"
                            >
                              {project.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span className="text-sm text-muted-foreground">使用范围</span>
                      <p className="text-sm mt-1">可用于所有项目</p>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                    创建时间：{new Date(location.createdAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </MobileCard>
            ))}
          </div>
        )}

        {/* 删除确认对话框 */}
        <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                您确定要删除这个地点吗？此操作无法撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => showDeleteDialog && handleDelete(showDeleteDialog)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MobileLayout>
  );
}