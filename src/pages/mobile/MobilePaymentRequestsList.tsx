import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
// import { Loader2, FileText, Eye, AlertCircle, Send, FileText as FileTextIcon, Banknote } from 'lucide-react';
import { Banknote } from 'lucide-react';

// 简单的图标占位符组件
const Loader2 = ({ className }: { className?: string }) => <span className={className}>⏳</span>;
const FileText = ({ className }: { className?: string }) => <span className={className}>📄</span>;
const FileTextIcon = ({ className }: { className?: string }) => <span className={className}>📄</span>;
const Eye = ({ className }: { className?: string }) => <span className={className}>👁️</span>;
const AlertCircle = ({ className }: { className?: string }) => <span className={className}>⚠️</span>;
const Send = ({ className }: { className?: string }) => <span className={className}>📤</span>;
const Users = ({ className }: { className?: string }) => <span className={className}>👥</span>;
const RotateCcw = ({ className }: { className?: string }) => <span className={className}>🔄</span>;
import { MobilePaymentApproval } from '@/components/mobile/MobilePaymentApproval';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { MobileCard } from '@/components/mobile/MobileCard';
import { MobilePullToRefresh } from '@/components/mobile/MobilePullToRefresh';
import { MobileSkeletonLoader } from '@/components/mobile/MobileSkeletonLoader';
import { triggerHaptic } from '@/utils/mobile';
import { MobileConfirmDialog } from '@/components/mobile/MobileConfirmDialog';
import { MobileHTMLPreviewDialog } from '@/components/mobile/MobileHTMLPreviewDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X } from 'lucide-react';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// 简单的图标占位符组件
const Search = ({ className }: { className?: string }) => <span className={className}>🔍</span>;

interface PaymentRequest {
  id: string;
  created_at: string;
  request_id: string;
  status: 'Pending' | 'Approved' | 'Paid' | 'Rejected';
  notes: string | null;
  logistics_record_ids: string[];
  record_count: number;
  max_amount?: number; // 申请金额（最高金额）
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
  payable_amount: number | null;
}

interface PartnerTotal {
  partner_id: string;
  partner_name: string;
  total_amount: number;
  level: number;
}

