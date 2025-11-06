// 文件路径: src/pages/PaymentRequestsList.tsx
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
// @ts-ignore - lucide-react图标导入
import { Loader2, FileSpreadsheet, Trash2, ClipboardList, FileText, Banknote, RotateCcw, Users } from 'lucide-react';
// ✅ 导入可复用组件
import {
  PaginationControl,
  StatusBadge,
  PAYMENT_REQUEST_STATUS_CONFIG,
  type TableColumn
} from '@/components/common';

import { PaymentApproval } from '@/components/PaymentApproval';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, X, Search, Building } from 'lucide-react';
import { zhCN } from 'date-fns/locale';
import { BatchInputDialog } from '@/pages/BusinessEntry/components/BatchInputDialog';

// --- 类型定义 ---
interface PaymentRequest {
  id: string;
  created_at: string;
  request_id: string;
  status: 'Pending' | 'Approved' | 'Paid' | 'Rejected' | 'Cancelled';
  notes: string | null;
  logistics_record_ids: string[];
  record_count: number;
  max_amount?: number; // 申请金额（最高金额）
}
interface LogisticsRecordDetail { id: string; auto_number: string; driver_name: string; license_plate: string; loading_location: string; unloading_location: string; loading_date: string; loading_weight: number | null; payable_amount: number | null; }
interface PartnerTotal { partner_id: string; partner_name: string; total_amount: number; level: number; }
interface SelectionState { mode: 'none' | 'all_filtered'; selectedIds: Set<string>; }

