import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CheckCircle, Clock, XCircle, Send, AlertTriangle, ArrowLeft } from 'lucide-react';

interface MobilePaymentApprovalProps {
  paymentRequestId: string;
  amount: number;
  description: string;
  onApprovalSubmitted?: () => void;
  onBack?: () => void;
}

type ApprovalStatus = 'pending_approval' | 'approved' | 'rejected' | 'pending' | null;

export function MobilePaymentApproval({ 
  paymentRequestId, 
  amount, 
  description, 
  onApprovalSubmitted,
  onBack
}: MobilePaymentApprovalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>(null);
  const [workWechatSpNo, setWorkWechatSpNo] = useState<string | null>(null);
  const { profile } = useAuth();

  // 获取支付请求状态
  const fetchPaymentRequestStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_requests')
        .select('status, work_wechat_sp_no')
        .eq('id', paymentRequestId)
        .single();

      if (error) {
        console.error('获取支付请求状态失败:', error);
        return;
      }

      if (data) {
        setApprovalStatus(data.status as ApprovalStatus);
        setWorkWechatSpNo(data.work_wechat_sp_no);
      }
    } catch (error) {
      console.error('获取支付请求状态错误:', error);
    }
  };

  useEffect(() => {
    fetchPaymentRequestStatus();
  }, [paymentRequestId]);

  // 提交企业微信审批
  const handleSubmitApproval = async () => {
    if (!profile?.work_wechat_userid) {
      toast.error('请先绑定企业微信账号');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('work-wechat-approval', {
        body: {
          action: 'submit',
          payment_request_id: paymentRequestId,
          applicant_userid: profile.work_wechat_userid,
          approver_userid: 'admin',
          amount,
          description,
          corpId: 'wwd2e97593b6b963cf',
          agentId: '1000002'
        }
      });

      if (error) {
        console.error('提交审批失败:', error);
        toast.error(`提交审批失败: ${error.message}`);
        return;
      }

      if (data?.success) {
        setApprovalStatus('pending_approval');
        setWorkWechatSpNo(data.sp_no);
        toast.success('审批申请已提交到企业微信');
        onApprovalSubmitted?.();
      } else {
        toast.error(data?.message || '提交审批失败');
      }

    } catch (error) {
      console.error('提交审批错误:', error);
      toast.error('提交审批失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = () => {
    switch (approvalStatus) {
      case 'pending_approval':
        return <Clock className="h-5 w-5 text-amber-500" />;
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Send className="h-5 w-5" />;
    }
  };

  const getStatusText = () => {
    switch (approvalStatus) {
      case 'pending_approval':
        return '审批中';
      case 'approved':
        return '已通过';
      case 'rejected':
        return '已拒绝';
      case 'pending':
        return '待审批';
      default:
        return '待提交';
    }
  };

  const getStatusVariant = () => {
    switch (approvalStatus) {
      case 'pending_approval':
        return 'secondary';
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const shouldShowSubmitButton = () => {
    return !approvalStatus || approvalStatus === 'pending' || approvalStatus === 'rejected';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 头部 */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onBack}
              className="p-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex-1">
            <h1 className="text-lg font-semibold">企业微信审批</h1>
          </div>
          <Badge variant={getStatusVariant()}>
            {getStatusText()}
          </Badge>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="px-4 py-6 space-y-4">
        {/* 付款申请详情卡片 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {getStatusIcon()}
              付款申请详情
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-sm text-muted-foreground">申请单号</span>
                <span className="text-sm font-mono text-right">{paymentRequestId}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-sm text-muted-foreground">付款金额</span>
                <span className="text-lg font-bold text-green-600">
                  ¥{(amount || 0).toLocaleString()}
                </span>
              </div>
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">申请说明</span>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">{description}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 审批流程卡片 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">审批流程</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-primary rounded-full"></div>
              <div>
                <p className="text-sm font-medium">提交申请人</p>
                <p className="text-xs text-muted-foreground">{profile?.full_name || '当前用户'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-secondary rounded-full"></div>
              <div>
                <p className="text-sm font-medium">审批人</p>
                <p className="text-xs text-muted-foreground">财务负责人</p>
              </div>
            </div>
            {workWechatSpNo && (
              <div className="flex items-center gap-3 p-2 bg-muted rounded">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <div>
                  <p className="text-xs text-muted-foreground">审批单号</p>
                  <p className="text-xs font-mono">{workWechatSpNo}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 审批状态或提交按钮 */}
        {approvalStatus && !shouldShowSubmitButton() ? (
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-4">
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center gap-2">
                  {getStatusIcon()}
                  <span className="font-medium">审批状态: {getStatusText()}</span>
                </div>
                
                {approvalStatus === 'pending_approval' && (
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <p className="text-sm text-amber-800 text-center">
                      请在企业微信中查看审批进度
                    </p>
                    <p className="text-xs text-amber-600 mt-1 text-center">
                      或联系审批人处理
                    </p>
                  </div>
                )}
                
                {approvalStatus === 'approved' && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-800 text-center font-medium">
                      审批已通过，付款申请已进入下一流程
                    </p>
                  </div>
                )}
                
                {approvalStatus === 'rejected' && (
                  <div className="p-3 bg-red-50 rounded-lg">
                    <p className="text-sm text-red-800 text-center font-medium">
                      审批已拒绝，可重新修改后提交
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {!profile?.work_wechat_userid && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-amber-800 font-medium">需要绑定企业微信</p>
                      <p className="text-xs text-amber-700 mt-1">
                        需要先绑定企业微信账号才能使用审批功能
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            <Button 
              onClick={handleSubmitApproval}
              disabled={isSubmitting || !profile?.work_wechat_userid}
              className="w-full h-12 text-base"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Clock className="mr-2 h-5 w-5 animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-5 w-5" />
                  提交企业微信审批
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}