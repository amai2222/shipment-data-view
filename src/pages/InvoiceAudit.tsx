// 文件路径: src/pages/InvoiceAudit.tsx
// 描述: 开票审核页面 - 完全复制自PaymentAudit，将付款逻辑改为开票逻辑

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
// @ts-expect-error - lucide-react图标导入
import { Loader2, FileSpreadsheet, Trash2, ClipboardList, FileText, Receipt, RotateCcw, Users } from 'lucide-react';
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
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, X, Building, Search } from 'lucide-react';
import { zhCN } from 'date-fns/locale';
import { BatchInputDialog } from '@/pages/BusinessEntry/components/BatchInputDialog';

// --- 类型定义 ---
interface InvoiceRequest {
  id: string;
  created_at: string;
  request_number: string;
  status: 'Pending' | 'Approved' | 'Completed' | 'Rejected' | 'Voided';
  remarks: string | null;
  logistics_record_ids: string[];
  record_count: number;
  total_amount?: number; // 开票金额
  invoicing_partner_id?: string;  // ✅ 添加（关键！）
  partner_name?: string;
  partner_full_name?: string;
  invoicing_partner_full_name?: string;
  invoicing_partner_tax_number?: string;
  tax_number?: string;
  invoice_number?: string;
}
interface LogisticsRecordDetail { id: string; auto_number: string; driver_name: string; license_plate: string; loading_location: string; unloading_location: string; loading_date: string; loading_weight: number | null; invoiceable_amount: number | null; }
interface PartnerTotal { partner_id: string; partner_name: string; total_amount: number; level: number; }
interface SelectionState { mode: 'none' | 'all_filtered'; selectedIds: Set<string>; }

