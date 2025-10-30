// 首页 - 完整重构版本
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { Home as HomeIcon } from 'lucide-react';

export default function Home() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title="首页" description="系统概览" icon={HomeIcon} iconColor="text-blue-600" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle>快速入口</CardTitle></CardHeader><CardContent><p>功能模块</p></CardContent></Card>
      </div>
    </div>
  );
}

