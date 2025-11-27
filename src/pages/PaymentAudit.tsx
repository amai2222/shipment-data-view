// 文件路径: src/pages/PaymentAudit.tsx
// 版本: z8A8C-FINAL-BULK-ACTION-RESTORATION
// 描述: [最终生产级批量操作修复] 此代码最终、决定性地、无可辩驳地
//       在正确的页面上实现了安全的、支持跨页选择的批量作废功能。
//       通过引入选择状态管理、复选框UI和调用批量RPC，完成了您最终的架构构想，
//       并修复了之前因传输失败导致的灾难性代码截断问题。

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import type { MouseEvent } from 'react';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShipperProjectCascadeFilter } from '@/components/ShipperProjectCascadeFilter';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, FileSpreadsheet, Trash2, ClipboardList, FileText, Banknote, RotateCcw, Users, Merge, Undo2, Copy } from 'lucide-react';
// ✅ 导入可复用组件
import {
  PaginationControl,
  StatusBadge,
  PAYMENT_REQUEST_STATUS_CONFIG,
  TableSkeleton
} from '@/components/common';

import { PaymentApproval } from '@/components/PaymentApproval';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
// ✅ 修改：移除日期转换函数，直接传递中国时区日期字符串给后端
import { convertUTCDateStringToChinaDateString } from '@/utils/dateRangeUtils';
import { addDays } from 'date-fns';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, X, Building2, Search } from 'lucide-react';
import { zhCN } from 'date-fns/locale';
import { BatchInputDialog } from '@/pages/BusinessEntry/components/BatchInputDialog';
import { WaybillDetailDialog } from '@/components/WaybillDetailDialog';
import { LogisticsRecord, PlatformTracking } from '@/types';
import { RouteDisplay } from '@/components/RouteDisplay';
import { formatQuantityByBillingType } from '@/utils/formatters';

// --- 类型定义 ---
interface PaymentRequest {
  id: string;
  created_at: string;
  request_id: string;
  status: 'Pending' | 'Approved' | 'Paid' | 'Rejected' | 'Cancelled' | 'Merged';
  notes: string | null;
  logistics_record_ids: string[];
  record_count: number;
  max_amount?: number; // 申请金额（最高金额）
  total_driver_freight?: number; // 司机运费合计
  total_partner_amount?: number; // 货主金额合计
  project_names?: string; // 项目列表（多个项目用逗号分隔，或显示"项目1等N个"）
  loading_date_range?: string; // 装货日期范围（如"2025-11-01 至 2025-11-17"）
  is_merged_request?: boolean; // 是否为合并申请单
  merged_count?: number; // 合并的申请单数量
}

// 从RPC函数返回的原始数据类型
interface PaymentRequestRaw {
  id: string;
  created_at: string;
  request_id: string;
  status: string;
  notes: string | null;
  logistics_record_ids: string[];
  record_count: number;
  max_amount?: number;
  total_count?: number; // 用于分页
}

// RPC函数返回值类型
interface VoidAndDeletePaymentRequestsResult {
  success: boolean;
  message?: string;
  deleted_requests?: number;
  affected_logistics_records?: number;
  skipped_paid?: number;
}

interface BatchRollbackApprovalResult {
  success: boolean;
  message?: string;
  rollback_count?: number;
  failed_count?: number;
  not_approved_count?: number;
  failed_requests?: string[];
}

interface LogisticsRecordDetail { id: string; auto_number: string; driver_name: string; license_plate: string; loading_location: string; unloading_location: string; loading_date: string; loading_weight: number | null; payable_amount: number | null; }
interface PartnerTotal { partner_id: string; partner_name: string; total_amount: number; level: number; }
interface SelectionState { mode: 'none' | 'all_filtered'; selectedIds: Set<string>; }