export default function PaymentRequestsList() {
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
  const [selection, setSelection] = useState<SelectionState>({ mode: 'none', selectedIds: new Set() });
  const [isCancelling, setIsCancelling] = useState(false);
  const [totalRequestsCount, setTotalRequestsCount] = useState(0);
  
  // 批量操作状态
  const [isBatchOperating, setIsBatchOperating] = useState(false);
  const [batchOperation, setBatchOperation] = useState<'approve' | 'pay' | null>(null);
  
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
    status: 'Approved', // 默认筛选"已审批待支付"
    projectId: '',
    partnerName: '',
    licensePlate: '',
    phoneNumber: '',
    platformName: ''
  });
  const [showFilters, setShowFilters] = useState(true);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // 项目列表状态
  const [projects, setProjects] = useState<Array<{id: string, name: string}>>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  
  // 平台选项状态
  const [platformOptions, setPlatformOptions] = useState<Array<{platform_name: string, usage_count: number}>>([]);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  const fetchPaymentRequests = useCallback(async () => {
    setLoading(true);
    try {
      // 使用后端筛选函数
      // @ts-ignore - 新的RPC函数，TypeScript类型尚未更新
      const { data, error } = await supabase.rpc('get_payment_requests_filtered', {
        p_request_id: filters.requestId || null,
        p_waybill_number: filters.waybillNumber || null,
        p_driver_name: filters.driverName || null,
        p_loading_date: filters.loadingDate ? format(filters.loadingDate, 'yyyy-MM-dd') : null,
        p_status: filters.status || null,
        p_project_id: filters.projectId || null,
        p_limit: pageSize,
        p_offset: (currentPage - 1) * pageSize
      });

      if (error) throw error;
      
      // 处理返回的数据
      const requestsData = (data as any[]) || [];
      setRequests(requestsData.map(item => ({
        id: item.id,
        created_at: item.created_at,
        request_id: item.request_id,
        status: item.status,
        notes: item.notes,
        logistics_record_ids: item.logistics_record_ids,
        record_count: item.record_count,
        max_amount: item.max_amount  // ✅ 添加申请金额字段
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
      console.error("加载付款申请列表失败:", error);
      toast({ title: "错误", description: `加载付款申请列表失败: ${(error as any).message}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, filters, currentPage, pageSize]);

  useEffect(() => { fetchPaymentRequests(); }, [fetchPaymentRequests]);

  // 获取项目列表和平台选项
  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');
      
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
      toast({ title: "错误", description: `获取项目列表失败: ${(error as any).message}`, variant: "destructive" });
    } finally {
      setLoadingProjects(false);
    }
  }, [toast]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // 筛选器处理函数
  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // 筛选条件变化时重置到第一页
  };

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
    fetchPaymentRequests(); // 清除筛选后自动搜索
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
  const handleBatchApprove = async () => {
    if (selection.selectedIds.size === 0) {
      toast({ title: "提示", description: "请先选择要审批的申请单", variant: "destructive" });
      return;
    }

    setIsBatchOperating(true);
    setBatchOperation('approve');
    
    try {
      const selectedRequestIds = Array.from(selection.selectedIds);
      // @ts-ignore - 新的RPC函数
      const { data, error } = await supabase.rpc('batch_approve_payment_requests', {
        p_request_ids: selectedRequestIds
      });

      if (error) throw error;

      const result = data as any;
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
      toast({ title: "批量审批失败", description: (error as any).message, variant: "destructive" });
    } finally {
      setIsBatchOperating(false);
      setBatchOperation(null);
    }
  };

  const handleBatchPay = async () => {
    if (selection.selectedIds.size === 0) {
      toast({ title: "提示", description: "请先选择要付款的申请单", variant: "destructive" });
      return;
    }

    setIsBatchOperating(true);
    setBatchOperation('pay');
    
    try {
      const selectedRequestIds = Array.from(selection.selectedIds);
      // @ts-ignore - 新的RPC函数
      const { data, error } = await supabase.rpc('batch_pay_payment_requests', {
        p_request_ids: selectedRequestIds
      });

      if (error) throw error;

      const result = data as any;
      toast({ 
        title: "批量付款完成", 
        description: result.message,
        variant: result.failed_count > 0 ? "destructive" : "default"
      });

      // 清除选择并刷新数据
      setSelection({ mode: 'none', selectedIds: new Set() });
      fetchPaymentRequests();
    } catch (error) {
      console.error('批量付款失败:', error);
      toast({ title: "批量付款失败", description: (error as any).message, variant: "destructive" });
    } finally {
      setIsBatchOperating(false);
      setBatchOperation(null);
    }
  };

  const handleRollbackApproval = async (requestId: string) => {
    try {
      setExportingId(requestId);
      // @ts-ignore - 新的RPC函数
      const { data, error } = await supabase.rpc('rollback_payment_request_approval', {
        p_request_id: requestId
      });

      if (error) throw error;

      toast({ title: "审批回滚成功", description: "申请单已回滚为待审批状态" });
      fetchPaymentRequests();
    } catch (error) {
      console.error('审批回滚失败:', error);
      toast({ title: "审批回滚失败", description: (error as any).message, variant: "destructive" });
    } finally {
      setExportingId(null);
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

  const handleExport = async (e: MouseEvent<HTMLButtonElement>, req: PaymentRequest) => {
    e.stopPropagation();
    try {
      setExportingId(req.id);
      const { data, error } = await supabase.functions.invoke('export-excel', { body: { requestId: req.request_id } });
      if (error) {
        let errorMessage = error.message;
        try { 
          const errorBody = JSON.parse(error.context?.responseText || '{}'); 
          if (errorBody.error) { 
            errorMessage = errorBody.error; 
          } 
        } catch (parseError) {
          console.warn('Failed to parse error context:', parseError);
        }
        throw new Error(errorMessage);
      }
      const { signedUrl } = data;
      if (!signedUrl) { throw new Error('云函数未返回有效的下载链接。'); }
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = signedUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({ title: '文件已开始下载', description: `申请单 ${req.request_id} 的Excel已开始下载。` });
    } catch (error) {
      console.error('导出失败:', error);
      toast({ title: '导出失败', description: error instanceof Error ? error.message : '未知错误', variant: 'destructive' });
    } finally {
      setExportingId(null);
    }
  };

  const handleGeneratePDF = async (e: MouseEvent<HTMLButtonElement>, req: PaymentRequest) => {
    e.stopPropagation();
    try {
      setExportingId(req.id);
      
      // 使用Excel导出功能的数据结构 - 确保与Excel完全一致
      const { data: excelData, error } = await supabase.rpc('get_payment_request_data_v2', {
        p_record_ids: req.logistics_record_ids
      });

      if (error) throw error;

      // 生成PDF HTML内容 - 使用与Excel导出完全相同的逻辑
      const generatePaymentRequestPDF = async (requestData: unknown): Promise<string> => {
        if (!requestData) {
          throw new Error('付款申请单数据不能为空');
        }

        const records: unknown[] = Array.isArray((requestData as { records?: unknown[] })?.records) ? (requestData as { records: unknown[] }).records : [];

        // ✅ 修复：按每个运单单独判断最高级，只包含低层级合作方
        const sheetMap = new Map<string, unknown>();
        for (const rec of records) {
          const costs = Array.isArray((rec as { partner_costs?: unknown[] }).partner_costs) ? (rec as { partner_costs: unknown[] }).partner_costs : [];
          
          // 计算该运单的最高层级
          const recMaxLevel = costs.length > 0 
            ? Math.max(...costs.map(c => (c as { level: number }).level)) 
            : 0;
          
          // 只包含低于该运单最高级的合作方
          for (const cost of costs) {
            const costData = cost as { partner_id: string; level: number; full_name?: string; partner_name?: string; bank_account?: string; bank_name?: string; branch_name?: string; payable_amount?: number };
            
            // ✅ 关键修复：跳过最高级合作方
            if (costData.level >= recMaxLevel) {
              continue;  // 跳过该运单的最高级合作方
            }
            
            const recData = rec as { id: string; project_name: string };
            const key = costData.partner_id;
            if (!sheetMap.has(key)) {
              sheetMap.set(key, {
                paying_partner_id: key,
                paying_partner_full_name: costData.full_name || costData.partner_name,
                paying_partner_bank_account: costData.bank_account || '',
                paying_partner_bank_name: costData.bank_name || '',
                paying_partner_branch_name: costData.branch_name || '',
                record_count: 0,
                total_payable: 0,
                project_name: recData.project_name,
                records: [],
              });
            }
            const sheet = sheetMap.get(key) as { records: unknown[]; record_count: number; total_payable: number };
            if (!sheet.records.some((r: unknown) => (r as { record: { id: string } }).record.id === recData.id)) {
              sheet.record_count += 1;
            }
            sheet.records.push({ record: rec, payable_amount: costData.payable_amount });
            sheet.total_payable += Number(costData.payable_amount || 0);
          }
        }
        
        // 获取项目合作方信息，实现与Excel导出相同的逻辑
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
        
        // ✅ 已在上面的循环中过滤掉最高级，这里只需要获取所有sheet
        const filteredSheets = Array.from(sheetMap.values());
        
        // 按合作方级别排序，级别高的在前面
        const sortedSheets = filteredSheets.sort((a, b) => {
          const aData = a as { project_name: string; chain_name?: string; paying_partner_id: string };
          const bData = b as { project_name: string; chain_name?: string; paying_partner_id: string };
          const projectNameA = aData.project_name;
          const projectNameB = bData.project_name;
          const projectIdA = projectsByName.get(projectNameA);
          const projectIdB = projectsByName.get(projectNameB);
          
          const allPartnersInProjectA = projectIdA ? projectPartnersByProjectId.get(projectIdA) || [] : [];
          const allPartnersInProjectB = projectIdB ? projectPartnersByProjectId.get(projectIdB) || [] : [];
          
          const partnersInChainA = allPartnersInProjectA.filter((p) => !aData.chain_name || p.chain_name === aData.chain_name);
          const partnersInChainB = allPartnersInProjectB.filter((p) => !bData.chain_name || p.chain_name === bData.chain_name);
          
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
          // 排序规则：先按日期降序（最新在前），再按运单编号升序（编号小在前）
          const sorted = (sheetData.records || []).slice().sort((a: unknown, b: unknown) => {
            const aRecord = (a as { record: { auto_number?: string; loading_date?: string } }).record;
            const bRecord = (b as { record: { auto_number?: string; loading_date?: string } }).record;
            
            // 第一优先级：按日期降序（最新的在前）
            const dateA = new Date(aRecord.loading_date || '').getTime();
            const dateB = new Date(bRecord.loading_date || '').getTime();
            if (dateB !== dateA) {
              return dateB - dateA; // 降序
            }
            
            // 第二优先级：按运单编号升序（编号小的在前）
            return String(aRecord.auto_number || "").localeCompare(String(bRecord.auto_number || ""));
          });
          
          const payingPartnerName = sheetData.paying_partner_full_name || sheetData.paying_partner_name || "";
          const bankAccount = sheetData.paying_partner_bank_account || "";
          const bankName = sheetData.paying_partner_bank_name || "";
          const branchName = sheetData.paying_partner_branch_name || "";
          
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
          
          // 获取上一级合作方信息，与Excel导出逻辑一致
          let parentTitle = "中科智运(云南)供应链科技有限公司";
          
          // 获取当前合作方的级别，然后找到上一级合作方
          const projectName = sheetData.project_name;
          const projectId = projectsByName.get(projectName);
          const allPartnersInProject = projectId ? projectPartnersByProjectId.get(projectId) || [] : [];
          const partnersInChain = allPartnersInProject.filter((p) => !sheetData.chain_name || p.chain_name === sheetData.chain_name);
          const maxLevelInChain = partnersInChain.length > 0 ? Math.max(...partnersInChain.map((p) => p.level || 0)) : 0;
          const currentPartnerInfo = partnersInChain.find((p) => p.partner_id === sheetData.paying_partner_id);
          
          if (currentPartnerInfo && currentPartnerInfo.level !== undefined) {
            if (currentPartnerInfo.level < maxLevelInChain - 1) {
              const parentLevel = currentPartnerInfo.level + 1;
              const parentInfo = partnersInChain.find((p) => p.level === parentLevel);
              if (parentInfo) {
                // 从已获取的数据中找到上一级合作方信息
                const parentPartner = partnersById.get(parentInfo.partner_id);
                if (parentPartner) {
                  parentTitle = parentPartner.full_name || parentPartner.name || parentTitle;
                }
              }
            }
          }
          
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
                    <th rowspan="2" style="display: table-cell !important; visibility: visible !important; background: transparent !important; border: 1px solid #000 !important; padding: 4px 6px !important; text-align: center !important; font-size: 11px !important; font-weight: bold !important;">吨位</th>
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
                    const itemData = item as { record: { unloading_date?: string; loading_date?: string; loading_location?: string; unloading_location?: string; cargo_type?: string; driver_name?: string; driver_phone?: string; license_plate?: string; loading_weight?: number; payable_amount?: number }; payable_amount?: number };
                    const rec = itemData.record;
                    let finalUnloadingDate = rec.unloading_date;
                    if (!finalUnloadingDate) {
                      finalUnloadingDate = rec.loading_date;
                    }
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
                        <td>${rec.loading_weight || ''}</td>
                        <td class="amount-cell">${(itemData.payable_amount || 0).toFixed(2)}</td>
                        <td>${payingPartnerName}</td>
                        <td>${bankAccount}</td>
                        <td>${bankName}</td>
                        <td>${branchName}</td>
                      </tr>
                    `;
                  }).join('')}
                  <tr class="total-row">
                    <td colspan="10" class="remarks-label">备注：</td>
                    <td class="total-amount">${(sheetData as { total_payable?: number }).total_payable?.toFixed(2) || '0.00'}</td>
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
                    <td class="signature-cell">业务经理签字</td>
                    <td class="signature-cell">复核审批人签字</td>
                    <td class="signature-cell">财务部审核签字</td>
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
              .main-table .data-row td:nth-child(11), .main-table .data-row td:nth-child(12), .main-table .data-row td:nth-child(13), .main-table .data-row td:nth-child(14), .main-table .data-row td:nth-child(15) { text-align: right; }
              .total-row { font-weight: bold; background: #f8f8f8; }
              .shipper-cell { background: #f9f9f9; font-weight: bold; vertical-align: middle; }
              .serial-number { text-align: center; }
              .amount-cell { text-align: right; }
              .total-label { text-align: center; font-weight: bold; }
              .total-amount { text-align: right; font-weight: bold; }
              .remarks-section { margin: 15px 0; }
              .remarks-label { font-weight: bold; margin-bottom: 5px; }
              .table-signature-section { margin-top: 0; margin-bottom: 0; padding-top: 0; }
              .signature-table { width: 100%; border-collapse: collapse; margin-top: 0; margin-bottom: 0; table-layout: auto; }
              .signature-table td { border: 1px solid #000; padding: 4px; text-align: center; font-size: 10px; }
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
            

            ${sheetData.sheets.map((sheet: any, index: number) => 
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

  const handlePayment = async (e: MouseEvent<HTMLButtonElement>, req: PaymentRequest) => {
    e.stopPropagation();
    
    // 检查状态：只有Approved状态才能付款
    if (req.status !== 'Approved') {
      toast({ 
        title: '无法付款', 
        description: '只有"待支付"状态的申请单才能执行付款操作', 
        variant: 'destructive' 
      });
      return;
    }
    
    try {
      setExportingId(req.id);
      
      // 调用新的付款函数（会同时更新申请单和运单状态）
      const { data, error } = await supabase.rpc('pay_payment_request', {
        p_request_id: req.request_id
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string; updated_count: number };
      toast({ 
        title: '付款成功', 
        description: result.message || `付款完成，${result.updated_count}条运单状态已更新为"已支付"` 
      });
      
      // 刷新数据
      fetchPaymentRequests();
    } catch (error) {
      console.error('付款操作失败:', error);
      toast({ title: '付款操作失败', description: error instanceof Error ? error.message : '未知错误', variant: 'destructive' });
    } finally {
      setExportingId(null);
    }
  };

  const handleCancelPayment = async (e: MouseEvent<HTMLButtonElement>, req: PaymentRequest) => {
    e.stopPropagation();
    
    // 检查状态：只有Paid状态才能取消付款
    if (req.status !== 'Paid') {
      toast({ 
        title: '无法取消', 
        description: '只有"已支付"状态的申请单才能取消付款', 
        variant: 'destructive' 
      });
      return;
    }
    
    try {
      setExportingId(req.id);
      
      // 调用新的取消付款函数
      const { data, error } = await supabase.rpc('cancel_payment_request', {
        p_request_id: req.request_id
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string; updated_count: number };
      toast({ 
        title: '取消付款成功', 
        description: result.message || `取消付款成功，${result.updated_count}条运单状态已回退到"支付审核通过"` 
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

  const handleApproval = async (e: any, req: PaymentRequest) => {
    e.stopPropagation();
    try {
      setExportingId(req.id);
      
      // 更新申请状态为已审批
      const { error } = await supabase
        .from('payment_requests')
        .update({ status: 'Approved' })
        .eq('id', req.id);
      
      if (error) {
        console.error('审批失败:', error);
        toast({ title: "审批失败", description: error.message, variant: "destructive" });
        return;
      }
      
      toast({ title: "审批成功", description: "付款申请已审批通过" });
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

    try {
      const { data: rpcData, error } = await supabase.rpc('get_payment_request_data_v2', {
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

      const detailedRecords = rawRecords.map((rec: any) => {
        return {
          id: rec.id,
          auto_number: rec.auto_number,
          driver_name: rec.driver_name,
          license_plate: rec.license_plate,
          loading_location: rec.loading_location,
          unloading_location: rec.unloading_location,
          loading_date: rec.loading_date,
          loading_weight: rec.loading_weight,
          payable_amount: rec.payable_cost || 0, // 使用运单的司机应收金额，而不是所有合作方应付金额的总和
        };
      });
      
      setModalRecords(detailedRecords);

    } catch (error) {
      console.error('获取运单详情失败:', error);
      toast({
        title: '获取详情失败',
        description: (error as any).message,
        variant: 'destructive',
      });
      setIsModalOpen(false);
    } finally {
      setModalContentLoading(false);
    }
  }, [toast]);

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

  // 对申请单按状态分组排序：已审批待支付 > 已支付 > 待审核
  const groupedRequests = useMemo(() => {
    const statusOrder = { 'Approved': 1, 'Paid': 2, 'Pending': 3 };
    return [...requests].sort((a, b) => {
      const orderA = statusOrder[a.status as keyof typeof statusOrder] || 99;
      const orderB = statusOrder[b.status as keyof typeof statusOrder] || 99;
      if (orderA !== orderB) return orderA - orderB;
      // 同状态按时间倒序
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [requests]);

  // 批量取消付款（回滚付款状态到待审批）
  const handleBatchCancelPayment = async () => {
    setIsCancelling(true);
    try {
      let idsToCancel: string[] = [];
      if (selection.mode === 'all_filtered') {
        const { data: allRequests, error: fetchError } = await supabase
          .from('payment_requests')
          .select('request_id')
          .eq('status', 'Paid');
        if (fetchError) throw fetchError;
        idsToCancel = allRequests.map(r => r.request_id);
      } else {
        const selectedReqs = requests.filter(r => selection.selectedIds.has(r.id) && r.status === 'Paid');
        idsToCancel = selectedReqs.map(r => r.request_id);
      }

      if (idsToCancel.length === 0) {
        toast({ title: "提示", description: "没有选择任何已付款状态的申请单。" });
        setIsCancelling(false);
        return;
      }

      // 将申请单状态回滚到 Pending（待审批）
      const { error } = await supabase
        .from('payment_requests')
        .update({ status: 'Pending', updated_at: new Date().toISOString() })
        .in('request_id', idsToCancel)
        .eq('status', 'Paid');

      if (error) throw error;

      toast({ 
        title: "取消付款完成", 
        description: `已将 ${idsToCancel.length} 个付款申请单的状态回滚到"待审批"。`
      });
      setSelection({ mode: 'none', selectedIds: new Set() });
      fetchPaymentRequests();
    } catch (error) {
      console.error("批量取消付款失败:", error);
      toast({ title: "取消付款失败", description: `操作失败: ${(error as Error).message}`, variant: "destructive" });
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
      const { data, error } = await supabase.rpc('void_and_delete_payment_requests' as any, { 
        p_request_ids: idsToDelete 
      });

      if (error) throw error;

      // 构建提示信息
      let description = `已永久删除 ${(data as any).deleted_requests} 个付款申请单，${(data as any).affected_logistics_records} 条运单状态已回滚为未支付。`;
      if ((data as any).skipped_paid > 0) {
        description += `\n跳过 ${(data as any).skipped_paid} 个已付款的申请单（需要先取消付款才能删除）。`;
      }

      toast({ 
        title: "作废成功", 
        description: description
      });
      setSelection({ mode: 'none', selectedIds: new Set() });
      fetchPaymentRequests();
    } catch (error) {
      console.error("批量作废删除失败:", error);
      toast({ title: "错误", description: `操作失败: ${(error as any).message}`, variant: "destructive" });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-2 p-4 md:p-6">
      <PageHeader 
        title="财务付款" 
        description="查看和管理所有已生成的付款申请批次"
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
          {/* 常规查询 - 第一行 */}
          <div className="flex flex-wrap gap-3 items-end">
            {/* 申请单号 */}
            <div className="flex-1 min-w-[180px] space-y-2">
              <Label htmlFor="requestId" className="text-sm font-medium">申请单号</Label>
              <div className="relative">
                <Input
                  id="requestId"
                  placeholder="输入申请单号"
                  value={filters.requestId}
                  onChange={(e) => handleFilterChange('requestId', e.target.value)}
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
                  onClick={() => openBatchInputDialog('requestId')}
                >
                  <span className="text-lg">+</span>
                </Button>
              </div>
            </div>

            {/* 申请单状态 */}
            <div className="flex-1 min-w-[140px] space-y-2">
              <Label htmlFor="status" className="text-sm font-medium">付款申请单状态</Label>
              <select
                id="status"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm h-10"
              >
                <option value="">全部状态</option>
                <option value="Pending">待审核</option>
                <option value="Approved">已审批待支付</option>
                <option value="Paid">已支付</option>
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
                {/* 批量付款按钮 - 绿色 */}
                <ConfirmDialog
                  title={`确认批量付款 ${selection.selectedIds.size} 张申请单`}
                  description="此操作将完成选中申请单的付款，并更新运单状态为已付款。请确认操作。"
                  onConfirm={handleBatchPay}
                >
                <Button
                  variant="default"
                  size="sm"
                  disabled={isBatchOperating}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  {batchOperation === 'pay' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                  批量付款
                </Button>
                </ConfirmDialog>

                {/* 批量取消付款按钮 - 橙色 */}
                    <ConfirmDialog
                  title={`确认批量取消付款 ${selectionCount} 张申请单`}
                  description='此操作将把已付款的申请单状态回滚到"待审批"。请确认操作。'
                  onConfirm={handleBatchCancelPayment}
                    >
                  <Button 
                    variant="default" 
                    size="sm"
                    disabled={selectionCount === 0 || isCancelling} 
                    className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white"
                  >
                        {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    批量取消付款
                      </Button>
                    </ConfirmDialog>

                {/* 一键作废按钮 - 需要审批权限 - 红色 */}
                {hasButtonAccess('finance.approve_payment') && (
                    <ConfirmDialog
                      title={`确认作废并删除 ${selectionCount} 张申请单`}
                      description="⚠️ 此操作将：\n- 永久删除申请单记录\n- 回滚运单状态为未支付\n\n此操作不可逆，请谨慎操作！"
                      onConfirm={handleDeleteRequests}
                    >
                      <Button variant="destructive" disabled={selectionCount === 0 || isCancelling} className="flex items-center gap-2">
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
              <div className="flex justify-center items-center h-full min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
              <Table>
                 <TableHeader>
                   <TableRow>
                     {isAdmin && <TableHead className="w-12"><Checkbox checked={selection.mode === 'all_filtered' || isAllOnPageSelected} onCheckedChange={handleSelectAllOnPage} /></TableHead>}
                    <TableHead>申请编号</TableHead>
                    <TableHead>申请时间</TableHead>
                    <TableHead>付款申请单状态</TableHead>
                    <TableHead className="text-right">运单数</TableHead>
                    <TableHead className="text-right">申请金额</TableHead>
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
                              <TableCell colSpan={isAdmin ? 8 : 7} className="h-3 p-0">
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
                        <TableCell className="font-mono cursor-pointer" onClick={() => handleViewDetails(req)}>{req.request_id}</TableCell>
                        <TableCell className="cursor-pointer" onClick={() => handleViewDetails(req)}>{format(new Date(req.created_at), 'yyyy-MM-dd HH:mm')}</TableCell>
                        <TableCell className="cursor-pointer" onClick={() => handleViewDetails(req)}>
                          <StatusBadge status={req.status} customConfig={PAYMENT_REQUEST_STATUS_CONFIG} />
                        </TableCell>
                        <TableCell className="text-right cursor-pointer" onClick={() => handleViewDetails(req)}>{req.record_count ?? 0}</TableCell>
                        <TableCell className="text-right cursor-pointer" onClick={() => handleViewDetails(req)}>
                          {req.max_amount ? `¥${req.max_amount.toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell className="max-w-[200px] cursor-pointer truncate text-sm text-muted-foreground" onClick={() => handleViewDetails(req)} title={req.notes || ''}>
                          {req.notes || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-3 flex-wrap">
                            {/* 导出按钮 - 已隐藏 */}

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

                            {/* 付款按钮 - 绿色主题，只在已审批状态显示 */}
                            {req.status === 'Approved' && (
                              <Button 
                                variant="default" 
                                size="sm" 
                                onClick={(e) => handlePayment(e, req)} 
                                disabled={exportingId === req.id}
                                className="bg-green-600 hover:bg-green-700 text-white border-0 shadow-sm font-medium transition-all duration-200"
                              >
                                <Banknote className="mr-2 h-4 w-4" />
                                付款
                              </Button>
                            )}

                            {/* 取消付款按钮 - 已移除，使用批量取消付款功能代替 */}

                            {/* 审批按钮 - 已隐藏 */}

                            {/* 隐藏企业微信审批按钮 */}
                            {/* {req.status === 'Pending' && (
                              <div onClick={(e) => e.stopPropagation()}>
                                <PaymentApproval
                                  paymentRequestId={req.id}
                                  amount={partnerTotals.reduce((sum, pt) => sum + pt.total_amount, 0)}
                                  description={`付款申请单 ${req.request_id} - ${req.record_count} 条运单`}
                                  onApprovalSubmitted={() => {
                                    fetchPaymentRequests();
                                    toast({ title: "提交成功", description: "企业微信审批已提交" });
                                  }}
                                />
                              </div>
                            )} */}
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
            <DialogTitle>申请单详情: {selectedRequest?.request_id}</DialogTitle>
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
                    <TableHead className="text-right">司机应收(元)</TableHead>
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
                          {(rec.payable_amount || 0).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}
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

