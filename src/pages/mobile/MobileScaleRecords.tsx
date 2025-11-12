import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { 
  Plus, 
  Search, 
  Scale, 
  Calendar,
  Truck,
  Image as ImageIcon,
  Trash2,
  ChevronDown,
  Filter,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from 'date-fns';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { MobileCard } from '@/components/mobile/MobileCard';
import { MobileScaleRecordForm } from '@/components/mobile/MobileScaleRecordForm';

interface Project { id: string; name: string; }
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
  logistics_number: string | null; 
}

export default function MobileScaleRecords() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [records, setRecords] = useState<ScaleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  
  // 过滤条件
  const [filters, setFilters] = useState({
    projectId: '',
    startDate: '',
    endDate: '',
    licensePlate: ''
  });
  
  // 搜索
  const [searchTerm, setSearchTerm] = useState('');
  
  const { toast } = useToast();

  useEffect(() => {
    loadProjects();
    loadRecords();
  }, []);

  useEffect(() => {
    loadRecords();
  }, [filters]);

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
    }
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('scale_records')
        .select('*')
        .order('loading_date', { ascending: false })
        .order('trip_number', { ascending: false })
        .limit(50); // 移动端限制条数

      if (filters.projectId) {
        query = query.eq('project_id', filters.projectId);
      }
      // 将中国时区的日期转换为 UTC 日期（用于数据库查询）
      // filters.startDate 和 filters.endDate 存储的是中国时区的日期字符串（如 "2025-11-02"）
      const convertChinaDateToUTC = (dateStr: string): string => {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-').map(Number);
        // 创建中国时区的日期字符串并解析（明确指定 +08:00 时区）
        const chinaDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00+08:00`;
        const chinaDateObj = new Date(chinaDateStr);
        return chinaDateObj.toISOString().split('T')[0];
      };
      
      // 结束日期需要加1天，确保包含结束日当天的所有数据
      const convertChinaEndDateToUTC = (dateStr: string): string => {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-').map(Number);
        const chinaDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00+08:00`;
        const chinaDateObj = new Date(chinaDateStr);
        const nextDay = new Date(chinaDateObj);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        return nextDay.toISOString().split('T')[0];
      };
      
      if (filters.startDate) {
        query = query.gte('loading_date', convertChinaDateToUTC(filters.startDate));
      }
      if (filters.endDate) {
        query = query.lte('loading_date', convertChinaEndDateToUTC(filters.endDate));
      }
      if (filters.licensePlate) {
        query = query.ilike('license_plate', `%${filters.licensePlate}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      let filteredData = (data as any[]) || [];
      
      // 客户端搜索
      if (searchTerm) {
        filteredData = filteredData.filter(record => 
          record.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.license_plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.driver_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.logistics_number?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      
      setRecords(filteredData);
    } catch (error) {
      console.error('Error loading records:', error);
      toast({ 
        title: "错误", 
        description: "加载磅单记录失败", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    try {
      const { error } = await supabase
        .from('scale_records')
        .delete()
        .eq('id', recordId);
      
      if (error) throw error;
      
      toast({ title: "成功", description: "磅单记录已删除" });
      loadRecords();
    } catch (error) {
      console.error('Error deleting record:', error);
      toast({ 
        title: "错误", 
        description: "删除记录失败", 
        variant: "destructive" 
      });
    } finally {
      setShowDeleteDialog(null);
    }
  };

  const clearFilters = () => {
    setFilters({
      projectId: '',
      startDate: '',
      endDate: '',
      licensePlate: ''
    });
    setSearchTerm('');
  };

  const hasActiveFilters = filters.projectId || filters.startDate || filters.endDate || filters.licensePlate || searchTerm;
  const activeFilterCount = [filters.projectId, filters.startDate, filters.endDate, filters.licensePlate, searchTerm]
    .filter(Boolean).length;

  return (
    <MobileLayout>
      <div className="space-y-4">
        {/* 顶部搜索和过滤 */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索项目名、车牌号、司机..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-8 w-8 p-0"
                onClick={() => setSearchTerm('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex-1">
                  <Filter className="h-4 w-4 mr-2" />
                  筛选
                  {activeFilterCount > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-md">
                <DialogHeader>
                  <DialogTitle>筛选条件</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>项目</Label>
                    <Select value={filters.projectId} onValueChange={(value) => 
                      setFilters(prev => ({ ...prev, projectId: value === "all" ? "" : value }))
                    }>
                      <SelectTrigger>
                        <SelectValue placeholder="选择项目" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部项目</SelectItem>
                        {projects.map(project => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>开始日期</Label>
                    <Input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label>结束日期</Label>
                    <Input
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label>车牌号</Label>
                    <Input
                      placeholder="输入车牌号"
                      value={filters.licensePlate}
                      onChange={(e) => setFilters(prev => ({ ...prev, licensePlate: e.target.value }))}
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" onClick={clearFilters} className="flex-1">
                      清除
                    </Button>
                    <Button onClick={() => setShowFilterDialog(false)} className="flex-1">
                      确定
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  添加
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>添加磅单记录</DialogTitle>
                </DialogHeader>
                <MobileScaleRecordForm
                  projects={projects}
                  onSuccess={() => {
                    setShowAddDialog(false);
                    loadRecords();
                    toast({ title: "成功", description: "磅单记录已添加" });
                  }}
                  onCancel={() => setShowAddDialog(false)}
                />
              </DialogContent>
            </Dialog>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
              <span>已应用 {activeFilterCount} 个筛选条件</span>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                清除全部
              </Button>
            </div>
          )}
        </div>

        {/* 记录列表 */}
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : records.length === 0 ? (
          <MobileCard>
            <CardContent className="text-center py-8">
              <Scale className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {hasActiveFilters ? "没有找到符合条件的记录" : "暂无磅单记录"}
              </p>
            </CardContent>
          </MobileCard>
        ) : (
          <div className="space-y-3">
            {records.map((record) => (
              <MobileCard key={record.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">
                        {record.project_name}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(record.loading_date), 'yyyy-MM-dd')}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeleteDialog(record.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">车牌号</span>
                      <div className="flex items-center gap-1 mt-1">
                        <Truck className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono">
                          {record.license_plate || 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">司机</span>
                      <p className="mt-1">{record.driver_name || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">车次</span>
                      <p className="mt-1">第 {record.trip_number} 车次</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">有效数量</span>
                      <p className="mt-1">
                        {record.valid_quantity ? `${record.valid_quantity} 吨` : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {record.logistics_number && (
                    <div>
                      <span className="text-muted-foreground text-sm">运单号</span>
                      <Badge variant="secondary" className="mt-1 font-mono text-xs">
                        {record.logistics_number}
                      </Badge>
                    </div>
                  )}

                  {record.image_urls.length > 0 && (
                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {record.image_urls.length} 张图片
                      </span>
                      <Badge variant="outline" className="text-xs">
                        点击查看
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </MobileCard>
            ))}
          </div>
        )}

        {/* 删除确认对话框 */}
        <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                您确定要删除这条磅单记录吗？此操作无法撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => showDeleteDialog && handleDeleteRecord(showDeleteDialog)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MobileLayout>
  );
}