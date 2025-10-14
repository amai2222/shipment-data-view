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
import { FileText, Search, Filter, Eye, Edit, Download, RefreshCw, X, CheckCircle, FileDown, CheckSquare, Square, Trash2, Ban } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { LogisticsFormDialog } from "@/pages/BusinessEntry/components/LogisticsFormDialog";
import { LogisticsRecord } from "../BusinessEntry/types";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";

// 开票申请单类型定义
interface InvoiceRequest {
  id: string;
  request_number: string;
  partner_id: string;
  partner_name: string;
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
    loading_address: string;
    unloading_address: string;
  };
}

export default function InvoiceRequestManagement() {
  const [invoiceRequests, setInvoiceRequests] = useState<InvoiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // 基于logistics_records的筛选条件
  const [projectFilter, setProjectFilter] = useState('all');
  const [partnerFilter, setPartnerFilter] = useState('all');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState<{from: Date | undefined, to: Date | undefined}>({from: undefined, to: undefined});
  
  // 筛选选项数据
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  const [partners, setPartners] = useState<{id: string, name: string}[]>([]);
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

  // 加载开票申请单列表
  const loadInvoiceRequests = async () => {
    try {
      setLoading(true);
      
      // 构建基于logistics_records的查询
      let query = supabase
        .from('invoice_requests')
        .select(`
          *,
          profiles!created_by (
            full_name
          )
        `);

      // 如果有基于logistics_records的筛选条件，需要先找到符合条件的运单ID
      if (projectFilter !== 'all' || invoiceStatusFilter !== 'all' || dateRange.from || dateRange.to) {
        // 构建logistics_records查询
        let logisticsQuery = supabase
          .from('logistics_records')
          .select('id');

        if (projectFilter !== 'all') {
          logisticsQuery = logisticsQuery.eq('project_id', projectFilter);
        }

        if (invoiceStatusFilter !== 'all') {
          logisticsQuery = logisticsQuery.eq('invoice_status', invoiceStatusFilter);
        }

        if (dateRange.from) {
          logisticsQuery = logisticsQuery.gte('loading_date', dateRange.from.toISOString().split('T')[0]);
        }

        if (dateRange.to) {
          logisticsQuery = logisticsQuery.lte('loading_date', dateRange.to.toISOString().split('T')[0]);
        }

        // 执行logistics_records查询
        const { data: logisticsData, error: logisticsError } = await logisticsQuery;
        if (logisticsError) throw logisticsError;

        const logisticsRecordIds = logisticsData?.map(record => record.id) || [];
        
        if (logisticsRecordIds.length === 0) {
          // 如果没有符合条件的运单，返回空结果
          setInvoiceRequests([]);
          return;
        }

        // 根据运单ID筛选开票申请单
        // 这里需要通过invoice_request_details表来关联
        const { data: requestDetails, error: detailsError } = await supabase
          .from('invoice_request_details')
          .select('invoice_request_id')
          .in('logistics_record_id', logisticsRecordIds);

        if (detailsError) throw detailsError;

        const requestIds = [...new Set(requestDetails?.map(detail => detail.invoice_request_id) || [])];
        
        if (requestIds.length === 0) {
          setInvoiceRequests([]);
          return;
        }

        query = query.in('id', requestIds);
      }

      // 执行invoice_requests查询
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // 处理数据，添加creator_name字段
      const processedData = data?.map(request => ({
        ...request,
        creator_name: request.profiles?.full_name || '未知用户'
      })) || [];

      setInvoiceRequests(processedData);
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

      if (data?.success) {
        toast({
          title: "作废成功",
          description: data.message,
        });
        loadInvoiceRequests();
        setIsVoidDialogOpen(false);
        setVoidForm({ reason: '' });
      } else {
        throw new Error(data?.message || '作废失败');
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
      const { data, error } = await supabase
        .from('invoice_requests')
        .update({ 
          status: 'Approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "确认成功",
        description: "开票申请单已确认",
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
      const { error } = await supabase
        .from('invoice_requests')
        .update({ 
          status: 'Approved',
          updated_at: new Date().toISOString()
        })
        .in('id', Array.from(selectedRequests));

      if (error) throw error;

      toast({
        title: "批量确认成功",
        description: `已确认 ${selectedRequests.size} 个开票申请单`,
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
      const { data, error } = await supabase
        .from('logistics_records')
        .select(`
          id,
          auto_number,
          project_id,
          loading_location,
          unloading_location,
          loading_date,
          unloading_date,
          goods_name,
          goods_weight,
          unit_price,
          total_price,
          remarks,
          status,
          created_at,
          updated_at,
          created_by,
          updated_by,
          external_tracking_numbers,
          other_platform_names,
          projects (id, name, auto_code),
          drivers (id, name, license_plate, phone, id_card_number, bank_name, bank_account, bank_branch)
        `)
        .eq('id', recordId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('运单记录不存在');

      const formattedRecord: LogisticsRecord = {
        id: data.id,
        auto_number: data.auto_number,
        project_id: data.project_id,
        project_name: data.projects?.name || '',
        chain_id: null,
        chain_name: null,
        billing_type_id: 0,
        driver_id: data.drivers?.id || '',
        driver_name: data.drivers?.name || '',
        loading_location: data.loading_location,
        unloading_location: data.unloading_location,
        loading_date: data.loading_date,
        unloading_date: data.unloading_date,
        loading_weight: data.goods_weight,
        unloading_weight: data.goods_weight,
        current_cost: data.unit_price,
        payable_cost: data.total_price,
        driver_payable_cost: data.total_price,
        license_plate: data.drivers?.license_plate || '',
        driver_phone: data.drivers?.phone || '',
        transport_type: null,
        extra_cost: null,
        remarks: data.remarks,
        loading_weighbridge_image_url: null,
        unloading_weighbridge_image_url: null,
        external_tracking_numbers: data.external_tracking_numbers || [],
        other_platform_names: data.other_platform_names || [],
        created_at: data.created_at,
      };
      return formattedRecord;
    } catch (error: any) {
      console.error('获取运单详情失败:', error);
      toast({
        title: "加载失败",
        description: error.message || '无法加载运单详情',
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
      const createInvoiceRequestHTML = (requests: any[]) => {
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
      const htmlContent = createInvoiceRequestHTML(data || []);
      
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
  const filteredRequests = useMemo(() => {
    return invoiceRequests.filter(request => {
      const matchesSearch = 
        request.request_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.partner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.partner_full_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [invoiceRequests, searchTerm, statusFilter]);

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

      // 加载合作方列表
      const { data: partnersData, error: partnersError } = await supabase
        .from('partners')
        .select('id, name')
        .order('name');
      
      if (partnersError) throw partnersError;
      setPartners(partnersData || []);
    } catch (error) {
      console.error('加载筛选选项失败:', error);
    }
  };

  useEffect(() => {
    loadInvoiceRequests();
    loadFilterOptions();
  }, []);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader 
        title="开票申请单管理" 
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

      {/* 筛选和搜索 */}
      <Card>
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 搜索框 */}
            <div className="lg:col-span-2">
              <Label htmlFor="search">搜索</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="搜索申请单号、合作方名称..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* 申请单状态筛选 */}
            <div>
              <Label htmlFor="status">申请单状态</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="Pending">待审核</SelectItem>
                  <SelectItem value="Approved">已通过</SelectItem>
                  <SelectItem value="Rejected">已拒绝</SelectItem>
                  <SelectItem value="Completed">已完成</SelectItem>
                  <SelectItem value="Voided">已作废</SelectItem>
                  <SelectItem value="Merged">已合并</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 项目筛选 */}
            <div>
              <Label htmlFor="project">项目筛选</Label>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部项目</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 合作方筛选 */}
            <div>
              <Label htmlFor="partner">合作方筛选</Label>
              <Select value={partnerFilter} onValueChange={setPartnerFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="选择合作方" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部合作方</SelectItem>
                  {partners.map(partner => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 运单开票状态筛选 */}
            <div>
              <Label htmlFor="invoiceStatus">运单开票状态</Label>
              <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="选择开票状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="Uninvoiced">未开票</SelectItem>
                  <SelectItem value="Processing">开票中</SelectItem>
                  <SelectItem value="Invoiced">已开票</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 日期范围筛选 */}
            <div>
              <Label htmlFor="dateRange">装货日期范围</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1">
                      {dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : "开始日期"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateRange.from}
                      onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1">
                      {dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : "结束日期"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateRange.to}
                      onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          
          {/* 筛选按钮 */}
          <div className="flex gap-2 mt-4">
            <Button onClick={loadInvoiceRequests} className="flex-1">
              <Search className="h-4 w-4 mr-2" />
              应用筛选
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setProjectFilter('all');
                setPartnerFilter('all');
                setInvoiceStatusFilter('all');
                setDateRange({from: undefined, to: undefined});
                setSearchTerm('');
                setStatusFilter('all');
                loadInvoiceRequests();
              }}
            >
              清空筛选
            </Button>
          </div>
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
          isViewMode={true}
          isEditMode={false}
        />
      )}

    </div>
  );
}
