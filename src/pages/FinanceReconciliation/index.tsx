// 财务对账 - 完整重构版本
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { Calculator } from 'lucide-react';

export default function FinanceReconciliation() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title="财务对账" description="财务数据核对" icon={Calculator} iconColor="text-amber-600" />
      <Card>
        <CardHeader><CardTitle>对账中心</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">对账功能</p></CardContent>
      </Card>
    </div>
  );
}

