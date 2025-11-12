// 财务开票页面
import { useState, useEffect, useMemo, Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { FileText, Search, Filter, Eye, Edit, Download, RefreshCw, X, CheckCircle, FileDown, CheckSquare, Square, Trash2, Ban, CalendarIcon, Building, Users, RotateCcw, Copy, Receipt } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
// ✅ 导入可复用组件
import {
  PaginationControl,
  StatusBadge,
  INVOICE_REQUEST_STATUS_CONFIG,
  BulkActionBar,
  RequestTableHeader,
  ActionButtons,
  LoadingState,
  type BulkAction,
  type TableColumn
} from '@/components/common';
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { convertChinaDateToUTCDate, convertSingleDateToDateRange } from '@/utils/dateUtils';
import { convertUTCDateRangeToChinaDateRange } from '@/utils/dateRangeUtils';
import { BatchInputDialog } from '@/pages/BusinessEntry/components/BatchInputDialog';
import { zhCN } from 'date-fns/locale';
import { LogisticsFormDialog } from "@/pages/BusinessEntry/components/LogisticsFormDialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { WaybillDetailDialog } from '@/components/WaybillDetailDialog';
import { LogisticsRecord, PlatformTracking } from '@/types';

// 运单记录类型
interface LogisticsRecord {
  id: string;
  auto_number: string;
  project_id: string | null;
  project_name: string;
  chain_id: string | null;
  chain_name: string | null;
  billing_type_id: number;
  driver_id: string;
  driver_name: string;
  loading_location: string;
  unloading_location: string;
  loading_date: string;
  unloading_date: string | null;
  loading_weight: number | null;
  unloading_weight: number | null;
  current_cost: number | null;
  payable_cost: number | null;  // 司机应收金额
  license_plate: string;
  driver_phone: string;
  transport_type: string | null;
  extra_cost: number | null;
  remarks: string | null;
  loading_weighbridge_image_url: string | null;
  unloading_weighbridge_image_url: string | null;
  external_tracking_numbers: string[];
  other_platform_names: string[];
  created_at: string;
}

// 开票申请单类型定义
interface InvoiceRequest {
  id: string;
  request_number: string;
  partner_id: string;
  partner_name: string;
  partner_full_name?: string;
  invoicing_partner_id?: string;
  invoicing_partner_full_name?: string;
  invoicing_partner_tax_number?: string;
  invoicing_partner_company_address?: string;
  invoicing_partner_bank_name?: string;
  invoicing_partner_bank_account?: string;
  total_amount: number;
  record_count: number;
  status: 'Pending' | 'Approved' | 'Completed' | 'Rejected' | 'Voided';
  created_by: string;
  created_at: string;
  updated_at?: string;
  remarks?: string;
  is_voided?: boolean;
  voided_at?: string;
  voided_by?: string;
  void_reason?: string;
  is_merged?: boolean;
  merged_into_id?: string;
  merged_at?: string;
  merged_by?: string;
  merge_reason?: string;
  creator_name?: string;
  bank_name?: string;
  bank_account?: string;
  tax_number?: string;
  invoice_number?: string;
  invoice_date?: string;
  loading_date_range?: string;    // ✅ 新增：运单装货日期范围
  total_payable_cost?: number;     // ✅ 新增：司机应收合计
}

// 开票申请单详情类型
interface InvoiceRequestDetail {
  id: string;
  invoice_request_id: string;
  logistics_record_id: string;
  amount: number;
  invoiceable_amount?: number;  // ✅ 新增：开票金额
  logistics_record: {
    auto_number: string;
    project_name: string;
    driver_name: string;
    loading_location: string;
    unloading_location: string;
    loading_date: string;
    loading_weight?: number;
    payable_cost?: number | null;  // ✅ 新增：司机应收
  };
}

export default function InvoiceRequestManagement() {
  const [invoiceRequests, setInvoiceRequests] = useState<InvoiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 筛选器状态（参考财务付款页面）
  const [filters, setFilters] = useState({
    requestNumber: '',       // 开票申请单编号
    waybillNumber: '',       // 运单编号
    driverName: '',          // 司机姓名
    loadingDate: null as Date | null,  // 装货日期
    status: 'Approved',      // 默认筛选"已审批待开票"
    projectId: '',           // 项目ID
    licensePlate: '',        // 车牌号
    phoneNumber: '',         // 电话
    platformName: ''         // 平台名称
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // 批量输入对话框状态
  const [batchInputDialog, setBatchInputDialog] = useState<{
    isOpen: boolean;
    type: 'requestNumber' | 'waybillNumber' | 'driverName' | 'licensePlate' | 'phoneNumber' | null;
  }>({ isOpen: false, type: null });
  
  // 筛选选项数据
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  const [platformOptions, setPlatformOptions] = useState<Array<{platform_name: string, usage_count: number}>>([]);
  const [selectedRequest, setSelectedRequest] = useState<InvoiceRequest | null>(null);
  const [requestDetails, setRequestDetails] = useState<InvoiceRequestDetail[]>([]);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    status: 'Pending',
    remarks: ''
  });
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false);
  const [voidForm, setVoidForm] = useState({
    reason: ''
  });
  
  // 运单详情查看状态
  const [isLogisticsFormDialogOpen, setIsLogisticsFormDialogOpen] = useState(false);
  const [selectedLogisticsRecordForView, setSelectedLogisticsRecordForView] = useState<LogisticsRecord | null>(null);
  
  // ✅ 新增：运单详情对话框状态（用于WaybillDetailDialog）
  const [waybillDetailOpen, setWaybillDetailOpen] = useState(false);
  const [selectedWaybillRecord, setSelectedWaybillRecord] = useState<LogisticsRecord | null>(null);
  
  // 批量选择状态（参考财务付款页面）
  interface SelectionState { 
    mode: 'none' | 'all_filtered'; 
    selectedIds: Set<string>; 
  }
  const [selection, setSelection] = useState<SelectionState>({ mode: 'none', selectedIds: new Set() });
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [totalRequestsCount, setTotalRequestsCount] = useState(0);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  
  const { toast } = useToast();

  // 筛选器处理函数
  const handleFilterChange = (key: string, value: string | Date | null) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      requestNumber: '',
      waybillNumber: '',
      driverName: '',
      loadingDate: null,
      status: 'Approved', // 保持默认筛选"已审批待开票"
      projectId: '',
      licensePlate: '',
      phoneNumber: '',
      platformName: ''
    });
  };

  const hasActiveFilters = filters.requestNumber || filters.waybillNumber || filters.driverName || filters.loadingDate || filters.status || filters.projectId || filters.licensePlate || filters.phoneNumber || filters.platformName;

  // 批量输入对话框处理函数
  const openBatchInputDialog = (type: 'requestNumber' | 'waybillNumber' | 'driverName' | 'licensePlate' | 'phoneNumber') => {
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
      requestNumber: { title: '批量输入开票申请单号', placeholder: '每行一个申请单号，或用逗号/空格分隔', description: '支持多行输入或用逗号/空格分隔' },
      waybillNumber: { title: '批量输入运单编号', placeholder: '每行一个运单编号，或用逗号/空格分隔', description: '支持多行输入或用逗号/空格分隔' },
      driverName: { title: '批量输入司机姓名', placeholder: '每行一个司机姓名，或用逗号/空格分隔', description: '支持多行输入或用逗号/空格分隔' },
      licensePlate: { title: '批量输入车牌号', placeholder: '每行一个车牌号，或用逗号/空格分隔', description: '支持多行输入或用逗号/空格分隔' },
      phoneNumber: { title: '批量输入电话号码', placeholder: '每行一个电话号码，或用逗号/空格分隔', description: '支持多行输入或用逗号/空格分隔' }
    };
    return type ? configs[type] : configs.requestNumber;
  };

  // 加载开票申请单列表（使用后端RPC函数）
  const loadInvoiceRequests = async () => {
    try {
      setLoading(true);
      
      // 使用后端筛选函数（更高效）
      const { data, error } = await supabase.rpc('get_invoice_requests_filtered', {
        p_request_number: filters.requestNumber || null,
        p_waybill_number: filters.waybillNumber || null,
        p_driver_name: filters.driverName || null,
        // 单日查询：将单日转换为日期范围，确保包含当天的所有数据
        // 由于后端使用 lr.loading_date = p_loading_date 精确匹配，我们需要传递开始日期
        // 但为了包含当天的所有数据，我们传递开始日期（UTC）
        p_loading_date: filters.loadingDate ? (() => {
          const { startDate } = convertSingleDateToDateRange(filters.loadingDate);
          return startDate;
        })() : null,
        p_status: filters.status || null,
        p_project_id: filters.projectId || null,
        p_license_plate: filters.licensePlate || null,
        p_phone_number: filters.phoneNumber || null,
        p_platform_name: filters.platformName || null,
        p_limit: pageSize,
        p_offset: (currentPage - 1) * pageSize
      });

      if (error) throw error;

      const requestsData = (data as unknown as InvoiceRequest[]) || [];
      setInvoiceRequests(requestsData);
      
      // 设置总数和总页数
      if (requestsData.length > 0) {
        const totalCount = (requestsData[0] as unknown as { total_count: number }).total_count || 0;
        setTotalRequestsCount(totalCount);
        setTotalPages(Math.ceil(totalCount / pageSize));
      } else {
        setTotalRequestsCount(0);
        setTotalPages(0);
      }
    } catch (error) {
      console.error('加载开票申请单失败:', error);
      toast({
        title: "加载失败",
        description: `无法加载开票申请单列表: ${error.message || '未知错误'}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 加载开票申请单详情
  const loadRequestDetails = async (requestId: string) => {
    try {
      // 先获取开票申请单详情
      const { data: detailsData, error: detailsError } = await supabase
        .from('invoice_request_details')
        .select('*')
        .eq('invoice_request_id', requestId);

      if (detailsError) throw detailsError;

      if (!detailsData || detailsData.length === 0) {
        setRequestDetails([]);
        return;
      }

      // 获取所有相关的运单ID
      const logisticsRecordIds = detailsData.map(detail => detail.logistics_record_id).filter(Boolean);
      
      if (logisticsRecordIds.length === 0) {
        setRequestDetails([]);
        return;
      }

      // 分别查询运单信息、项目信息、司机信息
      const [logisticsResult, projectsResult, driversResult] = await Promise.all([
        supabase
          .from('logistics_records')
          .select('id, auto_number, project_id, driver_id, loading_location, unloading_location, loading_date, loading_weight, payable_cost')
          .in('id', logisticsRecordIds),
        supabase
          .from('projects')
          .select('id, name'),
        supabase
          .from('drivers')
          .select('id, name')
      ]);

      if (logisticsResult.error) throw logisticsResult.error;

      // 创建映射
      const projectsMap = new Map(projectsResult.data?.map(p => [p.id, p.name]) || []);
      const driversMap = new Map(driversResult.data?.map(d => [d.id, d.name]) || []);
      const logisticsMap = new Map(logisticsResult.data?.map(l => [l.id, l]) || []);

      // 组合数据
      const formattedDetails = detailsData.map(detail => {
        const logisticsRecord = logisticsMap.get(detail.logistics_record_id);
        return {
          id: detail.id,
          invoice_request_id: detail.invoice_request_id,
          logistics_record_id: detail.logistics_record_id,
          amount: detail.amount,
          invoiceable_amount: (detail as any).invoiceable_amount || detail.amount,  // ✅ 新增：开票金额
          logistics_record: {
            auto_number: logisticsRecord?.auto_number || '',
            project_name: logisticsRecord?.project_id ? projectsMap.get(logisticsRecord.project_id) || '' : '',
            driver_name: logisticsRecord?.driver_id ? driversMap.get(logisticsRecord.driver_id) || '' : '',
            loading_location: logisticsRecord?.loading_location || '',
            unloading_location: logisticsRecord?.unloading_location || '',
            loading_date: logisticsRecord?.loading_date || '',
            loading_weight: logisticsRecord?.loading_weight || 0,
            payable_cost: (logisticsRecord as any)?.payable_cost || null  // ✅ 新增：司机应收
          }
        };
      });

      setRequestDetails(formattedDetails);
    } catch (error) {
      console.error('加载申请单详情失败:', error);
      toast({
        title: "加载失败",
        description: `无法加载申请单详情: ${error.message || '未知错误'}`,
        variant: "destructive",
      });
    }
  };

  // 更新申请单状态
  const updateRequestStatus = async (requestId: string, status: string, remarks?: string) => {
    try {
      const { error } = await supabase
        .from('invoice_requests')
        .update({
          status,
          remarks,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "更新成功",
        description: "申请单状态已更新",
      });

      loadInvoiceRequests();
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error('更新申请单状态失败:', error);
      toast({
        title: "更新失败",
        description: "无法更新申请单状态",
        variant: "destructive",
      });
    }
  };


  // 查看详情
  const handleViewDetails = async (request: InvoiceRequest) => {
    setSelectedRequest(request);
    await loadRequestDetails(request.id);
    setIsDetailDialogOpen(true);
  };

  // 编辑状态
  const handleEditStatus = (request: InvoiceRequest) => {
    setSelectedRequest(request);
    setEditForm({
      status: request.status,
      remarks: request.remarks || ''
    });
    setIsEditDialogOpen(true);
  };

  // 作废申请单
  const voidRequest = async (requestId: string, reason: string) => {
    try {
      const { data, error } = await supabase.rpc('void_invoice_request', {
        p_request_id: requestId,
        p_void_reason: reason
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string } | null;
      if (result?.success) {
        toast({
          title: "作废成功",
          description: result.message,
        });
        loadInvoiceRequests();
        setIsVoidDialogOpen(false);
        setVoidForm({ reason: '' });
      } else {
        throw new Error(result?.message || '作废失败');
      }
    } catch (error) {
      console.error('作废申请单失败:', error);
      toast({
        title: "作废失败",
        description: error instanceof Error ? error.message : '无法作废申请单',
        variant: "destructive",
      });
    }
  };

  // 确认开票
  const approveInvoice = async (requestId: string) => {
    try {
      // 1. 更新开票申请单状态
      const { data: requestData, error: requestError } = await supabase
        .from('invoice_requests')
        .update({ 
          status: 'Approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (requestError) throw requestError;

      // 2. 获取开票申请单详情，更新相关运单的开票状态
      const { data: requestDetails, error: detailsError } = await supabase
        .from('invoice_request_details')
        .select('logistics_record_id')
        .eq('invoice_request_id', requestId);

      if (detailsError) throw detailsError;

      if (requestDetails && requestDetails.length > 0) {
        // 3. 更新运单记录的开票状态
        const recordIds = requestDetails.map(detail => detail.logistics_record_id);
        const { error: updateError } = await supabase
          .from('logistics_records')
          .update({ 
            invoice_status: 'Invoiced',
            invoice_completed_at: new Date().toISOString()
          })
          .in('id', recordIds);

        if (updateError) throw updateError;

        // 4. 更新 logistics_partner_costs 表的开票状态
        const { error: costsError } = await supabase
          .from('logistics_partner_costs')
          .update({ 
            invoice_status: 'Invoiced',
            invoice_completed_at: new Date().toISOString()
          })
          .in('logistics_record_id', recordIds);

        if (costsError) throw costsError;
      }

      toast({
        title: "确认成功",
        description: "开票申请单已确认，相关运单状态已更新",
      });
      loadInvoiceRequests();
    } catch (error) {
      console.error('确认开票失败:', error);
      toast({
        title: "确认失败",
        description: error.message || '无法确认开票',
        variant: "destructive",
      });
    }
  };

  // 处理作废
  const handleVoidRequest = (request: InvoiceRequest) => {
    setSelectedRequest(request);
    setIsVoidDialogOpen(true);
  };

  // 选择相关函数（参考财务付款页面）
  const handleRequestSelect = (requestId: string) => {
    setSelection(prev => {
      const newSet = new Set(prev.selectedIds);
      if (newSet.has(requestId)) { 
        newSet.delete(requestId); 
      } else { 
        newSet.add(requestId); 
      }
      if (prev.mode === 'all_filtered') { 
        return { mode: 'none', selectedIds: newSet }; 
      }
      return { ...prev, selectedIds: newSet };
    });
  };

  const handleSelectAllOnPage = (isChecked: boolean) => {
    const pageIds = invoiceRequests.map(r => r.id);
    if (isChecked) {
      setSelection(prev => ({ ...prev, selectedIds: new Set([...prev.selectedIds, ...pageIds]) }));
    } else {
      setSelection(prev => {
        const newSet = new Set(prev.selectedIds);
        pageIds.forEach(id => newSet.delete(id));
        if (prev.mode === 'all_filtered') { 
          return { mode: 'none', selectedIds: newSet }; 
        }
        return { ...prev, selectedIds: newSet };
      });
    }
  };

  const selectionCount = useMemo(() => {
    if (selection.mode === 'all_filtered') return totalRequestsCount;
    return selection.selectedIds.size;
  }, [selection, totalRequestsCount]);

  const isAllOnPageSelected = useMemo(() => {
    if (invoiceRequests.length === 0) return false;
    return invoiceRequests.every(req => selection.selectedIds.has(req.id));
  }, [invoiceRequests, selection.selectedIds]);

  // 对申请单按状态分组排序：已审批待开票 > 已开票 > 待审核
  const groupedRequests = useMemo(() => {
    const statusOrder = { 'Approved': 1, 'Completed': 2, 'Pending': 3 };
    return [...invoiceRequests].sort((a, b) => {
      const orderA = statusOrder[a.status as keyof typeof statusOrder] || 99;
      const orderB = statusOrder[b.status as keyof typeof statusOrder] || 99;
      if (orderA !== orderB) return orderA - orderB;
      // 同状态按时间倒序
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [invoiceRequests]);

  // 分页处理函数
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  // 批量操作函数
  // 批量开票
  const handleBatchInvoice = async () => {
    if (selection.selectedIds.size === 0) return;
    
    setIsBatchProcessing(true);
    try {
      const selectedRequestNumbers = invoiceRequests
        .filter(r => selection.selectedIds.has(r.id))
        .map(r => r.request_number);
      
      // 调用批量开票函数
      const { data, error } = await supabase.rpc('batch_complete_invoice_requests', {
        p_request_numbers: selectedRequestNumbers
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string; failed_count: number };
      toast({ 
        title: "批量开票完成", 
        description: result.message,
        variant: result.failed_count > 0 ? "destructive" : "default"
      });
      
      loadInvoiceRequests();
      setSelection({ mode: 'none', selectedIds: new Set() });
    } catch (error) {
      console.error('批量开票失败:', error);
      toast({ 
        title: "批量开票失败", 
        description: error instanceof Error ? error.message : '未知错误', 
        variant: 'destructive' 
      });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // 旧的实现（已废弃）
  const handleBatchInvoice_OLD = async () => {
    if (selection.selectedIds.size === 0) return;
    
    setIsBatchProcessing(true);
    try {
      const selectedIds = Array.from(selection.selectedIds);
      
      // 1. 更新开票申请单状态为已完成
      const { error } = await supabase
        .from('invoice_requests')
        .update({ 
          status: 'Completed',
          updated_at: new Date().toISOString()
        })
        .in('id', selectedIds);

      if (error) throw error;

      // 2. 获取所有相关运单记录ID
      const { data: requestDetails, error: detailsError } = await supabase
        .from('invoice_request_details')
        .select('logistics_record_id')
        .in('invoice_request_id', selectedIds);

      if (detailsError) throw detailsError;

      if (requestDetails && requestDetails.length > 0) {
        // 3. 更新运单记录的开票状态
        const recordIds = requestDetails.map(detail => detail.logistics_record_id);
        const { error: updateError } = await supabase
          .from('logistics_records')
          .update({ 
            invoice_status: 'Invoiced',
            invoice_completed_at: new Date().toISOString()
          })
          .in('id', recordIds);

        if (updateError) throw updateError;

        // 4. 更新 logistics_partner_costs 表的开票状态
        const { error: costsError } = await supabase
          .from('logistics_partner_costs')
          .update({ 
            invoice_status: 'Invoiced',
            invoice_completed_at: new Date().toISOString()
          })
          .in('logistics_record_id', recordIds);

        if (costsError) throw costsError;
      }

      toast({
        title: "批量开票成功",
        description: `已完成 ${selection.selectedIds.size} 个开票申请单的开票，相关运单状态已更新为已开票`,
      });
      
      loadInvoiceRequests();
      setSelection({ mode: 'none', selectedIds: new Set() });
    } catch (error) {
      console.error('批量开票失败:', error);
      toast({
        title: "批量开票失败",
        description: error instanceof Error ? error.message : '无法批量开票',
        variant: "destructive",
      });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // 批量取消开票（回滚开票状态到已审批待开票）- 只对已开票状态起作用
  const handleBatchCancelInvoice = async () => {
    if (selection.selectedIds.size === 0) return;
    
    setIsBatchProcessing(true);
    try {
      const selectedIds = Array.from(selection.selectedIds);
      const selectedReqs = invoiceRequests.filter(r => selectedIds.includes(r.id));
      
      // 只处理已开票状态的申请单
      const completedReqs = selectedReqs.filter(r => r.status === 'Completed');
      const skippedCount = selectedReqs.length - completedReqs.length;
      
      if (completedReqs.length === 0) {
        toast({
          title: "提示",
          description: "没有选择任何已开票的申请单。批量取消开票只对\"已开票\"状态有效。",
        });
        setIsBatchProcessing(false);
        return;
      }
      
      const completedIds = completedReqs.map(r => r.id);
      
      // 只回滚已开票状态的申请单到已审批待开票
      const { error } = await supabase
        .from('invoice_requests')
        .update({ status: 'Approved', updated_at: new Date().toISOString() })
        .in('id', completedIds)
        .eq('status', 'Completed');

      if (error) throw error;

      let description = `已将 ${completedReqs.length} 个开票申请单的状态回滚到"已审批待开票"。`;
      if (skippedCount > 0) {
        description += `\n已跳过 ${skippedCount} 个非已开票状态的申请单。`;
      }

      toast({
        title: "取消开票成功",
        description: description,
      });
      
      loadInvoiceRequests();
      setSelection({ mode: 'none', selectedIds: new Set() });
    } catch (error) {
      console.error('批量取消开票失败:', error);
      toast({
        title: "取消开票失败",
        description: error instanceof Error ? error.message : '无法批量取消开票',
        variant: "destructive",
      });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // 一键作废功能（删除申请单记录和回滚运单状态）- 跳过已开票
  const handleBatchVoid = async () => {
    if (selection.selectedIds.size === 0) return;
    
    setIsBatchProcessing(true);
    try {
      const selectedIds = Array.from(selection.selectedIds);
      const selectedReqs = invoiceRequests.filter(r => selectedIds.includes(r.id));
      
      // 只处理待审核和已审批待开票状态的申请单
      const voidableReqs = selectedReqs.filter(r => ['Pending', 'Approved'].includes(r.status));
      const skippedCompleted = selectedReqs.filter(r => r.status === 'Completed').length;
      
      if (voidableReqs.length === 0) {
        toast({
          title: "提示",
          description: skippedCompleted > 0
            ? `已跳过 ${skippedCompleted} 个已开票的申请单（已开票的申请单需要先取消开票才能作废）。`
            : "没有选择任何可作废的申请单（仅\"待审核\"和\"已审批待开票\"状态可作废）。",
        });
        setIsBatchProcessing(false);
        return;
      }
      
      const voidableIds = voidableReqs.map(r => r.id);
      
      // 调用删除函数
      const { data, error } = await supabase.rpc('void_and_delete_invoice_requests', {
        p_request_ids: voidableIds
      });
      
      if (error) throw error;
      
      const result = data as any;
      if (result.success) {
        let description = `已永久删除 ${result.deleted_requests} 个开票申请单，${result.affected_logistics_records} 条运单状态已回滚为未开票。`;
        if (skippedCompleted > 0) {
          description += `\n已跳过 ${skippedCompleted} 个已开票的申请单。`;
        }
        
        toast({
          title: "作废成功",
          description: description,
        });
      }
      
      loadInvoiceRequests();
      setSelection({ mode: 'none', selectedIds: new Set() });
    } catch (error) {
      console.error('批量作废删除失败:', error);
      toast({
        title: "作废失败",
        description: error instanceof Error ? error.message : '无法批量作废删除开票申请单',
        variant: "destructive",
      });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // 获取完整的运单数据
  const fetchFullLogisticsRecord = async (recordId: string): Promise<LogisticsRecord | null> => {
    try {
      // 分别查询运单、项目和司机信息，避免关系冲突
      const { data: logisticsData, error: logisticsError } = await supabase
        .from('logistics_records')
        .select('*')
        .eq('id', recordId)
        .single();

      if (logisticsError) throw logisticsError;
      if (!logisticsData) throw new Error('运单记录不存在');

      // 查询项目信息
      let projectName = '';
      if (logisticsData.project_id) {
        const { data: projectData } = await supabase
          .from('projects')
          .select('id, name, auto_code')
          .eq('id', logisticsData.project_id)
          .single();
        projectName = projectData?.name || '';
      }

      // 查询司机信息
      interface DriverInfo {
        id?: string;
        name?: string;
        license_plate?: string;
        phone?: string;
      }
      let driverInfo: DriverInfo = {};
      if (logisticsData.driver_id) {
        const { data: driverData } = await supabase
          .from('drivers')
          .select('id, name, license_plate, phone')
          .eq('id', logisticsData.driver_id)
          .single();
        if (driverData) {
          driverInfo = driverData;
        }
      }

      const formattedRecord: LogisticsRecord = {
        id: logisticsData.id,
        auto_number: logisticsData.auto_number,
        project_id: logisticsData.project_id,
        project_name: projectName,
        chain_id: null,
        chain_name: null,
        billing_type_id: 0,
        driver_id: driverInfo.id || '',
        driver_name: driverInfo.name || '',
        loading_location: logisticsData.loading_location,
        unloading_location: logisticsData.unloading_location,
        loading_date: logisticsData.loading_date,
        unloading_date: logisticsData.unloading_date,
        loading_weight: logisticsData.loading_weight,
        unloading_weight: logisticsData.unloading_weight,
        current_cost: logisticsData.current_cost,
        payable_cost: logisticsData.payable_cost,  // 司机应收金额
        license_plate: driverInfo.license_plate || '',
        driver_phone: driverInfo.phone || '',
        transport_type: null,
        extra_cost: null,
        remarks: logisticsData.remarks,
        loading_weighbridge_image_url: null,
        unloading_weighbridge_image_url: null,
        external_tracking_numbers: logisticsData.external_tracking_numbers || [],
        other_platform_names: logisticsData.other_platform_names || [],
        created_at: logisticsData.created_at,
      };
      return formattedRecord;
    } catch (error) {
      console.error('获取运单详情失败:', error);
      toast({
        title: "加载失败",
        description: error instanceof Error ? error.message : '无法加载运单详情',
        variant: "destructive",
      });
      return null;
    }
  };

  // 处理查看运单详情
  const handleViewLogisticsRecord = async (logisticsRecordId: string) => {
    const record = await fetchFullLogisticsRecord(logisticsRecordId);
    if (record) {
      setSelectedLogisticsRecordForView(record);
      setIsLogisticsFormDialogOpen(true);
    }
  };

  // ✅ 新增：处理查看运单详情（使用WaybillDetailDialog）
  const handleViewWaybillDetail = async (recordId: string) => {
    const record = await fetchFullLogisticsRecord(recordId);
    if (record) {
      // 获取chain_name
      let chainName = null;
      if (record.chain_id) {
        const { data: chainData } = await supabase
          .from('chains')
          .select('name')
          .eq('id', record.chain_id)
          .single();
        chainName = chainData?.name || null;
      }
      
      // 添加chain_name属性
      const recordWithChainName = record as LogisticsRecord & { chain_name?: string | null };
      recordWithChainName.chain_name = chainName;
      
      setSelectedWaybillRecord(recordWithChainName);
      setWaybillDetailOpen(true);
    }
  };

  // 处理确认开票
  const handleApproveInvoice = (request: InvoiceRequest) => {
    approveInvoice(request.id);
  };

  // 完成开票（单个）
  const handleCompleteInvoice = async (request: InvoiceRequest) => {
    try {
      // 调用新的开票函数（会同时更新申请单和运单状态）
      const { data, error } = await supabase.rpc('complete_invoice_request_v2', {
        p_request_number: request.request_number
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string; updated_count: number };
      toast({ 
        title: "开票成功", 
        description: result.message || `开票完成，${result.updated_count}条运单状态已更新为"已开票"` 
      });
      
      loadInvoiceRequests();
    } catch (error) {
      console.error('开票失败:', error);
      toast({ 
        title: "开票失败", 
        description: error instanceof Error ? error.message : '未知错误', 
        variant: 'destructive' 
      });
    }
  };

  // 旧的实现（已废弃）
  const handleCompleteInvoice_OLD = async (request: InvoiceRequest) => {
    try {
      // 更新开票申请单状态为已完成
      const { error: requestError } = await supabase
        .from('invoice_requests')
        .update({ 
          status: 'Completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (requestError) throw requestError;

      // 获取申请单详情，更新相关运单的开票状态
      const { data: requestDetails, error: detailsError } = await supabase
        .from('invoice_request_details')
        .select('logistics_record_id')
        .eq('invoice_request_id', request.id);

      if (detailsError) throw detailsError;

      if (requestDetails && requestDetails.length > 0) {
        const recordIds = requestDetails.map(detail => detail.logistics_record_id);
        
        // 更新运单记录的开票状态
        const { error: updateError } = await supabase
          .from('logistics_records')
          .update({ 
            invoice_status: 'Invoiced',
            invoice_completed_at: new Date().toISOString()
          })
          .in('id', recordIds);

        if (updateError) throw updateError;

        // 更新 logistics_partner_costs 表的开票状态
        const { error: costsError } = await supabase
          .from('logistics_partner_costs')
          .update({ 
            invoice_status: 'Invoiced',
            invoice_completed_at: new Date().toISOString()
          })
          .in('logistics_record_id', recordIds);

        if (costsError) throw costsError;
      }

      toast({
        title: "开票成功",
        description: "开票申请单已完成，相关运单状态已更新为已开票",
      });
      loadInvoiceRequests();
    } catch (error) {
      console.error('完成开票失败:', error);
      toast({
        title: "开票失败",
        description: error instanceof Error ? error.message : '无法完成开票',
        variant: "destructive",
      });
    }
  };

  // 查看开票申请表（打印格式）
  const viewInvoiceRequestForm = async (request: InvoiceRequest) => {
    try {
      // ✅ 先查询最高级合作方的税号信息
      let partnerTaxNumber = '';
      let partnerFullName = '';
      
      if (request.invoicing_partner_id) {
        const { data: partnerBankData } = await supabase
          .from('partner_bank_details')
          .select('tax_number, full_name')
          .eq('partner_id', request.invoicing_partner_id)
          .single();
        
        if (partnerBankData) {
          partnerTaxNumber = partnerBankData.tax_number || '';
          partnerFullName = partnerBankData.full_name || '';
        }
      }
      
      // 查询申请单详情
      const { data: detailsData, error: detailsError } = await supabase
        .from('invoice_request_details')
        .select('*')
        .eq('invoice_request_id', request.id);

      if (detailsError) throw detailsError;

      let details: InvoiceRequestDetail[] = [];
      if (detailsData && detailsData.length > 0) {
        // 获取所有运单ID
        const logisticsRecordIds = detailsData.map(detail => detail.logistics_record_id).filter(Boolean);
        
        if (logisticsRecordIds.length > 0) {
          // 分别查询运单信息、项目信息、司机信息
          const [logisticsResult, projectsResult, driversResult] = await Promise.all([
            supabase
              .from('logistics_records')
              .select('id, auto_number, project_id, driver_id, loading_location, unloading_location, loading_date, loading_weight')
              .in('id', logisticsRecordIds),
            supabase
              .from('projects')
              .select('id, name'),
            supabase
              .from('drivers')
              .select('id, name')
          ]);

          if (logisticsResult.error) throw logisticsResult.error;

          // 创建映射
          const projectsMap = new Map(projectsResult.data?.map(p => [p.id, p.name]) || []);
          const driversMap = new Map(driversResult.data?.map(d => [d.id, d.name]) || []);
          const logisticsMap = new Map(logisticsResult.data?.map(l => [l.id, l]) || []);

          // 组合数据
          details = detailsData.map(detail => {
            const logisticsRecord = logisticsMap.get(detail.logistics_record_id);
            return {
              id: detail.id,
              invoice_request_id: detail.invoice_request_id,
              logistics_record_id: detail.logistics_record_id,
              amount: detail.amount,
              logistics_record: {
                auto_number: logisticsRecord?.auto_number || '',
                project_name: logisticsRecord?.project_id ? projectsMap.get(logisticsRecord.project_id) || '' : '',
                driver_name: logisticsRecord?.driver_id ? driversMap.get(logisticsRecord.driver_id) || '' : '',
                loading_location: logisticsRecord?.loading_location || '',
                unloading_location: logisticsRecord?.unloading_location || '',
                loading_date: logisticsRecord?.loading_date || '',
                loading_weight: logisticsRecord?.loading_weight || 0
              }
            };
          });
        }
      }
      
      // 打开新窗口显示打印格式
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast({
          title: "无法打开窗口",
          description: "请允许弹出窗口以查看申请表",
          variant: "destructive",
        });
        return;
      }

      // ✅ 将查询到的税号和全称传递给生成函数
      const enrichedRequest = {
        ...request,
        invoicing_partner_tax_number: partnerTaxNumber || request.invoicing_partner_tax_number,
        tax_number: partnerTaxNumber || request.tax_number,
        invoicing_partner_full_name: partnerFullName || request.invoicing_partner_full_name || request.partner_full_name
      };

      // 生成打印HTML
      const htmlContent = generateInvoiceRequestFormHTML(enrichedRequest, details);
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } catch (error) {
      console.error('生成申请表失败:', error);
      toast({
        title: "生成失败",
        description: error instanceof Error ? error.message : '无法生成申请表',
        variant: "destructive",
      });
    }
  };

  // 生成开票申请表HTML
  const generateInvoiceRequestFormHTML = (request: InvoiceRequest, details: InvoiceRequestDetail[]) => {
    const totalWeight = details.reduce((sum, d) => sum + (d.logistics_record.loading_weight || 0), 0);
    
    // AI动态生成备注总结
    const generateDynamicSummary = () => {
      if (details.length === 0) return '无运单记录';
      
      // 提取关键信息
      const projectNames = [...new Set(details.map(d => d.logistics_record.project_name).filter(Boolean))];
      const driverNames = [...new Set(details.map(d => d.logistics_record.driver_name).filter(Boolean))];
      const destinations = [...new Set(details.map(d => d.logistics_record.unloading_location).filter(Boolean))];
      
      // 提取日期范围
      const dates = details
        .map(d => d.logistics_record.loading_date)
        .filter(Boolean)
        .sort();
      
      let dateRange = '';
      if (dates.length > 0) {
        const startDate = new Date(dates[0]);
        const endDate = new Date(dates[dates.length - 1]);
        const startMonth = format(startDate, 'M月');
        const endMonth = format(endDate, 'M月');
        
        if (startMonth === endMonth) {
          dateRange = format(startDate, 'yyyy年M月');
        } else {
          dateRange = `${format(startDate, 'yyyy年M月')}-${endMonth}`;
        }
      }
      
      // 构建总结
      let summary = '';
      
      // 司机信息（取第一个）
      if (driverNames.length > 0) {
        summary += driverNames[0];
      }
      
      // 项目信息
      if (projectNames.length > 0) {
        summary += projectNames.length === 1 
          ? projectNames[0] 
          : `等${projectNames.length}个项目`;
      }
      
      // 日期范围
      if (dateRange) {
        summary += dateRange;
      }
      
      // 目的地（如果只有一个）
      if (destinations.length === 1) {
        summary += `配送至${destinations[0]}`;
      } else if (destinations.length > 1) {
        summary += `配送至${destinations[0]}等${destinations.length}个地点`;
      }
      
      // 总重量
      if (totalWeight > 0) {
        summary += `，共计${totalWeight.toFixed(2)}吨`;
      }
      
      return summary || '运输服务';
    };
    
    const dynamicSummary = generateDynamicSummary();
    
    // ✅ 处理合作方名称和信息（与开票审核页面一致）
    const partnerName = request.invoicing_partner_full_name || request.partner_full_name || request.partner_name || '未知合作方';
    const requestNumber = request.request_number || request.id;
    const totalAmount = request.total_amount || 0;
    const recordCount = request.record_count || details.length;
    const createdAt = request.created_at || new Date().toISOString();
    const invoiceNumber = request.invoice_number || '';
    
    // 获取公司抬头和税号
    const companyName = request.invoicing_partner_full_name || request.partner_full_name || partnerName;
    const taxNumber = request.invoicing_partner_tax_number || request.tax_number || '';
    
    // 动态获取货物类型（从运单中提取）
    const cargoTypes = [...new Set(details.map(d => (d.logistics_record as any).cargo_type).filter(Boolean))];
    const cargoType = cargoTypes.length === 1 ? cargoTypes[0] : (cargoTypes.length > 1 ? `${cargoTypes[0]}等` : '食品');
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>开票申请表 - ${requestNumber}</title>
  <style>
    @media print {
      @page { margin: 1cm; }
      body { margin: 0; }
      .no-print { display: none; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "SimSun", "Microsoft YaHei", Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      padding: 60px 20px 20px 20px;  /* ✅ 上边距60px，为打印按钮留空间 */
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .company-name {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0;
      padding: 10px;
      border: 1px solid #000;
    }
    .info-item {
      display: flex;
      align-items: center;
      padding: 0 10px;
    }
    .info-label {
      font-weight: bold;
      margin-right: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 0;
    }
    th, td {
      border: 1px solid #000;
      padding: 8px;
      text-align: center;
    }
    table.main-table {
      border-bottom: none;
    }
    th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .signatures-table {
      margin-top: 0;
      width: 100%;
      border-collapse: collapse;
    }
    .signatures-table th {
      border: 1px solid #000;
      padding: 8px;
      text-align: center;
      font-weight: bold;
      background-color: #f0f0f0;
    }
    .signatures-table td {
      border: 1px solid #000;
      padding: 0;
      height: 80px;
      background-color: #fff;
    }
    .remarks {
      margin: 0;
    }
    .remarks-content {
      border: none;
      min-height: 60px;
      padding: 0;
      margin-top: 5px;
    }
    .disclaimer {
      margin-top: 0;
      font-size: 11px;
      line-height: 1.8;
      border: 1px solid #000;
      border-top: none;
      border-bottom: none;
      padding: 10px;
    }
    .invoice-info-table {
      margin-top: 0;
      width: 100%;
      border-collapse: collapse;
    }
    .invoice-info-table td {
      border: 1px solid #000;
      padding: 8px;
      text-align: left;
    }
    .invoice-info-table .label-cell {
      font-weight: bold;
      width: 120px;
      background-color: #f0f0f0;
    }
    .invoice-info-table .value-cell {
      width: 200px;
    }
    .print-button {
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 10px 20px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    .print-button:hover {
      background: #0056b3;
    }
  </style>
</head>
<body>
  <button class="print-button no-print" onclick="window.print()">打印申请表</button>
  
  <div class="header">
    <div class="company-name">中科智运（云南）供应链科技有限公司开票申请表</div>
  </div>

  <div class="info-row">
    <div class="info-item">
      <span class="info-label">货主单位：</span>
      <span>${partnerName}</span>
    </div>
    <div class="info-item">
      <span class="info-label">申请时间：</span>
      <span>${format(new Date(createdAt), 'yyyy-MM-dd')}</span>
    </div>
    <div class="info-item">
      <span class="info-label">申请编号：</span>
      <span>${requestNumber}</span>
    </div>
  </div>

  <table class="main-table">
    <thead>
      <tr>
        <th style="width: 40px;">序号</th>
        <th style="width: 100px;">申请日期</th>
        <th>开票抬头</th>
        <th style="width: 80px;">货物</th>
        <th style="width: 100px;">业务期限</th>
        <th>目的地</th>
        <th style="width: 60px;">运单数</th>
        <th style="width: 120px;">开票金额</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>${format(new Date(createdAt), 'yyyy-MM-dd')}</td>
        <td class="text-left">${partnerName}</td>
        <td>${cargoType}</td>
        <td>${format(new Date(createdAt), 'yyyy年MM月')}</td>
        <td class="text-left">${details.length > 0 ? details[0].logistics_record.unloading_location : '-'}</td>
        <td>${recordCount}</td>
        <td class="text-right">¥${totalAmount.toLocaleString()}</td>
      </tr>
      <tr>
        <td colspan="7" class="text-left" style="padding-left: 20px;">
          <strong>备注：${dynamicSummary}</strong>
        </td>
        <td class="text-right">
          <strong>合计：</strong>
        </td>
      </tr>
      <tr>
        <td colspan="7" class="text-right" style="padding-right: 20px;">
          <strong>运单数：${request.record_count}</strong>
        </td>
        <td class="text-right">
          <strong>¥${(request.total_amount || 0).toLocaleString()}</strong>
        </td>
      </tr>
    </tbody>
  </table>

  <table style="margin-top: 0; border-top: none;">
    <tbody>
      <tr>
        <td style="width: 15%; font-weight: bold; border-top: none;">公司抬头：</td>
        <td style="width: 35%; text-align: left; border-top: none; font-weight: bold;">${companyName}</td>
        <td style="width: 15%; font-weight: bold; border-top: none;">税号：</td>
        <td style="width: 35%; text-align: left; border-top: none; font-weight: bold;">${taxNumber || '请联系合作方补充税号信息'}</td>
      </tr>
    </tbody>
  </table>

  <div class="remarks" style="margin-top: 0; border: 1px solid #000; border-top: none; padding: 10px;">
    <div><strong>事项说明：</strong></div>
    <div class="remarks-content" style="border: none; min-height: 60px;">
      ${(request as any).remarks || dynamicSummary}
    </div>
  </div>

  <table class="signatures-table" style="border-top: none;">
    <thead>
      <tr>
        <th style="width: 25%; border-top: none;">信息部专员签字</th>
        <th style="width: 25%; border-top: none;">业务部审核签字</th>
        <th style="width: 25%; border-top: none;">复核审批人签字</th>
        <th style="width: 25%; border-top: none;">财务部审核签字</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <div class="disclaimer">
    以上相关内容经本人(申请人)与客户充分沟通，并保证所提供相关资料的准确与完整，如因资料不符或约定不清等原因造成退票，其责任损失将由开票申请人负责。
  </div>

  <table class="invoice-info-table">
    <tbody>
      <tr>
        <td class="label-cell">发票号码：</td>
        <td class="value-cell">${invoiceNumber}</td>
        <td class="label-cell">领票日期：</td>
        <td class="value-cell"></td>
      </tr>
      <tr>
        <td class="label-cell">领票人：</td>
        <td class="value-cell"></td>
        <td class="label-cell">发票开具情况：</td>
        <td class="value-cell"></td>
      </tr>
    </tbody>
  </table>

  <script>
    // 自动打印（可选）
    // window.onload = function() { window.print(); };
  </script>
</body>
</html>`;
  };

  // 导出开票申请单
  const exportInvoiceRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('invoice_requests')
        .select(`
          *,
          profiles!created_by (
            full_name
          )
        `)
        .order('created_at', { ascending: false});

      if (error) throw error;

      // 创建开票申请单格式的HTML表格
      const createInvoiceRequestHTML = (requests: InvoiceRequest[]) => {
        const currentDate = format(new Date(), 'yyyy-MM-dd');
        const totalAmount = requests.reduce((sum, req) => sum + (req.total_amount || 0), 0);

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>开票申请单</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .company-name { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
        .title { font-size: 16px; font-weight: bold; margin-bottom: 10px; }
        .subtitle { font-size: 14px; margin-bottom: 20px; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .info-item { font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th, td { border: 1px solid #000; padding: 8px; text-align: center; font-size: 12px; }
        th { background-color: #f0f0f0; font-weight: bold; }
        .remarks-section { margin-top: 20px; margin-bottom: 20px; }
        .signature-section { margin-top: 40px; }
        .signature-row { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .signature-item { width: 200px; text-align: center; }
        .signature-line { border-bottom: 1px solid #000; height: 30px; margin-bottom: 5px; }
        .disclaimer { margin-top: 30px; font-size: 12px; line-height: 1.5; }
        .invoice-details { margin-top: 30px; }
        .invoice-details table { width: 60%; }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-name">中科智运 (云南) 供应链科技有限公司开票申请单</div>
        <div class="subtitle">申请单编号: ${requests[0]?.request_number || 'N/A'}</div>
    </div>

    <table>
        <thead>
            <tr>
                <th>申请日期</th>
                <th>开票抬头</th>
                <th>回款金额</th>
                <th>数量/单位(方)</th>
                <th>业务期限</th>
                <th>实际运费</th>
                <th>开票金额</th>
            </tr>
        </thead>
        <tbody>
            ${requests.map((request, index) => `
                <tr>
                    <td>${format(new Date(request.created_at), 'yyyy年MM月dd日')}</td>
                    <td>${request.partner_name}</td>
                    <td></td>
                    <td></td>
                    <td>${format(new Date(request.created_at), 'yyyy年MM月')}</td>
                    <td>${(request.total_amount || 0).toLocaleString()}</td>
                    <td>${(request.total_amount || 0).toLocaleString()}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="remarks-section">
        <div><strong>事项说明:</strong></div>
        <div style="height: 50px; border: 1px solid #ccc; margin-top: 10px;"></div>
    </div>

    <div class="signature-section">
        <div class="signature-row">
            <div class="signature-item">
                <div>信息员</div>
                <div class="signature-line"></div>
            </div>
            <div class="signature-item">
                <div>业务员</div>
                <div class="signature-line"></div>
            </div>
            <div class="signature-item">
                <div>财务部审核</div>
                <div class="signature-line"></div>
            </div>
            <div class="signature-item">
                <div>客户核对签字</div>
                <div class="signature-line"></div>
            </div>
        </div>
    </div>

    <div class="disclaimer">
        以上相关内容经本人(申请人)与客户充分沟通,并保证所提供相关资料的准确与完整,如因资料不符或约定不清等原因造成退票,其责任损失将由开票申请人负责。
    </div>

    <div class="invoice-details">
        <table>
            <tr>
                <td><strong>发票号码:</strong></td>
                <td style="border-bottom: 1px solid #000; width: 200px;"></td>
                <td><strong>领票日期:</strong></td>
                <td style="border-bottom: 1px solid #000; width: 200px;"></td>
            </tr>
            <tr>
                <td><strong>领票人:</strong></td>
                <td style="border-bottom: 1px solid #000; width: 200px;"></td>
                <td><strong>发票开具情况:</strong></td>
                <td style="border-bottom: 1px solid #000; width: 200px;"></td>
            </tr>
        </table>
    </div>
</body>
</html>`;
      };

      // 创建HTML内容
      const htmlContent = createInvoiceRequestHTML((data || []) as InvoiceRequest[]);
      
      // 下载文件
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `开票申请单_${format(new Date(), 'yyyyMMdd_HHmmss')}.html`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "导出成功",
        description: `已导出 ${data?.length || 0} 条记录，格式类似开票申请单`,
      });
    } catch (error) {
      console.error('导出失败:', error);
      toast({
        title: "导出失败",
        description: error.message || '无法导出数据',
        variant: "destructive",
      });
    }
  };

  // ✅ 已删除getStatusBadgeVariant和getStatusText函数（使用StatusBadge组件替代）
  
  // ✅ 表格列配置（调整顺序：与InvoiceAudit.tsx保持一致）
  const tableColumns: TableColumn[] = useMemo(() => [
    { key: 'number', label: '开票单号' },
    { key: 'time', label: '申请时间' },
    { key: 'status', label: '开票申请单状态' },
    { key: 'loading_date_range', label: '装货日期范围' },  // ✅ 新增列
    { key: 'total_payable_cost', label: '司机应收合计', align: 'right' },  // ✅ 新增列
    { key: 'amount', label: '开票金额', align: 'right' },
    { key: 'count', label: '运单数', align: 'right' },  // ✅ 调整：放在开票金额后面
    { key: 'remarks', label: '备注' },
    { key: 'actions', label: '操作', align: 'center' }
  ], []);

  // ✅ 批量操作配置
  const bulkActions: BulkAction[] = useMemo(() => [
    {
      key: 'invoice',
      label: '批量开票',
      icon: <CheckCircle className="mr-2 h-4 w-4" />,
      variant: 'default',
      className: 'bg-green-600 hover:bg-green-700 text-white border-0',
      needConfirm: true,
      confirmTitle: `确认批量开票 ${selectionCount} 个申请单`,
      confirmDescription: '此操作将完成选中申请单的开票，并将所有关联运单的状态更新为已开票。请确认操作。',
      onClick: handleBatchInvoice
    },
    {
      key: 'cancel-invoice',
      label: '批量取消开票',
      icon: <RotateCcw className="mr-2 h-4 w-4" />,
      variant: 'default',
      className: 'bg-orange-600 hover:bg-orange-700 text-white border-0',
      needConfirm: true,
      confirmTitle: `确认批量取消开票 ${selectionCount} 个申请单`,
      confirmDescription: '此操作将把已开票的申请单状态回滚到"已审批待开票"。请确认操作。',
      onClick: handleBatchCancelInvoice
    },
    {
      key: 'void',
      label: '一键作废',
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      variant: 'destructive',
      needConfirm: true,
      confirmTitle: `确认作废并删除 ${selectionCount} 个申请单`,
      confirmDescription: '⚠️ 此操作将：\n- 永久删除申请单记录\n- 回滚运单状态为未开票\n\n此操作不可逆，请谨慎操作！',
      onClick: handleBatchVoid
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [selectionCount]);

  // 过滤后的申请单列表（使用分组排序后的数据）
  // 筛选逻辑已在loadInvoiceRequests中处理，使用groupedRequests实现状态分组
  const filteredRequests = groupedRequests;

  // 加载筛选选项数据
  const loadFilterOptions = async () => {
    try {
      // 加载项目列表
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');
      
      if (projectsError) throw projectsError;
      setProjects(projectsData || []);

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
      console.error('加载筛选选项失败:', error);
    }
  };

  useEffect(() => {
    loadInvoiceRequests();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader 
        title="财务开票" 
        description="管理和跟踪所有开票申请单的状态"
        icon={FileText}
        iconColor="text-blue-600"
      />

      {/* 筛选条件卡片 */}


      {/* 筛选器（参考财务付款页面） */}
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
          {/* 常规查询 - 第一行 */}
          <div className="flex flex-wrap gap-3 items-end">
            {/* 开票申请单号 */}
            <div className="flex-1 min-w-[180px] space-y-2">
              <Label htmlFor="requestNumber" className="text-sm font-medium">开票申请单号</Label>
              <div className="relative">
                <Input
                  id="requestNumber"
                  placeholder="输入申请单号"
                  value={filters.requestNumber}
                  onChange={(e) => handleFilterChange('requestNumber', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      loadInvoiceRequests();
                    }
                  }}
                  className="pr-8"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
                  onClick={() => openBatchInputDialog('requestNumber')}
                >
                  <span className="text-lg">+</span>
                </Button>
              </div>
            </div>

            {/* 开票状态 */}
            <div className="flex-1 min-w-[140px] space-y-2">
              <Label htmlFor="status" className="text-sm font-medium">开票申请单状态</Label>
              <select
                id="status"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm h-10"
              >
                <option value="">全部状态</option>
                <option value="Pending">待审核</option>
                <option value="Approved">已审批待开票</option>
                <option value="Completed">已开票</option>
              </select>
            </div>

            {/* 项目 */}
            <div className="flex-1 min-w-[140px] space-y-2">
              <Label htmlFor="projectId" className="text-sm font-medium flex items-center gap-1">
                <Building className="h-4 w-4" />
                项目
              </Label>
              <select
                id="projectId"
                value={filters.projectId}
                onChange={(e) => handleFilterChange('projectId', e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm h-10"
              >
                <option value="">全部项目</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
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
              <Button onClick={loadInvoiceRequests} size="default" className="bg-blue-600 hover:bg-blue-700 h-10">
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
                      placeholder="司机姓名，多个用逗号/空格分隔..."
                      value={filters.driverName}
                      onChange={(e) => handleFilterChange('driverName', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          loadInvoiceRequests();
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
                      placeholder="车牌号，多个用逗号/空格分隔..."
                      value={filters.licensePlate}
                      onChange={(e) => handleFilterChange('licensePlate', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          loadInvoiceRequests();
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
                      placeholder="电话号码，多个用逗号/空格分隔..."
                      value={filters.phoneNumber}
                      onChange={(e) => handleFilterChange('phoneNumber', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          loadInvoiceRequests();
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
                      placeholder="输入运单编号，多个用逗号/空格分隔..."
                      value={filters.waybillNumber}
                      onChange={(e) => handleFilterChange('waybillNumber', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          loadInvoiceRequests();
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


      {/* 申请单列表 */}
      <Card className="shadow-lg border-2 border-border/50 overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-background to-muted/30 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              开票申请单列表 ({filteredRequests.length})
            </CardTitle>
            
            {/* ✅ 使用BulkActionBar组件 */}
            <BulkActionBar
              selectedCount={selectionCount}
              isProcessing={isBatchProcessing}
              actions={bulkActions}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0 p-0">
          {/* ✅ 使用LoadingState组件 */}
          {loading ? (
            <LoadingState message="加载开票申请单中..." />
          ) : (
            <div className="border-t">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow className="border-b-2 hover:bg-muted/50">
                  <TableHead className="w-12 font-semibold"><Checkbox checked={isAllOnPageSelected} onCheckedChange={handleSelectAllOnPage} /></TableHead>
                  <TableHead className="font-semibold text-foreground">开票单号</TableHead>
                  <TableHead className="font-semibold text-foreground">申请时间</TableHead>
                  <TableHead className="font-semibold text-foreground">开票申请单状态</TableHead>
                  <TableHead className="font-semibold text-foreground">装货日期范围</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">司机应收合计</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">开票金额</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">运单数</TableHead>
                  <TableHead className="max-w-[200px] font-semibold text-foreground">备注</TableHead>
                  <TableHead className="text-center font-semibold text-foreground">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length > 0 ? (
                  filteredRequests.map((request, index) => {
                    // 检查是否需要插入分割线
                    const prevReq = index > 0 ? filteredRequests[index - 1] : null;
                    const showDivider = prevReq && prevReq.status !== request.status;
                    
                    return (
                      <Fragment key={request.id}>
                        {/* 状态分组分割线 */}
                        {showDivider && (
                          <TableRow className="bg-gradient-to-r from-transparent via-muted/30 to-transparent hover:bg-gradient-to-r hover:from-transparent hover:via-muted/30 hover:to-transparent border-y border-border/50">
                            <TableCell colSpan={10} className="h-3 p-0">
                              <div className="w-full h-full flex items-center justify-center">
                                <div className="w-full max-w-md h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        
                        <TableRow 
                      key={request.id}
                      data-state={selection.selectedIds.has(request.id) ? "selected" : undefined}
                      className={cn(
                        "hover:bg-muted/60 transition-colors duration-150 border-b border-border/30",
                        selection.selectedIds.has(request.id) && "bg-primary/5 border-l-4 border-l-primary"
                      )}
                      onClick={() => handleViewDetails(request)}
                    >
                      <TableCell className="w-12 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selection.selectedIds.has(request.id)}
                          onCheckedChange={() => handleRequestSelect(request.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono cursor-pointer py-3" onClick={() => handleViewDetails(request)}>
                        {request.request_number}
                      </TableCell>
                      <TableCell className="cursor-pointer py-3" onClick={() => handleViewDetails(request)}>
                        <span className="text-sm">{format(new Date(request.created_at), 'yyyy-MM-dd HH:mm')}</span>
                      </TableCell>
                      <TableCell className="cursor-pointer py-3" onClick={() => handleViewDetails(request)}>
                        {/* ✅ 使用StatusBadge组件 */}
                        <StatusBadge status={request.status} customConfig={INVOICE_REQUEST_STATUS_CONFIG} />
                      </TableCell>
                      <TableCell className="cursor-pointer py-3" onClick={() => handleViewDetails(request)}>
                        <span className="text-sm text-muted-foreground">
                          {request.loading_date_range ? convertUTCDateRangeToChinaDateRange(request.loading_date_range) : '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right cursor-pointer py-3 font-mono font-semibold text-green-700" onClick={() => handleViewDetails(request)}>
                        {request.total_payable_cost ? `¥${request.total_payable_cost.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                      </TableCell>
                      <TableCell className="text-right cursor-pointer py-3 font-mono font-semibold text-blue-700" onClick={() => handleViewDetails(request)}>
                        {request.total_amount ? `¥${request.total_amount.toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell className="text-right cursor-pointer py-3 font-medium" onClick={() => handleViewDetails(request)}>
                        {request.record_count}
                      </TableCell>
                      <TableCell className="max-w-[200px] cursor-pointer truncate text-sm text-muted-foreground py-3" onClick={() => handleViewDetails(request)} title={request.remarks || ''}>
                        {request.remarks || '-'}
                      </TableCell>
                      <TableCell className="text-center py-3" onClick={(e) => e.stopPropagation()}>
                        {/* ✅ 使用ActionButtons组件 */}
                        <ActionButtons
                          actions={[
                            {
                              label: '查看申请单',
                              icon: <FileText className="mr-2 h-4 w-4" />,
                              variant: 'default',
                              className: 'bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-sm transition-all duration-200',
                              needConfirm: true,
                              confirmTitle: '查看开票申请单',
                              confirmDescription: `确定要查看申请单 ${request.request_number} 的详细信息吗？`,
                              onClick: () => viewInvoiceRequestForm(request)
                            },
                            ...(request.status === 'Approved' ? [{
                              label: '开票',
                              icon: <CheckCircle className="mr-2 h-4 w-4" />,
                              variant: 'default' as const,
                              className: 'bg-green-600 hover:bg-green-700 text-white border-0 shadow-sm transition-all duration-200',
                              needConfirm: true,
                              confirmTitle: '确认开票',
                              confirmDescription: `确定要完成申请单 ${request.request_number} 的开票吗？开票后将更新所有关联运单的状态为已开票。`,
                              onClick: () => handleCompleteInvoice(request)
                            }] : [])
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                      </Fragment>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center">
                      暂无开票申请记录。
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ✅ 使用PaginationControl组件 */}
      <PaginationControl
        currentPage={currentPage}
        pageSize={pageSize}
        totalPages={totalPages}
        totalCount={totalRequestsCount}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {/* 详情对话框 */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DialogTitle>申请单详情: {selectedRequest?.request_number}</DialogTitle>
                <DialogDescription>
                  此申请单包含以下 {selectedRequest?.record_count ?? 0} 条运单记录。
                </DialogDescription>
              </div>
              {/* ✅ 复制运单号按钮 */}
              {requestDetails.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const waybillNumbers = requestDetails.map(detail => detail.logistics_record.auto_number).filter(Boolean).join(',');
                    navigator.clipboard.writeText(waybillNumbers).then(() => {
                      toast({
                        title: "复制成功",
                        description: `已复制 ${requestDetails.length} 个运单号到剪贴板`,
                      });
                    }).catch(() => {
                      toast({
                        title: "复制失败",
                        description: "无法复制到剪贴板",
                        variant: "destructive",
                      });
                    });
                  }}
                  className="ml-4"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  复制运单号
                </Button>
              )}
            </div>
          </DialogHeader>
          
          {/* ✅ 新增：金额汇总 (按合作方) 和司机应收合计 */}
          {selectedRequest && requestDetails.length > 0 && (
            <div className="p-4 border rounded-lg bg-muted/50">
              <h4 className="mb-2 font-semibold text-foreground">金额汇总 (按合作方)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-muted-foreground">{selectedRequest.invoicing_partner_full_name || selectedRequest.partner_full_name || selectedRequest.partner_name || '开票单位'}:</span>
                  <span className="font-mono font-semibold text-primary">
                    {(requestDetails.reduce((sum, d) => sum + (d.invoiceable_amount || d.amount || 0), 0)).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}
                  </span>
                </div>
              </div>
              {/* ✅ 新增：司机应收合计 */}
              {selectedRequest.total_payable_cost !== undefined && (
                <div className="mt-3 pt-3 border-t flex justify-between items-baseline">
                  <span className="text-sm font-semibold text-foreground">司机应收合计：</span>
                  <span className="font-mono font-semibold text-green-700">
                    {selectedRequest.total_payable_cost.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          )}
          
          <div className="max-h-[50vh] overflow-y-auto">
          
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>运单号</TableHead>
                  <TableHead>司机</TableHead>
                  <TableHead>车牌号</TableHead>
                  <TableHead>起运地 → 目的地</TableHead>
                  <TableHead>装车日期</TableHead>
                  <TableHead className="text-right">吨位</TableHead>
                  <TableHead className="text-right">司机应收(元)</TableHead>
                  <TableHead className="text-right">开票金额(元)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requestDetails.length > 0 ? (
                  requestDetails.map((detail) => (
                    <TableRow key={detail.id}>
                      <TableCell 
                        className="font-mono cursor-pointer hover:text-primary hover:underline"
                        onClick={() => handleViewWaybillDetail(detail.logistics_record_id)}
                      >
                        {detail.logistics_record.auto_number}
                      </TableCell>
                      <TableCell>{detail.logistics_record.driver_name}</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>{`${detail.logistics_record.loading_location} → ${detail.logistics_record.unloading_location}`}</TableCell>
                      <TableCell>
                        {detail.logistics_record.loading_date ? format(new Date(detail.logistics_record.loading_date), 'yyyy-MM-dd') : '-'}
                      </TableCell>
                      <TableCell className="text-right">{detail.logistics_record.loading_weight ?? 'N/A'}</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-green-700">
                        {detail.logistics_record.payable_cost ? `¥${detail.logistics_record.payable_cost.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-primary">
                        {(detail.invoiceable_amount || detail.amount || 0).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      未能加载运单详情或此申请单无运单。
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* 编辑状态对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑申请单状态</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="status">状态</Label>
              <Select value={editForm.status} onValueChange={(value) => setEditForm({...editForm, status: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">待审核</SelectItem>
                  <SelectItem value="Approved">已通过</SelectItem>
                  <SelectItem value="Completed">已完成</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="remarks">备注</Label>
              <Textarea
                id="remarks"
                placeholder="请输入备注信息..."
                value={editForm.remarks}
                onChange={(e) => setEditForm(prev => ({...prev, remarks: e.target.value}))}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => updateRequestStatus(selectedRequest?.id || '', editForm.status, editForm.remarks)}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 作废对话框 */}
      <Dialog open={isVoidDialogOpen} onOpenChange={setIsVoidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>作废开票申请单</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>申请单号</Label>
              <div className="font-medium">{selectedRequest?.request_number}</div>
            </div>
            
            <div>
              <Label htmlFor="void-reason">作废原因</Label>
              <Textarea
                id="void-reason"
                placeholder="请输入作废原因..."
                value={voidForm.reason}
                onChange={(e) => setVoidForm(prev => ({...prev, reason: e.target.value}))}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVoidDialogOpen(false)}>
              取消
            </Button>
            <Button 
              variant="destructive"
              onClick={() => voidRequest(selectedRequest?.id || '', voidForm.reason)}
            >
              确认作废
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 运单详情对话框 */}
      {selectedLogisticsRecordForView && (
        <LogisticsFormDialog
          isOpen={isLogisticsFormDialogOpen}
          onClose={() => {
            setIsLogisticsFormDialogOpen(false);
            setSelectedLogisticsRecordForView(null);
          }}
          record={selectedLogisticsRecordForView}
        />
      )}

      {/* ✅ 新增：运单详情对话框（WaybillDetailDialog） */}
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