export default function MobilePaymentRequestsList() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [modalRecords, setModalRecords] = useState<LogisticsRecordDetail[]>([]);
  const [modalContentLoading, setModalContentLoading] = useState(false);
  const [partnerTotals, setPartnerTotals] = useState<PartnerTotal[]>([]);
  const [showApprovalPage, setShowApprovalPage] = useState<PaymentRequest | null>(null);
  
  // HTML预览对话框状态
  const [htmlPreviewDialog, setHtmlPreviewDialog] = useState<{
    open: boolean;
    title: string;
    htmlContent: string;
  }>({
    open: false,
    title: '',
    htmlContent: ''
  });
  
  // 筛选器状态
  const [filters, setFilters] = useState({
    requestId: '',
    waybillNumber: '',
    driverName: '',
    loadingDate: null as Date | null,
    status: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

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
        record_count: item.record_count
      })));
      
      // 设置总数和总页数
      if (requestsData.length > 0) {
        const totalCount = requestsData[0].total_count || 0;
        setTotalCount(totalCount);
        setTotalPages(Math.ceil(totalCount / pageSize));
      } else {
        setTotalCount(0);
        setTotalPages(0);
      }
    } catch (error) {
      console.error("加载付款申请列表失败:", error);
      toast({ 
        title: "错误", 
        description: `加载付款申请列表失败: ${(error as any).message}`, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  }, [toast, filters, currentPage, pageSize]);

  useEffect(() => {
    fetchPaymentRequests();
  }, [fetchPaymentRequests]);

  // 筛选器处理函数
  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      requestId: '',
      waybillNumber: '',
      driverName: '',
      loadingDate: null,
      status: ''
    });
  };

  const hasActiveFilters = filters.requestId || filters.waybillNumber || filters.driverName || filters.loadingDate || filters.status;

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

  const getStatusBadge = (status: PaymentRequest['status']) => {
    switch (status) {
      case 'Pending': return <Badge variant="secondary">待审核</Badge>;
      case 'Approved': return <Badge variant="default">已审批待支付</Badge>;
      case 'Paid': return <Badge variant="outline" className="border-green-600 text-white bg-green-600">已支付</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const handleExport = async (req: PaymentRequest) => {
    try {
      setExportingId(req.id);
      const { data, error } = await supabase.functions.invoke('export-excel', { 
        body: { requestId: req.request_id } 
      });
      
      if (error) {
        let errorMessage = error.message;
        try { 
          const errorBody = JSON.parse(error.context?.responseText || '{}'); 
          if (errorBody.error) { 
            errorMessage = errorBody.error; 
          } 
        } catch {
          // 忽略JSON解析错误
        }
        throw new Error(errorMessage);
      }
      
      const { signedUrl } = data;
      if (!signedUrl) { 
        throw new Error('云函数未返回有效的下载链接。'); 
      }
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = signedUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast({ 
        title: '文件已开始下载', 
        description: `申请单 ${req.request_id} 的Excel已开始下载。` 
      });
    } catch (error) {
      console.error('导出失败:', error);
      toast({ 
        title: '导出失败', 
        description: (error as any).message, 
        variant: 'destructive' 
      });
    } finally {
      setExportingId(null);
    }
  };

  const handleGeneratePDF = async (req: PaymentRequest) => {
    try {
      setExportingId(req.id);
      
      // 使用Excel导出功能的数据结构 - 确保与Excel完全一致
      const { data: excelData, error } = await supabase.rpc('get_payment_request_data_v2' as any, {
        p_record_ids: req.logistics_record_ids
      });

      if (error) throw error;

      // 生成PDF HTML内容 - 使用与Excel导出完全相同的逻辑
      const generatePaymentRequestPDF = async (requestData: any): Promise<string> => {
        if (!requestData) {
          throw new Error('付款申请单数据不能为空');
        }

        const records: any[] = Array.isArray((requestData as any)?.records) ? (requestData as any).records : [];

        // 使用与Excel导出完全相同的分组逻辑
        const sheetMap = new Map<string, any>();
        for (const rec of records) {
          const costs = Array.isArray(rec.partner_costs) ? rec.partner_costs : [];
          for (const cost of costs) {
            const key = cost.partner_id;
            if (!sheetMap.has(key)) {
              sheetMap.set(key, {
                paying_partner_id: key,
                paying_partner_full_name: cost.full_name || cost.partner_name,
                paying_partner_bank_account: cost.bank_account || '',
                paying_partner_bank_name: cost.bank_name || '',
                paying_partner_branch_name: cost.branch_name || '',
                record_count: 0,
                total_payable: 0,
                project_name: rec.project_name,
                records: [],
              });
            }
            const sheet = sheetMap.get(key);
            if (!sheet.records.some((r: any) => r.record.id === rec.id)) {
              sheet.record_count += 1;
            }
            sheet.records.push({ record: rec, payable_amount: cost.payable_amount });
            sheet.total_payable += Number(cost.payable_amount || 0);
          }
        }
        
        // 获取项目合作方信息，实现与Excel导出相同的过滤逻辑
        const { data: projectsData } = await supabase.from('projects').select('id, name');
        const { data: projectPartnersData } = await supabase.from('project_partners').select(`
          project_id,
          partner_id,
          level,
          partner_chains!inner(chain_name)
        `);
        
        const projectsByName = new Map((projectsData || []).map(p => [p.name, p.id]));
        const projectPartnersByProjectId = (projectPartnersData || []).reduce((acc, pp) => {
          if (!acc.has(pp.project_id)) acc.set(pp.project_id, []);
          acc.get(pp.project_id).push({
            ...pp,
            chain_name: pp.partner_chains?.chain_name
          });
          return acc;
        }, new Map());
        
        // 过滤掉最高级别的合作方，并按级别排序 - 与Excel导出逻辑一致
        const filteredSheets = Array.from(sheetMap.values()).filter((sheet) => {
          const projectName = sheet.project_name;
          const projectId = projectsByName.get(projectName);
          const allPartnersInProject = projectId ? projectPartnersByProjectId.get(projectId) || [] : [];
          const partnersInChain = allPartnersInProject.filter((p) => !sheet.chain_name || p.chain_name === sheet.chain_name);
          const maxLevelInChain = partnersInChain.length > 0 ? Math.max(...partnersInChain.map((p) => p.level || 0)) : 0;
          const currentPartnerInfo = partnersInChain.find((p) => p.partner_id === sheet.paying_partner_id);
          
          // 跳过最高级别的合作方
          if (currentPartnerInfo && currentPartnerInfo.level === maxLevelInChain) {
            return false;
          }
          return true;
        });
        
        // 按合作方级别排序，级别高的在前面
        const sortedSheets = filteredSheets.sort((a, b) => {
          const projectNameA = a.project_name;
          const projectNameB = b.project_name;
          const projectIdA = projectsByName.get(projectNameA);
          const projectIdB = projectsByName.get(projectNameB);
          
          const allPartnersInProjectA = projectIdA ? projectPartnersByProjectId.get(projectIdA) || [] : [];
          const allPartnersInProjectB = projectIdB ? projectPartnersByProjectId.get(projectIdB) || [] : [];
          
          const partnersInChainA = allPartnersInProjectA.filter((p) => !a.chain_name || p.chain_name === a.chain_name);
          const partnersInChainB = allPartnersInProjectB.filter((p) => !b.chain_name || p.chain_name === b.chain_name);
          
          const currentPartnerInfoA = partnersInChainA.find((p) => p.partner_id === a.paying_partner_id);
          const currentPartnerInfoB = partnersInChainB.find((p) => p.partner_id === b.paying_partner_id);
          
          const levelA = currentPartnerInfoA?.level || 0;
          const levelB = currentPartnerInfoB?.level || 0;
          
          // 按级别降序排序（级别高的在前面）
          return levelB - levelA;
        });
        
        const sheetData = { sheets: sortedSheets };

        // 生成单个合作方的表格 - 完全按照Excel导出逻辑
        const generatePartnerTable = (sheet: any, index: number) => {
          const sorted = (sheet.records || []).slice().sort((a: any, b: any) => 
            String(a.record.auto_number || "").localeCompare(String(b.record.auto_number || ""))
          );
          
          const payingPartnerName = sheet.paying_partner_full_name || sheet.paying_partner_name || "";
          const bankAccount = sheet.paying_partner_bank_account || "";
          const bankName = sheet.paying_partner_bank_name || "";
          const branchName = sheet.paying_partner_branch_name || "";
          
          console.log(`生成第 ${index + 1} 个表格，合作方: ${payingPartnerName}`);
          
          // 获取上一级合作方信息，与Excel导出逻辑一致
          let parentTitle = "中科智运(云南)供应链科技有限公司";
          
          // 简化逻辑：暂时使用默认标题，后续可以优化
          // TODO: 实现完整的上一级合作方查找逻辑
          
          return `
            <div class="partner-section">
              <!-- 每个表格的独立文档标题 - 与Excel导出逻辑一致 -->
              <div class="header">
                <div class="company-title">${parentTitle}支付申请表</div>
              </div>
              
              <!-- 合作方信息头部 - 与Excel导出逻辑一致 -->
              <div class="partner-header">
                <div class="partner-title">项目名称：${sheet.project_name}</div>
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
                  ${sorted.map((item: any, index: number) => {
                    const rec = item.record;
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
                        <td class="amount-cell">${(item.payable_amount || 0).toFixed(2)}</td>
                        <td>${payingPartnerName}</td>
                        <td>${bankAccount}</td>
                        <td>${bankName}</td>
                        <td>${branchName}</td>
                      </tr>
                    `;
                  }).join('')}
                  <tr class="total-row">
                    <td colspan="10" class="remarks-label">备注：</td>
                    <td class="total-amount">${sheet.total_payable.toFixed(2)}</td>
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

        // 计算总金额
        const totalAmount = sheetData.sheets.reduce((sum: number, sheet: any) => sum + (sheet.total_payable || 0), 0);

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
              .main-table tbody tr:first-child td { border-top: 0 !important; }
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
      
      // 在对话框中显示（兼容企业微信环境）
      setHtmlPreviewDialog({
        open: true,
        title: `付款申请单 - ${req.request_id}`,
        htmlContent: printHTML
      });

      toast({ 
        title: '申请单加载成功', 
        description: `已加载付款申请单，包含 ${req.logistics_record_ids.length} 条运单。` 
      });
    } catch (error) {
      console.error('生成PDF失败:', error);
      toast({ title: '生成PDF失败', description: (error as any).message, variant: 'destructive' });
    } finally {
      setExportingId(null);
    }
  };

  const handlePayment = async (req: PaymentRequest) => {
    try {
      setExportingId(req.id);
      
      // 更新付款状态
      const { data, error } = await supabase.rpc('set_payment_status_for_waybills' as any, {
        p_record_ids: req.logistics_record_ids,
        p_payment_status: 'Paid'
      });

      if (error) throw error;

      toast({ 
        title: '付款成功', 
        description: `已更新 ${(data as any)?.updated_waybills || 0} 条运单的付款状态，同步了 ${(data as any)?.updated_partner_costs || 0} 条合作方成本记录。` 
      });
      
      // 刷新数据
      fetchPaymentRequests();
    } catch (error) {
      console.error('付款操作失败:', error);
      toast({ title: '付款操作失败', description: (error as any).message, variant: 'destructive' });
    } finally {
      setExportingId(null);
    }
  };

  const handleCancelPayment = async (req: PaymentRequest) => {
    try {
      setExportingId(req.id);
      
      // 取消付款状态
      const { data, error } = await supabase.rpc('void_payment_for_request' as any, {
        p_request_id: req.request_id,
        p_cancel_reason: '手动取消付款'
      });

      if (error) throw error;

      toast({ 
        title: '取消付款成功', 
        description: `已取消 ${(data as any).waybill_count} 条运单的付款状态，运单状态回退到"未付款"。` 
      });
      
      // 刷新数据
      fetchPaymentRequests();
    } catch (error) {
      console.error('取消付款操作失败:', error);
      toast({ title: '取消付款失败', description: (error as any).message, variant: 'destructive' });
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

      const rawRecords = (rpcData as any)?.records || [];
      
      const totalsMap = new Map<string, PartnerTotal>();
      let maxLevel = -1;
      
      rawRecords.forEach((rec: any) => {
        (rec.partner_costs || []).forEach((cost: any) => {
          const level = cost.level ?? 0; 
          if (level > maxLevel) {
            maxLevel = level;
          }
          const partnerId = cost.partner_id;
          if (!totalsMap.has(partnerId)) {
            totalsMap.set(partnerId, {
              partner_id: partnerId,
              partner_name: cost.full_name || cost.partner_name,
              total_amount: 0,
              level: level,
            });
          }
          const partnerData = totalsMap.get(partnerId)!;
          partnerData.total_amount += Number(cost.payable_amount || 0);
        });
      });
      
      const filteredTotals = Array.from(totalsMap.values()).filter(
        pt => pt.level < maxLevel
      ).sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0));
      
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

  const formatCurrency = (value: number) => 
    (value || 0).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' });

  const handleApproval = async (req: PaymentRequest) => {
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

  const handleApprovalClick = (req: PaymentRequest) => {
    setShowApprovalPage(req);
  };

  // 如果显示审批页面，渲染 MobilePaymentApproval
  if (showApprovalPage) {
    return (
      <MobilePaymentApproval
        paymentRequestId={showApprovalPage.id}
        amount={partnerTotals.reduce((sum, pt) => sum + pt.total_amount, 0)}
        description={`付款申请单 ${showApprovalPage.request_id} - ${showApprovalPage.record_count} 条运单`}
        onApprovalSubmitted={() => {
          fetchPaymentRequests();
          setShowApprovalPage(null);
          toast({ title: "提交成功", description: "企业微信审批已提交" });
        }}
        onBack={() => setShowApprovalPage(null)}
      />
    );
  }

  if (loading) {
    return (
      <MobileLayout>
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="space-y-4">
        {/* 页面标题 */}
        <MobileCard>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              付款申请单
            </CardTitle>
            <p className="text-sm text-muted-foreground">查看和管理付款申请批次</p>
          </CardHeader>
        </MobileCard>

        {/* 筛选器 */}
        <MobileCard>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">筛选条件</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                {showFilters ? '隐藏' : '显示'}
                {hasActiveFilters && <Badge variant="secondary">已筛选</Badge>}
              </Button>
            </div>
          </CardHeader>
          {showFilters && (
            <CardContent>
              <div className="space-y-4">
                {/* 申请单号筛选 */}
                <div className="space-y-2">
                  <Label htmlFor="requestId">申请单号</Label>
                  <Input
                    id="requestId"
                    placeholder="输入申请单号"
                    value={filters.requestId}
                    onChange={(e) => handleFilterChange('requestId', e.target.value)}
                  />
                </div>

                {/* 运单号筛选 */}
                <div className="space-y-2">
                  <Label htmlFor="waybillNumber" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    运单号
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="waybillNumber"
                      placeholder="输入运单编号,多个用逗号分隔..."
                      value={filters.waybillNumber}
                      onChange={(e) => handleFilterChange('waybillNumber', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          fetchPaymentRequests();
                        }
                      }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={fetchPaymentRequests}
                      className="px-3"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    支持多个运单编号查询,用逗号分隔,按回车快速搜索
                  </p>
                </div>

                {/* 司机筛选 */}
                <div className="space-y-2">
                  <Label htmlFor="driverName" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    司机
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="driverName"
                      placeholder="司机姓名..."
                      value={filters.driverName}
                      onChange={(e) => handleFilterChange('driverName', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          fetchPaymentRequests();
                        }
                      }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={fetchPaymentRequests}
                      className="px-3"
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* 装货日期筛选 */}
                <div className="space-y-2">
                  <Label htmlFor="loadingDate">装货日期</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="loadingDate"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !filters.loadingDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.loadingDate ? format(filters.loadingDate, "yyyy-MM-dd", { locale: zhCN }) : "选择日期"}
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

                {/* 状态筛选 */}
                <div className="space-y-2">
                  <Label htmlFor="status">申请单状态</Label>
                  <select
                    id="status"
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="">全部状态</option>
                    <option value="Pending">待审批</option>
                    <option value="Approved">已审批</option>
                    <option value="Paid">已付款</option>
                  </select>
                </div>

                {/* 筛选器操作按钮 */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-2">
                    {hasActiveFilters && (
                      <Button variant="outline" size="sm" onClick={clearFilters}>
                        <X className="h-4 w-4 mr-1" />
                        清除
                      </Button>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {hasActiveFilters ? '已应用筛选' : '未设置筛选'}
                    </span>
                  </div>
                  <Button onClick={fetchPaymentRequests} size="sm">
                    <Search className="h-4 w-4 mr-1" />
                    搜索
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </MobileCard>

        {/* 申请单列表 */}
        <MobilePullToRefresh onRefresh={fetchPaymentRequests}>
          {loading ? (
            <div className="space-y-3">
              <MobileSkeletonLoader count={3} />
            </div>
          ) : requests.length === 0 ? (
            <MobileCard className="rounded-lg shadow-sm">
              <CardContent className="text-center py-12">
                <Banknote className="h-16 w-16 mx-auto mb-4 text-muted-foreground/40" />
                <p className="text-lg font-medium text-muted-foreground mb-2">暂无付款申请</p>
                <p className="text-sm text-muted-foreground">当前筛选条件下没有找到申请单</p>
              </CardContent>
            </MobileCard>
          ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <MobileCard 
                key={req.id}
                className="transition-all duration-200 hover:shadow-md active:scale-[0.98] rounded-lg shadow-sm"
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base flex items-center gap-2 mb-1">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="font-mono text-sm">{req.request_id}</span>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(req.created_at), 'yyyy-MM-dd HH:mm')}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(req.status)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">运单数量</span>
                    <span className="font-medium">{req.record_count ?? 0} 条</span>
                  </div>
                  
                  {/* ✅ 添加备注显示 */}
                  {req.notes && (
                    <div className="p-2 bg-muted/50 rounded text-xs text-muted-foreground line-clamp-2">
                      💬 {req.notes}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        triggerHaptic('light');
                        handleViewDetails(req);
                      }}
                      className="min-h-[44px]"
                    >
                      <Eye className="h-5 w-5 mr-1" />
                      查看详情
                    </Button>
                    {/* 导出按钮 - 取消颜色背景 */}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleExport(req)} 
                      disabled={exportingId === req.id}
                      className="min-h-[44px] border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm transition-all duration-200"
                    >
                      {exportingId === req.id ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4 mr-1" />
                      )}
                      导出
                    </Button>

                    {/* 查看申请单按钮 - 蓝色主题 */}
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={() => handleGeneratePDF(req)} 
                      disabled={exportingId === req.id}
                      className="bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-sm transition-all duration-200"
                    >
                      <FileTextIcon className="h-4 w-4 mr-1" />
                      查看申请单
                    </Button>

                    {/* 付款按钮 - 红色主题，只在已审批状态显示 */}
                    {req.status === 'Approved' && (
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={() => handlePayment(req)} 
                        disabled={exportingId === req.id}
                        className="bg-orange-600 hover:bg-orange-700 text-white border-0 shadow-sm font-medium transition-all duration-200"
                      >
                        <Banknote className="h-4 w-4 mr-1" />
                        付款
                      </Button>
                    )}

                    {/* 审批按钮 - 蓝色主题，只在待审批状态显示 */}
                    {req.status === 'Pending' && (
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={() => handleApproval(req)} 
                        disabled={exportingId === req.id}
                        className="bg-green-600 hover:bg-green-700 text-white border-0 shadow-sm font-medium transition-all duration-200"
                      >
                        <Send className="h-4 w-4 mr-1" />
                        审批
                      </Button>
                    )}

                    {/* 取消付款按钮 - 橙色主题，只在已付款状态显示 */}
                    {req.status === 'Paid' && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleCancelPayment(req)} 
                        disabled={exportingId === req.id}
                        className="border-orange-300 text-orange-700 hover:bg-orange-50 shadow-sm transition-all duration-200"
                      >
                        <Banknote className="h-4 w-4 mr-1" />
                        取消付款
                      </Button>
                    )}

                    {/* 取消审批按钮 - 橙色主题，只在已审批状态显示 */}
                    {req.status === 'Approved' && (
                      <MobileConfirmDialog
                        trigger={
                          <Button 
                            variant="default" 
                            size="sm" 
                            disabled={exportingId === req.id}
                            className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 active:scale-95 text-white shadow-md hover:shadow-lg transition-all duration-200 rounded-lg font-medium"
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            取消审批
                          </Button>
                        }
                        title="确认取消审批"
                        description={`确定要取消审批付款申请 ${req.request_id} 吗？\n\n此操作将把申请单状态回滚为待审批。`}
                        confirmText="确认取消审批"
                        variant="warning"
                        onConfirm={() => handleRollbackApproval(req.request_id)}
                        disabled={exportingId === req.id}
                      />
                    )}
                  </div>

                  {req.status === 'Pending' && (
                    <div className="pt-2 border-t border-border">
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="w-full flex items-center gap-2"
                        onClick={() => handleApprovalClick(req)}
                      >
                        <Send className="h-4 w-4" />
                        企业微信审批
                      </Button>
                    </div>
                  )}
                </CardContent>
              </MobileCard>
            ))}
          </div>
          )}
        </MobilePullToRefresh>

        {/* 详情对话框 */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>申请单详情: {selectedRequest?.request_id}</DialogTitle>
              <DialogDescription>
                此申请单包含以下 {selectedRequest?.record_count ?? 0} 条运单记录。
              </DialogDescription>
            </DialogHeader>
            
            {!modalContentLoading && partnerTotals.length > 0 && (
              <div className="p-3 border rounded-lg bg-muted/50 mb-4">
                <h4 className="mb-2 font-semibold text-sm">金额汇总 (按合作方)</h4>
                <div className="space-y-2">
                  {partnerTotals.map(pt => (
                    <div key={pt.partner_id} className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">{pt.partner_name}:</span>
                      <span className="font-mono font-semibold text-primary">
                        {formatCurrency(pt.total_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="overflow-x-auto">
              {modalContentLoading ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">运单号</TableHead>
                      <TableHead className="text-xs">司机</TableHead>
                      <TableHead className="text-xs">车牌</TableHead>
                      <TableHead className="text-xs">装货地</TableHead>
                      <TableHead className="text-xs">卸货地</TableHead>
                      <TableHead className="text-xs">重量</TableHead>
                      <TableHead className="text-xs">应付</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modalRecords.length > 0 ? modalRecords.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs font-mono">{r.auto_number}</TableCell>
                        <TableCell className="text-xs">{r.driver_name}</TableCell>
                        <TableCell className="text-xs">{r.license_plate || '-'}</TableCell>
                        <TableCell className="text-xs">{r.loading_location}</TableCell>
                        <TableCell className="text-xs">{r.unloading_location}</TableCell>
                        <TableCell className="text-xs">{r.loading_weight}</TableCell>
                        <TableCell className="text-xs">{formatCurrency(r.payable_amount || 0)}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                          没有找到记录
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* 移动端分页组件 */}
        {totalPages > 0 && (
          <MobileCard>
            <CardContent className="py-4">
              <div className="space-y-4">
                {/* 分页信息 */}
                <div className="text-center text-sm text-muted-foreground">
                  共 {totalCount} 条记录，第 {currentPage} / {totalPages} 页
                </div>

                {/* 每页显示数量选择 */}
                <div className="flex items-center justify-center gap-2">
                  <Label htmlFor="mobilePageSize" className="text-sm">每页显示</Label>
                  <select
                    id="mobilePageSize"
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                    className="px-2 py-1 border rounded text-sm"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={30}>30</option>
                  </select>
                  <span className="text-sm text-muted-foreground">条</span>
                </div>

                {/* 分页按钮 - 优化触摸区域 */}
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      triggerHaptic('light');
                      handlePageChange(currentPage - 1);
                    }}
                    disabled={currentPage <= 1}
                    className="min-h-[44px] min-w-[44px] p-0 text-lg"
                  >
                    ‹
                  </Button>

                  {/* 页码按钮 - 移动端只显示当前页附近的页码 */}
                  {currentPage > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        triggerHaptic('light');
                        handlePageChange(currentPage - 1);
                      }}
                      className="min-h-[44px] min-w-[44px] p-0"
                    >
                      {currentPage - 1}
                    </Button>
                  )}

                  <Button
                    variant="default"
                    size="sm"
                    className="min-h-[44px] min-w-[44px] p-0 font-bold"
                  >
                    {currentPage}
                  </Button>

                  {currentPage < totalPages && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        triggerHaptic('light');
                        handlePageChange(currentPage + 1);
                      }}
                      className="min-h-[44px] min-w-[44px] p-0"
                    >
                      {currentPage + 1}
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      triggerHaptic('light');
                      handlePageChange(currentPage + 1);
                    }}
                    disabled={currentPage >= totalPages}
                    className="min-h-[44px] min-w-[44px] p-0 text-lg"
                  >
                    ›
                  </Button>
                </div>

                {/* 快速跳转 */}
                {totalPages > 3 && (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm text-muted-foreground">跳转到</span>
                    <Input
                      type="number"
                      value={currentPage}
                      onChange={(e) => {
                        const page = parseInt(e.target.value);
                        if (page >= 1 && page <= totalPages) {
                          setCurrentPage(page);
                        }
                      }}
                      className="w-16 h-8 text-center"
                      min="1"
                      max={totalPages}
                    />
                    <span className="text-sm text-muted-foreground">页</span>
                  </div>
                )}
              </div>
            </CardContent>
          </MobileCard>
        )}
      </div>

      {/* HTML预览对话框 - 兼容企业微信环境 */}
      <MobileHTMLPreviewDialog
        open={htmlPreviewDialog.open}
        onOpenChange={(open) => setHtmlPreviewDialog(prev => ({ ...prev, open }))}
        title={htmlPreviewDialog.title}
        htmlContent={htmlPreviewDialog.htmlContent}
      />
    </MobileLayout>
  );
}