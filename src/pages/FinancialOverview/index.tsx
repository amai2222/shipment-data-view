// 财务总览 - 完整重构版本
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { TrendingUp } from 'lucide-react';
import { LoadingState } from '@/components/common';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/utils/auditFormatters';

export default function FinancialOverview() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const { count: totalRecords } = await supabase.from('logistics_records').select('*', { count: 'exact', head: true });
        const { data: sumData } = await supabase.from('logistics_records').select('payable_cost');
        const totalAmount = sumData?.reduce((sum, r) => sum + (r.payable_cost || 0), 0) || 0;
        setStats({ totalRecords, totalAmount });
      } catch (error) {
        console.error('加载统计失败:', error);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title="财务总览" description="财务数据统计" icon={TrendingUp} iconColor="text-emerald-600" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">总运单数</CardTitle></CardHeader>
          <CardContent>{loading ? <LoadingState /> : <div className="text-2xl font-bold">{stats?.totalRecords || 0}</div>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">总金额</CardTitle></CardHeader>
          <CardContent>{loading ? <LoadingState /> : <div className="text-2xl font-bold text-primary">{formatCurrency(stats?.totalAmount)}</div>}</CardContent>
        </Card>
      </div>
    </div>
  );
}

