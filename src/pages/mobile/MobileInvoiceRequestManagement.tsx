// 移动端财务开票页面
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
import { useUnifiedPermissions } from "@/hooks/useUnifiedPermissions";
import { FileText, Search, Filter, Eye, Edit, RefreshCw, ChevronRight, X, CheckCircle, FileDown, CheckSquare, Square, Trash2, Ban, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { LogisticsFormDialog } from "@/pages/BusinessEntry/components/LogisticsFormDialog";
import { LogisticsRecord } from "@/pages/BusinessEntry/types";
import { MobilePullToRefresh } from "@/components/mobile/MobilePullToRefresh";
import { MobileSkeletonLoader } from "@/components/mobile/MobileSkeletonLoader";
import { triggerHaptic } from "@/utils/mobile";
import { MobileConfirmDialog } from "@/components/mobile/MobileConfirmDialog";

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
  bank_name?: string;  // 银行名称
  bank_account?: string;  // 银行账号
  tax_number?: string;  // 税号
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
    loading_location?: string;
    unloading_location?: string;
    loading_address?: string;
    unloading_address?: string;
    loading_date?: string;
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
  const { hasButtonAccess } = useUnifiedPermissions();

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
      interface InvoiceRequestWithProfile extends InvoiceRequest {
        profiles?: { full_name: string } | null;
      }
      
      const processedData = (data as InvoiceRequestWithProfile[] | null)?.map(request => ({
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
      interface InvoiceRequestDetailRow {
        logistics_record_id: string;
        [key: string]: unknown;
      }
      
      const logisticsRecordIds = (detailsData as InvoiceRequestDetailRow[]).map(detail => detail.logistics_record_id).filter(Boolean);
      
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
      interface ProjectRow {
        id: string;
        name: string;
      }
      
      interface DriverRow {
        id: string;
        name: string;
      }
      
      interface LogisticsRow {
        id: string;
        auto_number: string;
        project_id: string;
        driver_id: string | null;
        loading_location: string;
        unloading_location: string;
        loading_date: string;
      }
      
      const projectsMap = new Map((projectsResult.data as ProjectRow[] | null)?.map(p => [p.id, p.name]) || []);
      const driversMap = new Map((driversResult.data as DriverRow[] | null)?.map(d => [d.id, d.name]) || []);
      const logisticsMap = new Map((logisticsResult.data as LogisticsRow[] | null)?.map(l => [l.id, l]) || []);

      // 组合数据
      const formattedDetails = (detailsData as InvoiceRequestDetailRow[]).map(detail => {
        const logisticsRecord = logisticsMap.get(detail.logistics_record_id);
        return {
          id: detail.id as string,
          invoice_request_id: detail.invoice_request_id as string,
          logistics_record_id: detail.logistics_record_id,
          amount: typeof detail.amount === 'number' ? detail.amount : parseFloat(String(detail.amount || 0)),
          logistics_record: {
            auto_number: logisticsRecord?.auto_number || '',
            project_name: logisticsRecord?.project_id ? projectsMap.get(logisticsRecord.project_id) || '' : '',
            driver_name: logisticsRecord?.driver_id ? driversMap.get(logisticsRecord.driver_id) || '' : '',
            loading_location: logisticsRecord?.loading_location || '',
            unloading_location: logisticsRecord?.unloading_location || '',
            loading_address: logisticsRecord?.loading_location || '',
            unloading_address: logisticsRecord?.unloading_location || '',
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

  // 完成开票（单个）
  const handleCompleteInvoice = async (request: InvoiceRequest) => {
    try {
      // 调用新的开票函数（会同时更新申请单和运单状态）
      const { data, error } = await supabase.rpc('complete_invoice_request_v2_1126', {
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

  // 更新申请单状态
  const updateRequestStatus = async (requestId: string, status: string, remarks?: string) => {
    try {
      const { error } = await supabase
        .from('invoice_requests')
        .update({
          status,
          remarks,
          updated_at: new Date().toISOString()
        } as never)
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
      const { data, error } = await supabase.rpc('void_invoice_request_1126', {
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
        } as never)
        .eq('id', requestId);

      if (requestError) throw requestError;

      // 2. 获取开票申请单详情，更新相关运单的开票状态
      interface InvoiceRequestDetailRow {
        logistics_record_id: string;
      }
      
      const { data: requestDetails, error: detailsError } = await supabase
        .from('invoice_request_details')
        .select('logistics_record_id')
        .eq('invoice_request_id', requestId);

      if (detailsError) throw detailsError;

      if (requestDetails && requestDetails.length > 0) {
        // 3. 更新运单记录的开票状态
        const recordIds = (requestDetails as InvoiceRequestDetailRow[]).map(detail => detail.logistics_record_id);
        const { error: updateError } = await supabase
          .from('logistics_records')
          .update({ 
            invoice_status: 'Invoiced',
            invoice_completed_at: new Date().toISOString()
          } as never)
          .in('id', recordIds);

        if (updateError) throw updateError;

        // 4. 更新 logistics_partner_costs 表的开票状态
        const { error: costsError } = await supabase
          .from('logistics_partner_costs')
          .update({ 
            invoice_status: 'Invoiced',
            invoice_completed_at: new Date().toISOString()
          } as never)
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
      interface InvoiceRequestForPDF {
        request_number: string;
        total_amount: number;
        [key: string]: unknown;
      }
      
      const createInvoiceRequestHTML = (requests: InvoiceRequestForPDF[]) => {
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
                    <td>${format(new Date(String(request.created_at)), 'yyyy年MM月dd日')}</td>
                    <td>${request.partner_name}</td>
                    <td></td>
                    <td></td>
                    <td>${format(new Date(String(request.created_at)), 'yyyy年MM月')}</td>
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
        } as never)
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

  // 批量取消审批（回滚到待审核状态）- 使用批量函数优化
  const handleBatchRollbackApproval = async () => {
    if (selectedRequests.size === 0) return;
    
    setIsBatchProcessing(true);
    try {
      const selectedIds = Array.from(selectedRequests);
      
      // 调用批量取消审批RPC函数（性能优化）
      const { data, error } = await supabase.rpc('batch_rollback_invoice_approval_1126', {
        p_request_ids: selectedIds
      });

      if (error) throw error;

      const result = data as { 
        success: boolean;
        rollback_count?: number;
        failed_count?: number;
        not_approved_count?: number;
      };

      // 构建详细的提示信息
      let description = `成功回滚 ${result.rollback_count || 0} 个开票申请`;
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
      
      loadInvoiceRequests();
      setSelectedRequests(new Set());
      setBatchSelectionMode(false);
    } catch (error) {
      console.error('批量取消审批失败:', error);
      toast({
        title: "批量取消审批失败",
        description: error instanceof Error ? error.message : '无法批量取消审批',
        variant: "destructive",
      });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // 一键回滚（保留申请单记录，只回滚运单状态）
  const handleBatchRollback = async () => {
    if (selectedRequests.size === 0) return;
    
    setIsBatchProcessing(true);
    try {
      const selectedIds = Array.from(selectedRequests);
      
      // 调用void_invoice_request函数（保留记录）
      let successCount = 0;
      let failCount = 0;
      
      for (const requestId of selectedIds) {
        try {
          const { data, error } = await supabase.rpc('void_invoice_request_1126', {
            p_request_id: requestId,
            p_void_reason: '批量回滚'
          });
          
          if (error) throw error;
          
          const rpcResult = data as { success?: boolean };
          if (rpcResult?.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          console.error(`回滚申请单 ${requestId} 失败:`, err);
          failCount++;
        }
      }

      toast({
        title: "回滚完成",
        description: `成功回滚 ${successCount} 个申请单的运单状态${failCount > 0 ? `，失败 ${failCount} 个` : ''}。申请单记录已保留，状态标记为已作废。`,
      });
      
      loadInvoiceRequests();
      setSelectedRequests(new Set());
      setBatchSelectionMode(false);
    } catch (error) {
      console.error('批量回滚失败:', error);
      toast({
        title: "回滚失败",
        description: error instanceof Error ? error.message : '无法批量回滚开票申请单',
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
      
      const { data, error } = await supabase.rpc('void_and_delete_invoice_requests_1126', {
        p_request_ids: selectedIds
      });

      if (error) throw error;

      const result = data as {
        success: boolean;
        deleted_requests?: number;
        affected_logistics_records?: number;
      };
      
      toast({
        title: "作废成功",
        description: `已永久删除 ${result.deleted_requests || 0} 个开票申请单，${result.affected_logistics_records || 0} 条运单状态已回滚为未开票`,
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

      // 定义类型
      interface LogisticsRecordRow {
        id: string;
        auto_number: string;
        project_id: string | null;
        driver_id: string | null;
        loading_location: string;
        unloading_location: string;
        loading_date: string | null;
        unloading_date: string | null;
        goods_weight: number | null;
        unit_price: number | null;
        total_price: number | null;
        remarks: string | null;
        external_tracking_numbers: string[] | null;
        other_platform_names: string[] | null;
        created_at: string;
      }
      
      interface ProjectRow {
        id: string;
        name: string;
        auto_code?: string;
      }
      
      interface DriverRow {
        id: string;
        name: string;
        license_plate?: string | null;
        phone?: string | null;
        id_card_number?: string | null;
        bank_name?: string | null;
        bank_account?: string | null;
        bank_branch?: string | null;
      }

      const logisticsRow = logisticsData as LogisticsRecordRow;

      // 查询项目信息
      let projectName = '';
      if (logisticsRow.project_id) {
        const { data: projectData } = await supabase
          .from('projects')
          .select('id, name, auto_code')
          .eq('id', logisticsRow.project_id)
          .single<ProjectRow>();
        if (projectData) {
          projectName = projectData.name || '';
        }
      }

      // 查询司机信息
      interface DriverInfo {
        id?: string;
        name?: string;
        license_plate?: string | null;
        phone?: string | null;
      }
      
      let driverInfo: DriverInfo = {};
      if (logisticsRow.driver_id) {
        const { data: driverData } = await supabase
          .from('drivers')
          .select('id, name, license_plate, phone, id_card_number, bank_name, bank_account, bank_branch')
          .eq('id', logisticsRow.driver_id)
          .single<DriverRow>();
        if (driverData) {
          driverInfo = {
            id: driverData.id,
            name: driverData.name,
            license_plate: driverData.license_plate,
            phone: driverData.phone
          };
        }
      }

      const formattedRecord: LogisticsRecord = {
        id: logisticsRow.id,
        auto_number: logisticsRow.auto_number,
        project_id: logisticsRow.project_id || '',
        project_name: projectName,
        chain_id: null,
        chain_name: null,
        billing_type_id: 0,
        driver_id: driverInfo.id || '',
        driver_name: driverInfo.name || '',
        loading_location: logisticsRow.loading_location,
        unloading_location: logisticsRow.unloading_location,
        loading_date: logisticsRow.loading_date,
        unloading_date: logisticsRow.unloading_date,
        loading_weight: logisticsRow.goods_weight,
        unloading_weight: logisticsRow.goods_weight,
        current_cost: logisticsRow.unit_price,
        payable_cost: logisticsRow.total_price,
        license_plate: driverInfo.license_plate || '',
        driver_phone: driverInfo.phone || '',
        transport_type: null,
        extra_cost: null,
        remarks: logisticsRow.remarks,
        loading_weighbridge_image_url: null,
        unloading_weighbridge_image_url: null,
        external_tracking_numbers: logisticsRow.external_tracking_numbers || [],
        other_platform_names: logisticsRow.other_platform_names || [],
        created_at: logisticsRow.created_at,
      };
      return formattedRecord;
    } catch (error: unknown) {
      console.error('获取运单详情失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        title: "加载失败",
        description: errorMessage || '无法加载运单详情',
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
      case 'Completed': return 'outline';
      case 'Processing': return 'secondary';
      default: return 'secondary';
    }
  };

  // 状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'Pending': return '待审核';
      case 'Approved': return '已审批待开票';
      case 'Completed': return '已开票';
      case 'Processing': return '处理中';
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              <div className="space-y-3">
                {/* 主要操作按钮组 - 2列布局 */}
                <div className="grid grid-cols-2 gap-3">
                  {/* 批量审批 - 绿色，渐变背景 */}
                  <MobileConfirmDialog
                    trigger={
                      <Button
                        disabled={selectedRequests.size === 0 || isBatchProcessing}
                        className="min-h-[52px] w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 active:scale-95 text-white shadow-lg hover:shadow-xl transition-all duration-200 font-medium rounded-xl"
                        size="sm"
                      >
                        <CheckCircle className="mr-2 h-5 w-5" />
                        批量审批
                      </Button>
                    }
                    title="确认批量审批"
                    description={`确定要批量审批选中的 ${selectedRequests.size} 个开票申请吗？\n\n审批后申请单状态将变为"已审批"。`}
                    confirmText="确认审批"
                    variant="default"
                    onConfirm={handleBatchApprove}
                    disabled={selectedRequests.size === 0 || isBatchProcessing}
                  />

                  {/* 批量取消审批 - 橙色，渐变背景 */}
                  <MobileConfirmDialog
                    trigger={
                      <Button
                        disabled={selectedRequests.size === 0 || isBatchProcessing}
                        className="min-h-[52px] w-full bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 active:scale-95 text-white shadow-lg hover:shadow-xl transition-all duration-200 font-medium rounded-xl"
                        size="sm"
                      >
                        <RotateCcw className="mr-2 h-5 w-5" />
                        取消审批
                      </Button>
                    }
                    title="确认批量取消审批"
                    description={`确定要批量取消审批选中的 ${selectedRequests.size} 个开票申请吗？\n\n此操作将把已审批的申请单状态回滚为待审批。`}
                    confirmText="确认取消审批"
                    variant="warning"
                    onConfirm={handleBatchRollbackApproval}
                    disabled={selectedRequests.size === 0 || isBatchProcessing}
                  />
                </div>

                {/* 次要操作按钮 - 全宽布局 */}
                <MobileConfirmDialog
                  trigger={
                    <Button
                      disabled={selectedRequests.size === 0 || isBatchProcessing}
                      className="min-h-[52px] w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 active:scale-95 text-white shadow-lg hover:shadow-xl transition-all duration-200 font-medium rounded-xl"
                      size="sm"
                    >
                      <RotateCcw className="mr-2 h-5 w-5" />
                      一键回滚 ({selectedRequests.size})
                    </Button>
                  }
                  title="确认一键回滚"
                  description={`确定要回滚选中的 ${selectedRequests.size} 个申请单吗？\n\n此操作将：\n• 保留申请单记录（标记为已作废）\n• 回滚运单状态为未开票`}
                  confirmText="确认回滚"
                  variant="warning"
                  onConfirm={handleBatchRollback}
                  disabled={selectedRequests.size === 0 || isBatchProcessing}
                />

                {/* 危险操作按钮 - 需要审批权限 */}
                {hasButtonAccess('finance.approve_payment') && (
                  <MobileConfirmDialog
                    trigger={
                      <Button
                        disabled={selectedRequests.size === 0 || isBatchProcessing}
                        variant="destructive"
                        size="sm"
                        className="min-h-[52px] w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 active:scale-95 shadow-lg hover:shadow-xl transition-all duration-200 font-medium rounded-xl"
                      >
                        <Trash2 className="mr-2 h-5 w-5" />
                        一键作废 ({selectedRequests.size})
                      </Button>
                    }
                    title="⚠️ 危险操作"
                    description={`确定要作废并删除选中的 ${selectedRequests.size} 个申请单吗？\n\n此操作将：\n• 永久删除申请单记录\n• 回滚运单状态为未开票\n\n此操作不可逆，请谨慎操作！`}
                    confirmText="确认作废"
                    variant="danger"
                    onConfirm={handleBatchVoid}
                    disabled={selectedRequests.size === 0 || isBatchProcessing}
                  />
                )}

                {/* 提示文字 */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-200">
                  <p className="text-sm text-center text-blue-900 font-medium">
                    已选择 <span className="text-lg font-bold text-blue-600">{selectedRequests.size}</span> 个申请单
                  </p>
                </div>
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
                  <SelectItem value="Approved">已审批待开票</SelectItem>
                  <SelectItem value="Completed">已开票</SelectItem>
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
                "relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl active:scale-[0.98]",
                "rounded-2xl shadow-lg border-0 bg-gradient-to-br from-white via-white to-gray-50",
                batchSelectionMode && selectedRequests.has(request.id) && "ring-2 ring-blue-500 shadow-2xl"
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
              {/* 顶部状态条 */}
              <div className={cn(
                "absolute top-0 left-0 right-0 h-1",
                request.status === 'Pending' && "bg-gradient-to-r from-gray-400 to-gray-500",
                request.status === 'Approved' && "bg-gradient-to-r from-blue-500 to-blue-600",
                request.status === 'Completed' && "bg-gradient-to-r from-green-500 to-emerald-600"
              )} />
              
              <CardContent className="p-5 pt-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {batchSelectionMode && (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRequestSelection(request.id);
                          }}
                          className="p-1"
                        >
                          {selectedRequests.has(request.id) ? (
                            <CheckSquare className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Square className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      )}
                      <div>
                        <div className="text-xs text-gray-500 mb-0.5">申请单号</div>
                        <div className="font-mono font-semibold text-base">{request.request_number}</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mt-2">
                      {request.invoicing_partner_full_name || request.partner_full_name || request.partner_name}
                    </div>
                  </div>
                  <Badge className={cn(
                    "px-3 py-1 text-sm font-medium shadow-md border-0",
                    request.status === 'Pending' && "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700",
                    request.status === 'Approved' && "bg-gradient-to-r from-blue-500 to-blue-600 text-white",
                    request.status === 'Completed' && "bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                  )}>
                    {request.status === 'Pending' && '⏰ '}
                    {request.status === 'Approved' && '✅ '}
                    {request.status === 'Completed' && '🎉 '}
                    {getStatusText(request.status)}
                  </Badge>
                </div>
                
                {/* 关键信息卡片 */}
                <div className="rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 p-4 border border-blue-100/50 mb-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-600 mb-1">开票金额</div>
                      <div className="text-xl font-bold text-blue-600">¥{request.total_amount.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 mb-1">运单数量</div>
                      <div className="text-xl font-semibold text-gray-900">{request.record_count}条</div>
                    </div>
                  </div>
                </div>
                
                {/* 备注显示 */}
                {request.remarks && (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-800 mb-3">
                    💬 {request.remarks}
                  </div>
                )}
                
                <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                  <span>🕐 {format(new Date(request.created_at), 'MM-dd HH:mm')}</span>
                  {!batchSelectionMode && <ChevronRight className="h-4 w-4" />}
                </div>
                
                {/* 操作按钮区 */}
                {!batchSelectionMode && !request.is_voided && !request.is_merged && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic('light');
                        handleViewDetails(request);
                      }}
                      className="h-11 text-base rounded-xl font-medium"
                    >
                      <Eye className="h-5 w-5 mr-1.5" />
                      详情
                    </Button>
                    
                    {request.status === 'Approved' && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic('medium');
                          handleCompleteInvoice(request);
                        }}
                        className="h-11 text-base rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-md font-semibold"
                      >
                        <CheckCircle className="h-5 w-5 mr-1.5" />
                        开票
                      </Button>
                    )}
                  </div>
                )}
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
                  <SelectItem value="Approved">已审批待开票</SelectItem>
                  <SelectItem value="Completed">已开票</SelectItem>
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
          editingRecord={selectedLogisticsRecordForView}
          projects={[]} // 查看模式下不需要项目列表
          onSubmitSuccess={() => {
            // 查看模式下不需要提交成功回调
          }}
        />
      )}

    </div>
  );
}
