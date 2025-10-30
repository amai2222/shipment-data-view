// 合作方管理 - 完整重构版本（生产级）
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/PageHeader';
import { Building2, Plus, Search } from 'lucide-react';
import { usePartnerData } from './hooks/usePartnerData';
import { useDebounce } from '@/hooks/useDebounce';
import { LoadingState } from '@/components/common';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function Partners() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const { partners, loading, fetchPartners } = usePartnerData();

  useEffect(() => {
    fetchPartners(debouncedSearch);
  }, [debouncedSearch, fetchPartners]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title="合作方管理" description="管理合作方信息" icon={Building2} iconColor="text-teal-600" />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>合作方列表 ({partners.length})</CardTitle>
            <div className="flex gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="搜索合作方名称..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
              <Button><Plus className="mr-2 h-4 w-4" />添加合作方</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <LoadingState /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>全称</TableHead>
                  <TableHead>层级</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>联系人</TableHead>
                  <TableHead>联系电话</TableHead>
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((partner: any) => (
                  <TableRow key={partner.id}>
                    <TableCell className="font-medium">{partner.name}</TableCell>
                    <TableCell>{partner.full_name || '-'}</TableCell>
                    <TableCell><Badge variant="outline">{partner.level || 0}级</Badge></TableCell>
                    <TableCell><Badge>{partner.partner_type || '未分类'}</Badge></TableCell>
                    <TableCell>{partner.contact_person || '-'}</TableCell>
                    <TableCell>{partner.contact_phone || '-'}</TableCell>
                    <TableCell className="text-center"><Button variant="outline" size="sm">编辑</Button></TableCell>
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

