// 文件路径: src/pages/FinanceReconciliation.tsx
// 描述: [最终修正版] 精确为“合作方名称”列设置10个汉字的最小宽度，实现最终视觉效果

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShipperProjectCascadeFilter } from "@/components/ShipperProjectCascadeFilter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Loader2, RefreshCw, Search, Calculator, ChevronDown, ChevronUp, Users, Hash, Phone, FileText, X, CheckCircle2, AlertCircle, Clock, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BatchInputDialog } from "@/pages/BusinessEntry/components/BatchInputDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { convertChinaDateToUTCDate, convertChinaEndDateToUTCDate, formatChinaDateString } from "@/utils/dateUtils";
import { useFilterState } from "@/hooks/useFilterState";
import { cn } from "@/lib/utils";
import { VirtualizedTable } from "@/components/VirtualizedTable";
import { PageHeader } from "@/components/PageHeader";
import { PaginationControl } from "@/components/common";
import { CurrencyDisplay } from "@/components/CurrencyDisplay";
import { useUnifiedPermissions } from "@/hooks/useUnifiedPermissions";
import { WaybillDetailDialog } from "@/components/WaybillDetailDialog";

// --- 类型定义 ---
interface LogisticsRecord { id: string; auto_number: string; project_name: string; driver_name: string; loading_location: string; unloading_location: string; loading_date: string; unloading_date: string | null; loading_weight: number | null; unloading_weight: number | null; current_cost: number | null; payable_cost: number | null; extra_cost: number | null; license_plate: string | null; driver_phone: string | null; transport_type: string | null; remarks: string | null; chain_name: string | null; billing_type_id: number; }
interface PartnerPayable { partner_id: string; partner_name: string; level: number; total_payable: number; records_count: number; }
interface PartnerCost {
  partner_id: string;
  partner_name: string;
  level: number;
  payable_amount: number;
  reconciliation_status?: string;
  reconciliation_date?: string;
  reconciliation_notes?: string;
  cost_id?: string;
}
interface LogisticsRecordWithPartners extends LogisticsRecord { partner_costs: PartnerCost[]; }
interface ProjectPartnerData {
  partner_id: string;
  level: number;
  partners: {
    name: string;
  };
}
interface FinanceReconciliationResponse {
  records?: LogisticsRecordWithPartners[];
  overview?: {
    total_records: number;
    total_freight: number;
    total_extra_cost: number;
    total_driver_receivable: number;
  };
  partner_summary?: PartnerPayable[];
  count?: number;
  total_pages?: number;
}
interface FinanceFilters { 
  projectId: string; 
  partnerId: string; 
  startDate: string; 
  endDate: string;
  // 高级筛选字段
  driverName?: string;
  licensePlate?: string;
  driverPhone?: string;
  waybillNumbers?: string;
  otherPlatformName?: string;
  // 对账状态筛选（新增）
  reconciliationStatus?: string;
}
interface SelectionState { mode: 'none' | 'all_filtered'; selectedIds: Set<string>; }

// --- 常量和初始状态 ---
const INITIAL_FINANCE_FILTERS: FinanceFilters = { 
  projectId: "all", 
  partnerId: "all", 
  startDate: "", 
  endDate: "",
  driverName: "",
  licensePlate: "",
  driverPhone: "",
  waybillNumbers: "",
  otherPlatformName: "",
  reconciliationStatus: "all"  // 新增：对账状态筛选
};
const StaleDataPrompt = () => ( <div className="text-center py-10 border rounded-lg bg-muted/20"> <Search className="mx-auto h-12 w-12 text-muted-foreground" /> <h3 className="mt-2 text-sm font-semibold text-foreground">筛选条件已更改</h3> <p className="mt-1 text-sm text-muted-foreground">请点击“搜索”按钮以查看最新结果。</p> </div> );

