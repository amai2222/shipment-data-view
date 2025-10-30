// 付款开票详情 - 完整重构版本
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { Receipt } from 'lucide-react';
import { LoadingState } from '@/components/common';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function PaymentInvoiceDetail() {
  const { requestId } = useParams<{ requestId: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      if (!requestId) return;
      setLoading(true);
      try {
        const { data: requestData, error } = await supabase
          .from('payment_requests')
          .select('*')
          .eq('id', requestId)
          .single();

        if (error) throw error;
        setData(requestData);
      } catch (error) {
        console.error('加载详情失败:', error);
        toast({ title: '错误', description: '加载详情失败', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [requestId, toast]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title="付款开票详情" description="查看付款和开票详细信息" icon={Receipt} />

      <Card>
        <CardHeader>
          <CardTitle>申请单详情</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <LoadingState /> : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">申请单号</div>
                  <div className="font-mono font-medium">{data?.request_id || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">状态</div>
                  <div>{data?.status || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">运单数量</div>
                  <div>{data?.logistics_record_ids?.length || 0} 条</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">备注</div>
                  <div className="text-sm">{data?.notes || '-'}</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
