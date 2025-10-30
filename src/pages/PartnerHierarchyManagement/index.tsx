// 合作方层级管理 - 完整重构版本
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { Network } from 'lucide-react';
import { usePartnerData } from '../Partners/hooks/usePartnerData';
import { LoadingState } from '@/components/common';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function PartnerHierarchyManagement() {
  const { partners, loading, fetchPartners } = usePartnerData();

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const sortedPartners = partners.sort((a, b) => (a.level || 0) - (b.level || 0));

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title="合作方层级管理" description="管理合作方层级关系" icon={Network} iconColor="text-purple-600" />
      <Card>
        <CardHeader><CardTitle>层级结构 ({partners.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? <LoadingState /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>合作方</TableHead>
                  <TableHead>全称</TableHead>
                  <TableHead>层级</TableHead>
                  <TableHead>类型</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPartners.map((partner: any) => (
                  <TableRow key={partner.id}>
                    <TableCell className="font-medium">{partner.name}</TableCell>
                    <TableCell>{partner.full_name || '-'}</TableCell>
                    <TableCell><Badge variant="outline" className="font-mono">{partner.level || 0}级</Badge></TableCell>
                    <TableCell><Badge>{partner.partner_type || '未分类'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

