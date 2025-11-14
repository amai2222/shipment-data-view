// 文件路径: src/pages/InvoiceAudit.tsx
// 描述: 开票审核页面 - 完全复制自PaymentAudit，将付款逻辑改为开票逻辑

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import type { MouseEvent } from 'react';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShipperProjectCascadeFilter } from '@/components/ShipperProjectCascadeFilter';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, FileSpreadsheet, Trash2, ClipboardList, FileText, Receipt, RotateCcw, Users, Copy, DollarSign, Upload, X as XIcon, History, FileCheck } from 'lucide-react';
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

import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
// ✅ 修改：移除日期转换函数，直接传递中国时区日期字符串给后端
import { convertUTCDateRangeToChinaDateRange } from '@/utils/dateRangeUtils';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, X, Building2, Search } from 'lucide-react';
import { zhCN } from 'date-fns/locale';
import { BatchInputDialog } from '@/pages/BusinessEntry/components/BatchInputDialog';
import { WaybillDetailDialog } from '@/components/WaybillDetailDialog';
import { LogisticsRecord, PlatformTracking } from '@/types';
import { RouteDisplay } from '@/components/RouteDisplay';

// --- 类型定义 ---
interface InvoiceRequest {
  id: string;
  created_at: string;
  request_number: string;
  status: 'Pending' | 'Approved' | 'Completed' | 'Received' | 'Rejected' | 'Voided';
  remarks: string | null;
  logistics_record_ids: string[];
  record_count: number;
  total_amount?: number; // 开票金额
  total_received_amount?: number;  // 累计收款金额（支持部分收款）
  remaining_amount?: number;  // 未收款金额
  payment_due_date?: string;  // 收款期限
  overdue_days?: number;  // 逾期天数
  reminder_count?: number;  // 提醒次数
  reconciliation_status?: string;  // 对账状态
  invoicing_partner_id?: string;  // ✅ 添加（关键！）
  partner_name?: string;
  partner_full_name?: string;
  invoicing_partner_full_name?: string;
  invoicing_partner_tax_number?: string;
  tax_number?: string;
  invoice_number?: string;
  loading_date_range?: string;    // ✅ 新增：运单装货日期范围
  total_payable_cost?: number;     // ✅ 新增：司机应收合计
}

// 从RPC函数返回的原始数据类型
interface InvoiceRequestRaw {
  id: string;
  created_at: string;
  request_number: string;
  status: string;
  remarks: string | null;
  record_count: number;
  total_amount?: number;
  total_received_amount?: number;  // 累计收款金额（支持部分收款）
  remaining_amount?: number;  // 未收款金额
  payment_due_date?: string;  // 收款期限
  overdue_days?: number;  // 逾期天数
  reminder_count?: number;  // 提醒次数
  reconciliation_status?: string;  // 对账状态
  invoicing_partner_id?: string;
  partner_name?: string;
  partner_full_name?: string;
  invoicing_partner_full_name?: string;
  invoicing_partner_tax_number?: string;
  tax_number?: string;
  invoice_number?: string;
  loading_date_range?: string;    // ✅ 新增：运单装货日期范围
  total_payable_cost?: number;     // ✅ 新增：司机应收合计
  total_count?: number; // 用于分页
}

interface LogisticsRecordDetail { 
  id: string; 
  auto_number: string; 
  driver_name: string; 
  license_plate: string; 
  loading_location: string; 
  unloading_location: string; 
  loading_date: string; 
  loading_weight: number | null; 
  payable_cost: number | null;  // ✅ 新增：司机应收
  invoiceable_amount: number | null; 
}

interface InvoiceRequestDetail {
  id: string;
  invoice_request_id: string;
  logistics_record_id: string;
  invoiceable_amount?: number;
  amount?: number;
  partner_id?: string;
  invoicing_partner_full_name?: string;
  partner_full_name?: string;
  partner_name?: string;
}

// RPC函数返回值类型
interface VoidInvoiceRequestResult {
  success: boolean;
  message?: string;
  affected_records?: number;
}

interface VoidAndDeleteInvoiceRequestsResult {
  success: boolean;
  message?: string;
  deleted_requests?: number;
  affected_logistics_records?: number;
  affected_partner_costs?: number;
}

interface BatchRollbackApprovalResult {
  success: boolean;
  message?: string;
  rollback_count?: number;
  failed_count?: number;
  not_approved_count?: number;
  failed_requests?: string[];
}

interface PartnerTotal { partner_id: string; partner_name: string; total_amount: number; level: number; }
interface SelectionState { mode: 'none' | 'all_filtered'; selectedIds: Set<string>; }

