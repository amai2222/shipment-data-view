// 开票申请单管理页面
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
// @ts-expect-error - lucide-react 图标导入
import { FileText, Search, Filter, Eye, Edit, Download, RefreshCw, X, CheckCircle, FileDown, CheckSquare, Square, Trash2, Ban, CalendarIcon, Building, Users } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { BatchInputDialog } from '@/pages/BusinessEntry/components/BatchInputDialog';
import { zhCN } from 'date-fns/locale';
import { LogisticsFormDialog } from "@/pages/BusinessEntry/components/LogisticsFormDialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";

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
  payable_cost: number | null;
  driver_payable_cost: number | null;
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
  status: 'Pending' | 'Approved' | 'Rejected' | 'Completed' | 'Voided' | 'Merged';
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
}

// 开票申请单详情类型
interface InvoiceRequestDetail {
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
    status: '',              // 开票申请单状态
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
  
  // 批量选择状态
  const [batchSelectionMode, setBatchSelectionMode] = useState(false);
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  
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
      status: '',
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
      // @ts-expect-error - 新的RPC函数
      const { data, error } = await supabase.rpc('get_invoice_requests_filtered', {
        p_request_number: filters.requestNumber || null,
        p_waybill_number: filters.waybillNumber || null,
        p_driver_name: filters.driverName || null,
        p_loading_date: filters.loadingDate ? format(filters.loadingDate, 'yyyy-MM-dd') : null,
        p_status: filters.status || null,
        p_project_id: filters.projectId || null,
        p_license_plate: filters.licensePlate || null,
        p_phone_number: filters.phoneNumber || null,
        p_platform_name: filters.platformName || null,
        p_limit: 100,
        p_offset: 0
      });

      if (error) throw error;