export default function PaymentAudit() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { hasButtonAccess, loading: permissionsLoading, isAdmin } = useUnifiedPermissions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [modalRecords, setModalRecords] = useState<LogisticsRecordDetail[]>([]);
  const [modalContentLoading, setModalContentLoading] = useState(false);
  const [partnerTotals, setPartnerTotals] = useState<PartnerTotal[]>([]);
  const [waybillDetailOpen, setWaybillDetailOpen] = useState(false);
  const [selectedWaybillRecord, setSelectedWaybillRecord] = useState<LogisticsRecord | null>(null);
  const [totalDriverPayable, setTotalDriverPayable] = useState<number>(0);
  const [totalPartnerAmount, setTotalPartnerAmount] = useState<number>(0);
  const [selection, setSelection] = useState<SelectionState>({ mode: 'none', selectedIds: new Set() });
  const [isCancelling, setIsCancelling] = useState(false);
  const [totalRequestsCount, setTotalRequestsCount] = useState(0);
  
  // 批量操作状态
  const [isBatchOperating, setIsBatchOperating] = useState(false);
  const [batchOperation, setBatchOperation] = useState<'approve' | 'pay' | null>(null);
  
  // 合并和取消合并状态
  const [isMerging, setIsMerging] = useState(false);
  const [isUnmerging, setIsUnmerging] = useState(false);
  
  // 批量输入对话框状态
  const [batchInputDialog, setBatchInputDialog] = useState<{
    isOpen: boolean;
    type: 'requestId' | 'waybillNumber' | 'driverName' | 'licensePlate' | 'phoneNumber' | null;
  }>({ isOpen: false, type: null });
  
  // 筛选器状态
  const [filters, setFilters] = useState({
    requestId: '',
    waybillNumber: '',
    driverName: '',
    loadingDate: null as Date | null,
    status: 'Pending', // 默认筛选"待审核"
    projectId: '',
    partnerName: '',
    licensePlate: '',
    phoneNumber: '',
    platformName: ''
  });
  const [showFilters, setShowFilters] = useState(true);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedShipperId, setSelectedShipperId] = useState('all');
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [availableProjects, setAvailableProjects] = useState<Array<{id: string, name: string}>>([]); // ✅ 当前货主对应的项目列表
  
  // 筛选器处理函数
  const handleFilterChange = useCallback((key: string, value: string | Date | null) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);
  
  // ✅ 当项目列表加载完成且选择了货主时，自动设置 projectId
  useEffect(() => {
    // 如果选择了货主（非"全部货主"）且项目列表已加载，自动设置 projectId
    if (selectedShipperId && selectedShipperId !== 'all' && availableProjects.length > 0) {
      // 如果当前选择的是"所有项目"，需要特殊处理
      // 注意：这些页面使用 projectId，对于"所有项目"的情况，我们保持空字符串
      // 但需要确保 filters.projectId 与 selectedProjectId 同步
      if (selectedProjectId === 'all' && filters.projectId !== '') {
        // 保持空字符串，表示该货主的所有项目（后端会处理）
        handleFilterChange('projectId', '');
      }
    } else if (selectedShipperId === 'all' || availableProjects.length === 0) {
      // 如果选择的是"全部货主"或没有项目，清空 projectId
      if (filters.projectId !== '') {
        handleFilterChange('projectId', '');
      }
    }
  }, [availableProjects, selectedShipperId, selectedProjectId, filters.projectId, handleFilterChange]);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [jumpToPage, setJumpToPage] = useState('');
  
  // 项目列表状态
  const [projects, setProjects] = useState<Array<{id: string, name: string}>>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  
  // 平台选项状态
  const [platformOptions, setPlatformOptions] = useState<Array<{platform_name: string, usage_count: number}>>([]);

  const fetchPaymentRequests = useCallback(async () => {
    setLoading(true);
    try {
      // ✅ 修改：直接传递中国时区日期字符串，后端函数会处理时区转换
      // ✅ 修改：支持多个 project_id（逗号分隔）
      let projectIdParam: string | null = null;
      
      // ✅ 如果只选择了项目（没有选择货主），直接使用项目ID
      if (selectedProjectId && selectedProjectId !== 'all' && (!selectedShipperId || selectedShipperId === 'all')) {
        projectIdParam = selectedProjectId;
      }
      // ✅ 如果选择了货主
      else if (selectedShipperId && selectedShipperId !== 'all') {
        if (selectedProjectId === 'all' && availableProjects.length > 0) {
          // 选择"所有项目"时，传递所有可用项目的ID（逗号分隔）
          projectIdParam = availableProjects.map(p => p.id).join(',');
        } else if (selectedProjectId && selectedProjectId !== 'all') {
          // 选择具体项目时，传递该项目ID
          projectIdParam = selectedProjectId;
        }
      }
      
      const { data, error } = await supabase.rpc('get_payment_requests_filtered_1120', {
        p_request_id: filters.requestId || null,
        p_waybill_number: filters.waybillNumber || null,
        p_driver_name: filters.driverName || null,
        p_loading_date: filters.loadingDate ? format(filters.loadingDate, 'yyyy-MM-dd') : null,
        p_status: filters.status || null,
        p_project_id: projectIdParam,
        p_limit: pageSize,
        p_offset: (currentPage - 1) * pageSize
      });

      if (error) throw error;
      
      // 处理返回的数据
      const requestsData = (data as PaymentRequestRaw[]) || [];
      
      // ✅ 优化：先计算所有状态，再一次性更新
      let totalCount = 0;
      let totalPagesCount = 0;
      
      if (requestsData.length > 0) {
        totalCount = requestsData[0].total_count || 0;
        totalPagesCount = Math.ceil(totalCount / pageSize);
      }
      
      // 并行获取每个申请单的详细数据以计算合计
      const requestsWithTotals = await Promise.all(
        requestsData.map(async (item) => {
          try {
            // 获取申请单的详细数据
            const { data: detailData } = await supabase.rpc('get_payment_request_data_v2_1124', {
              p_record_ids: item.logistics_record_ids
            });
            
            if (detailData && (detailData as { records?: unknown[] }).records) {
              const records = (detailData as { records?: unknown[] }).records || [];
              let totalDriverFreight = 0;
              let totalPartnerAmount = 0;
              
              // 收集项目名称和装货日期
              const projectNamesSet = new Set<string>();
              const loadingDates: string[] = [];
              
              records.forEach((rec: unknown) => {
                const recData = rec as { 
                  payable_cost?: number;
                  partner_costs?: Array<{ level?: number; payable_amount?: number }>;
                  project_name?: string;
                  loading_date?: string;
                };
                
                // 司机运费 = payable_cost
                totalDriverFreight += Number(recData.payable_cost || 0);
                
                // 货主金额 = 最高级合作方的应收金额
                if (recData.partner_costs && recData.partner_costs.length > 0) {
                  const maxLevel = Math.max(...recData.partner_costs.map(c => c.level || 0));
                  const highestPartner = recData.partner_costs.find(c => c.level === maxLevel);
                  if (highestPartner) {
                    totalPartnerAmount += Number(highestPartner.payable_amount || 0);
                  }
                }
                
                // 收集项目名称
                if (recData.project_name) {
                  projectNamesSet.add(recData.project_name);
                }
                
                // 收集装货日期（数据库返回的是UTC时间，需要转换为中国时区）
                if (recData.loading_date) {
                  try {
                    // 数据库返回的是UTC时间字符串（timestamptz），提取日期部分
                    let dateStr: string;
                    if (typeof recData.loading_date === 'string') {
                      // 提取日期部分（YYYY-MM-DD）
                      dateStr = recData.loading_date.split('T')[0];
                    } else {
                      // 如果是Date对象，转换为ISO字符串并提取日期部分
                      dateStr = new Date(recData.loading_date).toISOString().split('T')[0];
                    }
                    
                    if (dateStr) {
                      // 使用与开票审核相同的转换函数，将UTC日期转换为中国时区日期
                      const chinaDateStr: string = convertUTCDateStringToChinaDateString(dateStr);
                      if (chinaDateStr) {
                        loadingDates.push(chinaDateStr);
                      }
                    }
                  } catch (error) {
                    console.warn('日期解析失败:', recData.loading_date, error);
                  }
                }
              });
              
              // 计算项目显示文本
              const projectNames = Array.from(projectNamesSet);
              let projectDisplay = '-';
              if (projectNames.length > 0) {
                if (projectNames.length === 1) {
                  projectDisplay = projectNames[0];
                } else {
                  projectDisplay = `${projectNames[0]}等${projectNames.length}个`;
                }
              }
              
              // 计算装货日期范围（使用与开票审核相同的逻辑，日期+1天）
              let dateRangeDisplay = '-';
              if (loadingDates.length > 0) {
                // 去重并排序日期字符串
                const uniqueDates = Array.from(new Set(loadingDates)).sort();
                const earliest = uniqueDates[0];
                const latest = uniqueDates[uniqueDates.length - 1];
                
                // ✅ 将日期加1天（与开票审核逻辑一致）
                const earliestDateObj = new Date(earliest + 'T00:00:00+08:00');
                const latestDateObj = new Date(latest + 'T00:00:00+08:00');
                const adjustedEarliest = format(addDays(earliestDateObj, 1), 'yyyy-MM-dd');
                const adjustedLatest = format(addDays(latestDateObj, 1), 'yyyy-MM-dd');
                
                if (adjustedEarliest === adjustedLatest) {
                  dateRangeDisplay = adjustedEarliest;
                } else {
                  dateRangeDisplay = `${adjustedEarliest} 至 ${adjustedLatest}`;
                }
              }
              
              return {
                id: item.id,
                created_at: item.created_at,
                request_id: item.request_id,
                status: item.status as PaymentRequest['status'],
                notes: item.notes,
                logistics_record_ids: item.logistics_record_ids,
                record_count: item.record_count,
                total_driver_freight: totalDriverFreight,
                total_partner_amount: totalPartnerAmount,
                project_names: projectDisplay,
                loading_date_range: dateRangeDisplay
              };
            }
          } catch (error) {
            console.error(`获取申请单 ${item.request_id} 详细数据失败:`, error);
          }
          
          // 如果获取失败，返回基本数据
          return {
            id: item.id,
            created_at: item.created_at,
            request_id: item.request_id,
            status: item.status as PaymentRequest['status'],
            notes: item.notes,
            logistics_record_ids: item.logistics_record_ids,
            record_count: item.record_count,
            total_driver_freight: undefined,
            total_partner_amount: undefined,
            project_names: undefined,
            loading_date_range: undefined
          };
        })
      );
      
      // ✅ 优化：批量更新所有状态，减少重新渲染次数
      setRequests(requestsWithTotals);
      setTotalRequestsCount(totalCount);
      setTotalPages(totalPagesCount);
    } catch (error) {
      console.error("加载付款申请列表失败:", error);
      toast({ title: "错误", description: `加载付款申请列表失败: ${(error as Error).message}`, variant: "destructive" });
      // 错误时重置状态
      setRequests([]);
      setTotalRequestsCount(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [toast, filters, currentPage, pageSize, selectedShipperId, selectedProjectId, availableProjects]);

  // ✅ 优化：避免 availableProjects 变化时重复加载，直接调用函数而不使用 fetchPaymentRequests 依赖
  useEffect(() => { 
    fetchPaymentRequests(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, currentPage, pageSize, selectedShipperId, selectedProjectId]);

  // 移除自动搜索，改为手动搜索
  // useEffect(() => {
  //   const timeoutId = setTimeout(() => {
  //     fetchPaymentRequests();
  //   }, 500); // 500ms延迟，避免频繁请求

  //   return () => clearTimeout(timeoutId);
  // }, [filters, fetchPaymentRequests]);

  // 获取项目列表和平台选项
  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) throw error;
      setProjects(data || []);
      
      // 加载动态平台选项
      const { data: platformsData } = await supabase.rpc('get_all_used_platforms');
      if (platformsData) {
        const fixedPlatforms = ['本平台', '中科智运', '中工智云', '可乐公司', '盼盼集团'];
        const dynamicPlatforms = (platformsData as {platform_name: string; usage_count: number}[]).filter(
          p => !fixedPlatforms.includes(p.platform_name)
        );
        setPlatformOptions(dynamicPlatforms);
      }
    } catch (error) {
      console.error('获取项目列表失败:', error);
      toast({ title: "错误", description: "获取项目列表失败", variant: "destructive" });
    } finally {
      setLoadingProjects(false);
    }
  }, [toast]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const clearFilters = () => {
    setFilters({
      requestId: '',
      waybillNumber: '',
      driverName: '',
      loadingDate: null,
      status: '',
      projectId: '',
      partnerName: '',
      licensePlate: '',
      phoneNumber: '',
      platformName: ''
    });
    setCurrentPage(1);
    // 清除筛选后自动搜索
    fetchPaymentRequests();
  };

  const hasActiveFilters = filters.requestId || filters.waybillNumber || filters.driverName || filters.loadingDate || filters.status || filters.projectId || filters.partnerName || filters.licensePlate || filters.phoneNumber || filters.platformName;

  // 批量输入对话框处理函数
  const openBatchInputDialog = (type: 'requestId' | 'waybillNumber' | 'driverName' | 'licensePlate' | 'phoneNumber') => {
    setBatchInputDialog({ isOpen: true, type });
  };
  
  const closeBatchInputDialog = () => {
    setBatchInputDialog({ isOpen: false, type: null });
  };
  
  const handleBatchInputConfirm = (value: string) => {
    const type = batchInputDialog.type;
    if (type) {
      handleFilterChange(type, value);
    }
    closeBatchInputDialog();
  };
  
  const getCurrentBatchValue = () => {
    const type = batchInputDialog.type;
    if (!type) return '';
    return filters[type]?.toString() || '';
  };
  
  const getBatchInputConfig = () => {
    const type = batchInputDialog.type;
    const configs = {
      requestId: { title: '批量输入申请单号', placeholder: '每行一个申请单号，或用逗号分隔', description: '支持多行输入或用逗号分隔' },
      waybillNumber: { title: '批量输入运单编号', placeholder: '每行一个运单编号，或用逗号分隔', description: '支持多行输入或用逗号分隔' },
      driverName: { title: '批量输入司机姓名', placeholder: '每行一个司机姓名，或用逗号分隔', description: '支持多行输入或用逗号分隔' },
      licensePlate: { title: '批量输入车牌号', placeholder: '每行一个车牌号，或用逗号分隔', description: '支持多行输入或用逗号分隔' },
      phoneNumber: { title: '批量输入电话号码', placeholder: '每行一个电话号码，或用逗号分隔', description: '支持多行输入或用逗号分隔' }
    };
    return type ? configs[type] : configs.requestId;
  };

  // 批量操作处理函数
  /**
   * 合并付款申请
   */
  const handleMergePayments = async () => {
    if (selection.selectedIds.size < 2) {
      toast({ title: '请选择至少2个申请单', variant: 'destructive' });
      return;
    }

    const selectedRequests = requests.filter(r => selection.selectedIds.has(r.id));
    
    const allPending = selectedRequests.every(r => r.status === 'Pending');
    if (!allPending) {
      toast({ title: '只能合并待审核状态的申请单', variant: 'destructive' });
      return;
    }

    setIsMerging(true);
    try {
      const requestIds = selectedRequests.map(r => r.request_id);
      
      const { data, error } = await supabase.rpc('merge_payment_requests', {
        p_request_ids: requestIds
      });
      
      if (error) throw error;
      
      if (!data.success) {
        toast({ title: '合并失败', description: data.message, variant: 'destructive' });
        return;
      }
      
      toast({ 
        title: '合并成功', 
        description: `已生成新申请单：${data.new_request_id}，包含${data.waybill_count}条运单`
      });
      
      setSelection({ mode: 'none', selectedIds: new Set() });
      fetchPaymentRequests();
      
    } catch (error) {
      toast({ title: '合并失败', description: error instanceof Error ? error.message : '合并失败', variant: 'destructive' });
    } finally {
      setIsMerging(false);
    }
  };

  /**
   * 取消合并付款申请
   */
  const handleUnmergePayment = async (request: PaymentRequest) => {
    if (!request.is_merged_request) {
      toast({ title: '此申请单不是合并申请单', variant: 'destructive' });
      return;
    }
    
    if (request.status !== 'Pending') {
      toast({ title: '只能取消待审核状态的合并申请单', variant: 'destructive' });
      return;
    }
    
    const confirmed = window.confirm(
      `确定要取消合并申请单 ${request.request_id} 吗？\n\n` +
      `此操作将恢复 ${request.merged_count} 个原申请单，删除当前合并申请单。`
    );
    
    if (!confirmed) return;
    
    setIsUnmerging(true);
    try {
      const { data, error } = await supabase.rpc('unmerge_payment_request', {
        p_merged_request_id: request.request_id
      });
      
      if (error) throw error;
      
      if (!data.success) {
        toast({ title: '取消合并失败', description: data.message, variant: 'destructive' });
        return;
      }
      
      toast({ 
        title: '取消合并成功', 
        description: `已恢复 ${data.restored_count} 个原申请单`
      });
      
      fetchPaymentRequests();
      
    } catch (error) {
      toast({ title: '取消合并失败', description: error instanceof Error ? error.message : '取消合并失败', variant: 'destructive' });
    } finally {
      setIsUnmerging(false);
    }
  };

  const handleBatchApprove = async () => {
    if (selection.selectedIds.size === 0) {
      toast({ title: "提示", description: "请先选择要审批的申请单", variant: "destructive" });
      return;
    }

    setIsBatchOperating(true);
    setBatchOperation('approve');
    
    try {
      const selectedRequestIds = Array.from(selection.selectedIds);
      const { data, error } = await supabase.rpc('batch_approve_payment_requests_1126', {
        p_request_ids: selectedRequestIds
      });

      if (error) throw error;

      const result = data as { message: string; failed_count: number };
      toast({ 
        title: "批量审批完成", 
        description: result.message,
        variant: result.failed_count > 0 ? "destructive" : "default"
      });

      // 清除选择并刷新数据
      setSelection({ mode: 'none', selectedIds: new Set() });
      fetchPaymentRequests();
    } catch (error) {
      console.error('批量审批失败:', error);
      toast({ title: "批量审批失败", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsBatchOperating(false);
      setBatchOperation(null);
    }
  };

  // 批量付款功能已移除

  const handleRollbackApproval = async (requestId: string) => {
    // 权限检查
    if (!hasButtonAccess('finance.rollback_payment_approval')) {
      toast({ 
        title: '权限不足', 
        description: '您没有回滚付款审批的权限。请联系管理员在权限管理中分配 "finance.rollback_payment_approval" 权限。', 
        variant: 'destructive' 
      });
      return;
    }

    try {
      setExportingId(requestId);
      const { data, error } = await supabase.rpc('rollback_payment_request_approval_1126', {
        p_request_id: requestId
      });

      if (error) throw error;

      toast({ title: "审批回滚成功", description: "申请单已回滚为待审批状态" });
      fetchPaymentRequests();
    } catch (error) {
      console.error('审批回滚失败:', error);
      toast({ title: "审批回滚失败", description: (error as Error).message, variant: "destructive" });
    } finally {
      setExportingId(null);
    }
  };

  // 批量取消审批（回滚到待审批状态）- 使用批量函数优化
  const handleBatchRollbackApproval = async () => {
    // 权限检查
    if (!hasButtonAccess('finance.rollback_payment_approval')) {
      toast({ 
        title: '权限不足', 
        description: '您没有批量回滚付款审批的权限。请联系管理员在权限管理中分配 "finance.rollback_payment_approval" 权限。', 
        variant: 'destructive' 
      });
      return;
    }

    if (selection.selectedIds.size === 0) return;
    
    setIsBatchOperating(true);
    try {
      const selectedIds = Array.from(selection.selectedIds);
      const selectedReqs = requests.filter(r => selectedIds.includes(r.id));
      
      if (selectedReqs.length === 0) {
        toast({ title: "提示", description: "没有选择任何申请单。" });
        setIsBatchOperating(false);
        return;
      }

      // 调用批量取消审批RPC函数（性能优化）
      const requestIds = selectedReqs.map(r => r.request_id);
      const { data, error } = await supabase.rpc('batch_rollback_payment_approval_1126', {
        p_request_ids: requestIds
          });
          
      if (error) throw error;

      const result = data as BatchRollbackApprovalResult;
      
      // 构建详细的提示信息
      let description = `成功回滚 ${result.rollback_count || 0} 个付款申请`;
      if (result.not_approved_count && result.not_approved_count > 0) {
        description += `，跳过 ${result.not_approved_count} 个非已审批状态的申请单`;
          }
      if (result.failed_count && result.failed_count > 0) {
        description += `，失败 ${result.failed_count} 个`;
      }

      toast({ 
        title: "批量取消审批完成", 
        description: description,
        variant: result.failed_count && result.failed_count > 0 ? "destructive" : "default"
      });
      
      setSelection({ mode: 'none', selectedIds: new Set() });
      fetchPaymentRequests();
    } catch (error) {
      console.error('批量取消审批失败:', error);
      toast({ 
        title: "批量取消审批失败", 
        description: error instanceof Error ? error.message : '无法批量取消审批', 
        variant: "destructive" 
      });
    } finally {
      setIsBatchOperating(false);
    }
  };

  // 分页处理函数
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // 重置到第一页
  };

  const handleJumpToPage = () => {
    const page = parseInt(jumpToPage);
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      setJumpToPage('');
    } else {
      toast({ title: "错误", description: `请输入1到${totalPages}之间的页码`, variant: "destructive" });
    }
  };

  // 生成页码数组
  const generatePageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const start = Math.max(1, currentPage - 2);
      const end = Math.min(totalPages, start + maxVisiblePages - 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  // ✅ 已删除getStatusBadge函数（使用StatusBadge组件替代）

  // 导出功能已移除

  const handleGeneratePDF = async (e: MouseEvent<HTMLButtonElement>, req: PaymentRequest) => {
    e.stopPropagation();
    try {
      setExportingId(req.id);
      
      // 使用Excel导出功能的数据结构 - 确保与Excel完全一致
      const { data: excelData, error } = await supabase.rpc('get_payment_request_data_v2_1124', {
        p_record_ids: req.logistics_record_ids
      });

      if (error) throw error;

      // 生成PDF HTML内容 - 使用与Excel导出完全相同的逻辑
      const generatePaymentRequestPDF = async (requestData: unknown): Promise<string> => {
        if (!requestData) {
          throw new Error('付款申请单数据不能为空');
        }

        const records: unknown[] = Array.isArray((requestData as { records?: unknown[] })?.records) ? (requestData as { records: unknown[] }).records : [];

        // ✅ 先获取项目合作方信息，用于确定上下级关系
        const { data: projectsData } = await supabase.from('projects').select('id, name');
        const { data: projectPartnersData } = await supabase.from('project_partners').select(`
          project_id,
          partner_id,
          level,
          partner_chains!inner(chain_name)
        `);
        const { data: partnersData } = await supabase.from('partners').select('id, name, full_name');
        
        const projectsByName = new Map((projectsData || []).map(p => [p.name, p.id]));
        const partnersById = new Map((partnersData || []).map(p => [p.id, p]));
        const projectPartnersByProjectId = (projectPartnersData || []).reduce((acc, pp) => {
          if (!acc.has(pp.project_id)) acc.set(pp.project_id, []);
          acc.get(pp.project_id).push({
            ...pp,
            chain_name: pp.partner_chains?.chain_name
          });
          return acc;
        }, new Map());

        // ✅ 修复：按每个运单单独判断最高级，只包含低层级合作方，并按上下级关系分组
        const sheetMap = new Map<string, unknown>();
        for (const rec of records) {
          const costs = Array.isArray((rec as { partner_costs?: unknown[] }).partner_costs) ? (rec as { partner_costs: unknown[] }).partner_costs : [];
          
          // 计算该运单的最高层级
          const recMaxLevel = costs.length > 0 
            ? Math.max(...costs.map(c => (c as { level: number }).level)) 
            : 0;
          
          const recData = rec as { id: string; project_name: string; chain_id?: string; chain_name?: string };
          
          // ✅ 关键验证：获取该运单所属链路的合作方配置，用于验证
          const projectName = recData.project_name;
          const projectId = projectsByName.get(projectName);
          const allPartnersInProject = projectId ? projectPartnersByProjectId.get(projectId) || [] : [];
          const partnersInChain = recData.chain_name 
            ? allPartnersInProject.filter((p) => p.chain_name === recData.chain_name)
            : [];
          
          // 只包含低于该运单最高级的合作方（特殊情况：只有1个合作方时也包含）
          for (const cost of costs) {
            const costData = cost as { partner_id: string; level: number; full_name?: string; partner_name?: string; bank_account?: string; bank_name?: string; branch_name?: string; payable_amount?: number };
            
            // ✅ 关键验证：确保合作方属于该运单的实际链路
            if (recData.chain_name && partnersInChain.length > 0) {
              const partnerInChain = partnersInChain.find((p) => p.partner_id === costData.partner_id);
              if (!partnerInChain) {
                // 合作方不属于该运单的链路，跳过（这不应该发生，因为数据库函数已经过滤了）
                // 静默跳过，避免控制台警告（数据已由数据库函数保证正确性）
                continue;
              }
            }
            
            // ✅ 规则1：如果只有1个合作方，必须包含
            // ✅ 规则2：如果有多个合作方，只包含低层级（排除最高级）
            const shouldInclude = costs.length === 1 || costData.level < recMaxLevel;
            
            if (!shouldInclude) {
              continue;  // 跳过该运单的最高级合作方（仅当有多个合作方时）
            }
            
            // ✅ 找到当前合作方的上级合作方（付款方）
            // 注意：层级判断只基于链路内的层级关系，与全局合作方层级无关
            let parentPartnerId: string | null = null;
            let parentPartnerName: string | null = null;
            if (projectId && recData.chain_name && partnersInChain.length > 0) {
              const currentPartnerInfo = partnersInChain.find((p) => p.partner_id === costData.partner_id);
              if (currentPartnerInfo && currentPartnerInfo.level !== undefined) {
                // ✅ 直接基于链路内的层级关系：查找 level + 1 的合作方作为上级
                // 不依赖全局最大值，只判断链路内是否存在更高一级的合作方
                const parentLevel = currentPartnerInfo.level + 1;
                const parentInfo = partnersInChain.find((p) => p.level === parentLevel);
                if (parentInfo) {
                  // 如果链路内存在更高一级的合作方，它就是上级（付款方）
                  parentPartnerId = parentInfo.partner_id;
                  // 获取上级合作方名称
                  const parentPartner = partnersById.get(parentInfo.partner_id);
                  if (parentPartner) {
                    const parentData = parentPartner as { full_name?: string; name?: string };
                    parentPartnerName = parentData.full_name || parentData.name || null;
                  }
                }
                // 如果链路内不存在更高一级的合作方，说明当前合作方是链路内的最高级，parentPartnerId 保持为 null
              }
            }
            
            // ✅ 按付款关系分组（付款方 -> 收款方）
            // 分组规则：
            // 1. 相同的付款方 + 收款方 + 链路 → 合并到同一个表单
            // 2. 不同的付款关系 → 生成独立的表单
            // 例如：多个运单都是"中科智运平台 → 冠县昇仓仓储"，会合并到一个表单
            const chainIdForKey = recData.chain_id || 'no-chain';
            // 分组key：付款方ID_收款方ID_链路ID
            // 相同key的运单会被合并到同一个表单中
            const key = `${parentPartnerId || 'none'}_${costData.partner_id}_${chainIdForKey}`;
            if (!sheetMap.has(key)) {
              // 创建新的表单组
              sheetMap.set(key, {
                paying_partner_id: costData.partner_id, // 收款方ID
                paying_partner_full_name: costData.full_name || costData.partner_name, // 收款方名称
                paying_partner_bank_account: costData.bank_account || '',
                paying_partner_bank_name: costData.bank_name || '',
                paying_partner_branch_name: costData.branch_name || '',
                parent_partner_id: parentPartnerId, // 付款方ID
                parent_partner_name: parentPartnerName, // 付款方名称
                record_count: 0,
                total_payable: 0,
                project_name: recData.project_name,
                chain_id: recData.chain_id,
                chain_name: recData.chain_name, // 使用当前运单的链路名称
                chain_names: new Set<string>(), // 收集所有链路名称（应该只有一个）
                records: [],
              });
            }
            // 将当前运单添加到对应的表单组中（如果该运单还未添加）
            const sheet = sheetMap.get(key) as { 
              records: unknown[]; 
              record_count: number; 
              total_payable: number;
              chain_names?: Set<string>;
            };
            // 收集链路名称（正常情况下，同一个sheet中的运单应该有相同的链路）
            if (recData.chain_name && sheet.chain_names) {
              sheet.chain_names.add(recData.chain_name);
            }
            // 检查该运单是否已经添加过（避免重复添加）
            if (!sheet.records.some((r: unknown) => (r as { record: { id: string } }).record.id === recData.id)) {
              sheet.record_count += 1;
            }
            // 添加运单记录到表单组
            sheet.records.push({ record: rec, payable_amount: costData.payable_amount });
            sheet.total_payable += Number(costData.payable_amount || 0);
          }
        }
        
        // ✅ 已在上面的循环中过滤掉最高级，这里只需要获取所有sheet
        const filteredSheets = Array.from(sheetMap.values());
        
        // 按合作方级别排序，级别高的在前面
        const sortedSheets = filteredSheets.sort((a, b) => {
          const aData = a as { project_name: string; paying_partner_id: string; chain_names?: Set<string> };
          const bData = b as { project_name: string; paying_partner_id: string; chain_names?: Set<string> };
          const projectNameA = aData.project_name;
          const projectNameB = bData.project_name;
          const projectIdA = projectsByName.get(projectNameA);
          const projectIdB = projectsByName.get(projectNameB);
          
          const allPartnersInProjectA = projectIdA ? projectPartnersByProjectId.get(projectIdA) || [] : [];
          const allPartnersInProjectB = projectIdB ? projectPartnersByProjectId.get(projectIdB) || [] : [];
          
          // ✅ 修复：由于同一合作方可能包含多个链路，直接在所有链路中查找合作方信息
          // 如果sheet有多个链路，使用第一个链路来过滤（用于排序）
          const chainNamesA = aData.chain_names ? Array.from(aData.chain_names) : [];
          const chainNamesB = bData.chain_names ? Array.from(bData.chain_names) : [];
          const firstChainA = chainNamesA.length > 0 ? chainNamesA[0] : null;
          const firstChainB = chainNamesB.length > 0 ? chainNamesB[0] : null;
          
          const partnersInChainA = firstChainA 
            ? allPartnersInProjectA.filter((p) => p.chain_name === firstChainA)
            : allPartnersInProjectA;
          const partnersInChainB = firstChainB 
            ? allPartnersInProjectB.filter((p) => p.chain_name === firstChainB)
            : allPartnersInProjectB;
          
          const currentPartnerInfoA = partnersInChainA.find((p) => p.partner_id === aData.paying_partner_id);
          const currentPartnerInfoB = partnersInChainB.find((p) => p.partner_id === bData.paying_partner_id);
          
          const levelA = currentPartnerInfoA?.level || 0;
          const levelB = currentPartnerInfoB?.level || 0;
          
          // 按级别降序排序（级别高的在前面）
          return levelB - levelA;
        });
        
        const sheetData = { sheets: sortedSheets };

        // 生成单个合作方的表格 - 完全按照Excel导出逻辑
        const generatePartnerTable = (sheet: unknown, index: number) => {
          const sheetData = sheet as { 
            records?: unknown[]; 
            paying_partner_full_name?: string; 
            paying_partner_name?: string; 
            paying_partner_bank_account?: string; 
            paying_partner_bank_name?: string; 
            paying_partner_branch_name?: string;
            project_name?: string;
            chain_name?: string;
            paying_partner_id?: string;
          };
          const sorted = (sheetData.records || []).slice().sort((a: unknown, b: unknown) => 
            String((a as { record: { auto_number?: string } }).record.auto_number || "").localeCompare(String((b as { record: { auto_number?: string } }).record.auto_number || ""))
          );
          
          const payingPartnerName = sheetData.paying_partner_full_name || sheetData.paying_partner_name || "";
          const bankAccount = sheetData.paying_partner_bank_account || "";
          const bankName = sheetData.paying_partner_bank_name || "";
          const branchName = sheetData.paying_partner_branch_name || "";
          
          // 生成PDF表格
          console.log(`生成第 ${index + 1} 个表格，合作方: ${payingPartnerName}`);
          console.log(`表头HTML:`, `
            <thead>
              <tr class="header-row">
                <th rowspan="2">货主单位</th>
                <th rowspan="2">序号</th>
                <th rowspan="2">实际出发时间</th>
                <th rowspan="2">实际到达时间</th>
                <th rowspan="2">起始地</th>
                <th rowspan="2">目的地</th>
                <th rowspan="2">货物</th>
                <th rowspan="2">司机</th>
                <th rowspan="2">司机电话</th>
                <th rowspan="2">车牌号</th>
                <th rowspan="2">吨位</th>
                <th rowspan="2">承运人运费</th>
                <th colspan="4">收款人信息</th>
              </tr>
              <tr class="sub-header-row">
                <th>收款人</th>
                <th>收款银行账号</th>
                <th>开户行名称</th>
                <th>支行网点</th>
              </tr>
            </thead>
          `);
          
          // ✅ 表单标题规则：使用付款方（上级合作方）名称 + "支付申请表"
          // 直接使用分组时已存储的 parent_partner_name，确保与分组逻辑一致
          const parentPartnerName = (sheetData as { parent_partner_name?: string }).parent_partner_name;
          // 如果有付款方名称，使用付款方名称；否则使用默认值
          const parentTitle = parentPartnerName || "中科智运(云南)供应链科技有限公司";
          
          return `
            <div class="partner-section">
              <!-- 每个表格的独立文档标题 - 与Excel导出逻辑一致 -->
              <div class="header">
                <div class="company-title">${parentTitle}支付申请表</div>
              </div>
              
              <!-- 合作方信息头部 - 与Excel导出逻辑一致 -->
              <div class="partner-header">
                <div class="partner-title">项目名称：${sheetData.project_name}</div>
                <div class="request-id">申请编号：${req.request_id}</div>
              </div>
              
              <table class="main-table">
                <thead style="display: table-header-group !important;">
                  <tr class="header-row" style="display: table-row !important;">
                    <th rowspan="2" style="display: table-cell !important; visibility: visible !important; background: transparent !important; border: 1px solid #000 !important; padding: 4px 6px !important; text-align: center !important; font-size: 11px !important; font-weight: bold !important;">序号</th>
                    <th rowspan="2" style="display: table-cell !important; visibility: visible !important; background: transparent !important; border: 1px solid #000 !important; padding: 4px 6px !important; text-align: center !important; font-size: 11px !important; font-weight: bold !important;">实际出发时间</th>
                    <th rowspan="2" style="display: table-cell !important; visibility: visible !important; background: transparent !important; border: 1px solid #000 !important; padding: 4px 6px !important; text-align: center !important; font-size: 11px !important; font-weight: bold !important;">实际到达时间</th>
                    <th rowspan="2" style="display: table-cell !important; visibility: visible !important; background: transparent !important; border: 1px solid #000 !important; padding: 4px 6px !important; text-align: center !important; font-size: 11px !important; font-weight: bold !important;">起始地</th>
                    <th rowspan="2" style="display: table-cell !important; visibility: visible !important; background: transparent !important; border: 1px solid #000 !important; padding: 4px 6px !important; text-align: center !important; font-size: 11px !important; font-weight: bold !important;">目的地</th>
                    <th rowspan="2" style="display: table-cell !important; visibility: visible !important; background: transparent !important; border: 1px solid #000 !important; padding: 4px 6px !important; text-align: center !important; font-size: 11px !important; font-weight: bold !important;">货物</th>
                    <th rowspan="2" style="display: table-cell !important; visibility: visible !important; background: transparent !important; border: 1px solid #000 !important; padding: 4px 6px !important; text-align: center !important; font-size: 11px !important; font-weight: bold !important;">司机</th>
                    <th rowspan="2" style="display: table-cell !important; visibility: visible !important; background: transparent !important; border: 1px solid #000 !important; padding: 4px 6px !important; text-align: center !important; font-size: 11px !important; font-weight: bold !important;">司机电话</th>
                    <th rowspan="2" style="display: table-cell !important; visibility: visible !important; background: transparent !important; border: 1px solid #000 !important; padding: 4px 6px !important; text-align: center !important; font-size: 11px !important; font-weight: bold !important;">车牌号</th>
                    <th rowspan="2" style="display: table-cell !important; visibility: visible !important; background: transparent !important; border: 1px solid #000 !important; padding: 4px 6px !important; text-align: center !important; font-size: 11px !important; font-weight: bold !important;" id="quantity-header">数量</th>
                    <th rowspan="2" style="display: table-cell !important; visibility: visible !important; background: transparent !important; border: 1px solid #000 !important; padding: 4px 6px !important; text-align: center !important; font-size: 11px !important; font-weight: bold !important;">司机运费</th>
                    <th rowspan="2" style="display: table-cell !important; visibility: visible !important; background: transparent !important; border: 1px solid #000 !important; padding: 4px 6px !important; text-align: center !important; font-size: 11px !important; font-weight: bold !important;">承运人运费</th>
                    <th colspan="4" style="display: table-cell !important; visibility: visible !important; background: transparent !important; border: 1px solid #000 !important; padding: 4px 6px !important; text-align: center !important; font-size: 11px !important; font-weight: bold !important;">收款人信息</th>
                  </tr>
                  <tr class="sub-header-row" style="display: table-row !important;">
                    <th style="display: table-cell !important; visibility: visible !important; background: transparent !important; border: 1px solid #000 !important; padding: 4px 6px !important; text-align: center !important; font-size: 11px !important; font-weight: bold !important;">收款人</th>
                    <th style="display: table-cell !important; visibility: visible !important; background: transparent !important; border: 1px solid #000 !important; padding: 4px 6px !important; text-align: center !important; font-size: 11px !important; font-weight: bold !important;">收款银行账号</th>
                    <th style="display: table-cell !important; visibility: visible !important; background: transparent !important; border: 1px solid #000 !important; padding: 4px 6px !important; text-align: center !important; font-size: 11px !important; font-weight: bold !important;">开户行名称</th>
                    <th style="display: table-cell !important; visibility: visible !important; background: transparent !important; border: 1px solid #000 !important; padding: 4px 6px !important; text-align: center !important; font-size: 11px !important; font-weight: bold !important;">支行网点</th>
                  </tr>
                </thead>
                <tbody>
                  ${sorted.map((item: unknown, index: number) => {
                    const itemData = item as { record: { unloading_date?: string; loading_date?: string; loading_location?: string; unloading_location?: string; cargo_type?: string; driver_name?: string; driver_phone?: string; license_plate?: string; loading_weight?: number; unloading_weight?: number; billing_type_id?: number; payable_cost?: number; payable_amount?: number }; payable_amount?: number };
                    const rec = itemData.record;
                    let finalUnloadingDate = rec.unloading_date;
                    if (!finalUnloadingDate) {
                      finalUnloadingDate = rec.loading_date;
                    }
                    // 根据billing_type_id格式化数量显示
                    const quantityDisplay = formatQuantityByBillingType(
                      rec.billing_type_id,
                      rec.loading_weight,
                      rec.unloading_weight
                    );
                    return `
                      <tr class="data-row">
                        <td class="serial-number">${index + 1}</td>
                        <td>${rec.loading_date || ''}</td>
                        <td>${finalUnloadingDate || ''}</td>
                        <td>${rec.loading_location || ''}</td>
                        <td>${rec.unloading_location || ''}</td>
                        <td>${rec.cargo_type || '普货'}</td>
                        <td>${rec.driver_name || ''}</td>
                        <td>${rec.driver_phone || ''}</td>
                        <td>${rec.license_plate || ''}</td>
                        <td>${quantityDisplay}</td>
                        <td class="amount-cell">${(rec.payable_cost || 0).toFixed(2)}</td>
                        <td class="amount-cell">${(itemData.payable_amount || 0).toFixed(2)}</td>
                        <td>${payingPartnerName}</td>
                        <td>${bankAccount}</td>
                        <td>${bankName}</td>
                        <td>${branchName}</td>
                      </tr>
                    `;
                  }).join('')}
                  <tr class="total-row">
                    <td colspan="10" class="remarks-label">备注：共${sorted.length}条运单</td>
                    <td class="total-amount">${(() => {
                      const total = sorted.reduce((sum: number, item: { record: { payable_cost?: number } }) => {
                        const cost = item.record.payable_cost;
                        return sum + (typeof cost === 'number' ? cost : 0);
                      }, 0);
                      return typeof total === 'number' ? total.toFixed(2) : '0.00';
                    })()}</td>
                    <td class="total-amount">${(() => {
                      const total = (sheetData as { total_payable?: number }).total_payable;
                      return typeof total === 'number' ? total.toFixed(2) : '0.00';
                    })()}</td>
                    <td colspan="4"></td>
                  </tr>
                </tbody>
              </table>
              
              <!-- 每个表格下方的签字区域 -->
              <div class="table-signature-section">
                <table class="signature-table">
                  <tr>
                    <td class="signature-cell">信息专员签字</td>
                    <td class="signature-cell">信息部审核签字</td>
                    <td class="signature-cell">业务负责人签字</td>
                    <td class="signature-cell">财务会计审核</td>
                    <td class="signature-cell">复核审批人签字</td>
                    <td class="signature-cell">总经理签字</td>
                    <td class="signature-cell">办公室领导复核</td>
                    <td class="signature-cell">董事长签字</td>
                  </tr>
                  <tr>
                    <td class="signature-space"></td>
                    <td class="signature-space"></td>
                    <td class="signature-space"></td>
                    <td class="signature-space"></td>
                    <td class="signature-space"></td>
                    <td class="signature-space"></td>
                    <td class="signature-space"></td>
                    <td class="signature-space"></td>
                  </tr>
                </table>
              </div>
            </div>
          `;
        };

        return `
          <!DOCTYPE html>
          <html lang="zh-CN">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>支付申请表 - ${req.request_id}</title>
            <style>
              @media print {
                @page { size: A4 landscape; margin: 5mm; }
                body { margin: 0; padding: 0; font-family: 'Microsoft YaHei', Arial, sans-serif; font-size: 10px; line-height: 1.0; color: #000; }
              }
              body { font-family: 'Microsoft YaHei', Arial, sans-serif; font-size: 12px; line-height: 1.2; color: #000; margin: 20mm 0 0 0; padding: 15px; background: white; }
              .header { text-align: center; margin-bottom: 20px; }
              .company-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
              .form-title { font-size: 16px; font-weight: bold; margin-bottom: 15px; }
              .form-info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; }
              .partner-section { margin-bottom: 40px; page-break-before: always; page-break-inside: avoid; }
              .partner-section:first-child { page-break-before: auto; }
              .partner-header { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 12px; font-weight: bold; }
              .partner-title { color: #333; }
              .request-id { color: #666; }
              .main-table { width: 100%; border-collapse: collapse; margin-bottom: 0; table-layout: auto; }
              .signature-table { width: 100%; table-layout: auto; }
              .main-table th { border: 1px solid #000; padding: 2px 4px; text-align: center; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
              .main-table td { border: 1px solid #000; padding: 2px 4px; text-align: center; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
              .main-table thead tr:last-child th { border-bottom: 1px solid #000; }
              .main-table tbody tr:first-child td { border-top: none !important; }
              .main-table tbody tr:first-child td:not(:first-child) { border-top: none !important; }
              .main-table tbody tr:first-child td { border-top: none !important; }
              .main-table th { background: transparent; font-weight: bold; display: table-cell; }
              .main-table .header-row th { background: transparent; font-weight: bold; display: table-cell; }
              .main-table .sub-header-row th { background: transparent; font-weight: bold; display: table-cell; }
              .main-table thead { display: table-header-group; }
              .main-table thead tr { display: table-row; }
              .main-table thead th { display: table-cell !important; visibility: visible !important; }
              .main-table thead { display: table-header-group !important; }
              .main-table thead tr { display: table-row !important; }
              .main-table thead th { display: table-cell !important; visibility: visible !important; opacity: 1 !important; height: auto !important; min-height: 20px !important; }
              .main-table .data-row td { text-align: left; }
              .main-table .data-row td:first-child { text-align: center; }
              .main-table .data-row td:nth-child(11), .main-table .data-row td:nth-child(12), .main-table .data-row td:nth-child(13), .main-table .data-row td:nth-child(14), .main-table .data-row td:nth-child(15), .main-table .data-row td:nth-child(16) { text-align: right; }
              .total-row { font-weight: bold; background: #f8f8f8; }
              .shipper-cell { background: #f9f9f9; font-weight: bold; vertical-align: middle; }
              .serial-number { text-align: center; }
              .amount-cell { text-align: right; }
              .total-label { text-align: center; font-weight: bold; }
              .total-amount { text-align: right; font-weight: bold; }
              .remarks-section { margin: 15px 0; }
              .remarks-label { font-weight: bold; margin-bottom: 5px; }
              .table-signature-section { margin-top: 0; margin-bottom: 0; padding-top: 0; }
              .signature-table { width: 100%; border-collapse: collapse; margin-top: 0; margin-bottom: 0; table-layout: fixed; }
              .signature-table td { border: 1px solid #000; padding: 4px; text-align: center; font-size: 10px; width: 12.5%; }
              .signature-table { border-collapse: collapse; }
              .signature-table tr:first-child td { border-top: none !important; }
              .signature-table .signature-cell { background: #f9f9f9; font-weight: bold; height: 30px; }
              .signature-table .signature-space { height: 80px; background: white; }
              .remarks-label { text-align: left !important; font-weight: bold; }
              .print-button { position: fixed; top: 20px; right: 20px; z-index: 1000; background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 12px; }
              .print-button:hover { background: #1d4ed8; }
              @media print { .print-button { display: none; } }
            </style>
          </head>
          <body>
            <button class="print-button" onclick="window.print()">🖨️ 打印申请表</button>
            

            ${sheetData.sheets.map((sheet: unknown, index: number) => 
              generatePartnerTable(sheet, index)
            ).join('')}

            <div class="remarks-section">
              <div class="remarks-label">备注:</div>
            </div>
          </body>
          </html>
        `;
      };

      // 生成PDF内容
      const printHTML = await generatePaymentRequestPDF(excelData);
      
      // 创建新窗口并写入HTML内容
      const previewWindow = window.open('', '_blank', 'width=1000,height=800,scrollbars=yes');
      if (previewWindow) {
        previewWindow.document.write(printHTML);
        previewWindow.document.close();
        
        // 处理窗口关闭事件
        previewWindow.onbeforeunload = () => {};
      } else {
        throw new Error('无法打开预览窗口，请检查浏览器弹窗设置');
      }

      toast({ 
        title: 'PDF生成成功', 
        description: `已生成付款申请单PDF，包含 ${req.logistics_record_ids.length} 条运单。` 
      });
    } catch (error) {
      console.error('生成PDF失败:', error);
      toast({ title: '生成PDF失败', description: error instanceof Error ? error.message : '未知错误', variant: 'destructive' });
    } finally {
      setExportingId(null);
    }
  };

  // 付款功能已移除

  const handleCancelPayment = async (e: MouseEvent<HTMLButtonElement>, req: PaymentRequest) => {
    e.stopPropagation();
    try {
      setExportingId(req.id);
      
      // 取消付款状态
      const { data, error } = await supabase.rpc('void_payment_for_request_1126', {
        p_request_id: req.request_id,
        p_cancel_reason: '手动取消付款'
      });

      if (error) throw error;

      toast({ 
        title: '取消付款成功', 
        description: `已取消 ${(data as { waybill_count?: number }).waybill_count || 0} 条运单的付款状态，运单状态回退到"未付款"。` 
      });
      
      // 刷新数据
      fetchPaymentRequests();
    } catch (error) {
      console.error('取消付款操作失败:', error);
      toast({ title: '取消付款失败', description: error instanceof Error ? error.message : '未知错误', variant: 'destructive' });
    } finally {
      setExportingId(null);
    }
  };

  const handleApproval = async (req: PaymentRequest) => {
    try {
      setExportingId(req.id);
      
      // 调用新的审批函数（会同时更新申请单和运单状态）
      const { data, error } = await supabase.rpc('approve_payment_request', {
        p_request_id: req.request_id
      });
      
      if (error) {
        console.error('审批失败:', error);
        toast({ title: "审批失败", description: error.message, variant: "destructive" });
        return;
      }
      
      const result = data as { success: boolean; message: string; updated_count: number };
      toast({ 
        title: "审批成功", 
        description: result.message || `付款申请已审批通过，${result.updated_count}条运单状态已更新为"支付审核通过"` 
      });
      fetchPaymentRequests();
    } catch (error) {
      console.error('审批操作失败:', error);
      toast({ title: "审批失败", description: "操作失败，请重试", variant: "destructive" });
    } finally {
      setExportingId(null);
    }
  };

  const handleViewDetails = useCallback(async (request: PaymentRequest) => {
    setSelectedRequest(request);
    setIsModalOpen(true);
    setModalContentLoading(true);
    setModalRecords([]);
    setPartnerTotals([]);
    setTotalDriverPayable(0);
    setTotalPartnerAmount(0);

    try {
      const { data: rpcData, error } = await supabase.rpc('get_payment_request_data_v2_1124', {
        p_record_ids: request.logistics_record_ids,
      });

      if (error) throw error;

      const rawRecords = (rpcData as { records?: unknown[] })?.records || [];
      
      const totalsMap = new Map<string, PartnerTotal>();
      let maxLevel = -1;
      
      rawRecords.forEach((rec: unknown) => {
        const recData = rec as { partner_costs?: unknown[] };
        (recData.partner_costs || []).forEach((cost: unknown) => {
          const costData = cost as { level?: number; partner_id: string; full_name?: string; partner_name?: string; payable_amount?: number };
          const level = costData.level ?? 0; 
          if (level > maxLevel) {
            maxLevel = level;
          }
          const partnerId = costData.partner_id;
          if (!totalsMap.has(partnerId)) {
            totalsMap.set(partnerId, {
              partner_id: partnerId,
              partner_name: costData.full_name || costData.partner_name,
              total_amount: 0,
              level: level,
            });
          }
          const partnerData = totalsMap.get(partnerId)!;
          partnerData.total_amount += Number(costData.payable_amount || 0);
        });
      });
      
      const filteredTotals = Array.from(totalsMap.values()).filter(
        pt => pt.level < maxLevel
      );
      
      setPartnerTotals(filteredTotals);
      
      // ✅ 计算司机应付汇总和货主金额汇总
      let driverTotal = 0;
      let partnerTotal = 0;
      
      rawRecords.forEach((rec: unknown) => {
        const recData = rec as {
          payable_cost?: number;
          partner_costs?: Array<{ level?: number; payable_amount?: number }>;
        };
        
        // 司机应付 = payable_cost
        driverTotal += Number(recData.payable_cost || 0);
        
        // 货主金额 = 最高级合作方的应收金额
        if (recData.partner_costs && recData.partner_costs.length > 0) {
          const maxLevelInRecord = Math.max(...recData.partner_costs.map(c => c.level || 0));
          const highestPartner = recData.partner_costs.find(c => c.level === maxLevelInRecord);
          if (highestPartner) {
            partnerTotal += Number(highestPartner.payable_amount || 0);
          }
        }
      });
      
      setTotalDriverPayable(driverTotal);
      setTotalPartnerAmount(partnerTotal);

      // ✅ 先对rawRecords排序：日期降序，运单编号升序
      const sortedRawRecords = [...rawRecords].sort((a: { loading_date: string; auto_number: string }, b: { loading_date: string; auto_number: string }) => {
        // 主排序：日期降序
        const dateA = new Date(a.loading_date).getTime();
        const dateB = new Date(b.loading_date).getTime();
        if (dateA !== dateB) {
          return dateB - dateA;
        }
        // 次排序：运单编号升序
        return a.auto_number.localeCompare(b.auto_number, 'zh-CN', { numeric: true });
      });

      const detailedRecords = sortedRawRecords.map((rec: unknown) => {
        const record = rec as {
          id: string;
          auto_number: string;
          driver_name: string;
          license_plate: string;
          loading_location: string;
          unloading_location: string;
          loading_date: string;
          loading_weight: number | null;
          payable_cost: number | null;
        };
        return {
          id: record.id,
          auto_number: record.auto_number,
          driver_name: record.driver_name,
          license_plate: record.license_plate,
          loading_location: record.loading_location,
          unloading_location: record.unloading_location,
          loading_date: record.loading_date,
          loading_weight: record.loading_weight,
          payable_amount: record.payable_cost || 0, // 使用运单的司机应收金额，而不是所有合作方应付金额的总和
        };
      });
      
      setModalRecords(detailedRecords);

    } catch (error) {
      console.error('获取运单详情失败:', error);
      toast({
        title: '获取详情失败',
        description: (error as Error).message,
        variant: 'destructive',
      });
      setIsModalOpen(false);
    } finally {
      setModalContentLoading(false);
    }
  }, [toast]);

  // 获取完整的运单数据
  const fetchFullLogisticsRecord = useCallback(async (recordId: string): Promise<LogisticsRecord | null> => {
    try {
      // 分别查询运单、项目和司机信息，避免关系冲突
      const { data: logisticsData, error: logisticsError } = await supabase
        .from('logistics_records')
        .select('*')
        .eq('id', recordId)
        .single();

      if (logisticsError) throw logisticsError;
      if (!logisticsData) return null;

      // 查询项目信息
      let projectName = '';
      if (logisticsData.project_id) {
        const { data: projectData } = await supabase
          .from('projects')
          .select('id, name')
          .eq('id', logisticsData.project_id)
          .single();
        projectName = projectData?.name || '';
      }

      // 查询合作链路信息
      let chainName: string | null = null;
      if (logisticsData.chain_id) {
        const { data: chainData } = await supabase
          .from('partner_chains')
          .select('chain_name')
          .eq('id', logisticsData.chain_id)
          .single();
        chainName = chainData?.chain_name || null;
      }

      // 查询司机信息
      let driverInfo: { id?: string; name?: string; license_plate?: string; phone?: string } = {};
      if (logisticsData.driver_id) {
        const { data: driverData } = await supabase
          .from('drivers')
          .select('id, name, license_plate, phone')
          .eq('id', logisticsData.driver_id)
          .single();
        driverInfo = driverData || {};
      }

      const formattedRecord: LogisticsRecord = {
        id: logisticsData.id,
        auto_number: logisticsData.auto_number,
        project_id: logisticsData.project_id || '',
        project_name: projectName,
        chain_id: logisticsData.chain_id || undefined,
        loading_date: logisticsData.loading_date,
        unloading_date: logisticsData.unloading_date || undefined,
        loading_location: logisticsData.loading_location,
        unloading_location: logisticsData.unloading_location,
        driver_id: driverInfo.id || '',
        driver_name: driverInfo.name || '',
        license_plate: driverInfo.license_plate || '',
        driver_phone: driverInfo.phone || '',
        loading_weight: logisticsData.loading_weight || 0,
        unloading_weight: logisticsData.unloading_weight || undefined,
        transport_type: (logisticsData.transport_type as "实际运输" | "退货") || "实际运输",
        current_cost: logisticsData.current_cost || undefined,
        extra_cost: logisticsData.extra_cost || undefined,
        payable_cost: logisticsData.payable_cost || undefined,
        remarks: logisticsData.remarks || undefined,
        created_at: logisticsData.created_at,
        created_by_user_id: logisticsData.created_by_user_id || '',
        billing_type_id: logisticsData.billing_type_id || undefined,
        payment_status: logisticsData.payment_status as 'Unpaid' | 'Processing' | 'Paid' | undefined,
        cargo_type: logisticsData.cargo_type || undefined,
        loading_location_ids: logisticsData.loading_location_ids || undefined,
        unloading_location_ids: logisticsData.unloading_location_ids || undefined,
        external_tracking_numbers: (logisticsData.external_tracking_numbers as PlatformTracking[] | undefined) || undefined,
        other_platform_names: logisticsData.other_platform_names || undefined,
      };
      
      // 添加 chain_name 属性（WaybillDetailDialog 需要）
      const recordWithChainName = formattedRecord as LogisticsRecord & { chain_name?: string | null };
      recordWithChainName.chain_name = chainName;
      
      return recordWithChainName;
    } catch (error) {
      console.error('获取运单详情失败:', error);
      toast({
        title: "加载失败",
        description: error instanceof Error ? error.message : '无法加载运单详情',
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  // 处理查看运单详情
  const handleViewWaybillDetail = useCallback(async (recordId: string) => {
    const record = await fetchFullLogisticsRecord(recordId);
    if (record) {
      setSelectedWaybillRecord(record);
      setWaybillDetailOpen(true);
    }
  }, [fetchFullLogisticsRecord]);

  const handleRequestSelect = (requestId: string) => {
    setSelection(prev => {
      const newSet = new Set(prev.selectedIds);
      if (newSet.has(requestId)) { newSet.delete(requestId); } else { newSet.add(requestId); }
      if (prev.mode === 'all_filtered') { return { mode: 'none', selectedIds: newSet }; }
      return { ...prev, selectedIds: newSet };
    });
  };

  const handleSelectAllOnPage = (isChecked: boolean) => {
    const pageIds = requests.map(r => r.id);
    if (isChecked) {
      setSelection(prev => ({ ...prev, selectedIds: new Set([...prev.selectedIds, ...pageIds]) }));
    } else {
      setSelection(prev => {
        const newSet = new Set(prev.selectedIds);
        pageIds.forEach(id => newSet.delete(id));
        if (prev.mode === 'all_filtered') { return { mode: 'none', selectedIds: newSet }; }
        return { ...prev, selectedIds: newSet };
      });
    }
  };

  const selectionCount = useMemo(() => {
    if (selection.mode === 'all_filtered') return totalRequestsCount;
    return selection.selectedIds.size;
  }, [selection, totalRequestsCount]);

  const isAllOnPageSelected = useMemo(() => {
    if (requests.length === 0) return false;
    return requests.every(req => selection.selectedIds.has(req.id));
  }, [requests, selection.selectedIds]);

  // 对申请单按状态分组排序：待审核 > 已审批待支付 > 已支付
  const groupedRequests = useMemo(() => {
    const statusOrder = { 'Pending': 1, 'Approved': 2, 'Paid': 3 };
    return [...requests].sort((a, b) => {
      const orderA = statusOrder[a.status as keyof typeof statusOrder] || 99;
      const orderB = statusOrder[b.status as keyof typeof statusOrder] || 99;
      if (orderA !== orderB) return orderA - orderB;
      // 同状态按时间倒序
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [requests]);

  // 批量取消审批功能（只取消已审批状态，回退到待审核）
  const handleRollbackRequests = async () => {
    setIsCancelling(true);
    try {
      let idsToRollback: string[] = [];
      if (selection.mode === 'all_filtered') {
        const { data: allRequests, error: fetchError } = await supabase
          .from('payment_requests')
          .select('request_id')
          .eq('status', 'Approved'); // 只取消已审批状态
        if (fetchError) throw fetchError;
        idsToRollback = allRequests.map(r => r.request_id);
      } else {
        const selectedReqs = requests.filter(r => selection.selectedIds.has(r.id) && r.status === 'Approved');
        idsToRollback = selectedReqs.map(r => r.request_id);
      }

      if (idsToRollback.length === 0) {
        toast({ 
          title: "提示", 
          description: "没有选择任何可取消审批的申请单（仅\"已审批待支付\"状态可取消审批）。" 
        });
        setIsCancelling(false);
        return;
      }

      // 调用批量取消审批函数
      const { data, error } = await supabase.rpc('batch_rollback_payment_approval_1126', { 
        p_request_ids: idsToRollback 
      });
      if (error) throw error;

      const result = data as { success: boolean; message: string; rollback_count: number; skipped_count: number };
      toast({ 
        title: "取消审批完成", 
        description: result.message || `已取消${result.rollback_count}个申请的审批，运单状态已回退到"已申请支付"`
      });
      
      setSelection({ mode: 'none', selectedIds: new Set() });
      fetchPaymentRequests();
    } catch (error) {
      console.error("批量取消审批失败:", error);
      toast({ title: "错误", description: `操作失败: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setIsCancelling(false);
    }
  };

  // 一键作废功能（删除申请单记录和回滚运单状态）
  const handleDeleteRequests = async () => {
    setIsCancelling(true);
    try {
      let idsToDelete: string[] = [];
      if (selection.mode === 'all_filtered') {
        const { data: allRequests, error: fetchError } = await supabase
          .from('payment_requests')
          .select('request_id')
          .in('status', ['Pending', 'Approved']);
        if (fetchError) throw fetchError;
        idsToDelete = allRequests.map(r => r.request_id);
      } else {
        const selectedReqs = requests.filter(r => selection.selectedIds.has(r.id) && ['Pending', 'Approved'].includes(r.status));
        idsToDelete = selectedReqs.map(r => r.request_id);
      }

      if (idsToDelete.length === 0) {
        toast({ title: "提示", description: "没有选择任何可作废的申请单（仅\"待审批\"和\"已审批\"状态可作废）。" });
        setIsCancelling(false);
        return;
      }

      // 调用删除函数
      const { data, error } = await supabase.rpc('void_and_delete_payment_requests_1126', { 
        p_request_ids: idsToDelete 
      });

      if (error) throw error;

      const result = data as VoidAndDeletePaymentRequestsResult;
      let description = `已永久删除 ${result.deleted_requests || 0} 个付款申请单，${result.affected_logistics_records || 0} 条运单状态已回滚为未支付。`;
      if (result.skipped_paid && result.skipped_paid > 0) {
        description += `\n跳过 ${result.skipped_paid} 个已付款的申请单（需要先取消付款才能删除）。`;
      }

      toast({ 
        title: "作废成功", 
        description: description
      });
      setSelection({ mode: 'none', selectedIds: new Set() });
      fetchPaymentRequests();
    } catch (error) {
      console.error("批量作废删除失败:", error);
      toast({ title: "错误", description: `操作失败: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-2 p-4 md:p-6">
      <PageHeader
        title="付款审核"
        description="审核和管理付款申请单"
        icon={ClipboardList}
        iconColor="text-green-600"
        actions={
          <div className="flex items-center gap-2">
            {showFilters && (
              <>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    清除筛选
                  </Button>
                )}
                <Button onClick={fetchPaymentRequests} size="sm">
                  <Search className="h-4 w-4 mr-1" />
                  搜索
                </Button>
              </>
            )}
            {hasActiveFilters && <Badge variant="secondary">已筛选</Badge>}
          </div>
        }
      />


      <div className="space-y-2">

      <div className="flex justify-between items-center">
        <div/>
      </div>

      {selection.selectedIds.size > 0 && selection.mode !== 'all_filtered' && isAllOnPageSelected && totalRequestsCount > requests.length && (
        <div className="flex items-center justify-center gap-4 p-2 text-sm font-medium text-center bg-secondary text-secondary-foreground rounded-md">
          <span>已选择当前页的所有 <b>{requests.length}</b> 条记录。</span>
          <Button variant="link" className="p-0 h-auto" onClick={() => setSelection({ mode: 'all_filtered', selectedIds: new Set() })}>选择全部 <b>{totalRequestsCount}</b> 条记录</Button>
        </div>
      )}
      {selection.mode === 'all_filtered' && (
        <div className="flex items-center justify-center gap-4 p-2 text-sm font-medium text-center bg-secondary text-secondary-foreground rounded-md">
          <span>已选择全部 <b>{totalRequestsCount}</b> 条匹配的记录。</span>
          <Button variant="link" className="p-0 h-auto" onClick={() => setSelection({ mode: 'none', selectedIds: new Set() })}>清除选择</Button>
        </div>
      )}

      {/* 筛选器 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">筛选条件</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="text-sm"
            >
              {showAdvancedFilters ? '收起高级筛选 ▲' : '展开高级筛选 ▼'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 常规查询 - 一行布局 */}
          <div className="flex items-end gap-3 flex-wrap">
            {/* 货主-项目级联筛选器 */}
            <div className="flex-none" style={{width: '480px'}}>
              <ShipperProjectCascadeFilter
                selectedShipperId={selectedShipperId}
                selectedProjectId={selectedProjectId}
                onShipperChange={(id) => {
                  setSelectedShipperId(id);
                  setSelectedProjectId('all');
                  // ✅ 货主变化时，先清空 projectId，等待项目列表加载完成后再设置
                  handleFilterChange('projectId', '');
                }}
                onProjectChange={(id) => {
                  setSelectedProjectId(id);
                  handleFilterChange('projectId', id === 'all' ? '' : id);
                }}
                onProjectsChange={(projects) => {
                  // ✅ 当项目列表更新时，保存到状态
                  setAvailableProjects(projects);
                }}
              />
            </div>

            {/* 申请单状态 */}
            <div className="flex-none w-40 space-y-2">
              <Label className="text-sm font-medium">状态</Label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm h-10"
              >
                <option value="">全部</option>
                <option value="Pending">待审核</option>
                <option value="Approved">已审批</option>
                <option value="Paid">已支付</option>
              </select>
            </div>

            {/* 日期范围 */}
            <div className="flex-1 min-w-[160px] space-y-2">
              <Label htmlFor="loadingDate" className="text-sm font-medium flex items-center gap-1">
                <CalendarIcon className="h-4 w-4" />
                日期范围
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="loadingDate"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-10",
                      !filters.loadingDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.loadingDate ? format(filters.loadingDate, "yyyy-MM-dd", { locale: zhCN }) : "选择日期范围"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.loadingDate || undefined}
                    onSelect={(date) => handleFilterChange('loadingDate', date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2">
              {hasActiveFilters && (
                <Button variant="outline" size="default" onClick={clearFilters} className="h-10">
                  <X className="h-4 w-4 mr-1" />
                  清除
                </Button>
              )}
              <Button onClick={fetchPaymentRequests} size="default" className="bg-blue-600 hover:bg-blue-700 h-10">
                <Search className="h-4 w-4 mr-1" />
                搜索
              </Button>
            </div>
          </div>

          {/* 高级筛选 */}
          {showAdvancedFilters && (
            <div className="space-y-4 pt-4 border-t">
              {/* 第一排：司机、车牌号、电话 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 司机 */}
                <div className="space-y-2">
                  <Label htmlFor="driverName" className="text-sm font-medium flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    司机
                  </Label>
                  <div className="relative">
                    <Input
                      id="driverName"
                      placeholder="司机姓名，多个用逗号分隔..."
                      value={filters.driverName}
                      onChange={(e) => handleFilterChange('driverName', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          fetchPaymentRequests();
                        }
                      }}
                      className="pr-8"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
                      onClick={() => openBatchInputDialog('driverName')}
                    >
                      <span className="text-lg">+</span>
                    </Button>
                  </div>
                </div>

                {/* 车牌号 */}
                <div className="space-y-2">
                  <Label htmlFor="licensePlate" className="text-sm font-medium">🚗 车牌号</Label>
                  <div className="relative">
                    <Input
                      id="licensePlate"
                      placeholder="车牌号，多个用逗号分隔..."
                      value={filters.licensePlate}
                      onChange={(e) => handleFilterChange('licensePlate', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          fetchPaymentRequests();
                        }
                      }}
                      className="pr-8"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
                      onClick={() => openBatchInputDialog('licensePlate')}
                    >
                      <span className="text-lg">+</span>
                    </Button>
                  </div>
                </div>

                {/* 电话 */}
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="text-sm font-medium">📞 电话</Label>
                  <div className="relative">
                    <Input
                      id="phoneNumber"
                      placeholder="电话号码，多个用逗号分隔..."
                      value={filters.phoneNumber}
                      onChange={(e) => handleFilterChange('phoneNumber', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          fetchPaymentRequests();
                        }
                      }}
                      className="pr-8"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
                      onClick={() => openBatchInputDialog('phoneNumber')}
                    >
                      <span className="text-lg">+</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* 第二排：运单编号、平台名称 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 运单编号 */}
                <div className="space-y-2">
                  <Label htmlFor="waybillNumber" className="text-sm font-medium flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    运单编号
                  </Label>
                  <div className="relative">
                    <Input
                      id="waybillNumber"
                      placeholder="输入运单编号，多个用逗号分隔..."
                      value={filters.waybillNumber}
                      onChange={(e) => handleFilterChange('waybillNumber', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          fetchPaymentRequests();
                        }
                      }}
                      className="pr-8"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
                      onClick={() => openBatchInputDialog('waybillNumber')}
                    >
                      <span className="text-lg">+</span>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">💡 支持按本平台和其他平台运单号查询</p>
                </div>
                
                {/* 平台名称 */}
                <div className="space-y-2">
                  <Label htmlFor="platformName" className="text-sm font-medium">🌐 平台名称</Label>
                  <Select 
                    value={filters.platformName || 'all'} 
                    onValueChange={(v) => handleFilterChange('platformName', v === 'all' ? '' : v)}
                  >
                    <SelectTrigger id="platformName" className="h-10">
                      <SelectValue placeholder="选择平台" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">所有平台</SelectItem>
                      <SelectItem value="本平台">本平台</SelectItem>
                      <SelectItem value="中科智运">中科智运</SelectItem>
                      <SelectItem value="中工智云">中工智云</SelectItem>
                      <SelectItem value="可乐公司">可乐公司</SelectItem>
                      <SelectItem value="盼盼集团">盼盼集团</SelectItem>
                      {platformOptions.length > 0 && (
                        <>
                          <SelectItem value="---" disabled className="text-xs text-muted-foreground">
                            ─── 其他平台 ───
                          </SelectItem>
                          {platformOptions.map((platform) => (
                            <SelectItem key={platform.platform_name} value={platform.platform_name}>
                              {platform.platform_name} ({platform.usage_count}条)
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>申请单列表</CardTitle>
            {hasButtonAccess('finance.approve_payment') && selection.selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  已选择 {selection.selectedIds.size} 个申请单
                </span>
                
                {/* 合并付款按钮 - 紫色 */}
                {selection.selectedIds.size >= 2 && (
                  <ConfirmDialog
                    title="确认合并付款申请"
                    description={`确定要将选中的 ${selection.selectedIds.size} 个付款申请单合并为一个新的申请单吗？\n\n原申请单状态将变为"已合并"，运单将关联到新申请单。`}
                    onConfirm={handleMergePayments}
                  >
                    <Button
                      variant="default"
                      size="sm"
                      disabled={isMerging}
                      className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {isMerging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Merge className="h-4 w-4" />}
                      合并付款 ({selection.selectedIds.size}个)
                    </Button>
                  </ConfirmDialog>
                )}
                
                {/* 批量审批按钮 - 绿色 */}
                <ConfirmDialog
                  title="确认批量审批"
                  description={`确定要批量审批选中的 ${selection.selectedIds.size} 个付款申请吗？审批后申请单状态将变为"已审批"。`}
                  onConfirm={handleBatchApprove}
                >
                <Button
                  variant="default"
                  size="sm"
                  disabled={isBatchOperating}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  {batchOperation === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                  批量审批
                </Button>
                </ConfirmDialog>

                {/* 批量取消审批按钮 - 橙色 */}
                <ConfirmDialog
                  title="确认批量取消审批"
                  description={`确定要批量取消审批选中的 ${selection.selectedIds.size} 个付款申请吗？此操作将把已审批的申请单状态回滚为待审批。`}
                  onConfirm={handleBatchRollbackApproval}
                >
                    <Button 
                      variant="default"
                    size="sm"
                    disabled={isBatchOperating}
                    className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    {isBatchOperating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    批量取消审批
                    </Button>
                </ConfirmDialog>

                {/* 一键作废按钮 - 仅管理员可见 - 红色 */}
                {isAdmin && (
                  <ConfirmDialog
                    title="⚠️ 确认一键作废"
                    description={`确定要作废并删除选中的 ${selectionCount} 个付款申请吗？\n\n⚠️ 此操作将：\n• 永久删除申请单记录\n• 回滚运单状态为未支付\n\n此操作不可逆，请谨慎操作！`}
                    onConfirm={handleDeleteRequests}
                  >
                    <Button 
                      variant="destructive" 
                      size="sm"
                      disabled={selectionCount === 0 || isCancelling} 
                      className="flex items-center gap-2"
                    >
                      {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      一键作废 ({selectionCount})
                    </Button>
                  </ConfirmDialog>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="min-h-[400px]">
            {loading ? (
              <TableSkeleton rowCount={pageSize} colCount={10} showCheckbox={isAdmin} />
            ) : (
              <Table>
                 <TableHeader>
                   <TableRow>
                     {isAdmin && <TableHead className="w-12"><Checkbox checked={selection.mode === 'all_filtered' || isAllOnPageSelected} onCheckedChange={handleSelectAllOnPage} /></TableHead>}
                    <TableHead>申请编号</TableHead>
                    <TableHead>申请时间</TableHead>
                    <TableHead>付款申请单状态</TableHead>
                    <TableHead>项目</TableHead>
                    <TableHead>装货日期范围</TableHead>
                    <TableHead className="text-right">运单数</TableHead>
                    <TableHead className="text-right">司机运费</TableHead>
                    <TableHead className="text-right">货主金额</TableHead>
                    <TableHead className="max-w-[200px]">备注</TableHead>
                    <TableHead className="text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.length > 0 ? (
                    groupedRequests.map((req, index) => {
                      // 检查是否需要插入分割线
                      const prevReq = index > 0 ? groupedRequests[index - 1] : null;
                      const showDivider = prevReq && prevReq.status !== req.status;
                      
                      return (
                        <Fragment key={req.id}>
                          {/* 状态分组分割线 */}
                          {showDivider && (
                            <TableRow className="bg-gradient-to-r from-transparent via-muted to-transparent hover:bg-gradient-to-r hover:from-transparent hover:via-muted hover:to-transparent border-y border-border/50">
                              <TableCell colSpan={isAdmin ? 11 : 10} className="h-3 p-0">
                                <div className="w-full h-full flex items-center justify-center">
                                  <div className="w-full max-w-md h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                          
                      <TableRow 
                        key={req.id} 
                        data-state={selection.selectedIds.has(req.id) ? "selected" : undefined}
                        className="hover:bg-muted/50"
                      >
                        {isAdmin && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={selection.mode === 'all_filtered' || selection.selectedIds.has(req.id)} onCheckedChange={() => handleRequestSelect(req.id)} />
                          </TableCell>
                        )}
                        <TableCell className="font-mono cursor-pointer" onClick={() => handleViewDetails(req)}>
                          <div className="flex items-center gap-2">
                            <span>{req.request_id}</span>
                            {req.is_merged_request && (
                              <Badge className="bg-purple-100 text-purple-800 text-xs">
                                合并({req.merged_count})
                              </Badge>
                            )}
                            {req.status === 'Merged' && (
                              <Badge variant="outline" className="text-gray-600 text-xs">
                                已合并
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="cursor-pointer" onClick={() => handleViewDetails(req)}>{format(new Date(req.created_at), 'yyyy-MM-dd HH:mm')}</TableCell>
                        <TableCell className="cursor-pointer" onClick={() => handleViewDetails(req)}>
                          <StatusBadge status={req.status} customConfig={PAYMENT_REQUEST_STATUS_CONFIG} />
                        </TableCell>
                        <TableCell className="cursor-pointer" onClick={() => handleViewDetails(req)}>{req.project_names || '-'}</TableCell>
                        <TableCell className="cursor-pointer" onClick={() => handleViewDetails(req)}>{req.loading_date_range || '-'}</TableCell>
                        <TableCell className="text-right cursor-pointer" onClick={() => handleViewDetails(req)}>{req.record_count ?? 0}</TableCell>
                        <TableCell className="text-right cursor-pointer font-mono font-semibold text-green-700" onClick={() => handleViewDetails(req)}>
                          {req.total_driver_freight !== undefined ? `¥${req.total_driver_freight.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                        </TableCell>
                        <TableCell className="text-right cursor-pointer font-mono font-semibold text-blue-700" onClick={() => handleViewDetails(req)}>
                          {req.total_partner_amount !== undefined ? `¥${req.total_partner_amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                        </TableCell>
                        <TableCell className="max-w-[200px] cursor-pointer truncate text-sm text-muted-foreground" onClick={() => handleViewDetails(req)} title={req.notes || ''}>
                          {req.notes || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-3 flex-wrap">
                            {/* 查看申请单按钮 - 蓝色主题 */}
                            <Button 
                              variant="default" 
                              size="sm" 
                              onClick={(e) => handleGeneratePDF(e, req)} 
                              disabled={exportingId === req.id}
                              className="bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-sm transition-all duration-200"
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              查看申请单
                            </Button>

                            {/* 取消审批按钮 - 橙色主题，只在已审批状态显示 */}
                            {req.status === 'Approved' && (
                              <ConfirmDialog
                                title="确认取消审批"
                                description={`确定要取消审批付款申请 ${req.request_id} 吗？此操作将把申请单状态回滚为待审批。`}
                                onConfirm={() => handleRollbackApproval(req.request_id)}
                              >
                              <Button 
                                  variant="default" 
                                size="sm" 
                                disabled={exportingId === req.id}
                                  className="bg-orange-600 hover:bg-orange-700 text-white border-0 shadow-sm transition-all duration-200"
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                取消审批
                              </Button>
                              </ConfirmDialog>
                            )}

                            {/* 审批按钮 - 绿色主题，只在待审批状态显示 */}
                            {req.status === 'Pending' && (
                              <ConfirmDialog
                                title="确认审批"
                                description={`确定要审批付款申请 ${req.request_id} 吗？审批后申请单状态将变为"已审批"。`}
                                onConfirm={() => handleApproval(req)}
                              >
                              <Button 
                                variant="default" 
                                size="sm" 
                                disabled={exportingId === req.id}
                                className="bg-green-600 hover:bg-green-700 text-white border-0 shadow-sm font-medium transition-all duration-200"
                              >
                                <ClipboardList className="mr-2 h-4 w-4" />
                                审批
                              </Button>
                              </ConfirmDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                        </Fragment>
                      );
                    })
                  ) : (
                    <TableRow><TableCell colSpan={isAdmin ? 8 : 7} className="h-24 text-center">暂无付款申请记录。</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DialogTitle>申请单详情: {selectedRequest?.request_id}</DialogTitle>
                <DialogDescription>
                  此申请单包含以下 {selectedRequest?.record_count ?? 0} 条运单记录。
                </DialogDescription>
              </div>
            </div>
            {/* ✅ 复制运单号按钮 - 居中显示 */}
            {modalRecords.length > 0 && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const waybillNumbers = modalRecords.map(rec => rec.auto_number).filter(Boolean).join(',');
                    navigator.clipboard.writeText(waybillNumbers).then(() => {
                      toast({
                        title: "复制成功",
                        description: `已复制 ${modalRecords.length} 个运单号到剪贴板`,
                      });
                    }).catch(() => {
                      toast({
                        title: "复制失败",
                        description: "无法复制到剪贴板",
                        variant: "destructive",
                      });
                    });
                  }}
                  className="bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border-blue-200 text-blue-700 hover:text-blue-800 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  复制运单号
                </Button>
              </div>
            )}
          </DialogHeader>
          
          <div className="flex gap-4">
            {/* 表格区域 */}
            <div className="flex-1 max-h-[50vh] overflow-y-auto">
            {modalContentLoading ? (
              <div className="flex justify-center items-center h-48">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                  <TableRow className="border-b-2 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground">运单号</TableHead>
                    <TableHead className="font-semibold text-foreground">司机</TableHead>
                    <TableHead className="font-semibold text-foreground">车牌号</TableHead>
                    <TableHead className="font-semibold text-foreground">起运地 → 目的地</TableHead>
                    <TableHead className="font-semibold text-foreground">装车日期</TableHead>
                    <TableHead className="text-right font-semibold text-foreground">吨位</TableHead>
                    <TableHead className="text-right font-semibold text-foreground">司机应收(元)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modalRecords.length > 0 ? (
                    modalRecords.map((rec) => (
                      <TableRow 
                        key={rec.id}
                        className="hover:bg-muted/60 transition-colors duration-150 border-b border-border/30"
                      >
                        <TableCell 
                          className="font-mono cursor-pointer hover:text-primary hover:underline"
                          onClick={() => handleViewWaybillDetail(rec.id)}
                        >
                          {rec.auto_number}
                        </TableCell>
                        <TableCell>{rec.driver_name}</TableCell>
                        <TableCell>{rec.license_plate}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <RouteDisplay
                            loadingLocation={rec.loading_location}
                            unloadingLocation={rec.unloading_location}
                            variant="compact"
                          />
                        </TableCell>
                        <TableCell>{format(new Date(rec.loading_date), 'yyyy-MM-dd')}</TableCell>
                        <TableCell className="text-right">{rec.loading_weight ?? 'N/A'}</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-green-700">
                          {(rec.payable_amount || 0).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        未能加载运单详情或此申请单无运单。
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
            </div>

            {/* 汇总金额区域 - 右侧对齐 */}
            {!modalContentLoading && (
              <div className="flex-shrink-0 w-64 p-4 border rounded-lg bg-muted/50">
                <h4 className="mb-3 font-semibold text-foreground">金额汇总 (按合作方)</h4>
                <div className="space-y-3">
                  {partnerTotals.length > 0 ? (
                    partnerTotals
                      .sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0))
                      .map(pt => (
                        <div key={pt.partner_id} className="flex justify-between items-baseline">
                          <span className="text-sm text-muted-foreground truncate pr-2">{pt.partner_name}:</span>
                          <span className="font-mono font-semibold text-primary text-right whitespace-nowrap">
                            {(pt.total_amount || 0).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}
                          </span>
                        </div>
                      ))
                  ) : (
                    <div className="text-sm text-muted-foreground">暂无合作方数据</div>
                  )}
                </div>
                {/* ✅ 司机应付汇总 */}
                <div className="mt-4 pt-4 border-t flex justify-between items-baseline">
                  <span className="text-sm font-semibold text-foreground">司机应付汇总：</span>
                  <span className="font-mono font-semibold text-green-700 text-right whitespace-nowrap">
                    {totalDriverPayable.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {/* ✅ 货主金额汇总 */}
                <div className="mt-3 pt-3 border-t flex justify-between items-baseline">
                  <span className="text-sm font-semibold text-foreground">货主金额汇总：</span>
                  <span className="font-mono font-semibold text-blue-700 text-right whitespace-nowrap">
                    {totalPartnerAmount.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ✅ 使用PaginationControl组件 */}
      <PaginationControl
        currentPage={currentPage}
        pageSize={pageSize}
        totalPages={totalPages}
        totalCount={totalRequestsCount}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
      </div>
      
      {/* 运单详情对话框 */}
      <WaybillDetailDialog
        isOpen={waybillDetailOpen}
        onClose={() => {
          setWaybillDetailOpen(false);
          setSelectedWaybillRecord(null);
        }}
        record={selectedWaybillRecord}
      />

      {/* 批量输入对话框 */}
      <BatchInputDialog
        isOpen={batchInputDialog.isOpen}
        onClose={closeBatchInputDialog}
        onApply={handleBatchInputConfirm}
        title={getBatchInputConfig().title}
        placeholder={getBatchInputConfig().placeholder}
        description={getBatchInputConfig().description}
        currentValue={getCurrentBatchValue()}
      />
    </div>
  );
}