export default function InvoiceAudit() {
  const [requests, setRequests] = useState<InvoiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { hasButtonAccess, loading: permissionsLoading, isAdmin } = useUnifiedPermissions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<InvoiceRequest | null>(null);
  const [modalRecords, setModalRecords] = useState<LogisticsRecordDetail[]>([]);
  const [modalContentLoading, setModalContentLoading] = useState(false);
  const [partnerTotals, setPartnerTotals] = useState<PartnerTotal[]>([]);
  // ✅ 新增：运单详情对话框状态（用于WaybillDetailDialog）
  const [waybillDetailOpen, setWaybillDetailOpen] = useState(false);
  const [selectedWaybillRecord, setSelectedWaybillRecord] = useState<LogisticsRecord | null>(null);
  const [selection, setSelection] = useState<SelectionState>({ mode: 'none', selectedIds: new Set() });
  const [isCancelling, setIsCancelling] = useState(false);
  
  // 收款对话框状态
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [selectedReceiptRequest, setSelectedReceiptRequest] = useState<InvoiceRequest | null>(null);
  const [receiptNumber, setReceiptNumber] = useState<string>('');  // 收款单号
  const [receiptBank, setReceiptBank] = useState<string>('');  // 收款银行
  const [receiptAmount, setReceiptAmount] = useState<string>('');  // 收款金额
  const [receiptImages, setReceiptImages] = useState<File[]>([]);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [totalRequestsCount, setTotalRequestsCount] = useState(0);
  
  // 退款对话框状态
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [selectedRefundRequest, setSelectedRefundRequest] = useState<InvoiceRequest | null>(null);
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundReason, setRefundReason] = useState<string>('');
  const [processingRefund, setProcessingRefund] = useState(false);
  
  // 对账对话框状态
  const [showReconciliationDialog, setShowReconciliationDialog] = useState(false);
  const [selectedReconciliationRequest, setSelectedReconciliationRequest] = useState<InvoiceRequest | null>(null);
  const [reconciliationStatus, setReconciliationStatus] = useState<string>('Reconciled');
  const [reconciliationNotes, setReconciliationNotes] = useState<string>('');
  const [processingReconciliation, setProcessingReconciliation] = useState(false);
  
  // 收款记录对话框状态
  const [showReceiptRecordsDialog, setShowReceiptRecordsDialog] = useState(false);
  const [selectedReceiptRecordsRequest, setSelectedReceiptRecordsRequest] = useState<InvoiceRequest | null>(null);
  interface ReceiptRecord {
    id: string;
    invoice_request_id: string;
    request_number: string;
    receipt_number?: string;
    receipt_bank?: string;
    receipt_amount: number;
    refund_amount?: number;
    net_amount: number;
    receipt_images?: string[];
    receipt_date: string;
    refund_reason?: string;
    refund_date?: string;
    notes?: string;
    received_by_name?: string;
    refunded_by_name?: string;
  }
  const [receiptRecords, setReceiptRecords] = useState<ReceiptRecord[]>([]);
  const [loadingReceiptRecords, setLoadingReceiptRecords] = useState(false);
  
  // 批量操作状态
  const [isBatchOperating, setIsBatchOperating] = useState(false);
  const [batchOperation, setBatchOperation] = useState<'approve' | 'invoice' | null>(null);
  
  // 批量输入对话框状态
  const [batchInputDialog, setBatchInputDialog] = useState<{
    isOpen: boolean;
    type: 'requestNumber' | 'waybillNumber' | 'driverName' | 'licensePlate' | 'phoneNumber' | null;
  }>({ isOpen: false, type: null });
  
  // 筛选器状态
  const [filters, setFilters] = useState({
    requestNumber: '',
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

  const fetchInvoiceRequests = useCallback(async () => {
    setLoading(true);
    try {
      // ✅ 修改：直接传递中国时区日期字符串，后端函数会处理时区转换
      const { data, error } = await supabase.rpc('get_invoice_requests_filtered_1115', {
        p_request_number: filters.requestNumber || null,
        p_waybill_number: filters.waybillNumber || null,
        p_driver_name: filters.driverName || null,
        p_loading_date: filters.loadingDate ? format(filters.loadingDate, 'yyyy-MM-dd') : null,
        p_status: filters.status || null,
        p_project_id: filters.projectId && filters.projectId.trim() !== '' ? filters.projectId : null,
        p_license_plate: filters.licensePlate || null,      // ✅ 添加车牌号筛选
        p_phone_number: filters.phoneNumber || null,        // ✅ 添加电话筛选
        p_platform_name: filters.platformName || null,      // ✅ 添加平台筛选
        p_invoicing_partner_id: null,  // 财务收款页面不需要按开票方筛选
        p_page_number: currentPage,
        p_page_size: pageSize
      });

      if (error) throw error;
      
      // 处理返回的JSONB数据
      const result = data as {
        success: boolean;
        records?: InvoiceRequestRaw[];
        total_count?: number;
      };
      
      // 确保数据格式正确
      if (!result || result.success === false) {
        throw new Error('后端返回数据格式错误');
      }
      
      const requestsData = result.records || [];
      setTotalRequestsCount(result.total_count || 0);
      setRequests(requestsData.map(item => ({
        id: item.id,
        created_at: item.created_at,
        request_number: item.request_number,
        status: item.status as InvoiceRequest['status'],
        remarks: item.remarks,
        logistics_record_ids: [],
        record_count: item.record_count || 0,
        total_amount: item.total_amount,
        invoicing_partner_id: item.invoicing_partner_id,  // ✅ 关键字段
        partner_name: item.partner_name,
        partner_full_name: item.partner_full_name,
        invoicing_partner_full_name: item.invoicing_partner_full_name,
        invoicing_partner_tax_number: item.invoicing_partner_tax_number,
        tax_number: item.tax_number,
        invoice_number: item.invoice_number,
        loading_date_range: item.loading_date_range,      // ✅ 新增字段
        total_payable_cost: item.total_payable_cost,       // ✅ 新增字段
        total_received_amount: item.total_received_amount || 0,  // 累计收款金额
        payment_due_date: item.payment_due_date,  // 收款期限
        overdue_days: item.overdue_days,  // 逾期天数
        reconciliation_status: item.reconciliation_status,  // 对账状态
      })));
      
      // 设置总数和总页数
      if (requestsData.length > 0) {
        const totalCount = requestsData[0].total_count || 0;
        setTotalRequestsCount(totalCount);
        setTotalPages(Math.ceil(totalCount / pageSize));
      } else {
        setTotalRequestsCount(0);
        setTotalPages(0);
      }
    } catch (error) {
      console.error("加载开票申请列表失败:", error);
      // 设置默认值，避免页面崩溃
      setRequests([]);
      setTotalRequestsCount(0);
      setTotalPages(0);
      toast({ 
        title: "错误", 
        description: `加载开票申请列表失败: ${error instanceof Error ? error.message : '未知错误'}`, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  }, [toast, filters, currentPage, pageSize]);

  useEffect(() => { fetchInvoiceRequests(); }, [fetchInvoiceRequests]);

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

  // 筛选器处理函数
  const handleFilterChange = (key: string, value: string | Date | null) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    // 筛选条件变化时重置到第一页，但不自动搜索
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      requestNumber: '',
      waybillNumber: '',
      driverName: '',
      loadingDate: null,
      status: 'Pending', // 保持默认筛选"待审核"
      projectId: '',
      partnerName: '',
      licensePlate: '',
      phoneNumber: '',
      platformName: ''
    });
    setCurrentPage(1);
    // 清除筛选后自动搜索
    fetchInvoiceRequests();
  };

  const hasActiveFilters = filters.requestNumber || filters.waybillNumber || filters.driverName || filters.loadingDate || filters.status || filters.projectId || filters.partnerName || filters.licensePlate || filters.phoneNumber || filters.platformName;

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
      requestNumber: { title: '批量输入开票单号', placeholder: '每行一个开票单号，或用逗号分隔', description: '支持多行输入或用逗号分隔' },
      waybillNumber: { title: '批量输入运单编号', placeholder: '每行一个运单编号，或用逗号分隔', description: '支持多行输入或用逗号分隔' },
      driverName: { title: '批量输入司机姓名', placeholder: '每行一个司机姓名，或用逗号分隔', description: '支持多行输入或用逗号分隔' },
      licensePlate: { title: '批量输入车牌号', placeholder: '每行一个车牌号，或用逗号分隔', description: '支持多行输入或用逗号分隔' },
      phoneNumber: { title: '批量输入电话号码', placeholder: '每行一个电话号码，或用逗号分隔', description: '支持多行输入或用逗号分隔' }
    };
    return type ? configs[type] : configs.requestNumber;
  };

  // 批量审批功能
  const handleBatchApprove = async () => {
    if (selection.selectedIds.size === 0) {
      toast({ title: "提示", description: "请先选择要审批的开票申请", variant: "destructive" });
      return;
    }

    setIsBatchOperating(true);
    setBatchOperation('approve');
    
    try {
      const selectedRequestNumbers = Array.from(selection.selectedIds).map(id => {
        const req = requests.find(r => r.id === id);
        return req?.request_number;
      }).filter(Boolean) as string[];

      // 调用批量审批函数
      const { data, error } = await supabase.rpc('batch_approve_invoice_requests', {
        p_request_numbers: selectedRequestNumbers
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string; failed_count: number };
      toast({ 
        title: "批量审批完成", 
        description: result.message,
        variant: result.failed_count > 0 ? "destructive" : "default"
      });

      // 清除选择并刷新数据
      setSelection({ mode: 'none', selectedIds: new Set() });
      fetchInvoiceRequests();
    } catch (error) {
      console.error('批量审批失败:', error);
      toast({ title: "批量审批失败", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsBatchOperating(false);
      setBatchOperation(null);
    }
  };

  // 取消审批（回滚到待审批状态）
  const handleRollbackApproval = async (requestNumber: string) => {
    try {
      setExportingId(requestNumber);
      
      // 回滚状态为Pending
      const { error } = await supabase
        .from('invoice_requests')
        .update({ status: 'Pending' })
        .eq('request_number', requestNumber);

      if (error) throw error;

      toast({ title: "审批回滚成功", description: "开票申请已回滚为待审批状态" });
      fetchInvoiceRequests();
    } catch (error) {
      console.error('审批回滚失败:', error);
      toast({ title: "审批回滚失败", description: (error as Error).message, variant: "destructive" });
    } finally {
      setExportingId(null);
    }
  };

  // 批量取消审批（回滚到待审批状态）- 只对已审批待开票状态起作用
  const handleBatchRollbackApproval = async () => {
    if (selection.selectedIds.size === 0) return;
    
    setIsBatchOperating(true);
    try {
      const selectedIds = Array.from(selection.selectedIds);
      const selectedReqs = requests.filter(r => selectedIds.includes(r.id));
      
      // 只处理已审批待开票状态的申请单
      const approvedReqs = selectedReqs.filter(r => r.status === 'Approved');
      const skippedCount = selectedReqs.length - approvedReqs.length;
      
      if (approvedReqs.length === 0) {
        toast({ 
          title: "提示", 
          description: "没有选择任何已审批待开票的申请单。批量取消审批只对\"已审批待开票\"状态有效。" 
        });
        setIsBatchOperating(false);
        return;
      }

      // 调用批量取消审批RPC函数（性能优化）
      const requestIds = approvedReqs.map(r => r.id);
      const { data, error } = await supabase.rpc('batch_rollback_invoice_approval', {
        p_request_ids: requestIds
      });

      if (error) throw error;

      const result = data as BatchRollbackApprovalResult;
      
      // 构建详细的提示信息
      let description = `成功回滚 ${result.rollback_count || 0} 个开票申请`;
      if (skippedCount > 0) {
        description += `，跳过 ${skippedCount} 个非已审批待开票状态的申请单`;
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
      fetchInvoiceRequests();
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

  // ✅ 已删除getStatusBadge函数（使用StatusBadge组件替代）
  
  // ✅ 表格列配置（调整顺序：运单数放在开票金额后面）
  const tableColumns: TableColumn[] = useMemo(() => [
    { key: 'number', label: '开票单号' },
    { key: 'time', label: '申请时间' },
    { key: 'status', label: '申请单状态' },
    { key: 'loading_date_range', label: '装货日期范围' },  // ✅ 新增列
    { key: 'total_payable_cost', label: '司机应收合计', align: 'right' },  // ✅ 新增列
    { key: 'amount', label: '申请金额', align: 'right' },
    { key: 'count', label: '运单数', align: 'right' },  // ✅ 调整：放在开票金额后面
    { key: 'actions', label: '操作', align: 'center' }
  ], []);

  // 查看开票申请表（打印格式）
  const handleViewInvoiceRequestForm = async (e: MouseEvent<HTMLButtonElement>, req: InvoiceRequest) => {
    e.stopPropagation();
    
    try {
      // ✅ 先查询最高级合作方的税号信息
      let partnerTaxNumber = '';
      let partnerFullName = '';
      
      if (req.invoicing_partner_id) {
        const { data: partnerBankData } = await supabase
          .from('partner_bank_details')
          .select('tax_number, full_name')
          .eq('partner_id', req.invoicing_partner_id)
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
        .eq('invoice_request_id', req.id);

      if (detailsError) throw detailsError;

      let details: Array<{
        id: string;
        invoice_request_id: string;
        logistics_record_id: string;
        amount: number;
        logistics_record: {
          auto_number: string;
          project_name: string;
          driver_name: string;
          loading_location: string;
          unloading_location: string;
          loading_date: string;
          loading_weight?: number;
        };
      }> = [];
      
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
            const logisticsRecord = logisticsMap.get(detail.logistics_record_id) as {
              id: string;
              auto_number: string;
              project_id: string;
              driver_id: string;
              loading_location: string;
              unloading_location: string;
              loading_date: string;
              loading_weight?: number;
            } | undefined;
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
        ...req,
        invoicing_partner_tax_number: partnerTaxNumber || req.invoicing_partner_tax_number,
        tax_number: partnerTaxNumber || req.tax_number,
        invoicing_partner_full_name: partnerFullName || req.invoicing_partner_full_name || req.partner_full_name
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
  const generateInvoiceRequestFormHTML = (request: InvoiceRequest, details: Array<{
    id: string;
    invoice_request_id: string;
    logistics_record_id: string;
    amount: number;
    logistics_record: {
      auto_number: string;
      project_name: string;
      driver_name: string;
      loading_location: string;
      unloading_location: string;
      loading_date: string;
      loading_weight?: number;
      cargo_type?: string;
    };
  }>) => {
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
    
    // 处理合作方名称和信息
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
    const cargoTypes = [...new Set(details.map(d => d.logistics_record.cargo_type).filter(Boolean))];
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
      border: 1px solid #000;  /* ✅ 全边框 */
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
          <strong>运单数：${recordCount}</strong>
        </td>
        <td class="text-right">
          <strong>¥${totalAmount.toLocaleString()}</strong>
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
      ${request.remarks || dynamicSummary}
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

  // 审批功能
  const handleApproval = async (req: InvoiceRequest) => {
    try {
      setExportingId(req.id);
      
      // 调用新的审批函数（会同时更新申请单和运单状态）
      const { data, error } = await supabase.rpc('approve_invoice_request_v2', {
        p_request_number: req.request_number
      });
      
      if (error) {
        console.error('审批失败:', error);
        toast({ title: "审批失败", description: error.message, variant: "destructive" });
        return;
      }
      
      const result = data as { success: boolean; message: string; updated_count: number };
      toast({ 
        title: "审批成功", 
        description: result.message || `开票申请已审批通过，${result.updated_count}条运单状态已更新为"开票审核通过"` 
      });
      fetchInvoiceRequests();
    } catch (error) {
      console.error('审批操作失败:', error);
      toast({ title: "审批失败", description: "操作失败，请重试", variant: "destructive" });
    } finally {
      setExportingId(null);
    }
  };

  // 处理收款（支持部分收款）
  const handleReceipt = async () => {
    if (!selectedReceiptRequest) return;
    
    if (!receiptAmount || parseFloat(receiptAmount) <= 0) {
      toast({
        title: "输入错误",
        description: "请输入有效的收款金额",
        variant: "destructive"
      });
      return;
    }

    // 前端金额校验
    const invoiceAmount = selectedReceiptRequest.total_amount || 0;
    const totalReceived = (selectedReceiptRequest as any).total_received_amount || 0;
    const remainingAmount = invoiceAmount - totalReceived;
    const receiptAmountNum = parseFloat(receiptAmount);

    if (receiptAmountNum > remainingAmount) {
      toast({
        title: "金额错误",
        description: `收款金额超过未收款金额。开票金额：¥${invoiceAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}，已收款：¥${totalReceived.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}，未收款：¥${remainingAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        variant: "destructive"
      });
      return;
    }

    setUploadingReceipt(true);
    try {
      let receiptImageUrls: string[] = [];
      
      // 上传银行回单图片
      if (receiptImages.length > 0) {
        const filesToUpload = receiptImages.map(file => ({
          fileName: file.name,
          fileData: ''
        }));

        // 转换为base64
        for (let i = 0; i < receiptImages.length; i++) {
          const file = receiptImages[i];
          const reader = new FileReader();
          await new Promise((resolve) => {
            reader.onload = () => {
              const base64 = reader.result as string;
              filesToUpload[i].fileData = base64.split(',')[1];
              resolve(null);
            };
            reader.readAsDataURL(file);
          });
        }

        // 调用七牛云上传函数
        const timestamp = Date.now();
        const { data: uploadData, error: uploadError } = await supabase.functions.invoke('qiniu-upload', {
          body: {
            files: filesToUpload,
            namingParams: {
              projectName: 'InvoiceReceipt',
              customName: `收款回单-${selectedReceiptRequest.request_number}-${timestamp}`
            }
          }
        });

        if (uploadError) throw uploadError;
        if (!uploadData.success) throw new Error(uploadData.error || '图片上传失败');
        
        receiptImageUrls = uploadData.urls || [];
      }

      // 调用后端RPC函数更新状态
      const { data, error } = await supabase.rpc('receive_invoice_payment_1114', {
        p_request_number: selectedReceiptRequest.request_number,
        p_receipt_number: receiptNumber || null,  // 收款单号
        p_receipt_bank: receiptBank || null,  // 收款银行
        p_received_amount: receiptAmountNum,  // 收款金额
        p_receipt_images: receiptImageUrls.length > 0 ? receiptImageUrls : null,  // 银行回单图片
        p_notes: null  // 备注
      });

      if (error) throw error;

      const result = data as { 
        success: boolean; 
        message: string; 
        updated_count: number;
        is_full_payment: boolean;
        total_received: number;
        remaining_amount: number;
      };
      
      if (result.success) {
        toast({
          title: result.is_full_payment ? "收款成功（全额收款）" : "收款成功（部分收款）",
          description: result.message || `本次收款 ¥${receiptAmountNum.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        });
        setShowReceiptDialog(false);
        setSelectedReceiptRequest(null);
        setReceiptNumber('');
        setReceiptBank('');
        setReceiptAmount('');
        setReceiptImages([]);
        fetchInvoiceRequests();
      } else {
        throw new Error(result.message || '收款操作失败');
      }
    } catch (error) {
      console.error('收款操作失败:', error);
      toast({
        title: "收款失败",
        description: (error as Error).message || '操作失败，请重试',
        variant: "destructive"
      });
    } finally {
      setUploadingReceipt(false);
    }
  };

  // 处理退款
  const handleRefund = async () => {
    if (!selectedRefundRequest) return;
    
    if (!refundAmount || parseFloat(refundAmount) <= 0) {
      toast({
        title: "输入错误",
        description: "请输入有效的退款金额",
        variant: "destructive"
      });
      return;
    }

    const totalReceived = selectedRefundRequest.total_received_amount || 0;
    const refundAmountNum = parseFloat(refundAmount);

    if (refundAmountNum > totalReceived) {
      toast({
        title: "金额错误",
        description: `退款金额不能超过已收款金额。已收款：¥${totalReceived.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        variant: "destructive"
      });
      return;
    }

    setProcessingRefund(true);
    try {
      const { data, error } = await supabase.rpc('refund_invoice_receipt_1114', {
        p_request_number: selectedRefundRequest.request_number,
        p_refund_amount: refundAmountNum,
        p_refund_reason: refundReason || null,
        p_receipt_record_id: null  // 从累计金额中退款
      });

      if (error) throw error;

      const result = data as { 
        success: boolean; 
        message: string; 
        total_received: number;
        remaining_amount: number;
      };
      
      if (result.success) {
        toast({
          title: "退款成功",
          description: result.message || `退款金额 ¥${refundAmountNum.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        });
        setShowRefundDialog(false);
        setSelectedRefundRequest(null);
        setRefundAmount('');
        setRefundReason('');
        fetchInvoiceRequests();
      } else {
        throw new Error(result.message || '退款操作失败');
      }
    } catch (error) {
      console.error('退款操作失败:', error);
      toast({
        title: "退款失败",
        description: (error as Error).message || '操作失败，请重试',
        variant: "destructive"
      });
    } finally {
      setProcessingRefund(false);
    }
  };

  // 处理对账
  const handleReconciliation = async () => {
    if (!selectedReconciliationRequest) return;

    setProcessingReconciliation(true);
    try {
      const { data, error } = await supabase.rpc('reconcile_invoice_receipt_1114', {
        p_request_number: selectedReconciliationRequest.request_number,
        p_reconciliation_status: reconciliationStatus,
        p_reconciliation_notes: reconciliationNotes || null
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };
      
      if (result.success) {
        toast({
          title: "对账成功",
          description: result.message || '对账完成'
        });
        setShowReconciliationDialog(false);
        setSelectedReconciliationRequest(null);
        setReconciliationStatus('Reconciled');
        setReconciliationNotes('');
        fetchInvoiceRequests();
      } else {
        throw new Error(result.message || '对账操作失败');
      }
    } catch (error) {
      console.error('对账操作失败:', error);
      toast({
        title: "对账失败",
        description: (error as Error).message || '操作失败，请重试',
        variant: "destructive"
      });
    } finally {
      setProcessingReconciliation(false);
    }
  };

  // 处理图片选择
  const handleReceiptImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length !== files.length) {
      toast({
        title: "提示",
        description: "只能上传图片文件",
        variant: "destructive"
      });
    }

    setReceiptImages(prev => [...prev, ...imageFiles]);
    // 重置input，允许重复选择同一文件
    e.target.value = '';
  };

  // 删除图片
  const removeReceiptImage = (index: number) => {
    setReceiptImages(prev => prev.filter((_, i) => i !== index));
  };

  // 查看详情
  const handleViewDetails = useCallback(async (request: InvoiceRequest) => {
    setSelectedRequest(request);
    setIsModalOpen(true);
    setModalContentLoading(true);
    setModalRecords([]);
    setPartnerTotals([]);

    try {
      // 获取开票申请详情（分步查询，避免关系冲突）
      const { data: detailsData, error: detailsError } = await supabase
        .from('invoice_request_details')
        .select('*')
        .eq('invoice_request_id', request.id);

      if (detailsError) throw detailsError;
      if (!detailsData || detailsData.length === 0) {
        setModalRecords([]);
        return;
      }

      // 获取所有运单ID
      const logisticsRecordIds = detailsData.map(detail => detail.logistics_record_id).filter(Boolean);
      
      if (logisticsRecordIds.length === 0) {
        setModalRecords([]);
        return;
      }

      // 分别查询运单信息（logistics_records表中没有invoiceable_amount字段）
      const { data: logisticsData, error: logisticsError } = await supabase
        .from('logistics_records')
        .select('id, auto_number, driver_name, license_plate, loading_location, unloading_location, loading_date, loading_weight, payable_cost')
        .in('id', logisticsRecordIds);

      if (logisticsError) throw logisticsError;

      // 创建运单映射
      const logisticsMap = new Map(logisticsData?.map(l => [l.id, l]) || []);

      // 组合数据（使用invoice_request_details表中的invoiceable_amount）
      const detailedRecords = (detailsData as InvoiceRequestDetail[]).map((detail) => {
        const record = logisticsMap.get(detail.logistics_record_id) as {
          id: string;
          auto_number: string;
          driver_name: string;
          license_plate: string;
          loading_location: string;
          unloading_location: string;
          loading_date: string;
          loading_weight?: number | null;
          payable_cost?: number | null;
        } | undefined;
        return {
          id: record?.id || detail.logistics_record_id,
          auto_number: record?.auto_number || '',
          driver_name: record?.driver_name || '',
          license_plate: record?.license_plate || '',
          loading_location: record?.loading_location || '',
          unloading_location: record?.unloading_location || '',
          loading_date: record?.loading_date || '',
          loading_weight: record?.loading_weight || null,
          payable_cost: record?.payable_cost || null,  // ✅ 新增：司机应收
          invoiceable_amount: detail.invoiceable_amount || detail.amount || 0,
        };
      });
      
      setModalRecords(detailedRecords);

      // 计算合作方汇总（简化版，开票申请通常针对单一合作方）
      if (detailedRecords.length > 0) {
        const totalAmount = detailedRecords.reduce((sum, rec) => sum + (rec.invoiceable_amount || 0), 0);
        const firstDetail = detailsData[0] as InvoiceRequestDetail;
        setPartnerTotals([{
          partner_id: firstDetail.partner_id || '',
          partner_name: firstDetail.invoicing_partner_full_name || firstDetail.partner_full_name || firstDetail.partner_name || '未知合作方',
          total_amount: totalAmount,
          level: 1
        }]);
      }

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

  // ✅ 新增：获取完整的运单数据
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

      // 获取项目名称
      let projectName = '';
      if (logisticsData.project_id) {
        const { data: projectData } = await supabase
          .from('projects')
          .select('name')
          .eq('id', logisticsData.project_id)
          .single();
        projectName = projectData?.name || '';
      }

      // 获取司机信息
      let driverInfo: { id: string; name: string; license_plate: string; phone: string } = { id: '', name: '', license_plate: '', phone: '' };
      if (logisticsData.driver_id) {
        const { data: driverData } = await supabase
          .from('drivers')
          .select('id, name, license_plate, phone')
          .eq('id', logisticsData.driver_id)
          .single();
        driverInfo = driverData || { id: '', name: '', license_plate: '', phone: '' };
      }

      // 获取chain_name
      let chainName = null;
      if (logisticsData.chain_id) {
        const { data: chainData } = await supabase
          .from('chains')
          .select('name')
          .eq('id', logisticsData.chain_id)
          .single();
        chainName = chainData?.name || null;
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

  // ✅ 新增：处理查看运单详情（使用WaybillDetailDialog）
  const handleViewWaybillDetail = useCallback(async (recordId: string) => {
    const record = await fetchFullLogisticsRecord(recordId);
    if (record) {
      setSelectedWaybillRecord(record);
      setWaybillDetailOpen(true);
    }
  }, [fetchFullLogisticsRecord]);

  // 选择相关函数
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

  // 对申请单按状态分组排序：待审核 > 已审批待开票 > 已开票 > 已收款
  const groupedRequests = useMemo(() => {
    const statusOrder = { 'Pending': 1, 'Approved': 2, 'Completed': 3, 'Received': 4 };
    return [...requests].sort((a, b) => {
      const orderA = statusOrder[a.status as keyof typeof statusOrder] || 99;
      const orderB = statusOrder[b.status as keyof typeof statusOrder] || 99;
      if (orderA !== orderB) return orderA - orderB;
      // 同状态按时间倒序
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [requests]);

  // 一键回滚功能已移除（参考付款流程）
  // 旧的handleRollbackRequests函数
  const handleRollbackRequests_REMOVED = async () => {
    setIsCancelling(true);
    try {
      let idsToRollback: string[] = [];
      if (selection.mode === 'all_filtered') {
        const { data: allRequests, error: fetchError } = await supabase
          .from('invoice_requests')
          .select('id')
          .in('status', ['Pending', 'Approved']);
        if (fetchError) throw fetchError;
        idsToRollback = allRequests.map(r => r.id);
      } else {
        const selectedReqs = requests.filter(r => selection.selectedIds.has(r.id) && ['Pending', 'Approved'].includes(r.status));
        idsToRollback = selectedReqs.map(r => r.id);
      }

      if (idsToRollback.length === 0) {
        toast({ title: "提示", description: "没有选择任何可回滚的申请单（仅\"待审核\"和\"已审批\"状态可回滚）。" });
        setIsCancelling(false);
        return;
      }

      // 逐个调用 void_invoice_request（保留记录）
      let successCount = 0;
      let failCount = 0;
      
      for (const requestId of idsToRollback) {
        try {
          const { data, error } = await supabase.rpc('void_invoice_request', {
            p_request_id: requestId,
            p_void_reason: '批量回滚'
          });
          
          if (error) throw error;
          
          const result = data as VoidInvoiceRequestResult;
          if (result?.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          console.error(`回滚申请单 ${requestId} 失败:`, err);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: "回滚完成",
          description: `成功回滚 ${successCount} 个申请单的运单状态${failCount > 0 ? `，失败 ${failCount} 个` : ''}。申请单记录已保留，状态标记为已作废。`,
        });
      }
      
      setSelection({ mode: 'none', selectedIds: new Set() });
      fetchInvoiceRequests();
    } catch (error) {
      console.error("批量回滚申请失败:", error);
      toast({ title: "错误", description: `操作失败: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setIsCancelling(false);
    }
  };

  // 一键作废功能（删除申请单记录和回滚运单状态）- 跳过已开票
  const handleDeleteRequests = async () => {
    setIsCancelling(true);
    try {
      let idsToDelete: string[] = [];
      let skippedCompleted = 0;
      
      if (selection.mode === 'all_filtered') {
        const { data: allRequests, error: fetchError } = await supabase
          .from('invoice_requests')
          .select('id')
          .in('status', ['Pending', 'Approved']);  // 只选择待审核和已审批待开票
        if (fetchError) throw fetchError;
        idsToDelete = allRequests.map(r => r.id);
      } else {
        const selectedReqs = requests.filter(r => selection.selectedIds.has(r.id));
        // 统计跳过的已开票申请单
        skippedCompleted = selectedReqs.filter(r => r.status === 'Completed').length;
        // 只作废待审核和已审批待开票状态的
        idsToDelete = selectedReqs
          .filter(r => ['Pending', 'Approved'].includes(r.status))
          .map(r => r.id);
      }

      if (idsToDelete.length === 0) {
        toast({ 
          title: "提示", 
          description: skippedCompleted > 0 
            ? `已跳过 ${skippedCompleted} 个已开票的申请单（已开票的申请单需要先取消开票才能作废）。` 
            : "没有选择任何可作废的申请单（仅\"待审核\"和\"已审批待开票\"状态可作废）。" 
        });
        setIsCancelling(false);
        return;
      }

      // 调用删除函数
      const { data, error } = await supabase.rpc('void_and_delete_invoice_requests', { 
        p_request_ids: idsToDelete 
      });

      if (error) throw error;

      const result = data as VoidAndDeleteInvoiceRequestsResult;
      let description = `已永久删除 ${result.deleted_requests || 0} 个开票申请单，${result.affected_logistics_records || 0} 条运单状态已回滚为未开票。`;
      if (skippedCompleted > 0) {
        description += `\n已跳过 ${skippedCompleted} 个已开票的申请单。`;
      }
      
      toast({ 
        title: "作废成功", 
        description: description
      });
      setSelection({ mode: 'none', selectedIds: new Set() });
      fetchInvoiceRequests();
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
        title="财务收款"
        description="管理付款和开票业务"
        icon={Receipt}
        iconColor="text-blue-600"
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
                <Button onClick={fetchInvoiceRequests} size="sm">
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
                }}
                onProjectChange={(id) => {
                  setSelectedProjectId(id);
                  handleFilterChange('projectId', id === 'all' ? '' : id);
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
                <option value="Completed">已开票</option>
                <option value="Received">已收款</option>
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
              <Button onClick={fetchInvoiceRequests} size="default" className="bg-blue-600 hover:bg-blue-700 h-10">
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
                          fetchInvoiceRequests();
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
                          fetchInvoiceRequests();
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
                          fetchInvoiceRequests();
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
                          fetchInvoiceRequests();
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

      <Card className="shadow-lg border-2 border-border/50 overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-background to-muted/30 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              申请单列表
            </CardTitle>
            {hasButtonAccess('finance.approve_payment') && selection.selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  已选择 {selection.selectedIds.size} 个申请单
                </span>
                
                {/* 批量审批按钮 - 绿色 */}
                <ConfirmDialog
                  title="确认批量审批"
                  description={`确定要批量审批选中的 ${selection.selectedIds.size} 个开票申请吗？审批后申请单状态将变为"已审批"。`}
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
                  description={`确定要批量取消审批选中的 ${selection.selectedIds.size} 个开票申请吗？此操作将把已审批的申请单状态回滚为待审批。`}
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

                {/* 一键作废按钮 - 需要审批权限 - 红色 */}
                {hasButtonAccess('finance.approve_payment') && (
                  <ConfirmDialog
                    title="⚠️ 确认一键作废"
                    description={`确定要作废并删除选中的 ${selectionCount} 个开票申请吗？\n\n⚠️ 此操作将：\n• 永久删除申请单记录\n• 回滚运单状态为未开票\n\n此操作不可逆，请谨慎操作！`}
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
        <CardContent className="pt-0 p-0">
          <div className="min-h-[400px] overflow-x-auto">
            {loading ? (
              <div className="flex justify-center items-center h-full min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
              <div className="border-t">
              <Table>
                 <TableHeader className="bg-muted/50 sticky top-0 z-10">
                   <TableRow className="border-b-2 hover:bg-muted/50">
                     {isAdmin && <TableHead className="w-12 font-semibold"><Checkbox checked={selection.mode === 'all_filtered' || isAllOnPageSelected} onCheckedChange={handleSelectAllOnPage} /></TableHead>}
                    <TableHead className="font-semibold text-foreground">开票单号</TableHead>
                    <TableHead className="font-semibold text-foreground">申请时间</TableHead>
                    <TableHead className="font-semibold text-foreground">开票申请单状态</TableHead>
                    <TableHead className="font-semibold text-foreground">开票方</TableHead>
                    <TableHead className="font-semibold text-foreground">装货日期范围</TableHead>
                    <TableHead className="text-right font-semibold text-foreground">司机应收合计</TableHead>
                    <TableHead className="text-right font-semibold text-foreground">开票金额</TableHead>
                    <TableHead className="text-right font-semibold text-foreground">运单数</TableHead>
                    <TableHead className="max-w-[200px] font-semibold text-foreground">备注</TableHead>
                    <TableHead className="text-center font-semibold text-foreground">操作</TableHead>
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
                            <TableRow className="bg-gradient-to-r from-transparent via-muted/30 to-transparent hover:bg-gradient-to-r hover:from-transparent hover:via-muted/30 hover:to-transparent border-y border-border/50">
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
                        className={cn(
                          "hover:bg-muted/60 transition-colors duration-150 border-b border-border/30",
                          selection.selectedIds.has(req.id) && "bg-primary/5 border-l-4 border-l-primary"
                        )}
                      >
                        {isAdmin && (
                          <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={selection.mode === 'all_filtered' || selection.selectedIds.has(req.id)} onCheckedChange={() => handleRequestSelect(req.id)} />
                          </TableCell>
                        )}
                        <TableCell className="font-mono cursor-pointer py-3" onClick={() => handleViewDetails(req)}>{req.request_number}</TableCell>
                        <TableCell className="cursor-pointer py-3" onClick={() => handleViewDetails(req)}>
                          <span className="text-sm">{format(new Date(req.created_at), 'yyyy-MM-dd HH:mm')}</span>
                        </TableCell>
                        <TableCell className="cursor-pointer py-3" onClick={() => handleViewDetails(req)}>
                          <StatusBadge status={req.status} customConfig={INVOICE_REQUEST_STATUS_CONFIG} />
                        </TableCell>
                        <TableCell className="cursor-pointer py-3" onClick={() => handleViewDetails(req)}>
                          <span className="text-sm font-medium">
                            {req.partner_name || req.invoicing_partner_full_name || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="cursor-pointer py-3" onClick={() => handleViewDetails(req)}>
                          <span className="text-sm text-muted-foreground">
                            {req.loading_date_range ? convertUTCDateRangeToChinaDateRange(req.loading_date_range) : '-'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right cursor-pointer py-3 font-mono font-semibold text-green-700" onClick={() => handleViewDetails(req)}>
                          {req.total_payable_cost ? `¥${req.total_payable_cost.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                        </TableCell>
                        <TableCell className="text-right cursor-pointer py-3 font-mono font-semibold text-blue-700" onClick={() => handleViewDetails(req)}>
                          {req.total_amount ? `¥${req.total_amount.toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell className="text-right cursor-pointer py-3 font-medium" onClick={() => handleViewDetails(req)}>{req.record_count ?? 0}</TableCell>
                        <TableCell className="max-w-[200px] cursor-pointer truncate text-sm text-muted-foreground" onClick={() => handleViewDetails(req)} title={req.remarks || ''}>
                          {req.remarks || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-3 flex-wrap">
                            {/* 查看申请单按钮 - 蓝色主题 */}
                            <Button 
                              variant="default" 
                              size="sm" 
                              onClick={(e) => handleViewInvoiceRequestForm(e, req)} 
                              disabled={exportingId === req.id}
                              className="bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-sm transition-all duration-200"
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              查看申请单
                            </Button>

                            {/* 取消审批按钮 - 已移除，使用批量取消审批功能代替 */}

                            {/* 审批按钮 - 绿色主题，只在待审批状态显示 */}
                            {req.status === 'Pending' && (
                              <ConfirmDialog
                                title="确认审批"
                                description={`确定要审批开票申请 ${req.request_number} 吗？审批后申请单状态将变为"已审批待开票"。`}
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

                            {/* 收款按钮 - 橙色主题，支持部分收款 */}
                            {(req.status === 'Completed' || (req.status === 'Received' && (req.total_received_amount || 0) < (req.total_amount || 0))) && (
                              <Button 
                                variant="default" 
                                size="sm" 
                                onClick={() => {
                                  setSelectedReceiptRequest(req);
                                  const remaining = (req.total_amount || 0) - (req.total_received_amount || 0);
                                  setReceiptAmount(remaining > 0 ? remaining.toString() : '');
                                  setReceiptNumber('');
                                  setReceiptBank('');
                                  setReceiptImages([]);
                                  setShowReceiptDialog(true);
                                }}
                                className="bg-orange-600 hover:bg-orange-700 text-white border-0 shadow-sm font-medium transition-all duration-200"
                              >
                                <DollarSign className="mr-2 h-4 w-4" />
                                {(req.total_received_amount || 0) > 0 ? '继续收款' : '收款'}
                              </Button>
                            )}
                            
                            {/* 退款按钮 - 红色主题，只在已收款状态显示 */}
                            {req.status === 'Received' && (req.total_received_amount || 0) > 0 && (
                              <Button 
                                variant="destructive" 
                                size="sm" 
                                onClick={() => {
                                  setSelectedRefundRequest(req);
                                  setRefundAmount('');
                                  setRefundReason('');
                                  setShowRefundDialog(true);
                                }}
                                className="border-0 shadow-sm font-medium transition-all duration-200"
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                退款
                              </Button>
                            )}
                            
                            {/* 对账按钮 - 蓝色主题，有收款时显示 */}
                            {((req.status === 'Received' || req.status === 'Completed') && (req.total_received_amount || 0) > 0) && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => {
                                  setSelectedReconciliationRequest(req);
                                  setReconciliationStatus(req.reconciliation_status || 'Unreconciled');
                                  setReconciliationNotes('');
                                  setShowReconciliationDialog(true);
                                }}
                                className="border-blue-600 text-blue-600 hover:bg-blue-50"
                              >
                                <FileCheck className="mr-2 h-4 w-4" />
                                对账
                              </Button>
                            )}
                            
                            {/* 收款记录按钮 - 灰色主题 */}
                            {(req.total_received_amount || 0) > 0 && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={async () => {
                                  setSelectedReceiptRecordsRequest(req);
                                  setShowReceiptRecordsDialog(true);
                                  setLoadingReceiptRecords(true);
                                  try {
                                    const { data, error } = await supabase.rpc('get_receipt_records_1114', {
                                      p_request_number: req.request_number,
                                      p_start_date: null,
                                      p_end_date: null,
                                      p_page_number: 1,
                                      p_page_size: 100
                                    });
                                    if (error) throw error;
                                    const result = data as { success: boolean; records: ReceiptRecord[] };
                                    if (result.success) {
                                      setReceiptRecords(result.records || []);
                                    }
                                  } catch (error) {
                                    toast({
                                      title: "加载失败",
                                      description: (error as Error).message || '加载收款记录失败',
                                      variant: "destructive"
                                    });
                                  } finally {
                                    setLoadingReceiptRecords(false);
                                  }
                                }}
                                className="border-gray-300 text-gray-600 hover:bg-gray-50"
                              >
                                <History className="mr-2 h-4 w-4" />
                                收款记录
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                        </Fragment>
                      );
                    })
                  ) : (
                    <TableRow><TableCell colSpan={isAdmin ? 11 : 10} className="h-24 text-center">暂无开票申请记录。</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 详情对话框 */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DialogTitle>申请单详情: {selectedRequest?.request_number}</DialogTitle>
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
                  {modalRecords.length > 0 ? (
                    modalRecords.map((rec) => (
                      <TableRow key={rec.id}>
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
                          {rec.payable_cost ? `¥${rec.payable_cost.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-primary">
                          {(rec.invoiceable_amount || 0).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}
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
            )}
            </div>

            {/* 合计金额区域 - 右侧对齐 */}
            {!modalContentLoading && partnerTotals.length > 0 && (
              <div className="flex-shrink-0 w-64 p-4 border rounded-lg bg-muted/50">
                <h4 className="mb-3 font-semibold text-foreground">金额汇总 (按合作方)</h4>
                <div className="space-y-3">
                  {partnerTotals
                    .sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0))
                    .map(pt => (
                    <div key={pt.partner_id} className="flex justify-between items-baseline">
                      <span className="text-sm text-muted-foreground truncate pr-2">{pt.partner_name}:</span>
                      <span className="font-mono font-semibold text-primary text-right whitespace-nowrap">
                        {(pt.total_amount || 0).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}
                      </span>
                    </div>
                  ))}
                </div>
                {/* ✅ 司机应收合计 */}
                {selectedRequest && selectedRequest.total_payable_cost !== undefined && (
                  <div className="mt-4 pt-4 border-t flex justify-between items-baseline">
                    <span className="text-sm font-semibold text-foreground">司机应收合计：</span>
                    <span className="font-mono font-semibold text-green-700 text-right whitespace-nowrap">
                      {selectedRequest.total_payable_cost.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
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

      {/* 收款对话框 */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              收款登记
            </DialogTitle>
            <DialogDescription>
              开票申请单：{selectedReceiptRequest?.request_number}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* 收款单号 */}
            <div className="space-y-2">
              <Label htmlFor="receiptNumber">
                收款单号（可选）
              </Label>
              <Input
                id="receiptNumber"
                type="text"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                placeholder="请输入收款单号"
              />
            </div>

            {/* 收款银行 */}
            <div className="space-y-2">
              <Label htmlFor="receiptBank">
                收款银行（可选）
              </Label>
              <Input
                id="receiptBank"
                type="text"
                value={receiptBank}
                onChange={(e) => setReceiptBank(e.target.value)}
                placeholder="请输入收款银行"
              />
            </div>

            {/* 收款金额 */}
            <div className="space-y-2">
              <Label htmlFor="receiptAmount">
                收款金额 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="receiptAmount"
                type="number"
                step="0.01"
                value={receiptAmount}
                onChange={(e) => setReceiptAmount(e.target.value)}
                placeholder="请输入收款金额"
                className="text-lg font-semibold"
              />
              {selectedReceiptRequest?.total_amount && (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">开票金额：</span>
                    <span className="font-semibold">¥{selectedReceiptRequest.total_amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">累计已收款：</span>
                    <span className="text-green-600 font-semibold">¥{(selectedReceiptRequest.total_received_amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span className="text-muted-foreground">未收款：</span>
                    <span className={(selectedReceiptRequest.total_amount || 0) - (selectedReceiptRequest.total_received_amount || 0) > 0 ? "text-orange-600 font-semibold" : "text-green-600 font-semibold"}>
                      ¥{((selectedReceiptRequest.total_amount || 0) - (selectedReceiptRequest.total_received_amount || 0)).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {receiptAmount && parseFloat(receiptAmount) > 0 && (
                    <>
                      <div className="flex justify-between border-t pt-1 mt-1">
                        <span className="text-muted-foreground">本次收款后剩余：</span>
                        <span className={((selectedReceiptRequest.total_amount || 0) - (selectedReceiptRequest.total_received_amount || 0) - parseFloat(receiptAmount)) > 0 ? "text-orange-600 font-semibold" : "text-green-600 font-semibold"}>
                          ¥{((selectedReceiptRequest.total_amount || 0) - (selectedReceiptRequest.total_received_amount || 0) - parseFloat(receiptAmount)).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      {parseFloat(receiptAmount) > ((selectedReceiptRequest.total_amount || 0) - (selectedReceiptRequest.total_received_amount || 0)) && (
                        <p className="text-xs text-red-600 mt-1">
                          ⚠️ 收款金额超过未收款金额，请检查
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 上传银行回单 */}
            <div className="space-y-2">
              <Label htmlFor="receiptImages">
                上传银行回单图片（可选，支持多图）
              </Label>
              <Input
                id="receiptImages"
                type="file"
                multiple
                accept="image/*"
                onChange={handleReceiptImageSelect}
                className="cursor-pointer"
              />
              {receiptImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {receiptImages.map((file, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`银行回单 ${index + 1}`}
                        className="w-full h-32 object-cover rounded border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => removeReceiptImage(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 transition-colors"
                        title="删除图片"
                      >
                        <XIcon className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
                        {file.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                已选择 {receiptImages.length} 张图片
              </p>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowReceiptDialog(false);
                setSelectedReceiptRequest(null);
                setReceiptNumber('');
                setReceiptBank('');
                setReceiptAmount('');
                setReceiptImages([]);
              }}
              disabled={uploadingReceipt}
            >
              取消
            </Button>
            <Button
              onClick={handleReceipt}
              disabled={uploadingReceipt || !receiptAmount || parseFloat(receiptAmount) <= 0}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {uploadingReceipt ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <DollarSign className="mr-2 h-4 w-4" />
                  确认收款
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 退款对话框 */}
      <Dialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-red-600">退款处理</DialogTitle>
            <DialogDescription>
              申请单号：{selectedRefundRequest?.request_number}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* 金额信息 */}
            {selectedRefundRequest && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">开票金额：</span>
                  <span className="font-semibold">¥{(selectedRefundRequest.total_amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">累计已收款：</span>
                  <span className="font-semibold text-green-600">¥{(selectedRefundRequest.total_received_amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">可退款金额：</span>
                  <span className="font-semibold text-orange-600">¥{(selectedRefundRequest.total_received_amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}

            {/* 退款金额 */}
            <div className="space-y-2">
              <Label htmlFor="refundAmount">
                退款金额 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="refundAmount"
                type="number"
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="请输入退款金额"
                className="text-lg font-semibold"
              />
              {refundAmount && parseFloat(refundAmount) > 0 && selectedRefundRequest && (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between border-t pt-1">
                    <span className="text-muted-foreground">退款后剩余收款：</span>
                    <span className={((selectedRefundRequest.total_received_amount || 0) - parseFloat(refundAmount)) > 0 ? "text-orange-600 font-semibold" : "text-green-600 font-semibold"}>
                      ¥{((selectedRefundRequest.total_received_amount || 0) - parseFloat(refundAmount)).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {parseFloat(refundAmount) > (selectedRefundRequest.total_received_amount || 0) && (
                    <p className="text-xs text-red-600 mt-1">
                      ⚠️ 退款金额超过已收款金额，请检查
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 退款原因 */}
            <div className="space-y-2">
              <Label htmlFor="refundReason">
                退款原因 <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="refundReason"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="请输入退款原因"
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowRefundDialog(false);
                setSelectedRefundRequest(null);
                setRefundAmount('');
                setRefundReason('');
              }}
              disabled={processingRefund}
            >
              取消
            </Button>
            <Button
              onClick={handleRefund}
              disabled={processingRefund || !refundAmount || parseFloat(refundAmount) <= 0 || !refundReason}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {processingRefund ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  确认退款
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 对账对话框 */}
      <Dialog open={showReconciliationDialog} onOpenChange={setShowReconciliationDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-blue-600">收款对账</DialogTitle>
            <DialogDescription>
              申请单号：{selectedReconciliationRequest?.request_number}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* 金额信息 */}
            {selectedReconciliationRequest && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">开票金额：</span>
                  <span className="font-semibold">¥{(selectedReconciliationRequest.total_amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">累计已收款：</span>
                  <span className="font-semibold text-green-600">¥{(selectedReconciliationRequest.total_received_amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">当前对账状态：</span>
                  <Badge variant={selectedReconciliationRequest.reconciliation_status === 'Reconciled' ? 'default' : selectedReconciliationRequest.reconciliation_status === 'Exception' ? 'destructive' : 'outline'}>
                    {selectedReconciliationRequest.reconciliation_status === 'Reconciled' ? '已对账' : selectedReconciliationRequest.reconciliation_status === 'Exception' ? '异常' : '未对账'}
                  </Badge>
                </div>
              </div>
            )}

            {/* 对账状态 */}
            <div className="space-y-2">
              <Label htmlFor="reconciliationStatus">
                对账状态 <span className="text-red-500">*</span>
              </Label>
              <Select value={reconciliationStatus} onValueChange={setReconciliationStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="选择对账状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Reconciled">已对账</SelectItem>
                  <SelectItem value="Exception">异常</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 对账备注 */}
            <div className="space-y-2">
              <Label htmlFor="reconciliationNotes">
                对账备注（可选）
              </Label>
              <Textarea
                id="reconciliationNotes"
                value={reconciliationNotes}
                onChange={(e) => setReconciliationNotes(e.target.value)}
                placeholder="请输入对账备注"
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowReconciliationDialog(false);
                setSelectedReconciliationRequest(null);
                setReconciliationStatus('Reconciled');
                setReconciliationNotes('');
              }}
              disabled={processingReconciliation}
            >
              取消
            </Button>
            <Button
              onClick={handleReconciliation}
              disabled={processingReconciliation}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {processingReconciliation ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <FileCheck className="mr-2 h-4 w-4" />
                  确认对账
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 收款记录对话框 */}
      <Dialog open={showReceiptRecordsDialog} onOpenChange={setShowReceiptRecordsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">收款记录</DialogTitle>
            <DialogDescription>
              申请单号：{selectedReceiptRecordsRequest?.request_number}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {loadingReceiptRecords ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : receiptRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无收款记录
              </div>
            ) : (
              <div className="space-y-4">
                {receiptRecords.map((record) => (
                  <Card key={record.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">收款日期：</span>
                            <span>{format(new Date(record.receipt_date), 'yyyy-MM-dd HH:mm:ss')}</span>
                          </div>
                          {record.receipt_number && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">收款单号：</span>
                              <span>{record.receipt_number}</span>
                            </div>
                          )}
                          {record.receipt_bank && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">收款银行：</span>
                              <span>{record.receipt_bank}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right space-y-1">
                          <div className="text-lg font-semibold text-green-600">
                            ¥{record.receipt_amount?.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          {record.refund_amount > 0 && (
                            <div className="text-sm text-red-600">
                              退款：¥{record.refund_amount?.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          )}
                          <div className="text-sm font-semibold">
                            净收款：¥{(record.net_amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                      
                      {record.refund_reason && (
                        <div className="p-2 bg-red-50 rounded text-sm">
                          <span className="font-semibold text-red-600">退款原因：</span>
                          <span className="text-red-700">{record.refund_reason}</span>
                        </div>
                      )}
                      
                      {record.notes && (
                        <div className="text-sm text-muted-foreground">
                          <span className="font-semibold">备注：</span>
                          <span>{record.notes}</span>
                        </div>
                      )}
                      
                      {record.receipt_images && record.receipt_images.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-sm font-semibold">凭证图片：</span>
                          <div className="grid grid-cols-3 gap-2">
                            {record.receipt_images.map((url: string, idx: number) => (
                              <div key={idx} className="relative group">
                                <img
                                  src={url}
                                  alt={`凭证${idx + 1}`}
                                  className="w-full h-32 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => window.open(url, '_blank')}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowReceiptRecordsDialog(false);
                setSelectedReceiptRecordsRequest(null);
                setReceiptRecords([]);
              }}
            >
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
