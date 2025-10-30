// 地点列表表格组件
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, MapPin, Phone } from 'lucide-react';
import type { Location } from '@/types/managementPages';

interface LocationTableProps {
  locations: Location[];
  onEdit: (location: Location) => void;
  onDelete: (id: string) => void;
}

export function LocationTable({ locations, onEdit, onDelete }: LocationTableProps) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>地点名称</TableHead>
            <TableHead>详细地址</TableHead>
            <TableHead>联系人</TableHead>
            <TableHead>
              <div className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                联系电话
              </div>
            </TableHead>
            <TableHead>
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                GPS坐标
              </div>
            </TableHead>
            <TableHead className="text-center">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {locations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                暂无地点数据
              </TableCell>
            </TableRow>
          ) : (
            locations.map((location) => (
              <TableRow key={location.id} className="hover:bg-muted/50">
                <TableCell className="font-medium">{location.name}</TableCell>
                <TableCell className="max-w-[250px] truncate">{location.address || '-'}</TableCell>
                <TableCell>{location.contact_person || '-'}</TableCell>
                <TableCell>{location.contact_phone || '-'}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {location.latitude && location.longitude 
                    ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}` 
                    : '-'}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(location)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => onDelete(location.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

