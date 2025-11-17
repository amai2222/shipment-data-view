// 删除运单组件 - 支持按项目和日期范围筛选删除
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Project } from '@/types';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { formatChinaDateString } from '@/utils/dateUtils';
import { 
  Trash2, 
  AlertTriangle, 
  Info,
  Loader2,
  Filter
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

interface DeleteWaybillsProps {
  onDeleteSuccess?: () => void;
}

// 预览运单类型（基于 SQL 函数返回的字段）
interface WaybillPreview {
  id: string;
  auto_number: string;
  project_name: string;
  driver_name: string;
  license_plate: string | null;
  loading_location: string;
  unloading_location: string;
  loading_date: string;
  unloading_date: string | null;
  loading_weight: number | null;
  unloading_weight: number | null;
  current_cost: number | null;
  extra_cost: number | null;
  payable_cost: number | null;
  transport_type: string | null;
  remarks: string | null;
}

// 删除结果类型
interface DeleteResult {
  success: boolean;
  deleted_logistics_count?: number;
  deleted_costs_count?: number;
  error?: string;
}

export default function DeleteWaybills({ onDeleteSuccess }: DeleteWaybillsProps) {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [deleteResult, setDeleteResult] = useState<DeleteResult | null>(null);
  
  // 预览数据
  const [previewData, setPreviewData] = useState<{
    waybills: WaybillPreview[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // 加载项目列表
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('id, name, start_date, end_date, project_status')
          .order('name');

        if (error) throw error;
        // 转换数据库字段名到 Project 类型
        const transformedProjects = (data || []).map((p: { id: string; name: string; start_date: string; end_date: string; project_status?: string }) => ({
          id: p.id,
          name: p.name,
          startDate: p.start_date,
          endDate: p.end_date,
          manager: '',
          loadingAddress: '',
          unloadingAddress: '',
          createdAt: '',
          projectStatus: p.project_status
        }));
        setProjects(transformedProjects);
      } catch (error: unknown) {
        console.error('加载项目失败:', error);
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        toast({ 
          title: "错误", 
          description: "加载项目列表失败: " + errorMessage, 
          variant: "destructive" 
        });
      }
    };

    loadProjects();
  }, [toast]);

  // 预览符合条件的运单列表
  const previewDeleteCount = async (page: number = 1) => {
    if (!selectedProject) {
      toast({ 
        title: "提示", 
        description: "请先选择项目", 
        variant: "default" 
      });
      return;
    }

    // 从日期范围中提取开始和结束日期
    const startDate = dateRange?.from ? formatChinaDateString(dateRange.from) : '';
    const endDate = dateRange?.to ? formatChinaDateString(dateRange.to) : '';

    if (!startDate && !endDate) {
      toast({ 
        title: "提示", 
        description: "请至少选择一个日期条件", 
        variant: "default" 
      });
      return;
    }

    setIsChecking(true);
    try {
      // 调用后端函数预览符合条件的运单列表
      const { data, error } = await supabase.rpc('preview_delete_waybills', {
        p_project_name: selectedProject,
        p_start_date: startDate || null,
        p_end_date: endDate || null,
        p_page: page,
        p_page_size: pageSize
      });

      if (error) throw error;

      if (data && data.success) {
        const count = data.count || 0;
        setPreviewCount(count);
        
        if (count === 0) {
          toast({ 
            title: "提示", 
            description: "没有找到符合条件的运单记录", 
            variant: "default" 
          });
          setShowPreviewDialog(false);
        } else {
          // 设置预览数据并打开预览对话框
          setPreviewData({
            waybills: data.waybills || [],
            totalCount: count,
            totalPages: data.total_pages || 0,
            currentPage: data.current_page || 1,
            pageSize: data.page_size || pageSize
          });
          setCurrentPage(data.current_page || 1);
          setShowPreviewDialog(true);
        }
      } else {
        throw new Error(data?.error || '预览失败');
      }
    } catch (error: unknown) {
      console.error('预览删除数量失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast({ 
        title: "错误", 
        description: "预览失败: " + errorMessage, 
        variant: "destructive" 
      });
      setPreviewCount(null);
      setShowPreviewDialog(false);
    } finally {
      setIsChecking(false);
    }
  };

  // 切换预览页面
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= (previewData?.totalPages || 1)) {
      previewDeleteCount(page);
    }
  };

  // 执行删除（从预览窗口调用）
  const handleDelete = async () => {
    if (!selectedProject) {
      toast({ 
        title: "错误", 
        description: "请先选择项目", 
        variant: "destructive" 
      });
      return;
    }

    if (!dateRange?.from || !dateRange?.to) {
      toast({ 
        title: "错误", 
        description: "请选择完整的日期范围", 
        variant: "destructive" 
      });
      return;
    }

    if (previewCount === null || previewCount === 0) {
      toast({ 
        title: "提示", 
        description: "没有符合条件的运单记录，无需删除", 
        variant: "default" 
      });
      return;
    }

    // 关闭预览对话框，打开确认对话框
    setShowPreviewDialog(false);
    setShowConfirmDialog(true);
  };

  // 确认删除
  const confirmDelete = async () => {
    setIsDeleting(true);
    setShowConfirmDialog(false);

    // 从日期范围中提取开始和结束日期
    const startDate = dateRange?.from ? formatChinaDateString(dateRange.from) : '';
    const endDate = dateRange?.to ? formatChinaDateString(dateRange.to) : '';

    try {
      const { data, error } = await supabase.rpc('delete_waybills_by_project_and_date', {
        p_project_name: selectedProject,
        p_start_date: startDate || null,
        p_end_date: endDate || null
      });

      if (error) throw error;

      if (data && data.success) {
        setDeleteResult(data);
        toast({ 
          title: "删除成功", 
          description: `已成功删除 ${data.deleted_logistics_count || 0} 条运单记录和 ${data.deleted_costs_count || 0} 条成本记录`, 
          variant: "default" 
        });
        
        // 重置状态
        setSelectedProject('');
        setDateRange(undefined);
        setPreviewCount(null);
        setPreviewData(null);
        setCurrentPage(1);
        setDeleteResult(null);
        setShowPreviewDialog(false);

        // 调用成功回调
        if (onDeleteSuccess) {
          onDeleteSuccess();
        }
      } else {
        throw new Error(data?.error || '删除失败');
      }
    } catch (error: unknown) {
      console.error('删除运单失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast({ 
        title: "删除失败", 
        description: "删除运单时发生错误: " + errorMessage, 
        variant: "destructive" 
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            删除运单
          </CardTitle>
          <CardDescription>
            根据项目和日期范围筛选并删除符合条件的运单记录
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 警告提示 */}
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">危险操作警告</AlertTitle>
            <AlertDescription className="text-red-700">
              删除操作将永久移除符合条件的运单记录及其相关的成本记录。此操作不可撤销，请谨慎操作！
            </AlertDescription>
          </Alert>

          {/* 筛选条件 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="font-medium">筛选条件</span>
            </div>

            {/* 项目选择 */}
            <div className="space-y-2">
              <Label htmlFor="project-select">项目 <span className="text-red-500">*</span></Label>
              <Select value={selectedProject} onValueChange={(value) => {
                setSelectedProject(value);
                setPreviewCount(null);
                setDeleteResult(null);
                setPreviewData(null);
              }}>
                <SelectTrigger id="project-select" className="w-full">
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.name}>
                      <div className="flex items-center gap-2">
                        <span>{project.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {project.projectStatus || '进行中'}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 日期范围选择 */}
            <div className="space-y-2">
              <Label htmlFor="date-range">日期范围 <span className="text-red-500">*</span></Label>
              <DateRangePicker
                date={dateRange}
                setDate={(range) => {
                  setDateRange(range);
                  setPreviewCount(null);
                  setDeleteResult(null);
                  setPreviewData(null);
                }}
              />
              <p className="text-xs text-muted-foreground">
                选择装货日期范围，将删除该范围内的所有运单记录
              </p>
            </div>
          </div>

          {/* 删除结果 */}
          {deleteResult && (
            <Alert className="border-green-200 bg-green-50">
              <Info className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">删除完成</AlertTitle>
              <AlertDescription className="text-green-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>已删除运单记录：{deleteResult.deleted_logistics_count || 0} 条</li>
                  <li>已删除成本记录：{deleteResult.deleted_costs_count || 0} 条</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* 操作按钮 */}
          <div className="flex items-center gap-4">
            <Button
              onClick={() => previewDeleteCount(1)}
              disabled={!selectedProject || !dateRange?.from || !dateRange?.to || isChecking || isDeleting}
              variant="outline"
            >
              {isChecking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  检查中...
                </>
              ) : (
                <>
                  <Info className="h-4 w-4 mr-2" />
                  预览符合条件的运单
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 预览对话框 */}
      <Dialog open={showPreviewDialog} onOpenChange={(open) => {
        setShowPreviewDialog(open);
        if (!open) {
          // 关闭时重置预览数据
          setPreviewData(null);
          setCurrentPage(1);
        }
      }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600" />
              预览符合条件的运单
            </DialogTitle>
            <DialogDescription>
              共找到 {previewData?.totalCount || 0} 条符合条件的运单记录，请仔细核对后再删除
            </DialogDescription>
          </DialogHeader>
          
          {previewData && previewData.totalCount > 0 ? (
            <div className="space-y-4">
              {/* 筛选条件显示 */}
              <div className="p-3 bg-gray-50 rounded-md">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium">项目：</span>
                    <span>{selectedProject}</span>
                  </div>
                  <div>
                    <span className="font-medium">日期范围：</span>
                    <span>
                      {dateRange?.from && dateRange?.to
                        ? `${formatChinaDateString(dateRange.from)} 至 ${formatChinaDateString(dateRange.to)}`
                        : dateRange?.from
                        ? `>= ${formatChinaDateString(dateRange.from)}`
                        : dateRange?.to
                        ? `<= ${formatChinaDateString(dateRange.to)}`
                        : '未设置'
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* 运单列表表格 */}
              <div className="border rounded-md max-h-[60vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">运单号</TableHead>
                      <TableHead>司机姓名</TableHead>
                      <TableHead>车牌号</TableHead>
                      <TableHead>装货地点</TableHead>
                      <TableHead>卸货地点</TableHead>
                      <TableHead>装货日期</TableHead>
                      <TableHead>装货数量</TableHead>
                      <TableHead className="text-right">运费金额</TableHead>
                      <TableHead className="text-right">额外费用</TableHead>
                      <TableHead className="text-right">应收合计</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.waybills.map((waybill) => (
                      <TableRow key={waybill.id}>
                        <TableCell className="font-mono text-xs">
                          {waybill.auto_number}
                        </TableCell>
                        <TableCell>{waybill.driver_name}</TableCell>
                        <TableCell>{waybill.license_plate}</TableCell>
                        <TableCell className="max-w-[150px] truncate" title={waybill.loading_location}>
                          {waybill.loading_location}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate" title={waybill.unloading_location}>
                          {waybill.unloading_location}
                        </TableCell>
                        <TableCell>
                          {waybill.loading_date 
                            ? (() => {
                                try {
                                  const date = new Date(waybill.loading_date);
                                  return date.toLocaleDateString('zh-CN', { 
                                    year: 'numeric', 
                                    month: '2-digit', 
                                    day: '2-digit' 
                                  });
                                } catch {
                                  return waybill.loading_date;
                                }
                              })()
                            : '-'
                          }
                        </TableCell>
                        <TableCell>
                          {waybill.loading_weight !== null && waybill.loading_weight !== undefined
                            ? waybill.loading_weight
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          {waybill.current_cost !== null && waybill.current_cost !== undefined
                            ? `¥${waybill.current_cost.toFixed(2)}`
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          {waybill.extra_cost !== null && waybill.extra_cost !== undefined
                            ? `¥${waybill.extra_cost.toFixed(2)}`
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {waybill.payable_cost !== null && waybill.payable_cost !== undefined
                            ? `¥${waybill.payable_cost.toFixed(2)}`
                            : '-'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 分页控件 */}
              {previewData.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    显示第 {((previewData.currentPage - 1) * pageSize) + 1} - {Math.min(previewData.currentPage * pageSize, previewData.totalCount)} 条，共 {previewData.totalCount} 条
                  </div>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => handlePageChange(previewData.currentPage - 1)}
                          className={previewData.currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(5, previewData.totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (previewData.totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (previewData.currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (previewData.currentPage >= previewData.totalPages - 2) {
                          pageNum = previewData.totalPages - 4 + i;
                        } else {
                          pageNum = previewData.currentPage - 2 + i;
                        }
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              onClick={() => handlePageChange(pageNum)}
                              isActive={previewData.currentPage === pageNum}
                              className="cursor-pointer"
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => handlePageChange(previewData.currentPage + 1)}
                          className={previewData.currentPage >= previewData.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}

              {/* 警告提示 */}
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-800">危险操作警告</AlertTitle>
                <AlertDescription className="text-red-700">
                  删除操作将永久移除这 {previewData.totalCount} 条运单记录及其相关的成本记录。此操作不可撤销！
                </AlertDescription>
              </Alert>
            </div>
          ) : previewData && previewData.totalCount === 0 ? (
            <Alert className="border-blue-200 bg-blue-50">
              <Info className="h-4 w-4" />
              <AlertTitle>未找到符合条件的运单记录</AlertTitle>
              <AlertDescription>
                根据您设置的筛选条件，没有找到任何运单记录。
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPreviewDialog(false)}
              disabled={isDeleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting || !previewData || (previewData?.totalCount || 0) === 0}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  删除中...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  确认删除 ({previewData?.totalCount || 0} 条)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 确认删除对话框 */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              确认删除
            </DialogTitle>
            <DialogDescription>
              您确定要删除以下条件的运单记录吗？
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p className="font-medium">项目：{selectedProject}</p>
              <p className="text-sm text-muted-foreground">
                日期范围：
                {dateRange?.from && dateRange?.to
                  ? `${formatChinaDateString(dateRange.from)} 至 ${formatChinaDateString(dateRange.to)}`
                  : dateRange?.from
                  ? `>= ${formatChinaDateString(dateRange.from)}`
                  : dateRange?.to
                  ? `<= ${formatChinaDateString(dateRange.to)}`
                  : '未设置'
                }
              </p>
              <p className="text-sm text-red-600 font-medium">
                将删除约 {previewCount} 条运单记录及其相关成本记录
              </p>
            </div>
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">
                此操作不可撤销！请确认您要删除的数据是正确的。
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isDeleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  删除中...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  确认删除
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

