import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CheckCircle, Clock, XCircle, Send, AlertTriangle } from 'lucide-react';

interface PaymentApprovalProps {
  paymentRequestId: string;
  amount: number;
  description: string;
  onApprovalSubmitted?: () => void;
}

type ApprovalStatus = 'pending_approval' | 'approved' | 'rejected' | 'pending' | null;

export function PaymentApproval({ 
  paymentRequestId, 
  amount, 
  description, 
  onApprovalSubmitted 
}: PaymentApprovalProps) {
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
          approver_userid: 'admin', // 这里应该根据实际业务逻辑确定审批人
          amount,
          description,
          corpId: 'wwd2e97593b6b963cf', // 从环境变量或配置获取
          agentId: '1000002' // 从环境变量或配置获取
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
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Send className="h-4 w-4" />;
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
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant={approvalStatus && approvalStatus !== 'pending' ? "default" : "outline"}
          size="sm"
          className="flex items-center gap-2"
          disabled={approvalStatus === 'pending_approval'}
        >
          {getStatusIcon()}
          企业微信审批
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            企业微信审批
            <Badge variant={getStatusVariant()}>
              {getStatusText()}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">付款申请详情</CardTitle>
            <CardDescription>
              将通过企业微信审批流程处理此付款申请
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">申请单号:</span>
                <span className="text-sm text-muted-foreground">{paymentRequestId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">付款金额:</span>
                <span className="text-sm font-semibold text-green-600">
                  ¥{amount.toLocaleString()}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-sm font-medium">申请说明:</span>
                <p className="text-sm text-muted-foreground p-2 bg-gray-50 rounded">
                  {description}
                </p>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">审批流程</h4>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  提交申请人: {profile?.full_name || '当前用户'}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-secondary rounded-full"></div>
                  审批人: 财务负责人
                </div>
                {workWechatSpNo && (
                  <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                    <AlertTriangle className="h-3 w-3" />
                    审批单号: {workWechatSpNo}
                  </div>
                )}
              </div>
            </div>

            {approvalStatus && !shouldShowSubmitButton() ? (
              <Card className="border-l-4 border-l-primary">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon()}
                    <span className="text-sm font-medium">
                      审批状态: {getStatusText()}
                    </span>
                  </div>
                  {approvalStatus === 'pending_approval' && (
                    <p className="text-xs text-muted-foreground">
                      请在企业微信中查看审批进度，或联系审批人处理
                    </p>
                  )}
                  {approvalStatus === 'approved' && (
                    <p className="text-xs text-green-600 font-medium">
                      审批已通过，付款申请已进入下一流程
                    </p>
                  )}
                  {approvalStatus === 'rejected' && (
                    <p className="text-xs text-red-600 font-medium">
                      审批已拒绝，可重新修改后提交
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Button 
                onClick={handleSubmitApproval}
                disabled={isSubmitting || !profile?.work_wechat_userid}
                className="w-full"
              >
                {isSubmitting ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    提交中...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    提交企业微信审批
                  </>
                )}
              </Button>
            )}

            {!profile?.work_wechat_userid && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  需要先绑定企业微信账号才能使用审批功能
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}