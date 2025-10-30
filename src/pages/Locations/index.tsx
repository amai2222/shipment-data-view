// 地点管理（简化版）- 完整重构版本
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/PageHeader';
import { MapPin, Plus, Search } from 'lucide-react';
import { useLocationData } from '../EnhancedLocations/hooks/useLocationData';
import { LocationTable } from '../EnhancedLocations/components/LocationTable';
import { useDebounce } from '@/hooks/useDebounce';
import { LoadingState } from '@/components/common';

export default function Locations() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const { locations, loading, fetchLocations, deleteLocation } = useLocationData();

  useEffect(() => {
    fetchLocations(debouncedSearch);
  }, [debouncedSearch, fetchLocations]);

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
              <Button><Plus className="mr-2 h-4 w-4" />添加</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <LoadingState /> : <LocationTable locations={locations} onEdit={() => {}} onDelete={deleteLocation} />}
        </CardContent>
      </Card>
    </div>
  );
}

