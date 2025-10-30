// 项目管理 - 完整重构版本（生产级）
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/PageHeader';
import { Briefcase, Plus, Search } from 'lucide-react';
import { useProjectData } from './hooks/useProjectData';
import { useDebounce } from '@/hooks/useDebounce';
import { LoadingState } from '@/components/common';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDateShort } from '@/utils/auditFormatters';

export default function Projects() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const { projects, loading, fetchProjects } = useProjectData();

  useEffect(() => {
    fetchProjects(debouncedSearch);
  }, [debouncedSearch, fetchProjects]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title="项目管理" description="管理项目信息" icon={Briefcase} iconColor="text-indigo-600" />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>项目列表 ({projects.length})</CardTitle>
            <div className="flex gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="搜索项目名称、编码..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
              <Button><Plus className="mr-2 h-4 w-4" />添加项目</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <LoadingState /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目名称</TableHead>
                  <TableHead>项目编码</TableHead>
                  <TableHead>开始日期</TableHead>
                  <TableHead>结束日期</TableHead>
                  <TableHead>负责人</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project: any) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell className="font-mono">{project.auto_code || '-'}</TableCell>
                    <TableCell>{formatDateShort(project.start_date)}</TableCell>
                    <TableCell>{formatDateShort(project.end_date)}</TableCell>
                    <TableCell>{project.manager || '-'}</TableCell>
                    <TableCell><Badge variant={project.status === '进行中' ? 'default' : 'outline'}>{project.status || '未知'}</Badge></TableCell>
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

