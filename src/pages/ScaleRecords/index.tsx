import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShipperProjectCascadeFilter } from '@/components/ShipperProjectCascadeFilter';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Search, Image as ImageIcon, Trash2, Loader2, Link2, Edit, Eye, MoreHorizontal, Weight } from 'lucide-react';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useFilterState } from '@/hooks/useFilterState';
import { convertChinaDateToUTCDate } from '@/utils/dateUtils';
import { ScaleRecordForm } from './components/ScaleRecordForm';
import { ImageViewer } from './components/ImageViewer';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { PageHeader } from '@/components/PageHeader';

// 接口定义 (已更新)
interface Project { id: string; name: string; }
interface Driver { id: string; name: string; license_plate: string; }
interface ScaleRecord { id: string; project_id: string; project_name: string; loading_date: string; trip_number: number; valid_quantity: number | null; billing_type_id: number; image_urls: string[]; license_plate: string | null; driver_name: string | null; created_at: string; logistics_number: string | null; }
interface FilterState { projectId: string; startDate: string; endDate: string; licensePlate: string; }

const initialFilterState: FilterState = { projectId: '', startDate: '', endDate: '', licensePlate: '' };
const PAGE_SIZE = 15;

export default function ScaleRecords() {
  // 基础状态
  const [projects, setProjects] = useState<Project[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [records, setRecords] = useState<ScaleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 弹窗状态
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [showWaybillDetail, setShowWaybillDetail] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [editingRecord, setEditingRecord] = useState<ScaleRecord | null>(null);
  const [viewingWaybill, setViewingWaybill] = useState<any>(null);
  
  // 删除相关状态
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showSingleDeleteDialog, setShowSingleDeleteDialog] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<ScaleRecord | null>(null);
  
  // 数据与选择状态
  const [totalRecordsCount, setTotalRecordsCount] = useState(0);
  const [isSelectingAll, setIsSelectingAll] = useState(false);
  const [isBulkLinking, setIsBulkLinking] = useState(false); // 新增：批量关联加载状态

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);

  // 自定义 Hooks
  const { uiFilters, setUiFilters, activeFilters, handleSearch, handleClear, isStale } = useFilterState<FilterState>(initialFilterState);
  const { toast } = useToast();
  
  // 货主-项目级联筛选
  const [selectedShipperId, setSelectedShipperId] = useState('all');
  const [selectedProjectId, setSelectedProjectId] = useState('all');

  useEffect(() => {
    loadProjects();
    loadDrivers();
  }, []);

  useEffect(() => {
    loadRecords();
  }, [activeFilters, currentPage]);

  useEffect(() => {
    if (isStale) {
      setCurrentPage(1);
    }
  }, [isStale]);

  const loadProjects = async () => { try { const { data, error } = await supabase.from('projects').select('id, name').order('name'); if (error) throw error; setProjects(data || []); } catch (error) { console.error('Error loading projects:', error); } };
  const loadDrivers = async () => { try { const { data, error } = await supabase.from('drivers').select('id, name, license_plate').order('name'); if (error) throw error; setDrivers(data || []); } catch (error) { console.error('Error loading drivers:', error); } };

  const loadRecords = async () => {
    setLoading(true);
    try {
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // 将中国时区的日期转换为 UTC 日期（用于数据库查询）
      // activeFilters.startDate 和 activeFilters.endDate 存储的是中国时区的日期字符串（如 "2025-11-02"）
      const convertChinaDateToUTC = (dateStr: string): string => {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-').map(Number);
        // 创建中国时区的日期字符串并解析（明确指定 +08:00 时区）
        const chinaDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00+08:00`;
        const chinaDateObj = new Date(chinaDateStr);
        return chinaDateObj.toISOString().split('T')[0];
      };
      
      let query = supabase.from('scale_records').select('*', { count: 'exact' }).order('loading_date', { ascending: false }).order('trip_number', { ascending: false });
      if (activeFilters.projectId && activeFilters.projectId !== 'all') query = query.eq('project_id', activeFilters.projectId);
      if (activeFilters.startDate) query = query.gte('loading_date', convertChinaDateToUTC(activeFilters.startDate));
      if (activeFilters.endDate) query = query.lte('loading_date', convertChinaDateToUTC(activeFilters.endDate));
      if (activeFilters.licensePlate) query = query.ilike('license_plate', `%${activeFilters.licensePlate}%`);
      
      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      
      setRecords((data as any[]) || []);
      setTotalRecordsCount(count || 0);
    } catch (error) {
      console.error('Error loading records:', error);
      toast({ title: "错误", description: "加载磅单记录失败", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // 新增：批量关联运单号的函数
  const handleBulkLinkWaybills = async () => {
    const idsToLink = Array.from(selectedRecordIds);
    if (idsToLink.length === 0) return;

    setIsBulkLinking(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-link-logistics', {
        body: { scale_record_ids: idsToLink },
      });

      if (error) throw error;

      const results = data.results;
      const successfulUpdates = results.filter((r: any) => r.status === 'success');
      const notFoundCount = results.filter((r: any) => r.status === 'not_found').length;

      if (successfulUpdates.length > 0) {
        const updatesMap = new Map(successfulUpdates.map((u: any) => [u.id, u.logistics_number]));
        
        setRecords(prevRecords =>
          prevRecords.map(record => 
            updatesMap.has(record.id)
              ? { ...record, logistics_number: updatesMap.get(record.id) as string }
              : record
          )
        );
      }
      
      toast({
        title: "批量关联完成",
        description: `成功 ${successfulUpdates.length} 条，未找到匹配 ${notFoundCount} 条。`,
      });

    } catch (error) {
      console.error("Error during bulk link:", error);
      toast({ title: "操作失败", description: "批量关联时发生错误，请检查控制台。", variant: "destructive" });
    } finally {
      setIsBulkLinking(false);
    }
  };

  const handleRecordAdded = () => {
    setShowAddDialog(false);
    loadRecords();
    toast({ title: "成功", description: "磅单记录已添加" });
  };

  const handleEditRecord = (record: ScaleRecord) => {
    console.log('准备编辑记录:', record);
    setEditingRecord(record);
    setShowEditDialog(true);
  };

  const handleRecordUpdated = () => {
    setShowEditDialog(false);
    setEditingRecord(null);
    loadRecords();
    toast({ title: "成功", description: "磅单记录已更新" });
  };

  const handleViewWaybill = async (logisticsNumber: string) => {
    if (!logisticsNumber || logisticsNumber === '未关联') return;
    
    try {
      const { data, error } = await supabase
        .from('logistics_records')
        .select(`
          *,
          partner_chains(chain_name),
          projects(name)
        `)
        .eq('auto_number', logisticsNumber)
        .single();

      if (error) throw error;
      setViewingWaybill(data);
      setShowWaybillDetail(true);
    } catch (error) {
      console.error('Error loading waybill:', error);
      toast({ title: "错误", description: "加载运单详情失败", variant: "destructive" });
    }
  };

  const handleDeleteRecord = (record: ScaleRecord) => {
    setDeletingRecord(record);
    setShowSingleDeleteDialog(true);
  };

  const confirmDeleteRecord = async () => {
    if (!deletingRecord) return;

    try {
      // 删除云存储图片
      if (deletingRecord.image_urls && deletingRecord.image_urls.length > 0) {
        const { error: functionError } = await supabase.functions.invoke('qiniu-delete', { 
          body: { urls: deletingRecord.image_urls } 
        });
        if (functionError) throw new Error("删除云存储图片失败");
      }

      // 删除数据库记录
      const { error: dbError } = await supabase
        .from('scale_records')
        .delete()
        .eq('id', deletingRecord.id);

      if (dbError) throw dbError;

      toast({ title: "成功", description: "磅单记录已删除" });
      setDeletingRecord(null);
      setShowSingleDeleteDialog(false);
      loadRecords();
    } catch (error) {
      console.error("Delete record error:", error);
      toast({ title: "删除失败", description: "操作失败，请检查控制台错误信息。", variant: "destructive" });
    }
  };

  const handleImageClick = (images: string[]) => {
    if (images && images.length > 0) {
      setSelectedImages(images);
      setShowImageViewer(true);
    }
  };

  const handleDateRangeChange = (dateRange: DateRange | undefined) => {
    setUiFilters(prev => ({ 
      ...prev, 
      // 将中国时区的日期转换为 UTC 日期，确保筛选正确
      startDate: dateRange?.from ? convertChinaDateToUTCDate(dateRange.from) : '', 
      endDate: dateRange?.to ? convertChinaDateToUTCDate(dateRange.to) : '' 
    }));
  };

  const handleSelectRecord = (recordId: string) => {
    setSelectedRecordIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recordId)) {
        newSet.delete(recordId);
      } else {
        newSet.add(recordId);
      }
      return newSet;
    });
  };

  const handleBulkDelete = async () => {
    const idsToDelete = Array.from(selectedRecordIds);
    if (idsToDelete.length === 0) return;

    try {
      const { data: recordsToDelete, error: fetchError } = await supabase.from('scale_records').select('image_urls').in('id', idsToDelete);
      if (fetchError) throw fetchError;

      const urlsToDelete = recordsToDelete.flatMap(r => r.image_urls).filter(Boolean);
      if (urlsToDelete.length > 0) {
        const { error: functionError } = await supabase.functions.invoke('qiniu-delete', { body: { urls: urlsToDelete } });
        if (functionError) throw new Error("删除云存储图片失败");
      }

      const { error: dbError } = await supabase.from('scale_records').delete().in('id', idsToDelete);
      if (dbError) throw dbError;

      toast({ title: "成功", description: `已成功删除 ${idsToDelete.length} 条记录。` });
      setSelectedRecordIds(new Set());
      loadRecords();
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast({ title: "删除失败", description: "操作失败，请检查控制台错误信息。", variant: "destructive" });
    } finally {
      setShowBulkDeleteDialog(false);
    }
  };

  const handleSelectPage = (select = true) => {
    const currentPageIds = records.map(r => r.id);
    setSelectedRecordIds(prev => {
      const newSet = new Set(prev);
      if (select) {
        currentPageIds.forEach(id => newSet.add(id));
      } else {
        currentPageIds.forEach(id => newSet.delete(id));
      }
      return newSet;
    });
  };

  const handleSelectAllMatching = async () => {
    setIsSelectingAll(true);
    try {
      // 将中国时区的日期转换为 UTC 日期（用于数据库查询）
      // activeFilters.startDate 和 activeFilters.endDate 存储的是中国时区的日期字符串（如 "2025-11-02"）
      const convertChinaDateToUTC = (dateStr: string): string => {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-').map(Number);
        // 创建中国时区的日期字符串并解析（明确指定 +08:00 时区）
        const chinaDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00+08:00`;
        const chinaDateObj = new Date(chinaDateStr);
        return chinaDateObj.toISOString().split('T')[0];
      };
      
      let query = supabase.from('scale_records').select('id');
      if (activeFilters.projectId && activeFilters.projectId !== 'all') query = query.eq('project_id', activeFilters.projectId);
      if (activeFilters.startDate) query = query.gte('loading_date', convertChinaDateToUTC(activeFilters.startDate));
      if (activeFilters.endDate) query = query.lte('loading_date', convertChinaDateToUTC(activeFilters.endDate));
      if (activeFilters.licensePlate) query = query.ilike('license_plate', `%${activeFilters.licensePlate}%`);
      
      const { data, error } = await query;
      if (error) throw error;

      const allIds = data.map(item => item.id);
      setSelectedRecordIds(new Set(allIds));
    } catch (error) {
      console.error("Error selecting all matching records:", error);
      toast({ title: "错误", description: "无法获取所有记录，请重试。", variant: "destructive" });
    } finally {
      setIsSelectingAll(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const totalPages = Math.ceil(totalRecordsCount / PAGE_SIZE);
  const isAnyOnPageSelected = records.length > 0 && records.some(r => selectedRecordIds.has(r.id));
  const isAllOnPageSelected = records.length > 0 && records.every(r => selectedRecordIds.has(r.id));
  const headerCheckboxState = isAllOnPageSelected ? true : (isAnyOnPageSelected ? 'indeterminate' : false);
  const isAllMatchingSelected = selectedRecordIds.size === totalRecordsCount && totalRecordsCount > 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader 
        title="磅单管理" 
        description="管理货物称重记录"
        icon={Weight}
        iconColor="text-yellow-600"
      />

      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="flex items-end gap-4 flex-grow flex-wrap">
              {/* 货主-项目级联筛选器 */}
              <div className="flex-grow min-w-[400px]">
                <ShipperProjectCascadeFilter
                  selectedShipperId={selectedShipperId}
                  selectedProjectId={selectedProjectId}
                  onShipperChange={(id) => {
                    setSelectedShipperId(id);
                    setSelectedProjectId('all');
                  }}
                  onProjectChange={(id) => {
                    setSelectedProjectId(id);
                    setUiFilters(prev => ({ ...prev, projectId: id === 'all' ? '' : id }));
                  }}
                />
              </div>
              <div className="flex-1 min-w-[280px]"><Label htmlFor="date-range">日期范围</Label><DateRangePicker date={{ from: uiFilters.startDate ? new Date(uiFilters.startDate) : undefined, to: uiFilters.endDate ? new Date(uiFilters.endDate) : undefined, }} setDate={handleDateRangeChange} /></div>
              <div className="flex-1 min-w-[180px]"><Label htmlFor="licensePlate">车牌号</Label><Input id="licensePlate" placeholder="输入车牌号" value={uiFilters.licensePlate} onChange={(e) => setUiFilters(prev => ({ ...prev, licensePlate: e.target.value }))} /></div>
            </div>
            <div className="flex items-end gap-2">
              {selectedRecordIds.size > 0 && (
                <>
                  <Button variant="destructive" onClick={() => setShowBulkDeleteDialog(true)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    删除选中 ({selectedRecordIds.size})
                  </Button>
                  <Button onClick={handleBulkLinkWaybills} disabled={isBulkLinking}>
                    {isBulkLinking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
                    关联运单 ({selectedRecordIds.size})
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={handleClear}>清除</Button>
              <Button onClick={handleSearch} disabled={!isStale}><Search className="h-4 w-4 mr-2" />搜索</Button>
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}><DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />添加磅单</Button></DialogTrigger><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>添加磅单记录</DialogTitle></DialogHeader><ScaleRecordForm projects={projects} drivers={drivers} onSuccess={handleRecordAdded} /></DialogContent></Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? ( <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div><p className="mt-2 text-muted-foreground">加载中...</p></div> ) : 
           records.length === 0 ? ( <div className="text-center py-8"><p className="text-muted-foreground">暂无磅单记录</p></div> ) : (
            <>
              <div className="space-y-2">
                {isAllMatchingSelected && (
                  <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-md p-3 flex items-center justify-between">
                    <p className="text-sm font-medium">已选中所有 {totalRecordsCount} 条记录。</p>
                    <Button variant="link" className="p-0 h-auto text-blue-800" onClick={() => setSelectedRecordIds(new Set())}>清除选择</Button>
                  </div>
                )}
                
                <div className="flex items-center border-b pb-2 text-sm font-medium text-muted-foreground">
                  <div className="w-12 flex-shrink-0 flex items-center justify-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Checkbox checked={headerCheckboxState} /></DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => handleSelectPage(true)}>选择当前页 ({records.length})</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleSelectPage(false)}>取消选择当前页</DropdownMenuItem>
                        <DropdownMenuItem onSelect={handleSelectAllMatching} disabled={isSelectingAll}>
                          {isSelectingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          选择所有 {totalRecordsCount} 条记录
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="w-64 flex-shrink-0 px-2">项目名称</div>
                  <div className="w-28 flex-shrink-0 px-2">装车日期</div>
                  <div className="w-28 flex-shrink-0 px-2">车牌号</div>
                  <div className="w-24 flex-shrink-0 px-2">司机</div>
                  <div className="w-24 flex-shrink-0 px-2">车次</div>
                  <div className="w-28 flex-shrink-0 px-2">有效数量</div>
                  <div className="w-32 flex-shrink-0 px-2">运单号</div>
                  <div className="w-24 flex-shrink-0 text-center px-2">图片</div>
                  <div className="w-40 flex-shrink-0 text-right px-2">创建时间</div>
                  <div className="w-24 flex-shrink-0 text-center px-2">操作</div>
                </div>

                {records.map((record) => (
                  <div 
                    key={record.id} 
                    onClick={() => handleEditRecord(record)}
                    className="flex items-center border rounded-lg p-2 hover:bg-muted/50 transition-colors text-sm cursor-pointer"
                  >
                    <div className="w-12 flex-shrink-0 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selectedRecordIds.has(record.id)} onCheckedChange={() => handleSelectRecord(record.id)} />
                    </div>
                    
                    <div className="w-64 flex-shrink-0 font-semibold truncate px-2" title={record.project_name}>
                      {record.project_name}
                    </div>
                    <div className="w-28 flex-shrink-0 px-2">{format(new Date(record.loading_date), 'yyyy-MM-dd')}</div>
                    <div className="w-28 flex-shrink-0 px-2">{record.license_plate || 'N/A'}</div>
                    <div className="w-24 flex-shrink-0 px-2">{record.driver_name || 'N/A'}</div>
                    <div className="w-24 flex-shrink-0 px-2">第 {record.trip_number} 车次</div>
                    <div className="w-28 flex-shrink-0 px-2">{record.valid_quantity ? `${record.valid_quantity} 吨` : 'N/A'}</div>
                    
                    <div className="w-32 flex-shrink-0 px-2">
                      {record.logistics_number ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewWaybill(record.logistics_number!);
                          }}
                          className="text-xs font-mono bg-muted px-2 py-1 rounded hover:bg-muted/80 transition-colors cursor-pointer"
                        >
                          {record.logistics_number}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">未关联</span>
                      )}
                    </div>
                    
                    <div className="w-24 flex-shrink-0 text-center flex items-center justify-center gap-2 px-2">
                      {record.image_urls.length > 0 ? (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImageClick(record.image_urls);
                          }}
                          className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 transition-colors"
                        >
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          <span>{record.image_urls.length}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">无图片</span>
                      )}
                    </div>
                    
                    <div className="w-40 flex-shrink-0 flex justify-end items-center px-2">
                      <p className="text-xs text-muted-foreground">{format(new Date(record.created_at), 'yy-MM-dd HH:mm')}</p>
                    </div>
                    
                    <div className="w-24 flex-shrink-0 flex items-center justify-center gap-1 px-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => e.stopPropagation()}
                            className="h-8 w-8 p-0"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditRecord(record);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRecord(record);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
              
              {totalPages > 1 && (
                <div className="flex items-center justify-end space-x-2 pt-4">
                  <span className="text-sm text-muted-foreground">
                    共 {totalRecordsCount} 条记录
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    上一页
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    第 {currentPage} 页 / 共 {totalPages} 页
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showImageViewer} onOpenChange={setShowImageViewer}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>磅单图片</DialogTitle></DialogHeader><ImageViewer images={selectedImages} /></DialogContent></Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑磅单记录</DialogTitle>
          </DialogHeader>
          {editingRecord && (
            <ScaleRecordForm 
              projects={projects} 
              drivers={drivers} 
              onSuccess={handleRecordUpdated}
              editingRecord={editingRecord}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showWaybillDetail} onOpenChange={setShowWaybillDetail}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>运单详情 (编号: {viewingWaybill?.auto_number})</DialogTitle>
          </DialogHeader>
          {viewingWaybill && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-6 py-4 text-sm">
              <div className="space-y-1">
                <Label className="text-muted-foreground">项目</Label>
                <p>{viewingWaybill.project_name}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">合作链路</Label>
                <p>{viewingWaybill.partner_chains?.chain_name || '默认'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">装货日期</Label>
                <p>{viewingWaybill.loading_date ? viewingWaybill.loading_date.split('T')[0] : '未填写'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">卸货日期</Label>
                <p>{viewingWaybill.unloading_date ? viewingWaybill.unloading_date.split('T')[0] : '未填写'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">司机</Label>
                <p>{viewingWaybill.driver_name}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">车牌号</Label>
                <p>{viewingWaybill.license_plate || '未填写'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">司机电话</Label>
                <p>{viewingWaybill.driver_phone || '未填写'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">运输类型</Label>
                <p>{viewingWaybill.transport_type}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">装货地点</Label>
                <p>{viewingWaybill.loading_location}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">卸货地点</Label>
                <p>{viewingWaybill.unloading_location}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">装货重量</Label>
                <p>{viewingWaybill.loading_weight ? `${viewingWaybill.loading_weight} 吨` : '-'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">卸货重量</Label>
                <p>{viewingWaybill.unloading_weight ? `${viewingWaybill.unloading_weight} 吨` : '-'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">运费金额</Label>
                <p className="font-mono">¥{viewingWaybill.current_cost?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">额外费用</Label>
                <p className="font-mono">¥{viewingWaybill.extra_cost?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">司机应收</Label>
                <p className="font-mono font-bold text-primary">¥{viewingWaybill.payable_cost?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="space-y-1 col-span-4">
                <Label className="text-muted-foreground">备注</Label>
                <p>{viewingWaybill.remarks || '无'}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要批量删除吗？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将永久删除选中的 <span className="font-bold text-destructive">{selectedRecordIds.size}</span> 条磅单记录及其所有关联图片。此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showSingleDeleteDialog} onOpenChange={setShowSingleDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要删除这条磅单记录吗？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将永久删除磅单记录 <span className="font-bold text-destructive">{deletingRecord?.project_name} - {deletingRecord?.license_plate}</span> 及其所有关联图片。此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRecord} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
