// 统一状态徽章组件
// 用于显示申请单、运单等状态

import { Badge } from "@/components/ui/badge";

// 通用状态配置
export const STATUS_CONFIG = {
  // 申请单通用状态
  Pending: { label: '待审核', variant: 'secondary' as const },
  Processing: { label: '处理中', variant: 'default' as const },
  Approved: { label: '已通过', variant: 'default' as const },
  Completed: { label: '已完成', variant: 'outline' as const },
  Rejected: { label: '已拒绝', variant: 'destructive' as const },
  Voided: { label: '已作废', variant: 'destructive' as const },
  Cancelled: { label: '已取消', variant: 'destructive' as const },
  
  // 付款状态
  Paid: { label: '已付款', variant: 'outline' as const },
  Unpaid: { label: '未付款', variant: 'secondary' as const },
  
  // 开票状态
  Invoiced: { label: '已开票', variant: 'outline' as const },
  Uninvoiced: { label: '未开票', variant: 'secondary' as const },
  
  // 其他状态
  Merged: { label: '已合并', variant: 'secondary' as const },
};

interface StatusBadgeProps {
  status: string;
  customConfig?: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }>;
  className?: string;
}

export function StatusBadge({ status, customConfig, className = "" }: StatusBadgeProps) {
  const config = customConfig?.[status] || STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  
  if (!config) {
    return <Badge className={className}>{status}</Badge>;
  }
  
  return (
    <Badge variant={config.variant} className={className}>
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

