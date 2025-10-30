// 合作方管理 - 完整重构版本（生产级）
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PageHeader } from '@/components/PageHeader';
import { Building2, Plus, Search, Edit, Trash2 } from 'lucide-react';
import { usePartnerData } from './hooks/usePartnerData';
import { useDebounce } from '@/hooks/useDebounce';
import { LoadingState } from '@/components/common';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function Partners() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const { partners, loading, fetchPartners, createPartner, updatePartner, deletePartner } = usePartnerData();
  
  // 对话框状态
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    full_name: '',
    contact_person: '',
    contact_phone: '',
    tax_rate: '0.03',
  });

  useEffect(() => {
    fetchPartners(debouncedSearch);
  }, [debouncedSearch, fetchPartners]);

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: '',
      full_name: '',
      contact_person: '',
      contact_phone: '',
      tax_rate: '0.03',
    });
    setEditingPartner(null);
  };

  // 打开新建对话框
  const handleCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  // 打开编辑对话框
  const handleEdit = (partner: any) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name || '',
      full_name: partner.full_name || '',
      contact_person: partner.contact_person || '',
      contact_phone: partner.contact_phone || '',
      tax_rate: partner.tax_rate?.toString() || '0.03',
    });
    setIsDialogOpen(true);
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const partnerData = {
      ...formData,
      tax_rate: parseFloat(formData.tax_rate),
    };
    
    const success = editingPartner
      ? await updatePartner(editingPartner.id, partnerData)
      : await createPartner(partnerData);
    
    if (success) {
      setIsDialogOpen(false);
      resetForm();
      fetchPartners(debouncedSearch);
    }
  };

  // 删除合作方
  const handleDelete = async (id: string) => {
    const success = await deletePartner(id);
    if (success) {
      fetchPartners(debouncedSearch);
    }
  };

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
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" />添加合作方</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>{editingPartner ? '编辑合作方' : '添加合作方'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">名称 *</Label>
                        <Input 
                          id="name" 
                          value={formData.name} 
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="full_name">全称</Label>
                        <Input 
                          id="full_name" 
                          value={formData.full_name} 
                          onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contact_person">联系人</Label>
                        <Input 
                          id="contact_person" 
                          value={formData.contact_person} 
                          onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contact_phone">联系电话</Label>
                        <Input 
                          id="contact_phone" 
                          value={formData.contact_phone} 
                          onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tax_rate">税率</Label>
                        <Input 
                          id="tax_rate" 
                          type="number"
                          step="0.001"
                          min="0"
                          max="1"
                          value={formData.tax_rate} 
                          onChange={(e) => setFormData({...formData, tax_rate: e.target.value})}
                          placeholder="例如: 0.03 代表3%"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button>
                      <Button type="submit">{editingPartner ? '更新' : '创建'}</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
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
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(partner)}>
                          <Edit className="h-4 w-4 mr-1" />
                          编辑
                        </Button>
                        <ConfirmDialog
                          title="确认删除"
                          description={`确定要删除合作方"${partner.name}"吗？此操作不可撤销。`}
                          onConfirm={() => handleDelete(partner.id)}
                        >
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </ConfirmDialog>
                      </div>
                    </TableCell>
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

