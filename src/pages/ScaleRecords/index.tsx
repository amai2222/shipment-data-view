import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Search, Image as ImageIcon, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useFilterState } from '@/hooks/useFilterState';
import { ScaleRecordForm } from './components/ScaleRecordForm';
import { ImageViewer } from './components/ImageViewer';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';

// 接口定义
interface Project { id: string; name: string; }
interface Driver { id: string; name: string; license_plate: string; }
interface ScaleRecord { id: string; project_id: string; project_name: string; loading_date: string; trip_number: number; valid_quantity: number | null; billing_type_id: number; image_urls: string[]; license_plate: string | null; driver_name: string | null; created_at: string; }
interface FilterState { projectId: string; startDate: string; endDate: string; licensePlate: string; }

const initialFilterState: FilterState = { projectId: '', startDate: '', endDate: '', licensePlate: '' };
const PAGE_SIZE = 10; // 定义每页显示的记录数

export default function ScaleRecords() {
  // ... (所有 state 保持不变) ...
  const [projects, setProjects] = useState<Project[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [records, setRecords] = useState<ScaleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ScaleRecord | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [totalRecordsCount, setTotalRecordsCount] = useState(0);
  const [isSelectingAll, setIsSelectingAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { uiFilters, setUiFilters, activeFilters, handleSearch, handleClear, isStale } = useFilterState<FilterState>(initialFilterState);
  const { toast } = useToast();

  // ... (所有 useEffect 和函数保持不变, 除了 handleDelete 不再被UI直接调用) ...
  useEffect(() => { loadProjects(); loadDrivers(); }, []);
  useEffect(() => { loadRecords(); }, [activeFilters, currentPage]);
  useEffect(() => { if (isStale) { setCurrentPage(1); } }, [isStale]);
  const loadProjects = async () => { try { const { data, error } = await supabase.from('projects').select('id, name').order('name'); if (error) throw error; setProjects(data || []); } catch (error) { console.error('Error loading projects:', error); } };
  const loadDrivers = async () => { try { const { data, error } = await supabase.from('drivers').select('id, name, license_plate').order('name'); if (error) throw error; setDrivers(data || []); } catch (error) { console.error('Error loading drivers:', error); } };
  const loadRecords = async () => { setLoading(true); try { const from = (currentPage - 1) * PAGE_SIZE; const to = from + PAGE_SIZE - 1; let query = supabase.from('scale_records').select('*', { count: 'exact' }).order('loading_date', { ascending: false }).order('trip_number', { ascending: false }); if (activeFilters.projectId && activeFilters.projectId !== 'all') query = query.eq('project_id', activeFilters.projectId); if (activeFilters.startDate) query = query.gte('loading_date', activeFilters.startDate); if (activeFilters.endDate) query = query.lte('loading_date', activeFilters.endDate); if (activeFilters.licensePlate) query = query.ilike('license_plate', `%${activeFilters.licensePlate}%`); const { data, error, count } = await query.range(from, to); if (error) throw error; setRecords(data || []); setTotalRecordsCount(count || 0); } catch (error) { console.error('Error loading records:', error); toast({ title: "错误", description: "加载磅单记录失败", variant: "destructive" }); } finally { setLoading(false); } };
  const handleDelete = async (recordToDelete: ScaleRecord) => { if (recordToDelete.image_urls && recordToDelete.image_urls.length > 0) { const { error: functionError } = await supabase.functions.invoke('qiniu-delete', { body: { urls: recordToDelete.image_urls } }); if (functionError) { toast({ title: "删除失败", description: "无法删除云存储中的图片，请重试。", variant: "destructive" }); setDeleteTarget(null); return; } } const { error: dbError } = await supabase.from('scale_records').delete().eq('id', recordToDelete.id); if (dbError) { toast({ title: "删除失败", description: "无法从数据库中删除记录，请重试。", variant: "destructive" }); } else { toast({ title: "成功", description: "记录已删除" }); loadRecords(); } setDeleteTarget(null); };
  const handleRecordAdded = () => { setShowAddDialog(false); loadRecords(); toast({ title: "成功", description: "磅单记录已添加" }); };
  const handleImageClick = (images: string[]) => { setSelectedImages(images); setShowImageViewer(true); };
  const handleDateRangeChange = (dateRange: DateRange | undefined) => { setUiFilters(prev => ({ ...prev, startDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '', endDate: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '' })); };
  const handleSelectRecord = (recordId: string) => { setSelectedRecordIds(prev => { const newSet = new Set(prev); if (newSet.has(recordId)) { newSet.delete(recordId); } else { newSet.add(recordId); } return newSet; }); };
  const handleBulkDelete = async () => { const idsToDelete = Array.from(selectedRecordIds); if (idsToDelete.length === 0) return; try { const { data: recordsToDelete, error: fetchError } = await supabase.from('scale_records').select('image_urls').in('id', idsToDelete); if (fetchError) throw fetchError; const urlsToDelete = recordsToDelete.flatMap(r => r.image_urls).filter(Boolean); if (urlsToDelete.length > 0) { const { error: functionError } = await supabase.functions.invoke('qiniu-delete', { body: { urls: urlsToDelete } }); if (functionError) throw new Error("删除云存储图片失败"); } const { error: dbError } = await supabase.from('scale_records').delete().in('id', idsToDelete); if (dbError) throw dbError; toast({ title: "成功", description: `已成功删除 ${idsToDelete.length} 条记录。` }); setSelectedRecordIds(new Set()); loadRecords(); } catch (error) { console.error("Bulk delete error:", error); toast({ title: "删除失败", description: "操作失败，请检查控制台错误信息。", variant: "destructive" }); } finally { setShowBulkDeleteDialog(false); } };
  const handleSelectPage = (select = true) => { const currentPageIds = records.map(r => r.id); setSelectedRecordIds(prev => { const newSet = new Set(prev); if (select) { currentPageIds.forEach(id => newSet.add(id)); } else { currentPageIds.forEach(id => newSet.delete(id)); } return newSet; }); };
  const handleSelectAllMatching = async () => { setIsSelectingAll(true); try { let query = supabase.from('scale_records').select('id'); if (activeFilters.projectId && activeFilters.projectId !== 'all') query = query.eq('project_id', activeFilters.projectId); if (activeFilters.startDate) query = query.gte('loading_date', activeFilters.startDate); if (activeFilters.endDate) query = query.lte('loading_date', activeFilters.endDate); if (activeFilters.licensePlate) query = query.ilike('license_plate', `%${activeFilters.licensePlate}%`); const { data, error } = await query; if (error) throw error; const allIds = data.map(item => item.id); setSelectedRecordIds(new Set(allIds)); } catch (error) { console.error("Error selecting all matching records:", error); toast({ title: "错误", description: "无法获取所有记录，请重试。", variant: "destructive" }); } finally { setIsSelectingAll(false); } };
  const handlePageChange = (newPage: number) => { if (newPage >= 1 && newPage <= totalPages) { setCurrentPage(newPage); } };
  const totalPages = Math.ceil(totalRecordsCount / PAGE_SIZE);
  const isAnyOnPageSelected = records.length > 0 && records.some(r => selectedRecordIds.has(r.id));
  const isAllOnPageSelected = records.length > 0 && records.every(r => selectedRecordIds.has(r.id));
  const headerCheckboxState = isAllOnPageSelected ? true : (isAnyOnPageSelected ? 'indeterminate' : false);
  const isAllMatchingSelected = selectedRecordIds.size === totalRecordsCount && totalRecordsCount > 0;

  return (
    <div className="space-y-6">
      <Card>{/* ... (筛选器部分保持不变) ... */}</Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? ( <div className="text-center py-8">...</div> ) : 
           records.length === 0 ? ( <div className="text-center py-8">...</div> ) : (
            <>
              <div className="space-y-2">
                {isAllMatchingSelected && ( <div className="bg-blue-50 ...">...</div> )}
                
                {/* ★★★ 核心修改 1: 调整表头，去掉“操作”列 ★★★ */}
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
                  <div className="flex-1 min-w-[200px]">项目名称</div>
                  <div className="w-32 flex-shrink-0">装车日期</div>
                  <div className="w-32 flex-shrink-0">车牌号 / 司机</div>
                  <div className="w-28 flex-shrink-0">车次</div>
                  <div className="w-28 flex-shrink-0">有效数量</div>
                  <div className="w-28 flex-shrink-0 text-center">图片</div>
                  <div className="w-40 flex-shrink-0 text-right">创建时间</div>
                </div>

                {/* ★★★ 核心修改 2: 重构数据行 ★★★ */}
                {records.map((record) => (
                  <div 
                    key={record.id} 
                    // 如果有图片，则添加点击事件和手型光标
                    onClick={() => record.image_urls.length > 0 && handleImageClick(record.image_urls)}
                    className={`flex items-center border rounded-lg p-2 hover:bg-muted/50 transition-colors text-sm ${record.image_urls.length > 0 ? 'cursor-pointer' : ''}`}
                  >
                    {/* 阻止复选框的点击事件冒泡到整行 */}
                    <div className="w-12 flex-shrink-0 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selectedRecordIds.has(record.id)} onCheckedChange={() => handleSelectRecord(record.id)} />
                    </div>
                    
                    {/* 强制单行显示，过长则截断 */}
                    <div className="flex-1 min-w-[200px] font-semibold truncate pr-2" title={record.project_name}>
                      {record.project_name}
                    </div>
                    <div className="w-32 flex-shrink-0">{format(new Date(record.loading_date), 'yyyy-MM-dd')}</div>
                    <div className="w-32 flex-shrink-0">
                      <p>{record.license_plate || 'N/A'}</p>
                      <p className="text-muted-foreground">{record.driver_name || 'N/A'}</p>
                    </div>
                    <div className="w-28 flex-shrink-0">第 {record.trip_number} 车次</div>
                    <div className="w-28 flex-shrink-0">{record.valid_quantity ? `${record.valid_quantity} 吨` : 'N/A'}</div>
                    
                    {/* 图片列不再是按钮，仅为显示 */}
                    <div className="w-28 flex-shrink-0 text-center flex items-center justify-center gap-2">
                      {record.image_urls.length > 0 ? (
                        <>
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          <span>{record.image_urls.length}</span>
                        </>
                      ) : (<span className="text-xs text-muted-foreground">无图片</span>)}
                    </div>
                    
                    {/* 去掉了删除按钮，只显示创建时间 */}
                    <div className="w-40 flex-shrink-0 flex justify-end items-center">
                      <p className="text-xs text-muted-foreground">{format(new Date(record.created_at), 'yy-MM-dd HH:mm')}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {totalPages > 1 && ( <div className="flex items-center justify-end space-x-2 pt-4">...</div> )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ... (所有弹窗保持不变) ... */}
      <Dialog open={showImageViewer} onOpenChange={setShowImageViewer}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>磅单图片</DialogTitle></DialogHeader><ImageViewer images={selectedImages} /></DialogContent></Dialog>
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>确定要删除吗？</AlertDialogTitle><AlertDialogDescription>此操作将永久删除该条磅单记录及其所有关联图片。此操作无法撤销。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setDeleteTarget(null)}>取消</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(deleteTarget!)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">删除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>确定要批量删除吗？</AlertDialogTitle><AlertDialogDescription>此操作将永久删除选中的 <span className="font-bold text-destructive">{selectedRecordIds.size}</span> 条磅单记录及其所有关联图片。此操作无法撤销。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">确认删除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
