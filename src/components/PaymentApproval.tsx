import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CheckCircle, Clock, XCircle, Send } from 'lucide-react';

interface PaymentApprovalProps {
  paymentRequestId: string;
  amount: number;
  description: string;
  onApprovalSubmitted?: () => void;
}

export function PaymentApproval({ 
  paymentRequestId, 
  amount, 
  description, 
  onApprovalSubmitted 
}: PaymentApprovalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const { profile } = useAuth();

  const corpId = import.meta.env.VITE_WORK_WECHAT_CORPID;
  const agentId = import.meta.env.VITE_WORK_WECHAT_AGENTID;

  // 提交企业微信审批
  const handleSubmitApproval = async () => {
    if (!profile?.work_wechat_userid) {
      toast.error('请先绑定企业微信账号');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('work-wechat-approval/submit', {
        body: {
          payment_request_id: paymentRequestId,
          applicant_userid: profile.work_wechat_userid,
          approver_userid: 'admin', // 这里应该根据实际业务逻辑确定审批人
          amount,
          description,
          corpId,
          agentId
        }
      });

      if (error) {
        console.error('提交审批失败:', error);
        toast.error('提交审批失败');
        return;
      }

      if (data.success) {
        setApprovalStatus('pending');
        toast.success('审批申请已提交到企业微信');
        onApprovalSubmitted?.();
      } else {
        toast.error('提交审批失败');
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
      case 'pending':
        return <Clock className="h-4 w-4" />;
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
      case 'pending':
        return '审批中';
      case 'approved':
        return '已通过';
      case 'rejected':
        return '已拒绝';
      default:
        return '待提交';
    }
  };

  const getStatusColor = () => {
    switch (approvalStatus) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="flex items-center gap-2"
          disabled={approvalStatus === 'pending'}
        >
          {getStatusIcon()}
          企业微信审批
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            企业微信审批
            <Badge className={getStatusColor()}>
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
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  提交申请人: {profile?.full_name || '当前用户'}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  审批人: 财务负责人
                </div>
              </div>
            </div>

            {approvalStatus ? (
              <div className={`p-3 rounded-lg ${
                approvalStatus === 'approved' ? 'bg-green-50 border border-green-200' :
                approvalStatus === 'rejected' ? 'bg-red-50 border border-red-200' :
                'bg-yellow-50 border border-yellow-200'
              }`}>
                <div className="flex items-center gap-2">
                  {getStatusIcon()}
                  <span className="text-sm font-medium">
                    审批状态: {getStatusText()}
                  </span>
                </div>
                {approvalStatus === 'pending' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    请在企业微信中查看审批进度
                  </p>
                )}
              </div>
            ) : (
              <Button 
                onClick={handleSubmitApproval}
                disabled={isSubmitting || !profile?.work_wechat_userid}
                className="w-full"
              >
                {isSubmitting ? '提交中...' : '提交企业微信审批'}
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