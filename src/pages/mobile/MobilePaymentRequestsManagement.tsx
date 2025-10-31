import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Eye, FileSpreadsheet, Send, Receipt, AlertCircle, RefreshCw } from 'lucide-react';
import { MobilePaymentApproval } from '@/components/mobile/MobilePaymentApproval';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { MobileCard } from '@/components/mobile/MobileCard';
import { useNavigate } from 'react-router-dom';
import { MobileApprovalStatusCard } from '@/components/mobile/MobileApprovalStatusCard';

interface PaymentRequest {
  id: string;
  created_at: string;
  request_id: string;
  status: 'Pending' | 'Approved' | 'Paid' | 'Rejected';
  notes: string | null;
  logistics_record_ids: string[];
  record_count: number;
  max_amount?: number; // 申请金额（最高金额）
  work_wechat_sp_no?: string | null;
}

interface OverviewStats {
  total_requests: number;
  pending_count: number;
  approved_count: number;
  paid_count: number;
  rejected_count: number;
  total_amount: number;
}

export default function MobilePaymentRequestsManagement() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [showApprovalPage, setShowApprovalPage] = useState<PaymentRequest | null>(null);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchPaymentRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data || []).map(item => ({
        ...item,
        status: item.status as PaymentRequest['status']
      })));
    } catch (error) {
      console.error('加载付款申请列表失败:', error);
      toast({ 
        title: '错误', 
        description: '加载付款申请列表失败', 
        variant: 'destructive' 
      });
    }
  };

  const fetchOverviewStats = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_requests')
        .select('status, record_count');
      
      if (error) throw error;

      const stats: OverviewStats = {
        total_requests: data.length,
        pending_count: data.filter(r => r.status === 'Pending').length,
        approved_count: data.filter(r => r.status === 'Approved').length,
        paid_count: data.filter(r => r.status === 'Paid').length,
        rejected_count: data.filter(r => r.status === 'Rejected').length,
        total_amount: 0 // 需要从其他表计算
      };
      
      setStats(stats);
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchPaymentRequests(), fetchOverviewStats()]);
    setRefreshing(false);
    toast({ title: '刷新成功', description: '数据已更新' });
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchPaymentRequests(), fetchOverviewStats()]);
      setLoading(false);
    };
    loadData();
  }, []);

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
      
      if (error) throw error;
      
      const { signedUrl } = data;
      if (!signedUrl) throw new Error('未返回有效下载链接');
      
      const a = document.createElement('a');
      a.href = signedUrl;
      a.click();
      
      toast({ title: '下载开始', description: `${req.request_id} 导出成功` });
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

  // 如果显示审批页面
  if (showApprovalPage) {
    return (
      <MobilePaymentApproval
        paymentRequestId={showApprovalPage.id}
        amount={showApprovalPage.record_count * 1000} // 估算金额，实际应该从数据库计算
        description={`付款申请单 ${showApprovalPage.request_id} - ${showApprovalPage.record_count} 条运单`}
        onApprovalSubmitted={async () => {
          await handleRefresh();
          setShowApprovalPage(null);
          toast({ title: '提交成功', description: '企业微信审批已提交' });
        }}
        onBack={() => setShowApprovalPage(null)}
      />
    );
  }

  if (loading) {
    return (
      <MobileLayout>
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  const pendingRequests = requests.filter(r => r.status === 'Pending');
  const approvedRequests = requests.filter(r => r.status === 'Approved');
  const allRequests = requests;

  return (
    <MobileLayout>
      <div className="space-y-4">
        {/* 页面头部 */}
        <div className="flex justify-between items-center px-4">
          <div>
            <h1 className="text-xl font-bold">申请单管理</h1>
            <p className="text-sm text-muted-foreground">管理付款申请与企业微信审批</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            刷新
          </Button>
        </div>

        {/* 快捷操作 */}
        <div className="px-4">
          <MobileCard>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  className="h-12"
                  onClick={() => navigate('/m/payment-request')}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  创建申请
                </Button>
                <Button 
                  variant="outline" 
                  className="h-12"
                  onClick={() => navigate('/m/payment-requests-list')}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  查看列表
                </Button>
              </div>
            </CardContent>
          </MobileCard>
        </div>

        {/* 统计概览 */}
        {stats && (
          <div className="px-4">
            <MobileCard>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  统计概览
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center p-2 bg-muted rounded">
                    <div className="font-semibold text-lg">{stats.total_requests}</div>
                    <div className="text-muted-foreground">总申请数</div>
                  </div>
                  <div className="text-center p-2 bg-amber-50 rounded">
                    <div className="font-semibold text-lg text-amber-600">{stats.pending_count}</div>
                    <div className="text-muted-foreground">待审批</div>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded">
                    <div className="font-semibold text-lg text-green-600">{stats.approved_count}</div>
                    <div className="text-muted-foreground">已审批</div>
                  </div>
                  <div className="text-center p-2 bg-blue-50 rounded">
                    <div className="font-semibold text-lg text-blue-600">{stats.paid_count}</div>
                    <div className="text-muted-foreground">已支付</div>
                  </div>
                </div>
              </CardContent>
            </MobileCard>
          </div>
        )}

        {/* 标签页 */}
        <div className="px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending">待审批 ({pendingRequests.length})</TabsTrigger>
              <TabsTrigger value="approved">已审批 ({approvedRequests.length})</TabsTrigger>
              <TabsTrigger value="all">全部 ({allRequests.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4 space-y-3">
              {pendingRequests.length === 0 ? (
                <MobileCard>
                  <CardContent className="text-center py-8">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">暂无待审批申请单</p>
                  </CardContent>
                </MobileCard>
              ) : (
                pendingRequests.map((req) => (
                  <RequestCard 
                    key={req.id} 
                    request={req} 
                    onExport={handleExport} 
                    onApproval={setShowApprovalPage}
                    exportingId={exportingId}
                    showApprovalButton={true}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="approved" className="mt-4 space-y-3">
              {approvedRequests.length === 0 ? (
                <MobileCard>
                  <CardContent className="text-center py-8">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">暂无已审批申请单</p>
                  </CardContent>
                </MobileCard>
              ) : (
                approvedRequests.map((req) => (
                  <RequestCard 
                    key={req.id} 
                    request={req} 
                    onExport={handleExport} 
                    exportingId={exportingId}
                    showApprovalButton={false}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="all" className="mt-4 space-y-3">
              {allRequests.length === 0 ? (
                <MobileCard>
                  <CardContent className="text-center py-8">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">暂无申请单记录</p>
                  </CardContent>
                </MobileCard>
              ) : (
                allRequests.map((req) => (
                  <RequestCard 
                    key={req.id} 
                    request={req} 
                    onExport={handleExport} 
                    exportingId={exportingId}
                    onApproval={setShowApprovalPage}
                    showApprovalButton={req.status === 'Pending'}
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MobileLayout>
  );
}

interface RequestCardProps {
  request: PaymentRequest;
  onExport: (req: PaymentRequest) => void;
  onApproval?: (req: PaymentRequest) => void;
  exportingId: string | null;
  showApprovalButton?: boolean;
}

function RequestCard({ 
  request, 
  onExport, 
  onApproval, 
  exportingId, 
  showApprovalButton 
}: RequestCardProps) {
  const getStatusBadge = (status: PaymentRequest['status']) => {
    switch (status) {
      case 'Pending': 
        return <Badge className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 border-0 shadow-sm px-3 py-1 text-sm font-medium">⏰ 待审核</Badge>;
      case 'Approved': 
        return <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 shadow-md px-3 py-1 text-sm font-medium">✅ 已审批待支付</Badge>;
      case 'Paid': 
        return <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 shadow-md px-3 py-1 text-sm font-medium">🎉 已支付</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <MobileCard className="relative overflow-hidden transition-all duration-300 hover:shadow-xl active:scale-[0.98] rounded-2xl shadow-lg border-0 bg-gradient-to-br from-white via-white to-gray-50">
      {/* 顶部状态条 */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-1",
        request.status === 'Pending' && "bg-gradient-to-r from-gray-400 to-gray-500",
        request.status === 'Approved' && "bg-gradient-to-r from-blue-500 to-blue-600",
        request.status === 'Paid' && "bg-gradient-to-r from-green-500 to-emerald-600"
      )} />
      
      <CardHeader className="pb-3 pt-4">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-gray-500 mb-1">申请单号</div>
            <CardTitle className="text-base font-mono font-semibold mb-2">
              {request.request_id}
            </CardTitle>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              🕐 {format(new Date(request.created_at), 'MM-dd HH:mm')}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {getStatusBadge(request.status)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 关键信息卡片 */}
        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 p-4 border border-blue-100/50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">运单数量</span>
            <span className="text-lg font-semibold text-gray-900">{request.record_count ?? 0} 条</span>
          </div>
        </div>

        {/* 如果有审批状态，显示审批状态卡片 */}
        {(request.status === 'Pending' || request.status === 'Approved' || request.work_wechat_sp_no) && (
          <MobileApprovalStatusCard
            status={
              request.status === 'Pending' ? 'pending_approval' : 
              request.status === 'Approved' ? 'approved' : 
              request.status === 'Rejected' ? 'rejected' : 
              'pending'
            }
            workWechatSpNo={request.work_wechat_sp_no}
            createdAt={request.created_at}
            onRetry={
              request.status === 'Rejected' && showApprovalButton && onApproval 
                ? () => onApproval(request) 
                : undefined
            }
          />
        )}

        {/* 操作按钮区 */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onExport(request)} 
            disabled={exportingId === request.id}
            className="h-11 text-base rounded-xl font-medium"
          >
            {exportingId === request.id ? (
              <Loader2 className="h-5 w-5 mr-1.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-5 w-5 mr-1.5" />
            )}
            导出
          </Button>
          
          {showApprovalButton && onApproval && (
            <Button 
              variant="default" 
              size="sm" 
              className="h-11 text-base rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-md font-semibold"
              onClick={() => onApproval(request)}
            >
              <Send className="h-5 w-5 mr-1.5" />
              {request.status === 'Rejected' ? '重新审批' : '审批'}
            </Button>
          )}
        </div>
      </CardContent>
    </MobileCard>
  );
}