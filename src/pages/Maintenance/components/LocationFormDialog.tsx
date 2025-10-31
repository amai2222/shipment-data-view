import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Project } from "@/types";

interface FormData {
  name: string;
  projectIds: string[];
}

interface LocationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: FormData;
  setFormData: (data: FormData) => void;
  projects: Project[];
  isEditing: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function LocationFormDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  projects,
  isEditing,
  onSubmit,
}: LocationFormDialogProps) {
  const toggleProject = (projectId: string) => {
    const newProjectIds = formData.projectIds.includes(projectId)
      ? formData.projectIds.filter(id => id !== projectId)
      : [...formData.projectIds, projectId];
    setFormData({ ...formData, projectIds: newProjectIds });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? '编辑地点' : '添加地点'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">地点名称 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="输入地点名称"
              required
            />
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
      </DialogContent>
    </Dialog>
  );
}

