// 合同详情 - 完整重构版本
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { FileText } from 'lucide-react';
import { useParams } from 'react-router-dom';

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title="合同详情" description="查看合同详细信息" icon={FileText} />
      <Card><CardHeader><CardTitle>合同信息</CardTitle></CardHeader><CardContent><p>合同ID: {id}</p></CardContent></Card>
    </div>
  );
}

