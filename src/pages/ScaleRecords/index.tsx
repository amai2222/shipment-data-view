import React, auseState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card'; // 移除了 CardHeader 和 CardTitle 的导入
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useFilterState } from '@/hooks/useFilterState';
import { ScaleRecordForm } from './components/ScaleRecordForm';
import { ImageViewer } from './components/ImageViewer';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';

// --- 以下所有接口定义和状态管理都完整保留 ---

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

  // --- 以下所有数据加载和事件处理函数都完整保留 ---

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase.from('projects').select('id, name').order('name');
      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const loadDrivers = async () => {
    try {
      const { data, error } = await supabase.from('drivers').select('id, name, license_plate').order('name');
      if (error) throw error;
      setDrivers(data || []);
    } catch (error) {
      console.error('Error loading drivers:', error);
    }
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      let query = supabase.from('scale_records').select('*').order('loading_date', { ascending: false }).order('trip_number', { ascending: false });
      if (activeFilters.projectId && activeFilters.projectId !== 'all') query = query.eq('project_id', activeFilters.projectId);
      if (activeFilters.startDate) query = query.gte('loading_date', activeFilters.startDate);
      if (activeFilters.endDate) query = query.lte('loading_date', activeFilters.endDate);
      if (activeFilters.licensePlate) query = query.ilike('license_plate', `%${activeFilters.licensePlate}%`);
      const { data, error } = await query;
      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error loading records:', error);
      toast({ title: "错误", description: "加载磅单记录失败", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRecordAdded = () => {
    setShowAddDialog(false);
    loadRecords();
    toast({ title: "成功", description: "磅单记录已添加" });
  };

  const handleImageClick = (images: string[]) => {
    setSelectedImages(images);
    setShowImageViewer(true);
  };

  const handleDateRangeChange = (dateRange: DateRange | undefined) => {
    setUiFilters(prev => ({
      ...prev,
      startDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '',
      endDate: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '',
    }));
  };

  return (
    <div className="space-y-6">
      {/* 移除了 h1 标题以匹配新设计 */}

      {/* 筛选区域：重构为单行 Flex 布局 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end justify-between gap-4">
            {/* 左侧：筛选输入控件组 */}
            <div className="flex items-end gap-4 flex-grow">
              <div className="flex-1 min-w-[180px]">
                <Label htmlFor="project">项目</Label>
                <Select 
                  value={uiFilters.projectId || "all"} 
                  onValueChange={(value) => setUiFilters(prev => ({ ...prev, projectId: value === "all" ? "" : value }))}
                >
                  <SelectTrigger><SelectValue placeholder="选择项目" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部项目</SelectItem>
                    {projects.filter(p => p.id && p.id.trim() !== '').map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-[280px]">
                <Label htmlFor="date-range">日期范围</Label>
                <DateRangePicker
                  date={{
                    from: uiFilters.startDate ? new Date(uiFilters.startDate) : undefined,
                    to: uiFilters.endDate ? new Date(uiFilters.endDate) : undefined,
                  }}
                  setDate={handleDateRangeChange}
                />
              </div>

              <div className="flex-1 min-w-[180px]">
                <Label htmlFor="licensePlate">车牌号</Label>
                <Input
                  id="licensePlate"
                  placeholder="输入车牌号"
                  value={uiFilters.licensePlate}
                  onChange={(e) => setUiFilters(prev => ({ ...prev, licensePlate: e.target.value }))}
                />
              </div>
            </div>

            {/* 右侧：操作按钮组 */}
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={handleClear}>清除</Button>
              <Button onClick={handleSearch} disabled={!isStale}>
                <Search className="h-4 w-4 mr-2" />
                搜索
              </Button>
              {/* “添加磅单”按钮的 Dialog 组件被移动到这里，功能完全保留 */}
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    添加磅单
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader><DialogTitle>添加磅单记录</DialogTitle></DialogHeader>
                  <ScaleRecordForm projects={projects} drivers={drivers} onSuccess={handleRecordAdded} />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 磅单记录列表：这部分代码和逻辑完全没有变化 */}
      <Card>
        <CardContent className="pt-6">
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

      {/* 图片查看器：这部分代码和逻辑完全没有变化 */}
      <Dialog open={showImageViewer} onOpenChange={setShowImageViewer}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>磅单图片</DialogTitle></DialogHeader>
          <ImageViewer images={selectedImages} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
