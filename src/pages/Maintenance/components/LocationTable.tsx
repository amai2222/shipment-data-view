import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, MapPin } from "lucide-react";
import { Location, Project } from "@/types";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface LocationTableProps {
  locations: Location[];
  projects: Project[];
  totalCount: number;
  onEdit: (location: Location) => void;
  onDelete: (locationId: string) => void;
  activeFiltersCount: number;
  clearFilters: () => void;
}

export function LocationTable({
  locations,
  projects,
  totalCount,
  onEdit,
  onDelete,
  activeFiltersCount,
  clearFilters,
}: LocationTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<Location | null>(null);

  const handleDeleteClick = (location: Location) => {
    setLocationToDelete(location);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (locationToDelete) {
      onDelete(locationToDelete.id);
      setDeleteDialogOpen(false);
      setLocationToDelete(null);
    }
  };

  return (
    <>
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>地点列表 (共 {totalCount} 个地点，显示 {locations.length} 个)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>地点名称</TableHead>
                <TableHead>关联项目</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.length > 0 ? (
                locations.map((location) => {
                  const associatedProjects = projects.filter(p =>
                    location.projectIds && location.projectIds.includes(p.id)
                  );
                  
                  return (
                    <TableRow key={location.id}>
                      <TableCell className="font-medium">{location.name}</TableCell>
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
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit(location)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            编辑
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteClick(location)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            删除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
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
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="确认删除"
        description={`确定要删除地点"${locationToDelete?.name}"吗？此操作不可撤销。`}
      />
    </>
  );
}

