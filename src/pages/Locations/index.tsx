// 地点管理（简化版）- 完整重构版本
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PageHeader } from '@/components/PageHeader';
import { MapPin, Plus, Search } from 'lucide-react';
import { useLocationData } from '../EnhancedLocations/hooks/useLocationData';
import { LocationTable } from '../EnhancedLocations/components/LocationTable';
import { useDebounce } from '@/hooks/useDebounce';
import { LoadingState } from '@/components/common';

export default function Locations() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const { locations, loading, fetchLocations, createLocation, updateLocation, deleteLocation } = useLocationData();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '' });

  useEffect(() => {
    fetchLocations(debouncedSearch);
  }, [debouncedSearch, fetchLocations]);

  const handleCreate = () => {
    setEditingLocation(null);
    setFormData({ name: '' });
    setIsDialogOpen(true);
  };

  const handleEdit = (location: any) => {
    setEditingLocation(location);
    setFormData({ name: location.name || '' });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = editingLocation
      ? await updateLocation(editingLocation.id, formData)
      : await createLocation(formData);
    if (success) {
      setIsDialogOpen(false);
      fetchLocations(debouncedSearch);
    }
  };

  const handleDelete = async (id: string) => {
    const success = await deleteLocation(id);
    if (success) fetchLocations(debouncedSearch);
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title="地点管理" description="管理装卸货地点" icon={MapPin} iconColor="text-orange-600" />
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>地点列表 ({locations.length})</CardTitle>
            <div className="flex gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="搜索地点..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" />添加</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingLocation ? '编辑地点' : '添加地点'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">地点名称 *</Label>
                      <Input 
                        id="name" 
                        value={formData.name} 
                        onChange={(e) => setFormData({name: e.target.value})}
                        required
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button>
                      <Button type="submit">{editingLocation ? '更新' : '创建'}</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <LoadingState /> : <LocationTable locations={locations} onEdit={handleEdit} onDelete={handleDelete} />}
        </CardContent>
      </Card>
    </div>
  );
}

