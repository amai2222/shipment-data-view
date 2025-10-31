import { useState } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Truck, FileImage } from "lucide-react";
import { Driver, Project } from "@/types";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface DriverRowProps {
  driver: Driver;
  projects: Project[];
  onEdit: (driver: Driver) => void;
  onDelete: (driverId: string) => void;
}

export function DriverRow({ driver, projects, onEdit, onDelete }: DriverRowProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPhotosDialog, setShowPhotosDialog] = useState(false);

  const associatedProjects = projects.filter(p =>
    driver.projectIds && driver.projectIds.includes(p.id)
  );

  const hasPhotos = 
    (driver.id_card_photos?.length || 0) > 0 ||
    (driver.driver_license_photos?.length || 0) > 0 ||
    (driver.qualification_certificate_photos?.length || 0) > 0 ||
    (driver.driving_license_photos?.length || 0) > 0 ||
    (driver.transport_license_photos?.length || 0) > 0;

  return (
    <>
      <TableRow>
        <TableCell className="font-medium">{driver.name}</TableCell>
        <TableCell>{driver.licensePlate}</TableCell>
        <TableCell>{driver.phone || '—'}</TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {associatedProjects.length > 0 ? (
              associatedProjects.map(project => (
                <Badge key={project.id} variant="outline">
                  {project.name}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground text-sm">未关联</span>
            )}
          </div>
        </TableCell>
        <TableCell>
          {hasPhotos && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPhotosDialog(true)}
            >
              <FileImage className="h-4 w-4 mr-1" />
              查看照片
            </Button>
          )}
        </TableCell>
        <TableCell>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(driver)}>
              <Edit className="h-4 w-4 mr-1" />
              编辑
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              删除
            </Button>
          </div>
        </TableCell>
      </TableRow>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={() => {
          onDelete(driver.id);
          setShowDeleteDialog(false);
        }}
        title="确认删除"
        description={`确定要删除司机"${driver.name}"吗？此操作不可撤销。`}
      />

      <Dialog open={showPhotosDialog} onOpenChange={setShowPhotosDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>司机照片 - {driver.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {driver.id_card_photos && driver.id_card_photos.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">身份证照片</h4>
                <div className="grid grid-cols-3 gap-2">
                  {driver.id_card_photos.map((url, idx) => (
                    <img key={idx} src={url} alt="身份证" className="rounded border" />
                  ))}
                </div>
              </div>
            )}
            {driver.driver_license_photos && driver.driver_license_photos.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">驾驶证照片</h4>
                <div className="grid grid-cols-3 gap-2">
                  {driver.driver_license_photos.map((url, idx) => (
                    <img key={idx} src={url} alt="驾驶证" className="rounded border" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