export default function InvoiceAudit() {
  const [requests, setRequests] = useState<InvoiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { isAdmin } = usePermissions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<InvoiceRequest | null>(null);
  const [modalRecords, setModalRecords] = useState<LogisticsRecordDetail[]>([]);
  const [modalContentLoading, setModalContentLoading] = useState(false);
  const [partnerTotals, setPartnerTotals] = useState<PartnerTotal[]>([]);
  const [selection, setSelection] = useState<SelectionState>({ mode: 'none', selectedIds: new Set() });
  const [isCancelling, setIsCancelling] = useState(false);
  const [totalRequestsCount, setTotalRequestsCount] = useState(0);
  
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
    status: '',
    projectId: '',
    partnerName: '',
    licensePlate: '',
    phoneNumber: '',
    platformName: ''
  });
  const [showFilters, setShowFilters] = useState(true);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
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
      // 使用后端筛选函数
      // @ts-expect-error - RPC函数参数类型尚未更新
      const { data, error } = await supabase.rpc('get_invoice_requests_filtered', {
        p_request_number: filters.requestNumber || null,
        p_waybill_number: filters.waybillNumber || null,
        p_driver_name: filters.driverName || null,
        p_loading_date: filters.loadingDate ? format(filters.loadingDate, 'yyyy-MM-dd') : null,
        p_status: filters.status || null,
        p_project_id: filters.projectId || null,
        p_license_plate: filters.licensePlate || null,      // ✅ 添加车牌号筛选
        p_phone_number: filters.phoneNumber || null,        // ✅ 添加电话筛选
        p_platform_name: filters.platformName || null,      // ✅ 添加平台筛选
        p_limit: pageSize,
        p_offset: (currentPage - 1) * pageSize
      });

      if (error) throw error;
      
      // 处理返回的数据
      const requestsData = (data as any[]) || [];
      setRequests(requestsData.map(item => ({
        id: item.id,
        created_at: item.created_at,
        request_number: item.request_number,
        status: item.status,
        remarks: item.remarks,
        logistics_record_ids: [],
        record_count: item.record_count || 0,
        total_amount: item.total_amount,
        invoicing_partner_id: (item as any).invoicing_partner_id,  // ✅ 关键字段
        partner_name: (item as any).partner_name,
        partner_full_name: (item as any).partner_full_name,
        invoicing_partner_full_name: (item as any).invoicing_partner_full_name,
        invoicing_partner_tax_number: (item as any).invoicing_partner_tax_number,
        tax_number: (item as any).tax_number,
        invoice_number: (item as any).invoice_number
      })));
      
      // 设置总数和总页数
      if (requestsData.length > 0) {
        const totalCount = (requestsData[0] as any).total_count || 0;
        setTotalRequestsCount(totalCount);
        setTotalPages(Math.ceil(totalCount / pageSize));
      } else {
        setTotalRequestsCount(0);
        setTotalPages(0);
      }
    } catch (error) {
      console.error("加载开票申请列表失败:", error);
      toast({ title: "错误", description: `加载开票申请列表失败: ${(error as Error).message}`, variant: "destructive" });
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
      status: '',
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
      }).filter(Boolean);

      // 批量更新状态为Approved（已审批）
      const { error } = await supabase
        .from('invoice_requests')
        .update({ status: 'Approved' })
        .in('request_number', selectedRequestNumbers);

      if (error) throw error;

      toast({ 
        title: "批量审批完成", 
        description: `已审批 ${selectedRequestNumbers.length} 个开票申请，状态已更新为"已审批"`,
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

  const handleBatchApproveWithConfirm = () => {
    const selectedCount = selection.selectedIds.size;
    const confirmDialog = window.confirm(`确定要审批选中的 ${selectedCount} 个开票申请吗？`);
    if (confirmDialog) {
      handleBatchApprove();
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

  const handleRollbackApprovalWithConfirm = (requestNumber: string) => {
    const confirmDialog = window.confirm(`确定要取消审批开票申请 ${requestNumber} 吗？此操作将把申请单状态回滚为待审批。`);
    if (confirmDialog) {
      handleRollbackApproval(requestNumber);
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
  
  // ✅ 表格列配置
  const tableColumns: TableColumn[] = useMemo(() => [
    { key: 'number', label: '开票单号' },
    { key: 'time', label: '申请时间' },
    { key: 'status', label: '申请单状态' },
    { key: 'count', label: '运单数', align: 'right' },
    { key: 'amount', label: '申请金额', align: 'right' },
    { key: 'actions', label: '操作', align: 'center' }
  ], []);

  // 查看开票申请表（打印格式）
  // @ts-expect-error - React.MouseEvent类型
  const handleViewInvoiceRequestForm = async (e: React.MouseEvent<HTMLButtonElement>, req: InvoiceRequest) => {
    e.stopPropagation();
    
    try {
      // ✅ 先查询最高级合作方的税号信息
      let partnerTaxNumber = '';
      let partnerFullName = '';
      
      if ((req as any).invoicing_partner_id) {
        const { data: partnerBankData } = await supabase
          .from('partner_bank_details')
          .select('tax_number, full_name')
          .eq('partner_id', (req as any).invoicing_partner_id)
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
        ...req,
        invoicing_partner_tax_number: partnerTaxNumber || (req as any).invoicing_partner_tax_number,
        tax_number: partnerTaxNumber || (req as any).tax_number,
        invoicing_partner_full_name: partnerFullName || (req as any).invoicing_partner_full_name || (req as any).partner_full_name
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
    const partnerName = (request as any).invoicing_partner_full_name || (request as any).partner_full_name || (request as any).partner_name || '未知合作方';
    const requestNumber = (request as any).request_number || request.id;
    const totalAmount = (request as any).total_amount || 0;
    const recordCount = (request as any).record_count || details.length;
    const createdAt = (request as any).created_at || new Date().toISOString();
    const invoiceNumber = (request as any).invoice_number || '';
    
    // 获取公司抬头和税号
    const companyName = (request as any).invoicing_partner_full_name || (request as any).partner_full_name || partnerName;
    const taxNumber = (request as any).invoicing_partner_tax_number || (request as any).tax_number || '';
    
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

  // 审批功能
  const handleApproval = async (e: React.MouseEvent<HTMLButtonElement>, req: InvoiceRequest) => {
    e.stopPropagation();
    try {
      setExportingId(req.id);
      
      // 更新申请状态为已审批
      const { error } = await supabase
        .from('invoice_requests')
        .update({ status: 'Approved' })
        .eq('id', req.id);
      
      if (error) {
        console.error('审批失败:', error);
        toast({ title: "审批失败", description: error.message, variant: "destructive" });
        return;
      }
      
      toast({ title: "审批成功", description: "开票申请已审批通过，状态已更新为已审批" });
      fetchInvoiceRequests();
    } catch (error) {
      console.error('审批操作失败:', error);
      toast({ title: "审批失败", description: "操作失败，请重试", variant: "destructive" });
    } finally {
      setExportingId(null);
    }
  };

  const handleApprovalWithConfirm = (e: React.MouseEvent<HTMLButtonElement>, req: InvoiceRequest) => {
    const confirmDialog = window.confirm(`确定要审批开票申请 ${req.request_number} 吗？`);
    if (confirmDialog) {
      handleApproval(e, req);
    }
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
        .select('id, auto_number, driver_name, license_plate, loading_location, unloading_location, loading_date, loading_weight')
        .in('id', logisticsRecordIds);

      if (logisticsError) throw logisticsError;

      // 创建运单映射
      const logisticsMap = new Map(logisticsData?.map(l => [l.id, l]) || []);

      // 组合数据（使用invoice_request_details表中的invoiceable_amount）
      const detailedRecords = detailsData.map((detail: any) => {
        const record = logisticsMap.get(detail.logistics_record_id);
        return {
          id: record?.id || detail.logistics_record_id,
          auto_number: record?.auto_number || '',
          driver_name: record?.driver_name || '',
          license_plate: record?.license_plate || '',
          loading_location: record?.loading_location || '',
          unloading_location: record?.unloading_location || '',
          loading_date: record?.loading_date || '',
          loading_weight: record?.loading_weight || null,
          invoiceable_amount: detail.invoiceable_amount || detail.amount || 0,
        };
      });
      
      setModalRecords(detailedRecords);

      // 计算合作方汇总（简化版，开票申请通常针对单一合作方）
      if (detailedRecords.length > 0) {
        const totalAmount = detailedRecords.reduce((sum, rec) => sum + (rec.invoiceable_amount || 0), 0);
        setPartnerTotals([{
          partner_id: (detailsData[0] as any).partner_id || '',
          partner_name: (detailsData[0] as any).invoicing_partner_full_name || (detailsData[0] as any).partner_full_name || (detailsData[0] as any).partner_name || '未知合作方',
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

  // 一键回滚功能（保留申请单记录，只回滚运单状态）
  const handleRollbackRequests = async () => {
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
          
          if ((data as any)?.success) {
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

  // 一键作废功能（删除申请单记录和回滚运单状态）
  const handleDeleteRequests = async () => {
    setIsCancelling(true);
    try {
      let idsToDelete: string[] = [];
      if (selection.mode === 'all_filtered') {
        const { data: allRequests, error: fetchError } = await supabase
          .from('invoice_requests')
          .select('id')
          .in('status', ['Pending', 'Approved']);
        if (fetchError) throw fetchError;
        idsToDelete = allRequests.map(r => r.id);
      } else {
        const selectedReqs = requests.filter(r => selection.selectedIds.has(r.id) && ['Pending', 'Approved'].includes(r.status));
        idsToDelete = selectedReqs.map(r => r.id);
      }

      if (idsToDelete.length === 0) {
        toast({ title: "提示", description: "没有选择任何可作废的申请单（仅\"待审核\"和\"已审批\"状态可作废）。" });
        setIsCancelling(false);
        return;
      }

      // 调用删除函数
      const { data, error } = await supabase.rpc('void_and_delete_invoice_requests', { 
        p_request_ids: idsToDelete 
      });

      if (error) throw error;

      const result = data as any;
      toast({ 
        title: "作废成功", 
        description: `已删除 ${result.deleted_requests} 个开票申请单，${result.affected_logistics_records} 条运单状态已回滚为未开票。`
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
        title="开票审核"
        description="审核和管理开票申请单"
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
          {/* 常规查询 - 第一行 */}
          <div className="flex flex-wrap gap-3 items-end">
            {/* 开票单号 */}
            <div className="flex-1 min-w-[180px] space-y-2">
              <Label htmlFor="requestNumber" className="text-sm font-medium">开票单号</Label>
              <div className="relative">
                <Input
                  id="requestNumber"
                  placeholder="输入开票单号"
                  value={filters.requestNumber}
                  onChange={(e) => handleFilterChange('requestNumber', e.target.value)}
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
                  onClick={() => openBatchInputDialog('requestNumber')}
                >
                  <span className="text-lg">+</span>
                </Button>
              </div>
            </div>

            {/* 申请单状态 */}
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
                <option value="Approved">已审批</option>
                <option value="Completed">已完成</option>
                <option value="Voided">已作废</option>
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
                disabled={loadingProjects}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm disabled:opacity-50 h-10"
              >
                <option value="">{loadingProjects ? "加载中..." : "全部项目"}</option>
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

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>申请单列表</CardTitle>
            {isAdmin && selection.selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  已选择 {selection.selectedIds.size} 个申请单
                </span>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBatchApproveWithConfirm}
                  disabled={isBatchOperating}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  {batchOperation === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                  批量审批
                </Button>
                {isAdmin && (
                  <>
                    <Button 
                      variant="default"
                      disabled={selectionCount === 0 || isCancelling} 
                      onClick={() => {
                        if (window.confirm('确定要回滚选中的 ' + selectionCount + ' 个开票申请吗？\n\n此操作将：\n- 保留申请单记录（状态标记为已作废）\n- 回滚运单状态为未开票\n\n请确认操作。')) {
                          handleRollbackRequests();
                        }
                      }}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                      一键回滚 ({selectionCount})
                    </Button>
                    <Button 
                      variant="destructive" 
                      disabled={selectionCount === 0 || isCancelling} 
                      onClick={() => {
                        if (window.confirm('确定要作废并删除选中的 ' + selectionCount + ' 个开票申请吗？\n\n⚠️ 此操作将：\n- 永久删除申请单记录\n- 回滚运单状态为未开票\n\n此操作不可逆，请谨慎操作！')) {
                          handleDeleteRequests();
                        }
                      }}
                      className="flex items-center gap-2"
                    >
                      {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      一键作废 ({selectionCount})
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="min-h-[400px]">
            {loading ? (
              <div className="flex justify-center items-center h-full min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
              <Table>
                 <TableHeader>
                   <TableRow>
                     {isAdmin && <TableHead className="w-12"><Checkbox checked={selection.mode === 'all_filtered' || isAllOnPageSelected} onCheckedChange={handleSelectAllOnPage} /></TableHead>}
                    <TableHead>开票单号</TableHead>
                    <TableHead>申请时间</TableHead>
                    <TableHead>开票申请单状态</TableHead>
                    <TableHead className="text-right">运单数</TableHead>
                    <TableHead className="text-right">开票金额</TableHead>
                    <TableHead className="max-w-[200px]">备注</TableHead>
                    <TableHead className="text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.length > 0 ? (
                    requests.map((req) => (
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
                        <TableCell className="font-mono cursor-pointer" onClick={() => handleViewDetails(req)}>{req.request_number}</TableCell>
                        <TableCell className="cursor-pointer" onClick={() => handleViewDetails(req)}>{format(new Date(req.created_at), 'yyyy-MM-dd HH:mm')}</TableCell>
                        <TableCell className="cursor-pointer" onClick={() => handleViewDetails(req)}>
                          <StatusBadge status={req.status} customConfig={INVOICE_REQUEST_STATUS_CONFIG} />
                        </TableCell>
                        <TableCell className="text-right cursor-pointer" onClick={() => handleViewDetails(req)}>{req.record_count ?? 0}</TableCell>
                        <TableCell className="text-right cursor-pointer" onClick={() => handleViewDetails(req)}>
                          {req.total_amount ? `¥${req.total_amount.toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell className="max-w-[200px] cursor-pointer truncate text-sm text-muted-foreground" onClick={() => handleViewDetails(req)} title={(req as any).remarks || ''}>
                          {(req as any).remarks || '-'}
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

                            {/* 取消审批按钮 - 灰色主题，只在已审批状态显示 */}
                            {req.status === 'Approved' && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleRollbackApprovalWithConfirm(req.request_number)} 
                                disabled={exportingId === req.id}
                                className="border-gray-300 text-gray-600 hover:bg-gray-50 shadow-sm transition-all duration-200"
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                取消审批
                              </Button>
                            )}

                            {/* 审批按钮 - 绿色主题，只在待审批状态显示 */}
                            {req.status === 'Pending' && (
                              <Button 
                                variant="default" 
                                size="sm" 
                                onClick={(e) => handleApprovalWithConfirm(e, req)} 
                                disabled={exportingId === req.id}
                                className="bg-green-600 hover:bg-green-700 text-white border-0 shadow-sm font-medium transition-all duration-200"
                              >
                                <ClipboardList className="mr-2 h-4 w-4" />
                                审批
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="h-24 text-center">暂无开票申请记录。</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 详情对话框 */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>申请单详情: {selectedRequest?.request_number}</DialogTitle>
            <DialogDescription>
              此申请单包含以下 {selectedRequest?.record_count ?? 0} 条运单记录。
            </DialogDescription>
          </DialogHeader>
          
          {!modalContentLoading && partnerTotals.length > 0 && (
            <div className="p-4 border rounded-lg bg-muted/50">
              <h4 className="mb-2 font-semibold text-foreground">金额汇总 (按合作方)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                {partnerTotals
                  .sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0))
                  .map(pt => (
                  <div key={pt.partner_id} className="flex justify-between items-baseline">
                    <span className="text-sm text-muted-foreground">{pt.partner_name}:</span>
                    <span className="font-mono font-semibold text-primary">
                      {(pt.total_amount || 0).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="max-h-[50vh] overflow-y-auto">
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
                    <TableHead className="text-right">开票金额(元)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modalRecords.length > 0 ? (
                    modalRecords.map((rec) => (
                      <TableRow key={rec.id}>
                        <TableCell className="font-mono">{rec.auto_number}</TableCell>
                        <TableCell>{rec.driver_name}</TableCell>
                        <TableCell>{rec.license_plate}</TableCell>
                        <TableCell>{`${rec.loading_location} → ${rec.unloading_location}`}</TableCell>
                        <TableCell>{format(new Date(rec.loading_date), 'yyyy-MM-dd')}</TableCell>
                        <TableCell className="text-right">{rec.loading_weight ?? 'N/A'}</TableCell>
                        <TableCell className="text-right font-mono text-primary">
                          {(rec.invoiceable_amount || 0).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}
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
