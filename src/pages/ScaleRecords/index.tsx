import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar, Plus, Search, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useFilterState } from '@/hooks/useFilterState';
import { ScaleRecordForm } from './components/ScaleRecordForm';
import { ImageViewer } from './components/ImageViewer';

interface Project {
  id: string;
  name: string;
}

interface Driver {
  id: string;
  name: string;
  license_plate: string;
}

interface ScaleRecord {
  id: string;
  project_id: string;
  project_name: string;
  loading_date: string;
  trip_number: number;
  valid_quantity: number | null;
  billing_type_id: number;
  image_urls: string[];
  license_plate: string | null;
  driver_name: string | null;
  created_at: string;
}

interface FilterState {
  projectId: string;
  startDate: string;
  endDate: string;
  licensePlate: string;
}

const initialFilterState: FilterState = {
  projectId: '',
  startDate: '',
  endDate: '',
  licensePlate: ''
};

export default function ScaleRecords() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [records, setRecords] = useState<ScaleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  const { 
    uiFilters, 
    setUiFilters, 
    activeFilters, 
    handleSearch, 
    handleClear,
    isStale 
  } = useFilterState<FilterState>(initialFilterState);

  const { toast } = useToast();

  useEffect(() => {
    loadProjects();
    loadDrivers();
    loadRecords();
  }, [activeFilters]);

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
      toast({
        title: "错误",
        description: "加载项目失败",
        variant: "destructive",
      });
    }
  };

  const loadDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, name, license_plate')
        .order('name');

      if (error) throw error;
      setDrivers(data || []);
    } catch (error) {
      console.error('Error loading drivers:', error);
    }
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('scale_records')
        .select('*')
        .order('loading_date', { ascending: false })
        .order('trip_number', { ascending: false });

      if (activeFilters.projectId) {
        query = query.eq('project_id', activeFilters.projectId);
      }

      if (activeFilters.startDate) {
        query = query.gte('loading_date', activeFilters.startDate);
      }

      if (activeFilters.endDate) {
        query = query.lte('loading_date', activeFilters.endDate);
      }

      if (activeFilters.licensePlate) {
        query = query.ilike('license_plate', `%${activeFilters.licensePlate}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error loading records:', error);
      toast({
        title: "错误",
        description: "加载磅单记录失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecordAdded = () => {
    setShowAddDialog(false);
    loadRecords();
    toast({
      title: "成功",
      description: "磅单记录已添加",
    });
  };

  const handleImageClick = (images: string[]) => {
    setSelectedImages(images);
    setShowImageViewer(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">磅单录入</h1>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              添加磅单
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>添加磅单记录</DialogTitle>
            </DialogHeader>
            <ScaleRecordForm 
              projects={projects}
              drivers={drivers}
              onSuccess={handleRecordAdded}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            筛选条件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="project">项目</Label>
              <Select 
                value={uiFilters.projectId} 
                onValueChange={(value) => setUiFilters(prev => ({ ...prev, projectId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部项目</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="startDate">开始日期</Label>
              <Input
                id="startDate"
                type="date"
                value={uiFilters.startDate}
                onChange={(e) => setUiFilters(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="endDate">结束日期</Label>
              <Input
                id="endDate"
                type="date"
                value={uiFilters.endDate}
                onChange={(e) => setUiFilters(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="licensePlate">车牌号</Label>
              <Input
                id="licensePlate"
                placeholder="输入车牌号"
                value={uiFilters.licensePlate}
                onChange={(e) => setUiFilters(prev => ({ ...prev, licensePlate: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={handleClear}>
              清除
            </Button>
            <Button onClick={handleSearch} disabled={!isStale}>
              {isStale && <Search className="h-4 w-4 mr-2" />}
              搜索
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Records List */}
      <Card>
        <CardHeader>
          <CardTitle>磅单记录</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">加载中...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">暂无磅单记录</p>
            </div>
          ) : (
            <div className="space-y-4">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => record.image_urls.length > 0 && handleImageClick(record.image_urls)}
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{record.project_name}</h3>
                        <Badge variant="outline">第{record.trip_number}车次</Badge>
                        {record.image_urls.length > 0 && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" />
                            {record.image_urls.length}张图片
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p>装车日期: {format(new Date(record.loading_date), 'yyyy-MM-dd')}</p>
                        {record.license_plate && <p>车牌号: {record.license_plate}</p>}
                        {record.driver_name && <p>司机: {record.driver_name}</p>}
                        {record.valid_quantity && <p>有效数量: {record.valid_quantity}吨</p>}
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>{format(new Date(record.created_at), 'yyyy-MM-dd HH:mm')}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Viewer Dialog */}
      <Dialog open={showImageViewer} onOpenChange={setShowImageViewer}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>磅单图片</DialogTitle>
          </DialogHeader>
          <ImageViewer images={selectedImages} />
        </DialogContent>
      </Dialog>
    </div>
  );
}