      setInvoiceRequests((data as unknown as InvoiceRequest[]) || []);
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
          .select('id, auto_number, project_id, driver_id, loading_location, unloading_location, loading_date')
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
          logistics_record: {
            auto_number: logisticsRecord?.auto_number || '',
            project_name: logisticsRecord?.project_id ? projectsMap.get(logisticsRecord.project_id) || '' : '',
            driver_name: logisticsRecord?.driver_id ? driversMap.get(logisticsRecord.driver_id) || '' : '',
            loading_location: logisticsRecord?.loading_location || '',
            unloading_location: logisticsRecord?.unloading_location || '',
            loading_date: logisticsRecord?.loading_date || ''
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

  // 批量选择相关函数
  const toggleBatchSelectionMode = () => {
    setBatchSelectionMode(!batchSelectionMode);
    setSelectedRequests(new Set());
  };

  const toggleRequestSelection = (requestId: string) => {
    const newSelection = new Set(selectedRequests);
    if (newSelection.has(requestId)) {
      newSelection.delete(requestId);
    } else {
      newSelection.add(requestId);
    }
    setSelectedRequests(newSelection);
  };

  const selectAllRequests = () => {
    const allIds = new Set(invoiceRequests.map(req => req.id));
    setSelectedRequests(allIds);
  };

  const clearSelection = () => {
    setSelectedRequests(new Set());
  };

  // 批量操作函数
  const handleBatchApprove = async () => {
    if (selectedRequests.size === 0) return;
    
    setIsBatchProcessing(true);
    try {
      // 1. 更新开票申请单状态
      const { error } = await supabase
        .from('invoice_requests')
        .update({ 
          status: 'Approved',
          updated_at: new Date().toISOString()
        })
        .in('id', Array.from(selectedRequests));

      if (error) throw error;

      // 2. 获取所有相关运单记录ID
      const { data: requestDetails, error: detailsError } = await supabase
        .from('invoice_request_details')
        .select('logistics_record_id')
        .in('invoice_request_id', Array.from(selectedRequests));

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
        title: "批量确认成功",
        description: `已确认 ${selectedRequests.size} 个开票申请单，相关运单状态已更新`,
      });
      
      loadInvoiceRequests();
      setSelectedRequests(new Set());
    } catch (error) {
      console.error('批量确认失败:', error);
      toast({
        title: "批量确认失败",
        description: error.message || '无法批量确认开票申请单',
        variant: "destructive",
      });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchReject = async () => {
    if (selectedRequests.size === 0) return;
    
    setIsBatchProcessing(true);
    try {
      const { error } = await supabase
        .from('invoice_requests')
        .update({ 
          status: 'Rejected',
          updated_at: new Date().toISOString()
        })
        .in('id', Array.from(selectedRequests));

      if (error) throw error;

      toast({
        title: "批量拒绝成功",
        description: `已拒绝 ${selectedRequests.size} 个开票申请单`,
      });
      
      loadInvoiceRequests();
      setSelectedRequests(new Set());
    } catch (error) {
      console.error('批量拒绝失败:', error);
      toast({
        title: "批量拒绝失败",
        description: error.message || '无法批量拒绝开票申请单',
        variant: "destructive",
      });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchVoid = async () => {
    if (selectedRequests.size === 0) return;
    
    setIsBatchProcessing(true);
    try {
      const { error } = await supabase
        .from('invoice_requests')
        .update({ 
          status: 'Cancelled',
          updated_at: new Date().toISOString()
        })
        .in('id', Array.from(selectedRequests));

      if (error) throw error;

      toast({
        title: "批量作废成功",
        description: `已作废 ${selectedRequests.size} 个开票申请单`,
      });
      
      loadInvoiceRequests();
      setSelectedRequests(new Set());
    } catch (error) {
      console.error('批量作废失败:', error);
      toast({
        title: "批量作废失败",
        description: error.message || '无法批量作废开票申请单',
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
        payable_cost: logisticsData.payable_cost,
        driver_payable_cost: logisticsData.payable_cost,
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

  // 处理确认开票
  const handleApproveInvoice = (request: InvoiceRequest) => {
    approveInvoice(request.id);
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
        .order('created_at', { ascending: false });

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
                    <td>${request.total_amount.toLocaleString()}</td>
                    <td>${request.total_amount.toLocaleString()}</td>
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

  // 状态徽章颜色
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Pending': return 'secondary';
      case 'Approved': return 'default';
      case 'Rejected': return 'destructive';
      case 'Completed': return 'outline';
      case 'Voided': return 'destructive';
      case 'Cancelled': return 'destructive';
      case 'Processing': return 'secondary';
      case 'Merged': return 'secondary';
      default: return 'secondary';
    }
  };

  // 状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'Pending': return '待审核';
      case 'Approved': return '已通过';
      case 'Rejected': return '已拒绝';
      case 'Completed': return '已完成';
      case 'Voided': return '已作废';
      case 'Cancelled': return '已取消';
      case 'Processing': return '处理中';
      case 'Merged': return '已合并';
      default: return status;
    }
  };

  // 过滤后的申请单列表
  // 筛选逻辑已在loadInvoiceRequests中处理，直接使用invoiceRequests
  const filteredRequests = invoiceRequests;

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
    loadFilterOptions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader 
        title="财务开票" 
        description="管理和跟踪所有开票申请单的状态"
        icon={FileText}
        iconColor="text-blue-600"
      >
        <div className="flex gap-2">
          <Button onClick={exportInvoiceRequests} variant="outline">
            <FileDown className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button onClick={loadInvoiceRequests} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Button 
            onClick={toggleBatchSelectionMode} 
            variant={batchSelectionMode ? "default" : "outline"}
            className={batchSelectionMode ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            {batchSelectionMode ? <CheckSquare className="mr-2 h-4 w-4" /> : <Square className="mr-2 h-4 w-4" />}
            {batchSelectionMode ? "退出批量选择" : "批量选择"}
          </Button>
        </div>
      </PageHeader>

      {/* 批量操作栏 */}
      {batchSelectionMode && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-blue-800">
                  已选择 {selectedRequests.size} 个申请单
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllRequests}
                    disabled={isBatchProcessing}
                  >
                    全选
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSelection}
                    disabled={isBatchProcessing}
                  >
                    清空选择
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleBatchApprove}
                  disabled={selectedRequests.size === 0 || isBatchProcessing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  批量确认
                </Button>
                <Button
                  onClick={handleBatchReject}
                  disabled={selectedRequests.size === 0 || isBatchProcessing}
                  variant="destructive"
                >
                  <Ban className="mr-2 h-4 w-4" />
                  批量拒绝
                </Button>
                <Button
                  onClick={handleBatchVoid}
                  disabled={selectedRequests.size === 0 || isBatchProcessing}
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  批量作废
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
              <Label htmlFor="status" className="text-sm font-medium">开票状态</Label>
              <select
                id="status"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm h-10"
              >
                <option value="">全部状态</option>
                <option value="Pending">待审核</option>
                <option value="Approved">已通过</option>
                <option value="Rejected">已拒绝</option>
                <option value="Completed">已完成</option>
                <option value="Voided">已作废</option>
                <option value="Merged">已合并</option>
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
      <Card>
        <CardHeader>
          <CardTitle>开票申请单列表 ({filteredRequests.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              加载中...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {batchSelectionMode && (
                    <TableHead className="w-12">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedRequests.size === filteredRequests.length) {
                            clearSelection();
                          } else {
                            selectAllRequests();
                          }
                        }}
                        className="p-0 h-6 w-6"
                      >
                        {selectedRequests.size === filteredRequests.length ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                  )}
                  <TableHead>申请单号</TableHead>
                  <TableHead>合作方</TableHead>
                  <TableHead>开票金额</TableHead>
                  <TableHead>运单数量</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>创建人</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow 
                    key={request.id}
                    className={cn(
                      "cursor-pointer hover:bg-muted/50",
                      batchSelectionMode && selectedRequests.has(request.id) && "bg-blue-50"
                    )}
                    onClick={() => {
                      if (batchSelectionMode) {
                        toggleRequestSelection(request.id);
                      } else {
                        handleViewDetails(request);
                      }
                    }}
                  >
                    {batchSelectionMode && (
                      <TableCell className="w-12">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRequestSelection(request.id);
                          }}
                          className="p-0 h-6 w-6"
                        >
                          {selectedRequests.has(request.id) ? (
                            <CheckSquare className="h-4 w-4" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    )}
                    <TableCell className="font-medium">
                      {request.request_number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{request.partner_name}</div>
                        {request.invoicing_partner_full_name && (
                          <div className="text-sm text-muted-foreground">
                            {request.invoicing_partner_full_name}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      ¥{request.total_amount.toLocaleString()}
                    </TableCell>
                    <TableCell>{request.record_count}条</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(request.status)}>
                        {getStatusText(request.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(request.created_at), 'yyyy-MM-dd HH:mm')}
                    </TableCell>
                    <TableCell>
                      {request.creator_name || '未知'}
                    </TableCell>
                    <TableCell>
                      {!batchSelectionMode && (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {!request.is_voided && !request.is_merged && (
                            <>
                              {request.status === 'Pending' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleApproveInvoice(request)}
                                  title="确认开票"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditStatus(request)}
                                title="编辑状态"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleVoidRequest(request)}
                                title="作废申请单"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 详情对话框 */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>开票申请单详情 - {selectedRequest?.request_number}</DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-6">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>申请单号</Label>
                  <div className="font-medium">{selectedRequest.request_number}</div>
                </div>
                <div>
                  <Label>状态</Label>
                  <Badge variant={getStatusBadgeVariant(selectedRequest.status)}>
                    {getStatusText(selectedRequest.status)}
                  </Badge>
                </div>
                <div>
                  <Label>合作方</Label>
                  <div>{selectedRequest.partner_name}</div>
                  {selectedRequest.partner_full_name && (
                    <div className="text-sm text-muted-foreground">
                      {selectedRequest.partner_full_name}
                    </div>
                  )}
                </div>
                <div>
                  <Label>开票金额</Label>
                  <div className="font-medium">¥{selectedRequest.total_amount.toLocaleString()}</div>
                </div>
                <div>
                  <Label>运单数量</Label>
                  <div>{selectedRequest.record_count}条</div>
                </div>
                <div>
                  <Label>创建时间</Label>
                  <div>{format(new Date(selectedRequest.created_at), 'yyyy-MM-dd HH:mm:ss')}</div>
                </div>
              </div>

              {/* 银行信息 */}
              {(selectedRequest.bank_name || selectedRequest.bank_account || selectedRequest.tax_number) && (
                <div>
                  <Label>银行信息</Label>
                  <div className="space-y-2">
                    {selectedRequest.bank_name && (
                      <div>银行：{selectedRequest.bank_name}</div>
                    )}
                    {selectedRequest.bank_account && (
                      <div>账号：{selectedRequest.bank_account}</div>
                    )}
                    {selectedRequest.tax_number && (
                      <div>税号：{selectedRequest.tax_number}</div>
                    )}
                  </div>
                </div>
              )}

              {/* 运单明细 */}
              <div>
                <Label>运单明细</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>运单号</TableHead>
                      <TableHead>项目</TableHead>
                      <TableHead>司机</TableHead>
                      <TableHead>路线</TableHead>
                      <TableHead>装货日期</TableHead>
                      <TableHead>金额</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requestDetails.map((detail) => (
                      <TableRow 
                        key={detail.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewLogisticsRecord(detail.logistics_record_id)}
                      >
                        <TableCell>{detail.logistics_record.auto_number}</TableCell>
                        <TableCell>{detail.logistics_record.project_name}</TableCell>
                        <TableCell>{detail.logistics_record.driver_name}</TableCell>
                        <TableCell>
                          {detail.logistics_record.loading_location} → {detail.logistics_record.unloading_location}
                        </TableCell>
                        <TableCell>
                          {detail.logistics_record.loading_date ? format(new Date(detail.logistics_record.loading_date), 'yyyy-MM-dd') : '-'}
                        </TableCell>
                        <TableCell>¥{detail.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
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
                  <SelectItem value="Rejected">已拒绝</SelectItem>
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
                onChange={(e) => setEditForm({...editForm, remarks: e.target.value})}
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
                onChange={(e) => setVoidForm({...voidForm, reason: e.target.value})}
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
          editingRecord={selectedLogisticsRecordForView}
          projects={[]} // 查看模式下不需要项目列表
          onSubmitSuccess={() => {
            // 查看模式下不需要提交成功回调
          }}
        />
      )}

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
