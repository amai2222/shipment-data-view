// 统一状态徽章组件
// 用于显示申请单、运单等状态

import { Badge } from "@/components/ui/badge";

// 付款申请单状态配置
export const PAYMENT_REQUEST_STATUS_CONFIG = {
  Pending: { label: '待审核', variant: 'secondary' as const },
  Approved: { label: '已审批待支付', variant: 'default' as const },
  Paid: { label: '已支付', variant: 'outline' as const, className: 'border-green-500 text-green-700 bg-green-50' },
  Rejected: { label: '已驳回', variant: 'destructive' as const },
  Cancelled: { label: '已作废', variant: 'destructive' as const },
};

// 开票申请单状态配置
export const INVOICE_REQUEST_STATUS_CONFIG = {
  Pending: { label: '待审核', variant: 'secondary' as const },
  Approved: { label: '已审批', variant: 'default' as const },
  Completed: { label: '已完成', variant: 'outline' as const },
  Rejected: { label: '已拒绝', variant: 'destructive' as const },
  Voided: { label: '已作废', variant: 'destructive' as const },
};

// 通用状态配置（保持向后兼容）
export const STATUS_CONFIG = {
  // 付款申请状态
  ...PAYMENT_REQUEST_STATUS_CONFIG,
  
  // 开票申请状态
  Completed: { label: '已完成', variant: 'outline' as const },
  Voided: { label: '已作废', variant: 'destructive' as const },
  
  // 运单付款/开票状态
  Paid: { label: '已付款', variant: 'outline' as const },
  Unpaid: { label: '未付款', variant: 'secondary' as const },
  Invoiced: { label: '已开票', variant: 'outline' as const },
  Uninvoiced: { label: '未开票', variant: 'secondary' as const },
  Processing: { label: '处理中', variant: 'default' as const }, // 仅用于运单状态
  
  // 其他状态
  Merged: { label: '已合并', variant: 'secondary' as const },
};

interface StatusBadgeProps {
  status: string;
  customConfig?: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }>;
  className?: string;
}

export function StatusBadge({ status, customConfig, className = "" }: StatusBadgeProps) {
  const config = customConfig?.[status] || STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  
  if (!config) {
    return <Badge className={className}>{status}</Badge>;
  }
  
  const badgeClassName = `${config.className || ''} ${className}`.trim();
  
  return (
    <Badge variant={config.variant} className={badgeClassName}>
      {config.label}
    </Badge>
  );
}

// 导出配置，方便其他地方使用
export function getStatusLabel(status: string, customConfig?: Record<string, { label: string }>): string {
  const config = customConfig?.[status] || STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  return config?.label || status;
}

export function getStatusVariant(status: string, customConfig?: Record<string, { variant: string }>): string {
  const config = customConfig?.[status] || STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  return config?.variant || 'secondary';
}

