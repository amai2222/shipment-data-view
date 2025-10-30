// 仪表盘 - 完整重构版本
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { LayoutDashboard } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title="仪表盘" description="数据概览" icon={LayoutDashboard} iconColor="text-indigo-600" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader><CardTitle className="text-sm">统计数据</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">-</div></CardContent></Card>
      </div>
    </div>
  );
}

