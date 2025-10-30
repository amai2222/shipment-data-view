// 合同管理 - 完整重构版本
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  const { contracts, loading, fetchContracts, createContract, updateContract, deleteContract } = useContractData();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    contract_number: '',
    title: '',
    partner_id: '',
    start_date: '',
    end_date: '',
  });

  useEffect(() => {
    fetchContracts({ searchTerm: debouncedSearch });
  }, [debouncedSearch, fetchContracts]);

  const handleCreate = () => {
    setEditingContract(null);
    setFormData({
      contract_number: '',
      title: '',
      partner_id: '',
      start_date: '',
      end_date: '',
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (contract: Contract) => {
    setEditingContract(contract);
    setFormData({
      contract_number: contract.contract_number || '',
      title: contract.title || '',
      partner_id: contract.partner_id || '',
      start_date: contract.start_date || '',
      end_date: contract.end_date || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = editingContract
      ? await updateContract(editingContract.id, formData)
      : await createContract(formData);
    if (success) {
      setIsDialogOpen(false);
      fetchContracts({ searchTerm: debouncedSearch });
    }
  };

  const handleDelete = async (id: string) => {
    const success = await deleteContract(id);
    if (success) {
      fetchContracts({ searchTerm: debouncedSearch });
    }
  };

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
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    新建合同
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>{editingContract ? '编辑合同' : '新建合同'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="contract_number">合同编号 *</Label>
                        <Input 
                          id="contract_number" 
                          value={formData.contract_number} 
                          onChange={(e) => setFormData({...formData, contract_number: e.target.value})}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="title">合同标题 *</Label>
                        <Input 
                          id="title" 
                          value={formData.title} 
                          onChange={(e) => setFormData({...formData, title: e.target.value})}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="start_date">开始日期 *</Label>
                        <Input 
                          id="start_date" 
                          type="date"
                          value={formData.start_date} 
                          onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="end_date">结束日期</Label>
                        <Input 
                          id="end_date" 
                          type="date"
                          value={formData.end_date} 
                          onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button>
                      <Button type="submit">{editingContract ? '更新' : '创建'}</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="加载合同数据中..." />
          ) : (
            <ContractTable 
              contracts={contracts} 
              onEdit={handleEdit}
              onView={setViewingContract}
              onDelete={handleDelete}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
