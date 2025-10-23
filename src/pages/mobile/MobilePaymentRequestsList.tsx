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
import { MobilePaymentApproval } from '@/components/mobile/MobilePaymentApproval';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { MobileCard } from '@/components/mobile/MobileCard';

interface PaymentRequest {
  id: string;
  created_at: string;
  request_id: string;
  status: 'Pending' | 'Approved' | 'Paid' | 'Rejected';
  notes: string | null;
  logistics_record_ids: string[];
  record_count: number;
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

  const fetchPaymentRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50); // 移动端只加载前50条

      if (error) throw error;
      setRequests(((data as unknown) as PaymentRequest[]) || []);
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
  }, [toast]);

  useEffect(() => {
    fetchPaymentRequests();
  }, [fetchPaymentRequests]);

  const getStatusBadge = (status: PaymentRequest['status']) => {
    switch (status) {
      case 'Pending': return <Badge variant="secondary">待审批</Badge>;
      case 'Approved': return <Badge variant="default">已审批</Badge>;
      case 'Paid': return <Badge variant="outline">已支付</Badge>;
      case 'Rejected': return <Badge variant="destructive">已驳回</Badge>;
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
                    <td colspan="11" class="remarks-label">备注：</td>
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
              .signature-table { width: 100%; border-collapse: collapse; margin-top: 0; margin-bottom: 0; }
              .signature-table td { border: 1px solid #000; padding: 4px; text-align: center; font-size: 10px; }
              .signature-table { border-collapse: collapse; }
              .signature-table tr:first-child td { border-top: none !important; }
              .signature-table .signature-cell { background: #f9f9f9; font-weight: bold; height: 30px; }
              .signature-table .signature-space { height: 80px; background: white; }
              .remarks-label { text-align: left; font-weight: bold; }
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

        {/* 申请单列表 */}
        {requests.length === 0 ? (
          <MobileCard>
            <CardContent className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">暂无付款申请记录</p>
            </CardContent>
          </MobileCard>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <MobileCard key={req.id}>
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

                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleViewDetails(req)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      查看详情
                    </Button>
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={() => handleExport(req)} 
                      disabled={exportingId === req.id}
                    >
                      {exportingId === req.id ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4 mr-1" />
                      )}
                      导出
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleGeneratePDF(req)} 
                      disabled={exportingId === req.id}
                    >
                      <FileTextIcon className="h-4 w-4 mr-1" />
                      生成PDF
                    </Button>
                    {req.status === 'Pending' && (
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => handlePayment(req)} 
                        disabled={exportingId === req.id}
                      >
                        <Banknote className="h-4 w-4 mr-1" />
                        付款
                      </Button>
                    )}
                    {req.status === 'Paid' && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleCancelPayment(req)} 
                        disabled={exportingId === req.id}
                      >
                        <Banknote className="h-4 w-4 mr-1" />
                        取消付款
                      </Button>
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
      </div>
    </MobileLayout>
  );
}