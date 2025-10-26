import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, CheckCircle, Clock, Truck, XCircle, Copy } from 'lucide-react';
import { ExternalTrackingNumber } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface ExternalTrackingNumbersDisplayProps {
  externalTrackingNumbers: ExternalTrackingNumber[];
  showActions?: boolean;
  onUpdateStatus?: (index: number, status: ExternalTrackingNumber['status']) => void;
  className?: string;
}

export function ExternalTrackingNumbersDisplay({
  externalTrackingNumbers,
  showActions = false,
  onUpdateStatus,
  className = ''
}: ExternalTrackingNumbersDisplayProps) {
  const { toast } = useToast();

  // 获取状态图标和颜色
  const getStatusIcon = (status: ExternalTrackingNumber['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_transit':
        return <Truck className="h-4 w-4 text-blue-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: ExternalTrackingNumber['status']) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">已完成</Badge>;
      case 'in_transit':
        return <Badge variant="secondary" className="bg-blue-500">运输中</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">已取消</Badge>;
      default:
        return <Badge variant="outline">待处理</Badge>;
    }
  };

  // 复制运单号到剪贴板
  const copyTrackingNumber = (trackingNumber: string) => {
    navigator.clipboard.writeText(trackingNumber).then(() => {
      toast({
        title: "复制成功",
        description: `运单号 ${trackingNumber} 已复制到剪贴板`,
      });
    }).catch(() => {
      toast({
        title: "复制失败",
        description: "无法复制到剪贴板",
        variant: "destructive",
      });
    });
  };

  // 格式化创建时间
  const formatCreatedAt = (createdAt?: string) => {
    if (!createdAt) return '未知时间';
    try {
      return new Date(createdAt).toLocaleString('zh-CN');
    } catch {
      return '时间格式错误';
    }
  };

  if (!externalTrackingNumbers || externalTrackingNumbers.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="h-5 w-5" />
          其他平台运单号码
          <Badge variant="outline">{externalTrackingNumbers.length} 个</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {externalTrackingNumbers.map((tracking, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon(tracking.status)}
                  <Badge variant="outline">{tracking.platform}</Badge>
                  <span className="font-medium">{tracking.tracking_number}</span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(tracking.status)}
                  {showActions && onUpdateStatus && tracking.status === 'pending' && (
                    <div className="flex gap-1">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onUpdateStatus(index, 'in_transit')}
                      >
                        <Truck className="h-3 w-3 mr-1" />
                        开始运输
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onUpdateStatus(index, 'completed')}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        完成
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {tracking.remarks && (
                    <span>备注: {tracking.remarks}</span>
                  )}
                </div>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => copyTrackingNumber(tracking.tracking_number)}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  复制
                </Button>
              </div>
              
              {tracking.remarks && (
                <div className="mt-3 pt-3 border-t">
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">备注:</span> {tracking.remarks}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default ExternalTrackingNumbersDisplay;
