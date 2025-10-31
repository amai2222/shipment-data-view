import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, X } from "lucide-react";
import { Project } from "@/types";
import { DriverPhotoUpload, DriverPhotos } from "@/components/DriverPhotoUpload";
import { VehiclePhotoUpload, VehiclePhotos } from "@/components/VehiclePhotoUpload";

interface FormData {
  name: string;
  licensePlate: string;
  phone: string;
  projectIds: string[];
}

interface DriverFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: FormData;
  setFormData: (data: FormData) => void;
  driverPhotos: DriverPhotos;
  setDriverPhotos: (photos: DriverPhotos) => void;
  vehiclePhotos: VehiclePhotos;
  setVehiclePhotos: (photos: VehiclePhotos) => void;
  projects: Project[];
  isEditing: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function DriverFormDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  driverPhotos,
  setDriverPhotos,
  vehiclePhotos,
  setVehiclePhotos,
  projects,
  isEditing,
  onSubmit,
}: DriverFormDialogProps) {
  const toggleProject = (projectId: string) => {
    const newProjectIds = formData.projectIds.includes(projectId)
      ? formData.projectIds.filter(id => id !== projectId)
      : [...formData.projectIds, projectId];
    setFormData({ ...formData, projectIds: newProjectIds });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? '编辑司机' : '添加司机'}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">基本信息</TabsTrigger>
            <TabsTrigger value="driver-docs">司机证件</TabsTrigger>
            <TabsTrigger value="vehicle-docs">车辆证件</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">姓名 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="输入司机姓名"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="licensePlate">车牌号 *</Label>
                  <Input
                    id="licensePlate"
                    value={formData.licensePlate}
                    onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
                    placeholder="输入车牌号"
                    required
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="phone">电话</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="输入电话号码"
                  />
                </div>
              </div>

              {/* 关联项目 */}
              <div className="space-y-2">
                <Label>关联项目（可多选）</Label>
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                  {projects.length > 0 ? (
                    <div className="space-y-2">
                      {projects.map(project => (
                        <div
                          key={project.id}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-muted p-2 rounded"
                          onClick={() => toggleProject(project.id)}
                        >
                          <input
                            type="checkbox"
                            checked={formData.projectIds.includes(project.id)}
                            onChange={() => toggleProject(project.id)}
                            className="cursor-pointer"
                          />
                          <span>{project.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">暂无可关联的项目</p>
                  )}
                </div>
                {formData.projectIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.projectIds.map(id => {
                      const project = projects.find(p => p.id === id);
                      return project ? (
                        <Badge key={id} variant="secondary">
                          {project.name}
                          <X
                            className="h-3 w-3 ml-1 cursor-pointer"
                            onClick={() => toggleProject(id)}
                          />
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  取消
                </Button>
                <Button type="submit">
                  {isEditing ? "更新" : "添加"}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="driver-docs">
            <DriverPhotoUpload
              driverPhotos={driverPhotos}
              onChange={setDriverPhotos}
            />
          </TabsContent>

          <TabsContent value="vehicle-docs">
            <VehiclePhotoUpload
              vehiclePhotos={vehiclePhotos}
              onChange={setVehiclePhotos}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

