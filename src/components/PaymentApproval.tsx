import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { relaxedSupabase } from '@/lib/supabase-helpers';
import { useAuth, UserProfile } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CheckCircle, Clock, XCircle, Send, AlertTriangle } from 'lucide-react';

// 定义审批人对象的数据结构
type ApproverProfile = Pick<UserProfile, 'id' | 'full_name' | 'work_wechat_userid'>;

// 组件接收的属性
interface PaymentApprovalProps {
  paymentRequestId: string;
  amount: number;
  description: string;
  onApprovalSubmitted?: () => void;
}

// 审批状态的类型定义
type ApprovalStatus = 'pending_approval' | 'approved' | 'rejected' | 'pending' | null;

const getStatusIcon = (approvalStatus: ApprovalStatus) => {
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
  
const getStatusText = (approvalStatus: ApprovalStatus) => {
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

const getStatusVariant = (approvalStatus: ApprovalStatus) => {
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

export function PaymentApproval({
  paymentRequestId,
  amount,
  description,
  onApprovalSubmitted,
}: PaymentApprovalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>(null);
  const [workWechatSpNo, setWorkWechatSpNo] = useState<string | null>(null);

  // 状态：用于存储审批人列表和当前选择的审批人ID
  const [approvers, setApprovers] = useState<ApproverProfile[]>([]);
  const [selectedApprover, setSelectedApprover] = useState<string | null>(null);

  const { profile } = useAuth();

  // 获取支付请求的当前状态
  const fetchPaymentRequestStatus = async () => {
    try {
      const { data, error } = await relaxedSupabase
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
      console.error('获取支付请求状态时发生错误:', error);
    }
  };

  // 获取可用的审批人列表
  const fetchApprovers = async () => {
    try {
      // **关键修改：查询角色包含 'admin', 'finance', 和 'approver' 的用户**
      const { data, error } = await relaxedSupabase
        .from('profiles')
        .select('id, full_name, work_wechat_userid')
        .in('role', ['admin', 'finance']) // 只包含有效角色
        .not('work_wechat_userid', 'is', null);

      if (error) {
        toast.error('获取审批人列表失败', { description: error.message });
        return;
      }
      if (data) {
        setApprovers(data as ApproverProfile[]);
      }
    } catch (error: any) {
        toast.error('加载审批人列表时出错', { description: error.message });
    }
  };
  
  // 当对话框打开时，获取最新数据
  useEffect(() => {
    if (isOpen) {
      fetchPaymentRequestStatus();
      fetchApprovers();
      setSelectedApprover(null); // 重置已选审批人
    }
  }, [isOpen, paymentRequestId]);
  
  // 初始加载状态
  useEffect(() => {
    fetchPaymentRequestStatus();
  }, [paymentRequestId]);


  // 提交企业微信审批
  const handleSubmitApproval = async () => {
    // 增加前置检查
    if (!profile?.work_wechat_userid) {
      toast.error('您的账号尚未绑定企业微信，无法提交审批。');
      return;
    }
    if (!selectedApprover) {
      toast.error('请选择一位审批人。');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await relaxedSupabase.functions.invoke('work-wechat-approval', {
        body: {
          action: 'submit',
          payment_request_id: paymentRequestId,
          approver_userid: selectedApprover,
          amount,
          description: description || `付款申请: ${paymentRequestId}`,
          corpId: 'wwd2e97593b6b963cf',
          agentId: '1000002',
        },
      });

      if (error) {
        throw new Error(error.message);
      }
      
      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.success) {
        setApprovalStatus('pending_approval');
        setWorkWechatSpNo(data.sp_no);
        toast.success('审批申请已成功提交到企业微信');
        onApprovalSubmitted?.();
        setIsOpen(false);
      } else {
        throw new Error(data?.message || '提交审批失败，返回结果异常');
      }

    } catch (error: any) {
      console.error('提交审批错误:', error);
      toast.error('提交审批失败', {
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const shouldShowSubmitButton = () => !approvalStatus || approvalStatus === 'pending' || approvalStatus === 'rejected';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant={approvalStatus && approvalStatus !== 'pending' ? "default" : "outline"}
          size="sm"
          className="flex items-center gap-2"
          disabled={approvalStatus === 'pending_approval'}
        >
          {getStatusIcon(approvalStatus)}
          企业微信审批
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            企业微信审批
            <Badge variant={getStatusVariant(approvalStatus)}>{getStatusText(approvalStatus)}</Badge>
          </DialogTitle>
        </DialogHeader>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">付款申请详情</CardTitle>
            <CardDescription>将通过企业微信审批流程处理此付款申请。</CardDescription>
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
                  ¥{(amount || 0).toLocaleString()}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-sm font-medium">申请说明:</span>
                <p className="text-sm text-muted-foreground p-2 bg-gray-50 rounded">
                  {description || '无'}
                </p>
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              {shouldShowSubmitButton() && (
                 <div className="space-y-2">
                    <Label htmlFor="approver">选择审批人</Label>
                    <Select onValueChange={setSelectedApprover} value={selectedApprover || undefined}>
                        <SelectTrigger id="approver">
                            <SelectValue placeholder="请选择审批人..." />
                        </SelectTrigger>
                        <SelectContent>
                            {approvers.length > 0 ? (
                                approvers.map(approver => (
                                    <SelectItem key={approver.id} value={approver.work_wechat_userid!}>
                                        {approver.full_name || '未命名'}
                                    </SelectItem>
                                ))
                            ) : (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                    没有可用的审批人
                                </div>
                            )}
                        </SelectContent>
                    </Select>
                </div>
              )}

              {workWechatSpNo && (
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <AlertTriangle className="h-3 w-3" />
                  企业微信审批单号: {workWechatSpNo}
                </div>
              )}
            </div>
            
            {!profile?.work_wechat_userid && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                    <p className="text-sm text-yellow-800">
                    需要先绑定企业微信账号才能使用审批功能
                    </p>
                </div>
            )}

          </CardContent>
        </Card>
        
        <DialogFooter>
          {shouldShowSubmitButton() ? (
            <Button
              onClick={handleSubmitApproval}
              disabled={isSubmitting || !profile?.work_wechat_userid || !selectedApprover}
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
                  确认并提交企业微信审批
                </>
              )}
            </Button>
          ) : (
             <p className="text-sm text-muted-foreground w-full text-center">
                当前状态为 "{getStatusText(approvalStatus)}"，无需操作。
             </p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

