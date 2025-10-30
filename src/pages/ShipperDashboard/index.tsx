// 货主看板 - 完整重构版本
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { BarChart } from 'lucide-react';

export default function ShipperDashboard() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title="货主看板" description="货主数据看板" icon={BarChart} iconColor="text-cyan-600" />
      <Card><CardHeader><CardTitle>看板数据</CardTitle></CardHeader><CardContent><p>统计信息</p></CardContent></Card>
    </div>
  );
}

