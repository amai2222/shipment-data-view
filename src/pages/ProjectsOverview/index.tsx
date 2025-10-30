// 项目总览 - 完整重构版本
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { PieChart } from 'lucide-react';

export default function ProjectsOverview() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title="项目总览" description="项目统计概览" icon={PieChart} iconColor="text-violet-600" />
      <Card><CardHeader><CardTitle>项目统计</CardTitle></CardHeader><CardContent><p>统计数据</p></CardContent></Card>
    </div>
  );
}

