// 移动端开票申请单管理页面
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { FileText, Search, Filter, Eye, Edit, RefreshCw, ChevronRight, X, CheckCircle, FileDown, CheckSquare, Square, Trash2, Ban, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { LogisticsFormDialog } from "@/pages/BusinessEntry/components/LogisticsFormDialog";
import { LogisticsRecord } from "../../BusinessEntry/types";
import { MobilePullToRefresh } from "@/components/mobile/MobilePullToRefresh";
import { MobileSkeletonLoader } from "@/components/mobile/MobileSkeletonLoader";
import { triggerHaptic } from "@/utils/mobile";

// 开票申请单类型定义
interface InvoiceRequest {
  id: string;
  request_number: string;
  partner_id: string;
  partner_name: string;
  partner_full_name?: string;  // ✅ 添加
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
  remarks?: string;  // ✅ 备注字段
  invoice_number?: string;  // ✅ 添加发票号
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

export default function MobileInvoiceRequestManagement() {
  const [invoiceRequests, setInvoiceRequests] = useState<InvoiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
      
      // 使用手动JOIN查询，避免关系查询问题
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

  // 一键回滚（回滚申请单状态到待审核）
  const handleBatchRollback = async () => {
    if (selectedRequests.size === 0) return;
    
    setIsBatchProcessing(true);
    try {
      const selectedIds = Array.from(selectedRequests);
      
      const { error } = await supabase
        .from('invoice_requests')
        .update({ status: 'Pending', updated_at: new Date().toISOString() })
        .in('id', selectedIds)
        .in('status', ['Approved', 'Completed']);

      if (error) throw error;

      toast({
        title: "回滚完成",
        description: `已将 ${selectedIds.length} 个开票申请单的状态回滚到"待审核"`,
      });
      
      loadInvoiceRequests();
      setSelectedRequests(new Set());
      setBatchSelectionMode(false);
    } catch (error) {
      console.error('批量回滚失败:', error);
      toast({
        title: "回滚失败",
        description: error.message || '无法批量回滚开票申请单',
        variant: "destructive",
      });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // 一键作废（删除申请单记录和回滚运单状态）
  const handleBatchVoid = async () => {
    if (selectedRequests.size === 0) return;
    
    setIsBatchProcessing(true);
    try {
      const selectedIds = Array.from(selectedRequests);
      
      const { data, error } = await supabase.rpc('void_and_delete_invoice_requests', {
        p_request_ids: selectedIds
      });

      if (error) throw error;

      const result = data as any;
      toast({
        title: "作废成功",
        description: `已永久删除 ${result.deleted_requests} 个开票申请单，${result.affected_logistics_records} 条运单状态已回滚为未开票`,
      });
      
      loadInvoiceRequests();
      setSelectedRequests(new Set());
      setBatchSelectionMode(false);
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
      let driverInfo: any = {};
      if (logisticsData.driver_id) {
        const { data: driverData } = await supabase
          .from('drivers')
          .select('id, name, license_plate, phone, id_card_number, bank_name, bank_account, bank_branch')
          .eq('id', logisticsData.driver_id)
          .single();
        driverInfo = driverData || {};
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
        loading_weight: logisticsData.goods_weight,
        unloading_weight: logisticsData.goods_weight,
        current_cost: logisticsData.unit_price,
        payable_cost: logisticsData.total_price,
        payable_cost: logisticsData.total_price,
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
        (request.invoicing_partner_full_name || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [invoiceRequests, searchTerm, statusFilter]);

  useEffect(() => {
    loadInvoiceRequests();
  }, []);

  return (
    <div className="space-y-4 p-4">
      <PageHeader 
        title="财务开票" 
        description="管理和跟踪所有开票申请单的状态"
        icon={FileText}
        iconColor="text-blue-600"
      >
        <div className="flex gap-2">
          <Button onClick={exportInvoiceRequests} variant="outline" size="sm">
            <FileDown className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button onClick={loadInvoiceRequests} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Button 
            onClick={toggleBatchSelectionMode} 
            variant={batchSelectionMode ? "default" : "outline"}
            size="sm"
            className={batchSelectionMode ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            {batchSelectionMode ? <CheckSquare className="mr-2 h-4 w-4" /> : <Square className="mr-2 h-4 w-4" />}
            {batchSelectionMode ? "退出" : "批量"}
          </Button>
        </div>
      </PageHeader>

      {/* 批量操作栏 */}
      {batchSelectionMode && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-800 font-medium">
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
                    清空
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  onClick={() => {
                    triggerHaptic('medium');
                    handleBatchApprove();
                  }}
                  disabled={selectedRequests.size === 0 || isBatchProcessing}
                  className="min-h-[44px] bg-green-600 hover:bg-green-700 text-white shadow-sm"
                  size="sm"
                >
                  <CheckCircle className="mr-2 h-5 w-5" />
                  批量确认
                </Button>
                <Button
                  onClick={() => {
                    triggerHaptic('medium');
                    handleBatchReject();
                  }}
                  disabled={selectedRequests.size === 0 || isBatchProcessing}
                  variant="destructive"
                  size="sm"
                  className="min-h-[44px] shadow-sm"
                >
                  <Ban className="mr-2 h-5 w-5" />
                  批量拒绝
                </Button>
                <Button
                  onClick={() => {
                    triggerHaptic('warning');
                    if (window.confirm('确定要回滚 ' + selectedRequests.size + ' 个申请单吗？\n\n此操作将申请单状态回滚到"待审核"，不影响运单状态。')) {
                      handleBatchRollback();
                    }
                  }}
                  disabled={selectedRequests.size === 0 || isBatchProcessing}
                  variant="default"
                  className="min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                  size="sm"
                >
                  <RotateCcw className="mr-2 h-5 w-5" />
                  一键回滚
                </Button>
                <Button
                  onClick={() => {
                    triggerHaptic('error');
                    if (window.confirm('确定要作废并删除 ' + selectedRequests.size + ' 个申请单吗？\n\n⚠️ 此操作将永久删除记录并回滚运单状态，不可逆！')) {
                      handleBatchVoid();
                    }
                  }}
                  disabled={selectedRequests.size === 0 || isBatchProcessing}
                  variant="destructive"
                  size="sm"
                  className="min-h-[44px] shadow-sm"
                >
                  <Trash2 className="mr-2 h-5 w-5" />
                  一键作废
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 筛选和搜索 */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            <div>
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
            <div>
              <Label htmlFor="status">状态筛选</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="Pending">待审核</SelectItem>
                  <SelectItem value="Approved">已通过</SelectItem>
                  <SelectItem value="Completed">已完成</SelectItem>
                  <SelectItem value="Voided">已作废</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* 申请单列表 */}
      <MobilePullToRefresh onRefresh={loadInvoiceRequests}>
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              <MobileSkeletonLoader count={3} />
            </div>
          ) : filteredRequests.length === 0 ? (
            <Card className="rounded-lg shadow-sm">
              <CardContent className="text-center py-12">
                <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
                <p className="text-lg font-medium text-muted-foreground mb-2">暂无开票申请</p>
                <p className="text-sm text-muted-foreground">当前筛选条件下没有找到申请单</p>
              </CardContent>
            </Card>
          ) : (
            filteredRequests.map((request) => (
            <Card 
              key={request.id} 
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98]",
                "rounded-lg shadow-sm border-border/50",
                batchSelectionMode && selectedRequests.has(request.id) && "bg-blue-50 border-blue-300 shadow-md"
              )}
              onClick={() => {
                triggerHaptic('light');
                if (batchSelectionMode) {
                  toggleRequestSelection(request.id);
                } else {
                  handleViewDetails(request);
                }
              }}
            >
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {batchSelectionMode && (
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
                      )}
                      <div className="font-medium text-lg">{request.request_number}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {request.partner_name}
                      {request.invoicing_partner_full_name && (
                        <span className="ml-2">({request.invoicing_partner_full_name})</span>
                      )}
                    </div>
                  </div>
                  <Badge variant={getStatusBadgeVariant(request.status)}>
                    {getStatusText(request.status)}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <div className="text-sm text-muted-foreground">开票金额</div>
                    <div className="font-medium">¥{request.total_amount.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">运单数量</div>
                    <div className="font-medium">{request.record_count}条</div>
                  </div>
                </div>
                
                {/* ✅ 添加备注显示 */}
                {request.remarks && (
                  <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground truncate">
                    💬 {request.remarks}
                  </div>
                )}
                
                <div className="flex items-center justify-between text-sm text-muted-foreground mt-2">
                  <span>{format(new Date(request.created_at), 'MM-dd HH:mm')}</span>
                  {!batchSelectionMode && (
                    <div className="flex items-center gap-2">
                      {!request.is_voided && !request.is_merged && (
                        <>
                          {request.status === 'Pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApproveInvoice(request);
                              }}
                              title="确认开票"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditStatus(request);
                            }}
                            title="编辑状态"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVoidRequest(request);
                            }}
                            title="作废申请单"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
          )}
        </div>
      </MobilePullToRefresh>

      {/* 详情对话框 */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-full mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>开票申请单详情</DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              {/* 基本信息 */}
              <div className="space-y-3">
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
                  {selectedRequest.invoicing_partner_full_name && (
                    <div className="text-sm text-muted-foreground">
                      {selectedRequest.invoicing_partner_full_name}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>开票金额</Label>
                    <div className="font-medium">¥{selectedRequest.total_amount.toLocaleString()}</div>
                  </div>
                  <div>
                    <Label>运单数量</Label>
                    <div>{selectedRequest.record_count}条</div>
                  </div>
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
                  <div className="space-y-1">
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
                <div className="space-y-2 mt-2">
                  {requestDetails.map((detail) => (
                    <Card 
                      key={detail.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewLogisticsRecord(detail.logistics_record_id)}
                    >
                      <CardContent className="p-3">
                        <div className="space-y-1">
                          <div className="font-medium">{detail.logistics_record.auto_number}</div>
                          <div className="text-sm text-muted-foreground">
                            {detail.logistics_record.project_name} | {detail.logistics_record.driver_name}
                          </div>
                          <div className="text-sm">
                            {detail.logistics_record.loading_location} → {detail.logistics_record.unloading_location}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            装货日期: {detail.logistics_record.loading_date ? format(new Date(detail.logistics_record.loading_date), 'yyyy-MM-dd') : '-'}
                          </div>
                          <div className="font-medium">¥{detail.amount.toLocaleString()}</div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
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
