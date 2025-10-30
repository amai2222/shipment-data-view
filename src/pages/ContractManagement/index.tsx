// 合同管理 - 完整重构版本
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/PageHeader';
import { FileText, Plus, Search } from 'lucide-react';
import { useContractData } from './hooks/useContractData';
import { ContractTable } from './components/ContractTable';
import { useDebounce } from '@/hooks/useDebounce';
import { LoadingState } from '@/components/common';
import type { Contract } from '@/types/managementPages';

export default function ContractManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [viewingContract, setViewingContract] = useState<Contract | null>(null);
  const debouncedSearch = useDebounce(searchTerm, 500);
  const { contracts, loading, fetchContracts } = useContractData();

  useEffect(() => {
    fetchContracts({ searchTerm: debouncedSearch });
  }, [debouncedSearch, fetchContracts]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader 
        title="合同管理" 
        description="管理合同信息和文件" 
        icon={FileText} 
        iconColor="text-purple-600" 
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>合同列表 ({contracts.length})</CardTitle>
            <div className="flex gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索合同编号、标题..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                新建合同
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="加载合同数据中..." />
          ) : (
            <ContractTable 
              contracts={contracts} 
              onEdit={setEditingContract}
              onView={setViewingContract}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