export default function FinanceReconciliation() {
  // --- 权限管理 ---
  const { hasButtonAccess, isAdmin } = useUnifiedPermissions();
  const canReconcile = isAdmin || hasButtonAccess('finance.reconcile');
  
  // --- State 管理 ---
  const [reportData, setReportData] = useState<FinanceReconciliationResponse | null>(null);
  const [allPartners, setAllPartners] = useState<{id: string, name: string, level: number}[]>([]);
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingRecord, setViewingRecord] = useState<LogisticsRecordWithPartners | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const { toast } = useToast();
  const { uiFilters, setUiFilters, activeFilters, setActiveFilters, handleSearch, handleClear, isStale } = useFilterState(INITIAL_FINANCE_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [selection, setSelection] = useState<SelectionState>({ mode: 'none', selectedIds: new Set() });
  const [selectedShipperId, setSelectedShipperId] = useState('all');
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [availableProjects, setAvailableProjects] = useState<Array<{id: string, name: string}>>([]); // ✅ 当前货主对应的项目列表
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [waybillInput, setWaybillInput] = useState('');
  const [batchDialog, setBatchDialog] = useState<{
    isOpen: boolean;
    type: 'driver' | 'license' | 'phone' | 'waybill' | null;
  }>({ isOpen: false, type: null });
  // 对账相关状态（新增）
  const [reconciliationDialog, setReconciliationDialog] = useState<{
    isOpen: boolean;
    costIds: string[];
    recordId?: string;
    partnerId?: string;
  }>({ isOpen: false, costIds: [] });
  const [reconciliationStatus, setReconciliationStatus] = useState<string>('Reconciled');
  const [reconciliationNotes, setReconciliationNotes] = useState<string>('');
  const [isReconciling, setIsReconciling] = useState(false);
  
  const [platformOptions, setPlatformOptions] = useState<{
    platform_name: string;
    usage_count: number;
  }[]>([]);
  // 合作方显示状态：'hidden' -> 'maxLevel' -> 'all' -> 'maxLevel' -> 'hidden' (循环)
  const [partnerDisplayState, setPartnerDisplayState] = useState<'hidden' | 'maxLevel' | 'all'>('hidden');
  // 记录是否曾经展开过全部（用于区分 maxLevel 状态下的按钮文字）
  const [hasExpandedAll, setHasExpandedAll] = useState(false);
  // 控制合作方应付汇总卡片是否展开全部
  const [showAllPartnerCards, setShowAllPartnerCards] = useState(false);

  // 加载平台选项
  const loadPlatformOptions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('logistics_records')
        .select('other_platform_names')
        .not('other_platform_names', 'is', null);
      
      if (error) throw error;
      
      const platformMap = new Map<string, number>();
      // 为查询结果添加类型定义
      type PlatformRecord = { other_platform_names: string[] | null };
      ((data as PlatformRecord[] | null) || []).forEach(record => {
        if (record.other_platform_names && Array.isArray(record.other_platform_names)) {
          record.other_platform_names.forEach((platform: string) => {
            if (platform && platform.trim()) {
              platformMap.set(platform.trim(), (platformMap.get(platform.trim()) || 0) + 1);
            }
          });
        }
      });
      
      const platforms = Array.from(platformMap.entries())
        .map(([platform_name, usage_count]) => ({ platform_name, usage_count }))
        .sort((a, b) => b.usage_count - a.usage_count)
        .slice(0, 20); // 只显示前20个
      
      setPlatformOptions(platforms);
    } catch (error) {
      console.error('加载平台选项失败:', error);
    }
  }, []);

  // --- 数据获取 ---
  const fetchInitialOptions = useCallback(async () => {
    const startTime = performance.now();
    try {
      // 并行获取数据以提升性能
      const [projectsResult, partnersResult] = await Promise.all([
        supabase.from('projects').select('id, name').order('name'),
        supabase.from('project_partners').select(`partner_id, level, partners!inner(name)`)
      ]);
      
      setProjects(projectsResult.data || []);
      const uniquePartners = Array.from(
        new Map(
          (partnersResult.data as ProjectPartnerData[] | null)?.map(p => [ 
            p.partner_id, 
            { id: p.partner_id, name: p.partners.name, level: p.level } 
          ]) || []
        ).values()
      ).sort((a, b) => a.level - b.level);
      setAllPartners(uniquePartners);
      
      // 加载平台选项
      loadPlatformOptions();
      
      const loadTime = performance.now() - startTime;
      console.log(`初始数据加载时间: ${loadTime.toFixed(2)}ms`);
    } catch (error) {
      console.error('加载筛选选项失败:', error);
      toast({ title: "错误", description: "加载筛选选项失败", variant: "destructive" });
    }
  }, [toast, loadPlatformOptions]);

  const fetchReportData = useCallback(async () => {
    const startTime = performance.now();
    setLoading(true);
    try {
      // 注意：get_finance_reconciliation_by_partner 不是我们要修改的函数，保持原有转换逻辑
      const utcStartDate = activeFilters.startDate ? (() => {
        const [year, month, day] = activeFilters.startDate.split('-').map(Number);
        const chinaDate = new Date(year, month - 1, day);
        return convertChinaDateToUTCDate(chinaDate);
      })() : null;
      const utcEndDate = activeFilters.endDate ? (() => {
        const [year, month, day] = activeFilters.endDate.split('-').map(Number);
        const chinaDate = new Date(year, month - 1, day);
        return convertChinaEndDateToUTCDate(chinaDate);
      })() : null;
      
      // 使用优化的分页函数，包含billing_type_id和高级筛选
      // ✅ 修改：支持多个 project_id（逗号分隔）
      let projectIdParam: string | null = null;
      if (selectedShipperId && selectedShipperId !== 'all') {
        if (selectedProjectId === 'all' && availableProjects.length > 0) {
          // 选择"所有项目"时，传递所有可用项目的ID（逗号分隔）
          projectIdParam = availableProjects.map(p => p.id).join(',');
        } else if (selectedProjectId && selectedProjectId !== 'all') {
          // 选择具体项目时，传递该项目ID
          projectIdParam = selectedProjectId;
        }
      }
      
      const { data, error } = await supabase.rpc('get_finance_reconciliation_by_partner_1116', {
        p_project_id: projectIdParam,
        p_start_date: utcStartDate,
        p_end_date: utcEndDate,
        p_partner_id: activeFilters.partnerId === 'all' ? null : activeFilters.partnerId,
        p_page_number: currentPage,
        p_page_size: pageSize,
        // 高级筛选参数
        p_driver_name: activeFilters.driverName || null,
        p_license_plate: activeFilters.licensePlate || null,
        p_driver_phone: activeFilters.driverPhone || null,
        p_waybill_numbers: activeFilters.waybillNumbers || null,
        p_other_platform_name: activeFilters.otherPlatformName || null,
        // 对账状态筛选（新增）
        p_reconciliation_status: activeFilters.reconciliationStatus === 'all' ? null : activeFilters.reconciliationStatus || null,
      });
      if (error) throw error;
      
      setReportData(data as FinanceReconciliationResponse);
      setTotalPages((data as FinanceReconciliationResponse)?.total_pages || 1);
      
      const loadTime = performance.now() - startTime;
      const recordCount = (data as FinanceReconciliationResponse)?.records?.length || 0;
      console.log(`财务数据加载完成: ${loadTime.toFixed(2)}ms, ${recordCount}条记录`);
      
    } catch (error) {
      console.error("加载财务对账数据失败:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({ title: "错误", description: `加载财务对账数据失败: ${errorMessage}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [activeFilters, currentPage, pageSize, toast, selectedShipperId, selectedProjectId, availableProjects]);

  // --- Effects ---
  useEffect(() => { fetchInitialOptions(); }, [fetchInitialOptions]);
  useEffect(() => { if (!isStale) { fetchReportData(); } else { setLoading(false); } }, [fetchReportData, isStale]);
  useEffect(() => {
    setCurrentPage(1);
    setSelection({ mode: 'none', selectedIds: new Set() });
  }, [activeFilters]);

  // 同步运单编号输入框
  useEffect(() => {
    setWaybillInput(uiFilters.waybillNumbers || '');
  }, [uiFilters.waybillNumbers]);

  // [新增] 一个小巧、高效的货币格式化函数
  const formatCurrency = (value: number | null | undefined): string => {
    if (value == null || isNaN(value)) return '¥0.00';
    // 使用 Intl.NumberFormat 来实现专业的货币格式化，包括千位分隔符
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(value);
  };

  // 根据billing_type_id获取数量标签和显示函数
  const getQuantityLabel = (billingTypeId: number) => {
    switch (billingTypeId) {
      case 2: return '车次';
      case 3: return '体积(立方)';
      default: return '重量(吨)';
    }
  };

  const getQuantityDisplay = (record: LogisticsRecordWithPartners) => {
    const billingTypeId = record.billing_type_id || 1;
    const loading = record.loading_weight || 0;
    const unloading = record.unloading_weight || 0;
    // 根据 billing_type_id 返回带单位的字符串
    switch (billingTypeId) {
      case 2: return `1 车`;
      case 3: return `${loading} / ${unloading} 立方`;
      default: return `${loading} / ${unloading} 吨`;
    }
  };

  // 按级别分组合作方数据
  const partnersByLevel = useMemo(() => {
    if (!reportData?.partner_summary || reportData.partner_summary.length === 0) {
      return [];
    }
    
    // 按级别排序
    const sorted = [...reportData.partner_summary].sort((a, b) => a.level - b.level);
    
    // 按级别分组
    const grouped = new Map<number, PartnerPayable[]>();
    sorted.forEach(partner => {
      const level = partner.level || 1;
      if (!grouped.has(level)) {
        grouped.set(level, []);
      }
      grouped.get(level)!.push(partner);
    });
    
    // 转换为数组并按级别排序
    return Array.from(grouped.entries())
      .sort(([levelA], [levelB]) => levelA - levelB)
      .map(([level, partners]) => ({ level, partners }));
  }, [reportData?.partner_summary]);

  // --- 事件处理器 ---
  const handleFilterChange = <K extends keyof FinanceFilters>(field: K, value: FinanceFilters[K]) => { setUiFilters(prev => ({ ...prev, [field]: value })); };
  
  // 处理合作方卡片点击
  const handlePartnerClick = useCallback((partnerId: string | null) => {
    // 如果点击的是已选中的合作方，则清除筛选（显示全部）
    const newPartnerId = activeFilters.partnerId === partnerId ? 'all' : (partnerId || 'all');
    // 同时更新 UI 状态和活动状态，立即触发筛选
    setUiFilters(prev => ({ ...prev, partnerId: newPartnerId }));
    setActiveFilters(prev => ({ ...prev, partnerId: newPartnerId }));
  }, [activeFilters.partnerId, setUiFilters, setActiveFilters]);
  const handleDateChange = (dateRange: DateRange | undefined) => { 
    setUiFilters(prev => ({ 
      ...prev, 
      // 存储中国时区的日期字符串（用于显示）
      // 在查询时会转换为UTC日期字符串
      startDate: dateRange?.from ? formatChinaDateString(dateRange.from) : '', 
      endDate: dateRange?.to ? formatChinaDateString(dateRange.to) : '' 
    })); 
  };

  // 批量输入对话框处理
  const openBatchDialog = (type: 'driver' | 'license' | 'phone' | 'waybill') => {
    setBatchDialog({ isOpen: true, type });
  };

  const closeBatchDialog = () => {
    setBatchDialog({ isOpen: false, type: null });
  };

  const getCurrentValue = () => {
    const type = batchDialog.type;
    if (type === 'driver') return uiFilters.driverName || '';
    if (type === 'license') return uiFilters.licensePlate || '';
    if (type === 'phone') return uiFilters.driverPhone || '';
    if (type === 'waybill') return waybillInput;
    return '';
  };

  const handleBatchConfirm = (value: string) => {
    const type = batchDialog.type;
    if (type === 'driver') {
      handleFilterChange('driverName', value);
    } else if (type === 'license') {
      handleFilterChange('licensePlate', value);
    } else if (type === 'phone') {
      handleFilterChange('driverPhone', value);
    } else if (type === 'waybill') {
      setWaybillInput(value);
      handleFilterChange('waybillNumbers', value);
    }
    closeBatchDialog();
  };

  const getDialogConfig = () => {
    const type = batchDialog.type;
    switch (type) {
      case 'driver':
        return {
          title: '批量输入司机姓名',
          placeholder: '请输入司机姓名，多个用逗号或换行分隔\n例如：张三,李四,王五',
          description: '支持批量输入多个司机姓名进行筛选'
        };
      case 'license':
        return {
          title: '批量输入车牌号',
          placeholder: '请输入车牌号，多个用逗号或换行分隔\n例如：京A12345,沪B67890,粤C11111',
          description: '支持批量输入多个车牌号进行筛选'
        };
      case 'phone':
        return {
          title: '批量输入司机电话',
          placeholder: '请输入司机电话，多个用逗号或换行分隔\n例如：13800138000,13900139000',
          description: '支持批量输入多个司机电话进行筛选'
        };
      case 'waybill':
        return {
          title: '批量输入运单编号',
          placeholder: '请输入运单编号，多个用逗号或换行分隔\n例如：WB001,WB002,WB003',
          description: '支持批量输入多个运单编号进行筛选'
        };
      default:
        return { title: '', placeholder: '', description: '' };
    }
  };

  const handleWaybillNumbersChange = (value: string) => {
    setWaybillInput(value);
    handleFilterChange('waybillNumbers', value);
  };

  const handleWaybillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };
  
  const handleRecordSelect = (recordId: string) => {
    setSelection(prev => {
      const newSet = new Set(prev.selectedIds);
      if (newSet.has(recordId)) { newSet.delete(recordId); } else { newSet.add(recordId); }
      if (prev.mode === 'all_filtered') { return { mode: 'none', selectedIds: newSet }; }
      return { ...prev, selectedIds: newSet };
    });
  };

  const handleSelectAllOnPage = (isChecked: boolean) => {
    const pageIds = (reportData?.records || []).map((r) => r.id);
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

  // 对账操作函数（新增）
  const handleReconcile = async () => {
    if (reconciliationDialog.costIds.length === 0) {
      toast({ title: "提示", description: "请选择要对账的记录", variant: "destructive" });
      return;
    }

    setIsReconciling(true);
    try {
      const { data, error } = await supabase.rpc('reconcile_partner_costs_batch', {
        p_cost_ids: reconciliationDialog.costIds,
        p_reconciliation_status: reconciliationStatus,
        p_reconciliation_notes: reconciliationNotes || null
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string; count: number };
      
      if (result.success) {
        toast({
          title: "对账成功",
          description: result.message || `成功对账 ${result.count} 条记录`
        });
        setReconciliationDialog({ isOpen: false, costIds: [] });
        setReconciliationNotes('');
        setReconciliationStatus('Reconciled');
        fetchReportData();
      } else {
        throw new Error(result.message || '对账操作失败');
      }
    } catch (error) {
      console.error('对账操作失败:', error);
      toast({
        title: "对账失败",
        description: error instanceof Error ? error.message : '操作失败，请重试',
        variant: "destructive"
      });
    } finally {
      setIsReconciling(false);
    }
  };

  // 自动对账函数（新增）
  const handleAutoReconcile = async (partnerId?: string) => {
    setIsReconciling(true);
    try {
      const { data, error } = await supabase.rpc('auto_reconcile_by_waybill_1116', {
        p_partner_id: partnerId && partnerId !== 'all' ? partnerId : null
      });

      if (error) throw error;

      const result = data as { 
        success: boolean; 
        matched_count: number; 
        unmatched_count: number; 
        message: string;
      };
      
      if (result.success) {
        toast({
          title: "自动对账成功",
          description: result.message || `已自动对账 ${result.matched_count} 条记录，待处理 ${result.unmatched_count} 条记录`,
        });
        fetchReportData();
      } else {
        throw new Error(result.message || '自动对账操作失败');
      }
    } catch (error) {
      console.error('自动对账失败:', error);
      toast({
        title: "自动对账失败",
        description: error instanceof Error ? error.message : '操作失败，请重试',
        variant: "destructive"
      });
    } finally {
      setIsReconciling(false);
    }
  };

  // 打开对账对话框（批量）
  const openReconciliationDialog = (costIds: string[]) => {
    setReconciliationDialog({ isOpen: true, costIds });
    setReconciliationStatus('Reconciled');
    setReconciliationNotes('');
  };

  // 获取对账状态徽章
  const getReconciliationBadge = (status?: string) => {
    if (!status || status === 'Unreconciled') {
      return <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-300"><Clock className="mr-1 h-3 w-3" />未对账</Badge>;
    }
    if (status === 'Reconciled') {
      return <Badge variant="default" className="bg-green-50 text-green-700 border-green-300"><CheckCircle2 className="mr-1 h-3 w-3" />已对账</Badge>;
    }
    if (status === 'Exception') {
      return <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-300"><AlertCircle className="mr-1 h-3 w-3" />异常</Badge>;
    }
    return null;
  };

  const handleBatchRecalculate = async () => {
    setIsRecalculating(true);
    try {
      let error;
      if (selection.mode === 'all_filtered') {
        // ✅ 修改：支持多个 project_id（逗号分隔）
        let projectIdParam: string | null = null;
        if (selectedShipperId && selectedShipperId !== 'all') {
          if (selectedProjectId === 'all' && availableProjects.length > 0) {
            projectIdParam = availableProjects.map(p => p.id).join(',');
          } else if (selectedProjectId && selectedProjectId !== 'all') {
            projectIdParam = selectedProjectId;
          }
        }
        
        const { error: filterError } = await supabase.rpc('batch_recalculate_by_filter_1116', {
          p_project_id: projectIdParam,
          p_start_date: activeFilters.startDate || null,
          p_end_date: activeFilters.endDate || null,
          p_partner_id: activeFilters.partnerId === 'all' ? null : activeFilters.partnerId,
        });
        error = filterError;
      } else {
        const idsToRecalculate = Array.from(selection.selectedIds);
        if (idsToRecalculate.length === 0) {
          toast({ title: "提示", description: "没有选择任何运单。" });
          setIsRecalculating(false);
          return;
        }
        const { data: recalcResult, error: idError } = await supabase.rpc('batch_recalculate_partner_costs', { p_record_ids: idsToRecalculate });
        
        // ✅ 检查返回结果
        console.log('🔄 重算结果:', recalcResult);
        
        if (recalcResult && !recalcResult.success) {
          // 函数返回失败
          throw new Error(recalcResult.message || '重算失败');
        }
        
        if (recalcResult) {
          console.log('📊 重算统计:', {
            总运单数: recalcResult.total_count,
            成功数: recalcResult.updated_count,
            跳过数: recalcResult.skipped_count,
            保护手工值: recalcResult.protected_count
          });
          
          // 显示详细结果
          toast({ 
            title: "重算完成", 
            description: recalcResult.message || `成功重算 ${recalcResult.updated_count} 个合作方`,
            duration: 5000
          });
        }
        
        error = idError;
      }
      if (error) throw error;
      
      // ✅ 已在上面显示详细结果，这里只刷新数据
      setSelection({ mode: 'none', selectedIds: new Set() });
      fetchReportData();
    } catch (error) {
      console.error("批量重算失败:", error);
      toast({ title: "错误", description: "批量重算失败，请重试。", variant: "destructive" });
    } finally {
      setIsRecalculating(false);
    }
  };

  // --- 派生状态和工具函数 ---
  // 将存储的中国时区日期字符串转换为 Date 对象（用于显示）
  // uiFilters.startDate 和 uiFilters.endDate 存储的是中国时区的日期字符串（如 "2025-11-02"）
  const dateRangeValue: DateRange | undefined = (uiFilters.startDate || uiFilters.endDate) ? {
    from: uiFilters.startDate ? (() => {
      // 解析中国时区日期字符串为 Date 对象（用于显示）
      const [year, month, day] = uiFilters.startDate.split('-').map(Number);
      return new Date(year, month - 1, day);
    })() : undefined,
    to: uiFilters.endDate ? (() => {
      // 解析中国时区日期字符串为 Date 对象（用于显示）
      const [year, month, day] = uiFilters.endDate.split('-').map(Number);
      return new Date(year, month - 1, day);
    })() : undefined
  } : undefined;
  
  const displayedPartners = useMemo(() => {
    // 如果状态为 hidden，不显示合作方列
    if (partnerDisplayState === 'hidden') {
      return [];
    }
    
    // 如果筛选了特定合作方，只显示该合作方
    if (uiFilters.partnerId !== "all") {
      const selected = allPartners.find(p => p.id === uiFilters.partnerId);
      return selected ? [selected] : [];
    }
    
    if (!reportData || !Array.isArray(reportData.records)) return [];
    
    // 计算相关的合作方和最高级别
    const relevantPartnerIds = new Set<string>();
    let maxLevel = 0;
    reportData.records.forEach((record) => {
      if (record && Array.isArray(record.partner_costs)) {
        record.partner_costs.forEach((cost) => {
          relevantPartnerIds.add(cost.partner_id);
          if (cost.level > maxLevel) {
            maxLevel = cost.level;
          }
        });
      }
    });
    
    const filteredPartners = allPartners
      .filter(partner => relevantPartnerIds.has(partner.id))
      .sort((a, b) => a.level - b.level);
    
    // 根据 partnerDisplayState 决定显示哪些合作方
    if (partnerDisplayState === 'maxLevel' && maxLevel > 0) {
      return filteredPartners.filter(p => p.level === maxLevel);
    }
    // partnerDisplayState === 'all' 时显示所有合作方
    return filteredPartners;
  }, [reportData, allPartners, uiFilters.partnerId, partnerDisplayState]);
  
  // 处理合作方显示状态切换
  // 状态循环：hidden -> maxLevel -> all -> maxLevel -> hidden
  const handlePartnerDisplayToggle = () => {
    setPartnerDisplayState(prev => {
      if (prev === 'hidden') {
        setHasExpandedAll(false);  // 从隐藏开始，还未展开过全部
        return 'maxLevel';         // 隐藏 -> 最高级
      }
      if (prev === 'maxLevel') {
        if (!hasExpandedAll) {
          setHasExpandedAll(true);  // 标记已展开过全部
          return 'all';             // 最高级 -> 全部（第一次）
        } else {
          setHasExpandedAll(false); // 重置标志
          return 'hidden';          // 最高级 -> 隐藏（第二次）
        }
      }
      if (prev === 'all') {
        return 'maxLevel';          // 全部 -> 最高级
      }
      return 'hidden';
    });
  };
  
  // 获取按钮文字
  // 根据当前状态显示下一步操作的按钮文字
  const getPartnerDisplayButtonText = () => {
    if (partnerDisplayState === 'hidden') return '展开合作方';      // 下一步：展开最高级
    if (partnerDisplayState === 'maxLevel') {
      return hasExpandedAll ? '隐藏合作方' : '展开全部';  // 如果已展开过全部，显示"隐藏合作方"；否则显示"展开全部"
    }
    if (partnerDisplayState === 'all') return '仅显示最高级';  // 下一步：回到最高级
    return '展开合作方';
  };

  const exportDetailsToExcel = () => {
    if (!reportData?.records || reportData.records.length === 0) {
        toast({ title: "提示", description: "没有可导出的数据" });
        return;
    }
    const headers = ['运单编号', '项目名称', '司机姓名', '路线', '装货日期', '运费金额', '额外费用', '司机应收'];
    displayedPartners.forEach(p => headers.push(`${p.name}(应付)`));
    const dataToExport = (reportData.records || []).map((record) => {
      const row: Record<string, string | number> = {
        '运单编号': record.auto_number, '项目名称': record.project_name, '司机姓名': record.driver_name,
        '路线': `${record.loading_location} → ${record.unloading_location}`, '装货日期': record.loading_date,
        '运费金额': record.current_cost || 0, '额外费用': record.extra_cost || 0, '司机应收': record.payable_cost || 0,
      };
      displayedPartners.forEach(p => {
        const cost = (record.partner_costs || []).find((c) => c.partner_id === p.id);
        row[`${p.name}(应付)`] = cost ? cost.payable_amount : 0;
      });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(dataToExport, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "运单财务明细");
    XLSX.writeFile(wb, `运单财务明细_${new Date().toLocaleDateString()}.xlsx`);
    toast({ title: "成功", description: "财务明细数据已导出到Excel" });
  };

  const isAllOnPageSelected = useMemo(() => {
    const pageIds = (reportData?.records || []).map((r) => r.id);
    if (pageIds.length === 0) return false;
    return pageIds.every(id => selection.selectedIds.has(id));
  }, [reportData?.records, selection.selectedIds]);

  const selectionCount = useMemo(() => {
    if (selection.mode === 'all_filtered') return reportData?.count || 0;
    return selection.selectedIds.size;
  }, [selection, reportData?.count]);

  if (loading && !reportData) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin"/></div>;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader 
        title="运费对账" 
        description="运费收入与合作方应付金额统计"
        icon={Calculator}
        iconColor="text-blue-600"
      >
        {/* 一键重算已选运单按钮 */}
        <ConfirmDialog title="确认批量重算" description={`您确定要为选中的 ${selectionCount} 条运单重新计算所有合作方的应付金额吗？此操作会根据最新的项目合作链路配置覆盖现有数据。`} onConfirm={handleBatchRecalculate}>
          <Button variant="destructive" disabled={selectionCount === 0 || isRecalculating} className="h-10">
            {isRecalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            一键重算已选运单 ({selectionCount})
          </Button>
        </ConfirmDialog>
        {/* 自动对账按钮 */}
        {canReconcile && (
          <Button
            variant="default"
            disabled={isReconciling}
            onClick={() => handleAutoReconcile(activeFilters.partnerId === 'all' ? undefined : activeFilters.partnerId)}
            className="h-10 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isReconciling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                自动对账中...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                自动对账
              </>
            )}
          </Button>
        )}
        {/* 批量对账按钮 */}
        {canReconcile && (
          <Button
            variant="default"
            disabled={selectionCount === 0}
            onClick={async () => {
              try {
                const allCostIds: string[] = [];
                
                if (selection.mode === 'all_filtered') {
                  // 跨页选择：需要获取所有筛选条件下的运单
                  let projectIdParam: string | null = null;
                  if (selectedShipperId && selectedShipperId !== 'all') {
                    if (selectedProjectId === 'all' && availableProjects.length > 0) {
                      projectIdParam = availableProjects.map(p => p.id).join(',');
                    } else if (selectedProjectId && selectedProjectId !== 'all') {
                      projectIdParam = selectedProjectId;
                    }
                  }
                  
                  const utcStartDate = activeFilters.startDate ? (() => {
                    const [year, month, day] = activeFilters.startDate.split('-').map(Number);
                    const chinaDate = new Date(year, month - 1, day);
                    return convertChinaDateToUTCDate(chinaDate);
                  })() : null;
                  const utcEndDate = activeFilters.endDate ? (() => {
                    const [year, month, day] = activeFilters.endDate.split('-').map(Number);
                    const chinaDate = new Date(year, month - 1, day);
                    return convertChinaEndDateToUTCDate(chinaDate);
                  })() : null;
                  
                  // 获取所有筛选条件下的运单（不分页）
                  const { data: allData, error } = await supabase.rpc('get_finance_reconciliation_by_partner_1116', {
                    p_project_id: projectIdParam,
                    p_start_date: utcStartDate,
                    p_end_date: utcEndDate,
                    p_partner_id: activeFilters.partnerId === 'all' ? null : activeFilters.partnerId,
                    p_page_number: 1,
                    p_page_size: 10000, // 获取所有数据
                    p_driver_name: activeFilters.driverName || null,
                    p_license_plate: activeFilters.licensePlate || null,
                    p_driver_phone: activeFilters.driverPhone || null,
                    p_waybill_numbers: activeFilters.waybillNumbers || null,
                    p_other_platform_name: activeFilters.otherPlatformName || null,
                    p_reconciliation_status: activeFilters.reconciliationStatus === 'all' ? null : activeFilters.reconciliationStatus || null,
                  });
                  
                  if (error) throw error;
                  
                  const allRecords = (allData as FinanceReconciliationResponse)?.records || [];
                  allRecords.forEach((r) => {
                    displayedPartners.forEach(p => {
                      const cost = (r.partner_costs || []).find((c) => c.partner_id === p.id);
                      if (cost?.cost_id) {
                        allCostIds.push(cost.cost_id);
                      }
                    });
                  });
                } else {
                  // 单页选择：只收集当前页选中的运单
                  (reportData?.records || []).forEach((r) => {
                    if (selection.selectedIds.has(r.id)) {
                      displayedPartners.forEach(p => {
                        const cost = (r.partner_costs || []).find((c) => c.partner_id === p.id);
                        if (cost?.cost_id) {
                          allCostIds.push(cost.cost_id);
                        }
                      });
                    }
                  });
                }
                
                if (allCostIds.length > 0) {
                  openReconciliationDialog(allCostIds);
                } else {
                  toast({ title: "提示", description: "没有可对账的记录", variant: "destructive" });
                }
              } catch (error) {
                console.error('获取对账记录失败:', error);
                toast({
                  title: "错误",
                  description: error instanceof Error ? error.message : '获取对账记录失败',
                  variant: "destructive"
                });
              }
            }}
            className="h-10 bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            批量对账 ({selectionCount})
          </Button>
        )}
      </PageHeader>

      <div className="space-y-6">

      <Card className="border-muted/40">
        <CardContent className="p-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-none" style={{width: '480px'}}>
              <ShipperProjectCascadeFilter
                selectedShipperId={selectedShipperId}
                selectedProjectId={selectedProjectId}
                onShipperChange={(id) => {
                  setSelectedShipperId(id);
                  setSelectedProjectId('all');
                  handleFilterChange('projectId', '');
                }}
                onProjectChange={(id) => {
                  setSelectedProjectId(id);
                  // ✅ 统一处理：'all' 转换为空字符串，与 RPC 调用时的处理保持一致
                  handleFilterChange('projectId', id === 'all' ? '' : id);
                }}
                onProjectsChange={(projects) => {
                  setAvailableProjects(projects);
                }}
              />
            </div>
            <div className="flex-none w-64 space-y-2"><Label>日期范围</Label><DateRangePicker date={dateRangeValue} setDate={handleDateChange} /></div>
            <div className="flex-none w-40 space-y-2"><Label>合作方</Label><Select value={uiFilters.partnerId} onValueChange={(v) => handleFilterChange('partnerId', v)}><SelectTrigger className="h-10"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">全部</SelectItem>{allPartners.map(p => (<SelectItem key={p.id} value={p.id}>{p.name} ({p.level}级)</SelectItem>))}</SelectContent></Select></div>
            <div className="flex-none w-36 space-y-2"><Label>对账状态</Label><Select value={uiFilters.reconciliationStatus || 'all'} onValueChange={(v) => handleFilterChange('reconciliationStatus', v)}><SelectTrigger className="h-10"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">全部</SelectItem><SelectItem value="Unreconciled">未对账</SelectItem><SelectItem value="Reconciled">已对账</SelectItem><SelectItem value="Exception">异常</SelectItem></SelectContent></Select></div>
            <Button onClick={handleSearch} className="h-10 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"><Search className="mr-2 h-4 w-4"/>搜索</Button>
            <Button variant="outline" onClick={handleClear} className="h-10">清除</Button>
            <Button
              variant="outline"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="h-10"
            >
              {showAdvanced ? (
                <>
                  <ChevronUp className="mr-1 h-4 w-4" />
                  收起
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1 h-4 w-4" />
                  高级
                </>
              )}
            </Button>
          </div>

          {/* 高级筛选器 - 可折叠 */}
          {showAdvanced && (
            <div className="mt-4 pt-4 border-t border-purple-200">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {/* 司机 */}
                <div className="space-y-2">
                  <Label htmlFor="driver-name" className="text-sm font-medium text-purple-800 flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    司机
                  </Label>
                  <div className="flex gap-1">
                    <Input 
                      type="text" 
                      id="driver-name" 
                      placeholder="司机姓名..." 
                      value={uiFilters.driverName || ''} 
                      onChange={e => handleFilterChange('driverName', e.target.value)} 
                      disabled={loading}
                      className="h-10 flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openBatchDialog('driver')}
                      className="h-10 px-2"
                      title="批量输入"
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* 车牌号 */}
                <div className="space-y-2">
                  <Label htmlFor="license-plate" className="text-sm font-medium text-purple-800 flex items-center gap-1">
                    <Hash className="h-4 w-4" />
                    车牌号
                  </Label>
                  <div className="flex gap-1">
                    <Input 
                      type="text" 
                      id="license-plate" 
                      placeholder="车牌号..." 
                      value={uiFilters.licensePlate || ''} 
                      onChange={e => handleFilterChange('licensePlate', e.target.value)} 
                      disabled={loading}
                      className="h-10 flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openBatchDialog('license')}
                      className="h-10 px-2"
                      title="批量输入"
                    >
                      <Hash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* 司机电话 */}
                <div className="space-y-2">
                  <Label htmlFor="driver-phone" className="text-sm font-medium text-purple-800 flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    司机电话
                  </Label>
                  <div className="flex gap-1">
                    <Input 
                      type="text" 
                      id="driver-phone" 
                      placeholder="司机电话..." 
                      value={uiFilters.driverPhone || ''} 
                      onChange={e => handleFilterChange('driverPhone', e.target.value)} 
                      disabled={loading}
                      className="h-10 flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openBatchDialog('phone')}
                      className="h-10 px-2"
                      title="批量输入"
                    >
                      <Phone className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* 运单编号 */}
                <div className="space-y-2">
                  <Label htmlFor="waybill-numbers" className="text-sm font-medium text-purple-800 flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    运单编号
                  </Label>
                  <div className="flex gap-1">
                    <div className="relative flex-1">
                      <Input 
                        type="text" 
                        id="waybill-numbers" 
                        placeholder="输入运单编号，多个用逗号分隔..." 
                        value={waybillInput} 
                        onChange={e => handleWaybillNumbersChange(e.target.value)}
                        onKeyDown={handleWaybillKeyDown}
                        disabled={loading}
                        className="h-10 pr-8"
                      />
                      {waybillInput && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1 h-6 w-6 p-0 hover:bg-purple-100"
                          onClick={() => handleWaybillNumbersChange('')}
                        >
                          <X className="h-3 w-3 text-purple-600" />
                        </Button>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openBatchDialog('waybill')}
                      className="h-10 px-2"
                      title="批量输入"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="text-xs text-purple-600">
                    💡 支持多个运单编号查询，用逗号分隔，按回车快速搜索
                  </div>
                </div>

                {/* 其他平台名称 */}
                <div className="space-y-2">
                  <Label htmlFor="other-platform" className="text-sm font-medium text-purple-800">其他平台名称</Label>
                  <Select
                    value={uiFilters.otherPlatformName || 'all'}
                    onValueChange={(value) => handleFilterChange('otherPlatformName', value === 'all' ? '' : value)}
                    disabled={loading}
                  >
                    <SelectTrigger id="other-platform" className="h-10">
                      <SelectValue placeholder="选择平台" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">所有平台</SelectItem>
                      
                      {/* 固定平台列表 */}
                      <SelectItem value="本平台">本平台</SelectItem>
                      <SelectItem value="中科智运">中科智运</SelectItem>
                      <SelectItem value="中工智云">中工智云</SelectItem>
                      <SelectItem value="可乐公司">可乐公司</SelectItem>
                      <SelectItem value="盼盼集团">盼盼集团</SelectItem>
                      
                      {/* 动态平台列表（从数据库获取） */}
                      {platformOptions.length > 0 && (
                        <>
                          {/* 分隔线提示 */}
                          <SelectItem value="---" disabled className="text-xs text-purple-400">
                            ─── 其他平台 ───
                          </SelectItem>
                          {platformOptions.map((platform) => (
                            <SelectItem 
                              key={platform.platform_name} 
                              value={platform.platform_name}
                            >
                              {platform.platform_name} ({platform.usage_count}条)
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-purple-600">
                    📊 固定平台: 5个 {platformOptions.length > 0 && `| 其他平台: ${platformOptions.length}个`}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 批量输入对话框 */}
          <BatchInputDialog
            isOpen={batchDialog.isOpen}
            onClose={closeBatchDialog}
            onApply={handleBatchConfirm}
            title={getDialogConfig().title}
            placeholder={getDialogConfig().placeholder}
            description={getDialogConfig().description}
            currentValue={getCurrentValue()}
          />
        </CardContent>
      </Card>

      {selection.selectedIds.size > 0 && selection.mode !== 'all_filtered' && isAllOnPageSelected && reportData?.count > (reportData?.records?.length || 0) && (
        <div className="flex items-center justify-center gap-4 p-2 text-sm font-medium text-center bg-secondary text-secondary-foreground rounded-md">
          <span>已选择当前页的所有 <b>{reportData?.records?.length}</b> 条记录。</span>
          <Button variant="link" className="p-0 h-auto" onClick={() => setSelection({ mode: 'all_filtered', selectedIds: new Set() })}>选择全部 <b>{reportData?.count}</b> 条匹配的记录</Button>
        </div>
      )}
      {selection.mode === 'all_filtered' && (
        <div className="flex items-center justify-center gap-4 p-2 text-sm font-medium text-center bg-secondary text-secondary-foreground rounded-md">
          <span>已选择全部 <b>{reportData?.count}</b> 条匹配的记录。</span>
          <Button variant="link" className="p-0 h-auto" onClick={() => setSelection({ mode: 'none', selectedIds: new Set() })}>清除选择</Button>
        </div>
      )}

      {isStale ? ( <StaleDataPrompt /> ) : (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 auto-rows-fr">
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">运单总数</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex items-center">
                <div className="text-2xl font-bold text-blue-600">{reportData?.overview?.total_records || 0}</div>
              </CardContent>
            </Card>
            
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">总运费</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex items-center">
                <div className="text-2xl font-bold text-green-600">
                  <CurrencyDisplay value={reportData?.overview?.total_freight} />
                </div>
              </CardContent>
            </Card>
            
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">总额外费用</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex items-center">
                <div className="text-2xl font-bold text-orange-600">
                  <CurrencyDisplay value={reportData?.overview?.total_extra_cost} />
                </div>
              </CardContent>
            </Card>
            
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">司机应收汇总</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex items-center">
                <div className="text-2xl font-bold text-purple-600">
                  <CurrencyDisplay value={reportData?.overview?.total_driver_receivable} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* --- [优化设计] 合作方应付汇总 - 紧凑卡片布局 --- */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">合作方应付汇总</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllPartnerCards(!showAllPartnerCards)}
                className="h-8 text-xs"
              >
                {showAllPartnerCards ? '收起' : '展开全部'}
              </Button>
            </CardHeader>
            <CardContent>
                  {loading && !(reportData?.partner_summary?.length > 0) ? (
                <div className="flex justify-center items-center h-24">
                  <Loader2 className="h-5 w-5 animate-spin"/>
                </div>
                  ) : (!reportData?.partner_summary || reportData.partner_summary.length === 0) ? (
                <div className="text-center py-8 text-sm text-muted-foreground">没有找到匹配的数据</div>
                  ) : (
                    <>
                  {/* 按级别分行的卡片布局 */}
                  <div className="space-y-3 mb-4">
                    {/* 第一行：全部卡片 + 一级合作方（level 1） */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2.5">
                      {/* 全部卡片 */}
                      <Card 
                        className={cn(
                          "cursor-pointer transition-all hover:shadow-sm border",
                          activeFilters.partnerId === 'all' 
                            ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20" 
                            : "border-border/60 hover:border-primary/40 hover:bg-accent/50"
                        )}
                        onClick={() => handlePartnerClick(null)}
                      >
                        <CardContent className="p-3">
                          <div className="text-xs font-medium text-muted-foreground mb-1.5 truncate">全部</div>
                          <div className="space-y-1">
                            <div className="flex items-baseline justify-between gap-1">
                              <span className="text-[10px] text-muted-foreground">运单</span>
                              <span className="text-sm font-semibold">
                                {reportData.partner_summary?.reduce((sum: number, p) => sum + (p.records_count || 0), 0) || 0}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between gap-1">
                              <span className="text-[10px] text-muted-foreground">金额</span>
                              <span className="text-xs font-semibold text-red-600 truncate">
                                <CurrencyDisplay 
                                  value={reportData.partner_summary?.reduce((sum: number, p) => sum + (p.total_payable || 0), 0) || 0}
                                  className="text-red-600"
                                />
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      {/* 一级合作方（level 1） */}
                      {partnersByLevel.find(g => g.level === 1)?.partners.map((partner) => {
                        const isSelected = activeFilters.partnerId === partner.partner_id;
                        return (
                          <Card 
                            key={partner.partner_id}
                            className={cn(
                              "cursor-pointer transition-all hover:shadow-sm border",
                              isSelected
                                ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20" 
                                : "border-border/60 hover:border-primary/40 hover:bg-accent/50"
                            )}
                            onClick={() => handlePartnerClick(partner.partner_id)}
                          >
                            <CardContent className="p-3">
                              <div className="text-xs font-medium mb-1.5 truncate" title={partner.partner_name}>
                                {partner.partner_name}
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-baseline justify-between gap-1">
                                  <span className="text-[10px] text-muted-foreground">运单</span>
                                  <span className="text-sm font-semibold">{partner.records_count}</span>
                                </div>
                                <div className="flex items-baseline justify-between gap-1">
                                  <span className="text-[10px] text-muted-foreground">金额</span>
                                  <span className="text-xs font-semibold text-red-600 truncate">
                                    <CurrencyDisplay 
                                      value={partner.total_payable}
                                      className="text-red-600"
                                    />
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                    
                    {/* 后续级别：二级、三级等 */}
                    {showAllPartnerCards && partnersByLevel.filter(g => g.level !== 1).map(({ level, partners }) => (
                      <div key={level} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2.5">
                        {partners.map((partner) => {
                          const isSelected = activeFilters.partnerId === partner.partner_id;
                          return (
                            <Card 
                              key={partner.partner_id}
                              className={cn(
                                "cursor-pointer transition-all hover:shadow-sm border",
                                isSelected
                                  ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20" 
                                  : "border-border/60 hover:border-primary/40 hover:bg-accent/50"
                              )}
                              onClick={() => handlePartnerClick(partner.partner_id)}
                            >
                              <CardContent className="p-3">
                                <div className="text-xs font-medium mb-1.5 truncate" title={partner.partner_name}>
                                  {partner.partner_name}
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-baseline justify-between gap-1">
                                    <span className="text-[10px] text-muted-foreground">运单</span>
                                    <span className="text-sm font-semibold">{partner.records_count}</span>
                                  </div>
                                  <div className="flex items-baseline justify-between gap-1">
                                    <span className="text-[10px] text-muted-foreground">金额</span>
                                    <span className="text-xs font-semibold font-mono text-red-600 truncate">
                            {formatCurrency(partner.total_payable)}
                                    </span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  
                  {/* 合计信息 - 紧凑卡片设计 */}
                  <Card className="mt-3 w-fit">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-[10px] text-muted-foreground">总运单数</div>
                          <div className="text-sm font-semibold">
                            {reportData.partner_summary?.reduce((sum: number, p) => sum + (p.records_count || 0), 0) || 0}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-muted-foreground">应付总金额</div>
                          <div className="text-sm font-semibold text-red-600">
                            <CurrencyDisplay 
                              value={reportData.partner_summary?.reduce((sum: number, p) => sum + (p.total_payable || 0), 0) || 0}
                              className="text-red-600"
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                    </>
                  )}
            </CardContent>
          </Card>
          {/* --- 优化设计结束 --- */}

          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gradient-to-r from-background to-muted/10 border-b">
                <div>
                  <CardTitle className="text-lg">运单财务明细</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {partnerDisplayState === 'hidden' ? '合作方列已隐藏' : 
                     partnerDisplayState === 'maxLevel' ? '仅显示最高级合作方' : 
                     '显示所有层级的合作方'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handlePartnerDisplayToggle} 
                    className="whitespace-nowrap hover:bg-primary/10 transition-colors"
                  >
                    {getPartnerDisplayButtonText()}
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportDetailsToExcel} disabled={!(reportData?.records?.length > 0)}>
                    <Download className="mr-2 h-4 w-4" />导出明细
                  </Button>
                </div>
            </CardHeader>
            <CardContent>
              <div className="min-h-[400px] overflow-x-auto">
                {loading ? (<div className="flex justify-center items-center h-full min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin"/></div>) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox checked={selection.mode === 'all_filtered' || isAllOnPageSelected} onCheckedChange={handleSelectAllOnPage}/>
                      </TableHead>
                      <TableHead>运单编号</TableHead>
                      <TableHead>项目</TableHead>
                      <TableHead>司机</TableHead>
                      <TableHead>路线</TableHead>
                      <TableHead>日期</TableHead>
                      <TableHead>装货数量</TableHead>
                      <TableHead className="text-red-600">运费+额外费</TableHead>
                      <TableHead className="text-green-600">司机应收</TableHead>
                      {displayedPartners.map(p => (
                        <TableHead key={p.id} className="text-center">
                          {p.name}
                          <div className="text-xs text-muted-foreground">({p.level}级)</div>
                        </TableHead>
                      ))}
                      <TableHead>状态</TableHead>
                      <TableHead className="w-24">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(reportData?.records || []).map((r) => {
                      // 收集当前运单的所有合作方成本ID（用于批量对账）
                      // 即使合作方列隐藏，也要能收集到所有 cost_id
                      const costIds = (r.partner_costs || [])
                        .map(cost => cost.cost_id)
                        .filter((id): id is string => !!id);
                      
                      return (
                        <TableRow key={r.id} data-state={selection.selectedIds.has(r.id) && "selected"} className="whitespace-nowrap">
                          <TableCell>
                            <Checkbox 
                              checked={selection.mode === 'all_filtered' || selection.selectedIds.has(r.id)} 
                              onCheckedChange={() => handleRecordSelect(r.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono cursor-pointer" onClick={() => setViewingRecord(r)}>
                            {r.auto_number}
                          </TableCell>
                          <TableCell className="cursor-pointer" onClick={() => setViewingRecord(r)}>
                            {r.project_name}
                          </TableCell>
                          <TableCell className="cursor-pointer" onClick={() => setViewingRecord(r)}>
                            {r.driver_name}
                          </TableCell>
                          <TableCell className="text-sm cursor-pointer" onClick={() => setViewingRecord(r)}>
                            {`${r.loading_location?.substring(0, 2) || ''}→${r.unloading_location?.substring(0, 2) || ''}`}
                          </TableCell>
                          <TableCell className="cursor-pointer" onClick={() => setViewingRecord(r)}>
                            {r.loading_date}
                          </TableCell>
                          <TableCell className="text-sm cursor-pointer" onClick={() => setViewingRecord(r)}>
                            {getQuantityDisplay(r)}
                          </TableCell>
                          <TableCell className="cursor-pointer" onClick={() => setViewingRecord(r)}>
                            <div className="flex items-center gap-2">
                              <CurrencyDisplay value={r.current_cost} className="text-red-600" />
                              <span className="text-gray-400">/</span>
                              <CurrencyDisplay value={r.extra_cost} className="text-black" />
                            </div>
                          </TableCell>
                          <TableCell className="text-green-600 cursor-pointer" onClick={() => setViewingRecord(r)}>
                            <CurrencyDisplay value={r.payable_cost} className="text-green-600" />
                          </TableCell>
                          {displayedPartners.map(p => {
                            const cost = (r.partner_costs || []).find((c) => c.partner_id === p.id);
                            return (
                              <TableCell key={p.id} className="text-center">
                                <div className="flex flex-col items-center gap-1">
                                  <div className="font-mono">
                                    <CurrencyDisplay value={cost?.payable_amount} />
                                  </div>
                                  {cost && getReconciliationBadge(cost.reconciliation_status)}
                                </div>
                              </TableCell>
                            );
                          })}
                          <TableCell className="cursor-pointer" onClick={() => setViewingRecord(r)}>
                            <Badge variant={r.current_cost ? "default" : "secondary"}>
                              {r.current_cost ? "已计费" : "待计费"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {costIds.length > 0 && canReconcile && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openReconciliationDialog(costIds);
                                }}
                                className="h-7 text-xs"
                              >
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                对账
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-muted/30 font-semibold border-t-2">
                      <TableCell colSpan={7} className="text-right font-bold">合计</TableCell>
                      <TableCell className="font-bold text-center">
                        <div className="flex items-center justify-center gap-2">
                          <CurrencyDisplay value={reportData?.overview?.total_freight} className="text-red-600" />
                          <span className="text-gray-400">/</span>
                          <CurrencyDisplay value={reportData?.overview?.total_extra_cost} className="text-black" />
                        </div>
                        <div className="text-xs text-muted-foreground font-normal mt-1">(运费/额外费)</div>
                      </TableCell>
                      <TableCell className="text-center font-bold text-green-600">
                        <div><CurrencyDisplay value={reportData?.overview?.total_driver_receivable} className="text-green-600" /></div>
                        <div className="text-xs text-muted-foreground font-normal">(司机应收)</div>
                      </TableCell>
                      {displayedPartners.map(p => {
                        const total = (reportData?.partner_summary || []).find((pp) => pp.partner_id === p.id)?.total_payable || 0;
                        return (
                          <TableCell key={p.id} className="text-center font-bold">
                            <div><CurrencyDisplay value={total} /></div>
                            <div className="text-xs text-muted-foreground font-normal">({p.name})</div>
                          </TableCell>
                        );
                      })}
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
      
      {!isStale && (
        <PaginationControl
          currentPage={currentPage}
          pageSize={pageSize}
          totalPages={totalPages}
          totalCount={reportData?.count}
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      )}

      {/* 运单详情对话框 - 复用运单管理的运单详情组件 */}
      <WaybillDetailDialog
        isOpen={!!viewingRecord}
        onClose={() => setViewingRecord(null)}
        record={viewingRecord ? {
          id: viewingRecord.id,
          auto_number: viewingRecord.auto_number,
          project_id: '',
          project_name: viewingRecord.project_name,
          chain_id: undefined,
          loading_date: viewingRecord.loading_date,
          loading_location: viewingRecord.loading_location,
          unloading_location: viewingRecord.unloading_location || '',
          driver_id: '',
          driver_name: viewingRecord.driver_name,
          license_plate: viewingRecord.license_plate || '',
          driver_phone: viewingRecord.driver_phone || '',
          loading_weight: viewingRecord.loading_weight || 0,
          unloading_date: viewingRecord.unloading_date || undefined,
          unloading_weight: viewingRecord.unloading_weight || undefined,
          transport_type: (viewingRecord.transport_type === '实际运输' || viewingRecord.transport_type === '退货') 
            ? viewingRecord.transport_type 
            : '实际运输' as '实际运输' | '退货',
          current_cost: viewingRecord.current_cost,
          extra_cost: viewingRecord.extra_cost,
          payable_cost: viewingRecord.payable_cost,
          remarks: viewingRecord.remarks || undefined,
          created_at: '',
          created_by_user_id: '',
          billing_type_id: viewingRecord.billing_type_id,
          payment_status: undefined,
          cargo_type: undefined,
          loading_location_ids: undefined,
          unloading_location_ids: undefined,
          external_tracking_numbers: undefined,
          other_platform_names: undefined,
        } : null}
      />

      {/* 对账对话框（新增） */}
      <Dialog open={reconciliationDialog.isOpen} onOpenChange={(isOpen) => !isOpen && setReconciliationDialog({ isOpen: false, costIds: [] })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>批量对账</DialogTitle>
            <DialogDescription>
              将对 {reconciliationDialog.costIds.length} 条合作方成本记录进行对账操作
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
                  <SelectItem value="Unreconciled">未对账</SelectItem>
                  <SelectItem value="Exception">异常</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReconciliationDialog({ isOpen: false, costIds: [] })}
              disabled={isReconciling}
            >
              取消
            </Button>
            <Button
              onClick={handleReconcile}
              disabled={isReconciling}
            >
              {isReconciling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  对账中...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  确认对账
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
