import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle, AlertTriangle, Send } from 'lucide-react';

interface ApprovalStatusCardProps {
  status: 'pending' | 'pending_approval' | 'approved' | 'rejected' | null;
  workWechatSpNo?: string | null;
  createdAt: string;
  onRetry?: () => void;
}

export function MobileApprovalStatusCard({
  status,
  workWechatSpNo,
  createdAt,
  onRetry
}: ApprovalStatusCardProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'pending_approval':
        return {
          icon: <Clock className="h-5 w-5 text-amber-500" />,
          title: '审批中',
          description: '申请已提交到企业微信，请在企业微信中查看审批进度',
          variant: 'secondary' as const,
          bgClass: 'bg-amber-50 border-amber-200'
        };
      case 'approved':
        return {
          icon: <CheckCircle className="h-5 w-5 text-green-600" />,
          title: '审批通过',
          description: '企业微信审批已通过，付款申请已进入下一流程',
          variant: 'default' as const,
          bgClass: 'bg-green-50 border-green-200'
        };
      case 'rejected':
        return {
          icon: <XCircle className="h-5 w-5 text-red-600" />,
          title: '审批拒绝',
          description: '企业微信审批已拒绝，可重新修改后提交',
          variant: 'destructive' as const,
          bgClass: 'bg-red-50 border-red-200'
        };
      case 'pending':
        return {
          icon: <Send className="h-5 w-5 text-blue-500" />,
          title: '待提交',
          description: '申请单已创建，等待提交企业微信审批',
          variant: 'outline' as const,
          bgClass: 'bg-blue-50 border-blue-200'
        };
      default:
        return {
          icon: <AlertTriangle className="h-5 w-5 text-gray-500" />,
          title: '状态未知',
          description: '无法确定当前审批状态',
          variant: 'outline' as const,
          bgClass: 'bg-gray-50 border-gray-200'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Card className={`${config.bgClass} border-l-4`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {config.icon}
          <span>审批状态</span>
          <Badge variant={config.variant} className="ml-auto">
            {config.title}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {config.description}
        </p>
        
        {workWechatSpNo && (
          <div className="p-2 bg-background rounded border">
            <div className="text-xs text-muted-foreground">企业微信审批单号</div>
            <div className="text-sm font-mono">{workWechatSpNo}</div>
          </div>
        )}
        
        <div className="text-xs text-muted-foreground">
          申请时间: {new Date(createdAt).toLocaleString('zh-CN')}
        </div>

        {status === 'rejected' && onRetry && (
          <div className="pt-2">
            <button
              onClick={onRetry}
              className="text-sm text-primary hover:underline"
            >
              重新提交审批
            </button>
          </div>
        )}

        {status === 'pending_approval' && (
          <div className="p-2 bg-amber-100 rounded text-xs text-amber-800">
            💡 提示：请在企业微信应用中查看和处理审批申请
          </div>
        )}

        {status === 'approved' && (
          <div className="p-2 bg-green-100 rounded text-xs text-green-800">
            ✅ 审批已完成，可以进行后续付款操作
          </div>
        )}
      </CardContent>
    </Card>
  );
}