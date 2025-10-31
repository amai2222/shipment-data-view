import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit, Trash2, MapPin, Map, CheckCircle, AlertCircle, Clock, RefreshCw } from "lucide-react";
import { LocationWithGeocoding } from '@/services/LocationGeocodingService';
import { Project } from "@/types";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface EnhancedLocationTableProps {
  locations: LocationWithGeocoding[];
  projects: Project[];
  totalCount: number;
  selectedLocations: string[];
  setSelectedLocations: (ids: string[]) => void;
  selectAll: boolean;
  setSelectAll: (value: boolean) => void;
  showBatchActions: boolean;
  onEdit: (location: LocationWithGeocoding) => void;
  onDelete: (locationId: string) => void;
  onGeocode: (locationId: string) => void;
  activeFiltersCount: number;
  clearFilters: () => void;
}

export function EnhancedLocationTable({
  locations,
  projects,
  totalCount,
  selectedLocations,
  setSelectedLocations,
  selectAll,
  setSelectAll,
  showBatchActions,
  onEdit,
  onDelete,
  onGeocode,
  activeFiltersCount,
  clearFilters,
}: EnhancedLocationTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<LocationWithGeocoding | null>(null);

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedLocations([]);
      setSelectAll(false);
    } else {
      setSelectedLocations(locations.map(l => l.id));
      setSelectAll(true);
    }
  };

  const handleSelectLocation = (locationId: string) => {
    setSelectedLocations(
      selectedLocations.includes(locationId)
        ? selectedLocations.filter(id => id !== locationId)
        : [...selectedLocations, locationId]
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'retry':
        return <RefreshCw className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success': return '成功';
      case 'failed': return '失败';
      case 'retry': return '重试';
      default: return '待处理';
    }
  };

  const handleDeleteClick = (location: LocationWithGeocoding) => {
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
          <CardTitle>
            地点列表 (共 {totalCount} 个地点，显示 {locations.length} 个)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {showBatchActions && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectAll}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead>地点名称</TableHead>
                <TableHead>详细地址</TableHead>
                <TableHead>关联项目</TableHead>
                <TableHead>地理编码状态</TableHead>
                <TableHead>坐标</TableHead>
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
                      {showBatchActions && (
                        <TableCell>
                          <Checkbox
                            checked={selectedLocations.includes(location.id)}
                            onCheckedChange={() => handleSelectLocation(location.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{location.name}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {location.address || location.name}
                      </TableCell>
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
                        <div className="flex items-center gap-2">
                          {getStatusIcon(location.geocoding_status || 'pending')}
                          <span className="text-sm">
                            {getStatusText(location.geocoding_status || 'pending')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {location.longitude && location.latitude ? (
                          <span className="text-green-600">
                            {location.longitude.toFixed(6)}, {location.latitude.toFixed(6)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          {(!location.geocoding_status || location.geocoding_status === 'failed' || location.geocoding_status === 'retry') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onGeocode(location.id)}
                            >
                              <Map className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit(location)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteClick(location)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={showBatchActions ? 7 : 6} className="h-24 text-center">
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

