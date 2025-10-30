// 数据导入 - 完整重构版本
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { Upload } from 'lucide-react';

export default function DataImport() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title="数据导入" description="批量导入数据" icon={Upload} iconColor="text-blue-600" />
      <Card>
        <CardHeader><CardTitle>导入工具</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button>选择Excel文件</Button>
            <p className="text-sm text-muted-foreground">支持.xlsx格式文件</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

