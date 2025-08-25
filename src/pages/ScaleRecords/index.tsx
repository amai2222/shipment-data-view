import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Image as ImageIcon, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useFilterState } from '@/hooks/useFilterState';
import { ScaleRecordForm } from './components/ScaleRecordForm';
import { ImageViewer } from './components/ImageViewer';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';

// 接口定义 (与您原始代码一致)
interface Project { id: string; name: string; }
interface Driver { id: string; name: string; license_plate: string; }
interface ScaleRecord { id: string; project_id: string; project_name: string; loading_date: string; trip_number: number; valid_quantity: number | null; billing_type_id: number; image_urls: string[]; license_plate: string | null; driver_name: string | null; created_at: string; }
interface FilterState { projectId: string; startDate: string; endDate: string; licensePlate: string; }

const initialFilterState: FilterState = { projectId: '', startDate: '', endDate: '', licensePlate: '' };

export default function ScaleRecords() {
  // 状态管理 (与您原始代码一致)
  const [projects, setProjects] = useState<Project[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [records, setRecords] = useState<ScaleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  
  // ★ 新增功能: 用于管理删除确认弹窗的状态
  const [deleteTarget, setDeleteTarget] = useState<ScaleRecord | null>(null);

  const { uiFilters, setUiFilters, activeFilters, handleSearch, handleClear, isStale } = useFilterState<FilterState>(initialFilterState);
  const { toast } = useToast();

  useEffect(() => {
    loadProjects();
    loadDrivers();
    loadRecords();
  }, [activeFilters]);

  // 数据加载函数 (与您原始代码一致)
  const loadProjects = async () => { try { const { data, error } = await supabase.from('projects').select('id, name').order('name'); if (error) throw error; setProjects(data || []); } catch (error) { console.error('Error loading projects:', error); } };
  const loadDrivers = async () => { try { const { data, error } = await supabase.from('drivers').select('id, name, license_plate').order('name'); if (error) throw error; setDrivers(data || []); } catch (error) { console.error('Error loading drivers:', error); } };
  const loadRecords = async () => { setLoading(true); try { let query = supabase.from('scale_records').select('*').order('loading_date', { ascending: false }).order('trip_number', { ascending: false }); if (activeFilters.projectId && activeFilters.projectId !== 'all') query = query.eq('project_id', activeFilters.projectId); if (activeFilters.startDate) query = query.gte('loading_date', activeFilters.startDate); if (activeFilters.endDate) query = query.lte('loading_date', activeFilters.endDate); if (activeFilters.licensePlate) query = query.ilike('license_plate', `%${activeFilters.licensePlate}%`); const { data, error } = await query; if (error) throw error; setRecords(data || []); } catch (error) { console.error('Error loading records:', error); toast({ title: "错误", description: "加载磅单记录失败", variant: "destructive" }); } finally { setLoading(false); } };

  // ★ 新增功能: 统一的删除处理函数，会同时删除七牛云图片和数据库记录
  const handleDelete = async (recordToDelete: ScaleRecord) => {
    if (recordToDelete.image_urls && recordToDelete.image_urls.length > 0) {
      const { error: functionError } = await supabase.functions.invoke('qiniu-delete', { body: { urls: recordToDelete.image_urls } });
      if (functionError) {
        toast({ title: "删除失败", description: "无法删除云存储中的图片，请重试。", variant: "destructive" });
        setDeleteTarget(null);
        return;
      }
    }
    const { error: dbError } = await supabase.from('scale_records').delete().eq('id', recordToDelete.id);
    if (dbError) {
      toast({ title: "删除失败", description: "无法从数据库中删除记录，请重试。", variant: "destructive" });
    } else {
      setRecords(prevRecords => prevRecords.filter(r => r.id !== recordToDelete.id));
      toast({ title: "成功", description: "记录已删除" });
    }
    setDeleteTarget(null);
  };

  // ★ 功能优化: handleRecordAdded 现在使用乐观更新，并简化了成功提示
  const handleRecordAdded = (newRecord: ScaleRecord) => {
    setShowAddDialog(false);
    setRecords(prevRecords => [newRecord, ...prevRecords]);
    toast({ title: "成功", description: "磅单记录已添加" });
  };

  // 事件处理函数 (与您原始代码一致)
  const handleImageClick = (images: string[]) => {
    setSelectedImages(images);
    setShowImageViewer(true);
  };

  const handleDateRangeChange = (dateRange: DateRange | undefined) => {
    setUiFilters(prev => ({ ...prev, startDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '', endDate: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '' }));
  };

  return (
    <div className="space-y-6">
      {/* 筛选区域 (布局与之前一致) */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end justify-between gap-4">
            <div className="flex items-end gap-4 flex-grow">
              <div className="flex-1 min-w-[180px]"><Label htmlFor="project">项目</Label><Select value={uiFilters.projectId || "all"} onValueChange={(value) => setUiFilters(prev => ({ ...prev, projectId: value === "all" ? "" : value }))}><SelectTrigger><SelectValue placeholder="选择项目" /></SelectTrigger><SelectContent><SelectItem value="all">全部项目</SelectItem>{projects.filter(p => p.id && p.id.trim() !== '').map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent></Select></div>
              <div className="flex-1 min-w-[280px]"><Label htmlFor="date-range">日期范围</Label><DateRangePicker date={{ from: uiFilters.startDate ? new Date(uiFilters.startDate) : undefined, to: uiFilters.endDate ? new Date(uiFilters.endDate) : undefined, }} setDate={handleDateRangeChange} /></div>
              <div className="flex-1 min-w-[180px]"><Label htmlFor="licensePlate">车牌号</Label><Input id="licensePlate" placeholder="输入车牌号" value={uiFilters.licensePlate} onChange={(e) => setUiFilters(prev => ({ ...prev, licensePlate: e.target.value }))} /></div>
            </div>
            <div className="flex items-end gap-2"><Button variant="outline" onClick={handleClear}>清除</Button><Button onClick={handleSearch} disabled={!isStale}><Search className="h-4 w-4 mr-2" />搜索</Button><Dialog open={showAddDialog} onOpenChange={setShowAddDialog}><DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />添加磅单</Button></DialogTrigger><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>添加磅单记录</DialogTitle></DialogHeader><ScaleRecordForm projects={projects} drivers={drivers} onSuccess={handleRecordAdded} /></DialogContent></Dialog></div>
          </div>
        </CardContent>
      </Card>

      {/* 记录列表区域 */}
      <Card>
        <CardContent className="pt-6">
          {loading ? ( <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div><p className="mt-2 text-muted-foreground">加载中...</p></div> ) : 
           records.length === 0 ? ( <div className="text-center py-8"><p className="text-muted-foreground">暂无磅单记录</p></div> ) : (
            <div className="space-y-4">
              {records.map((record) => (
                // ★ 布局重构: 这是新的单行布局，并且整个 div 都是可点击的
                <div 
                  key={record.id} 
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => record.image_urls.length > 0 && handleImageClick(record.image_urls)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-grow space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-lg">{record.project_name}</h3>
                        <Badge variant="outline">第{record.trip_number}车次</Badge>
                        {record.image_urls.length > 0 && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" />{record.image_urls.length}张图片
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-4 flex-wrap">
                        <p>装车日期: {format(new Date(record.loading_date), 'yyyy-MM-dd')}</p>
                        {record.license_plate && <p>车牌号: {record.license_plate}</p>}
                        {record.driver_name && <p>司机: {record.driver_name}</p>}
                        {record.valid_quantity && <p>有效数量: {record.valid_quantity}吨</p>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-2 ml-4">
                      <p className="text-sm text-muted-foreground whitespace-nowrap">{format(new Date(record.created_at), 'yyyy-MM-dd HH:mm')}</p>
                      {/* ★ 新增功能: 删除按钮，使用 e.stopPropagation() 防止触发父级的 onClick 事件 */}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:text-destructive" 
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(record); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 图片查看器 (与您原始代码一致) */}
      <Dialog open={showImageViewer} onOpenChange={setShowImageViewer}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>磅单图片</DialogTitle></DialogHeader><ImageViewer images={selectedImages} /></DialogContent></Dialog>

      {/* ★ 新增功能: 删除确认弹窗 */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要删除吗？</AlertDialogTitle>
            <AlertDialogDescription>此操作将永久删除该条磅单记录及其所有关联图片。此操作无法撤销。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDelete(deleteTarget!)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
