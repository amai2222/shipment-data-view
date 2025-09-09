import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { DirectConfirmDialog } from '@/components/ConfirmDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, Plus, Search, Filter, Download, Trash2 } from 'lucide-react';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { format } from 'date-fns';

interface Contract {
  id: string;
  category: '行政合同' | '内部合同' | '业务合同';
  start_date: string;
  end_date: string;
  counterparty_company: string;
  our_company: string;
  contract_amount?: number;
  contract_original_url?: string;
  attachment_url?: string;
  remarks?: string;
  created_at: string;
}

interface ContractFormData {
  category: '行政合同' | '内部合同' | '业务合同';
  start_date: string;
  end_date: string;
  counterparty_company: string;
  our_company: string;
  contract_amount: string;
  remarks: string;
}

export default function MobileContractManagement() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [formData, setFormData] = useState<ContractFormData>({
    category: '业务合同',
    start_date: '',
    end_date: '',
    counterparty_company: '',
    our_company: '',
    contract_amount: '',
    remarks: ''
  });
  const [selectedFiles, setSelectedFiles] = useState<{
    original?: File;
    attachment?: File;
  }>({});

  const { toast } = useToast();

  useEffect(() => {
    loadContracts();
  }, []);

  const loadContracts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('contracts')
        .select('*')
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setContracts(data || []);
    } catch (error) {
      console.error('Error loading contracts:', error);
      toast({
        title: "错误",
        description: "加载合同列表失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadFiles = async (contractData: { counterparty_company: string; our_company: string }) => {
    const uploadResults: { original?: string; attachment?: string } = {};

    if (selectedFiles.original) {
      const originalFile = selectedFiles.original;
      const fileExtension = originalFile.name.split('.').pop();
      const fileName = `${contractData.counterparty_company}-${contractData.our_company}-原件.${fileExtension}`;
      
      const reader = new FileReader();
      const fileData = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]);
        };
        reader.readAsDataURL(originalFile);
      });

      const { data, error } = await supabase.functions.invoke('qiniu-upload', {
        body: {
          files: [{
            fileName: originalFile.name,
            fileData: fileData
          }],
          namingParams: {
            projectName: 'hetong',
            customName: fileName
          }
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Upload failed');
      uploadResults.original = data.urls[0];
    }

    if (selectedFiles.attachment) {
      const attachmentFile = selectedFiles.attachment;
      const fileExtension = attachmentFile.name.split('.').pop();
      const fileName = `${contractData.counterparty_company}-${contractData.our_company}-附件.${fileExtension}`;
      
      const reader = new FileReader();
      const fileData = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]);
        };
        reader.readAsDataURL(attachmentFile);
      });

      const { data, error } = await supabase.functions.invoke('qiniu-upload', {
        body: {
          files: [{
            fileName: attachmentFile.name,
            fileData: fileData
          }],
          namingParams: {
            projectName: 'hetong',
            customName: fileName
          }
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Upload failed');
      uploadResults.attachment = data.urls[0];
    }

    return uploadResults;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.counterparty_company || !formData.our_company || !formData.start_date || !formData.end_date) {
      toast({
        title: "错误",
        description: "请填写所有必填字段",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const uploadResults = await uploadFiles({
        counterparty_company: formData.counterparty_company,
        our_company: formData.our_company
      });

      const { error } = await supabase
        .from('contracts')
        .insert({
          category: formData.category,
          start_date: formData.start_date,
          end_date: formData.end_date,
          counterparty_company: formData.counterparty_company,
          our_company: formData.our_company,
          contract_amount: formData.contract_amount ? parseFloat(formData.contract_amount) : null,
          contract_original_url: uploadResults.original,
          attachment_url: uploadResults.attachment,
          remarks: formData.remarks || null,
        });

      if (error) throw error;

      toast({
        title: "成功",
        description: "合同保存成功",
      });

      setShowForm(false);
      setFormData({
        category: '业务合同',
        start_date: '',
        end_date: '',
        counterparty_company: '',
        our_company: '',
        contract_amount: '',
        remarks: ''
      });
      setSelectedFiles({});
      loadContracts();
    } catch (error) {
      console.error('Error saving contract:', error);
      toast({
        title: "错误",
        description: "保存合同失败",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, type: 'original' | 'attachment') => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFiles(prev => ({ ...prev, [type]: file }));
    }
  };

  const removeFile = (type: 'original' | 'attachment') => {
    setSelectedFiles(prev => {
      const updated = { ...prev };
      delete updated[type];
      return updated;
    });
  };

  const getCategoryBadgeVariant = (category: string) => {
    switch (category) {
      case '行政合同': return 'secondary';
      case '内部合同': return 'outline';
      case '业务合同': return 'default';
      default: return 'secondary';
    }
  };

  const handleSelectContract = (contractId: string, checked: boolean) => {
    const newSelected = new Set(selectedContracts);
    if (checked) {
      newSelected.add(contractId);
    } else {
      newSelected.delete(contractId);
    }
    setSelectedContracts(newSelected);
  };

  const handleToggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      setSelectedContracts(new Set());
    }
  };

  const handleBatchDelete = async () => {
    if (selectedContracts.size === 0) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('contracts')
        .delete()
        .in('id', Array.from(selectedContracts));

      if (error) throw error;

      toast({
        title: "成功",
        description: `已删除 ${selectedContracts.size} 个合同`,
      });

      setSelectedContracts(new Set());
      setShowDeleteDialog(false);
      setSelectionMode(false);
      loadContracts();
    } catch (error) {
      console.error('Error deleting contracts:', error);
      toast({
        title: "错误",
        description: "删除合同失败",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = !searchTerm || 
      contract.counterparty_company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.our_company.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || contract.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <MobileLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">合同管理</h1>
          <div className="flex gap-2">
            {selectedContracts.size > 0 ? (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={deleting}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleSelectionMode}
                >
                  取消 ({selectedContracts.size})
                </Button>
              </>
            ) : (
              <>
                {selectionMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToggleSelectionMode}
                  >
                    取消选择
                  </Button>
                )}
                {!selectionMode && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleToggleSelectionMode}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      <Filter className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </>
            )}
            {!selectionMode && (
              <Dialog open={showForm} onOpenChange={setShowForm}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="w-full max-w-md mx-auto">
                <DialogHeader>
                  <DialogTitle>新增合同</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="category">合同分类 *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value: '行政合同' | '内部合同' | '业务合同') =>
                        setFormData(prev => ({ ...prev, category: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="行政合同">行政合同</SelectItem>
                        <SelectItem value="内部合同">内部合同</SelectItem>
                        <SelectItem value="业务合同">业务合同</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="counterparty_company">对方公司名称 *</Label>
                    <Input
                      id="counterparty_company"
                      placeholder="输入对方公司名称"
                      value={formData.counterparty_company}
                      onChange={(e) => setFormData(prev => ({ ...prev, counterparty_company: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="our_company">我方公司名称 *</Label>
                    <Input
                      id="our_company"
                      placeholder="输入我方公司名称"
                      value={formData.our_company}
                      onChange={(e) => setFormData(prev => ({ ...prev, our_company: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="start_date">开始日期 *</Label>
                      <Input
                        id="start_date"
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="end_date">结束日期 *</Label>
                      <Input
                        id="end_date"
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="contract_amount">合同金额</Label>
                    <Input
                      id="contract_amount"
                      type="number"
                      step="0.01"
                      placeholder="输入合同金额"
                      value={formData.contract_amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, contract_amount: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="remarks">备注</Label>
                    <Textarea
                      id="remarks"
                      placeholder="输入备注信息"
                      value={formData.remarks}
                      onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label>合同原件</Label>
                      <div className="mt-1">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileSelect(e, 'original')}
                          className="hidden"
                          id="originalFileInput"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('originalFileInput')?.click()}
                          className="w-full"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          选择合同原件
                        </Button>
                        {selectedFiles.original && (
                          <div className="mt-1 p-2 bg-gray-50 rounded text-xs">
                            {selectedFiles.original.name}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile('original')}
                              className="ml-2 text-red-500"
                            >
                              删除
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label>附件</Label>
                      <div className="mt-1">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileSelect(e, 'attachment')}
                          className="hidden"
                          id="attachmentFileInput"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('attachmentFileInput')?.click()}
                          className="w-full"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          选择附件
                        </Button>
                        {selectedFiles.attachment && (
                          <div className="mt-1 p-2 bg-gray-50 rounded text-xs">
                            {selectedFiles.attachment.name}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile('attachment')}
                              className="ml-2 text-red-500"
                            >
                              删除
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowForm(false)}
                      disabled={uploading}
                    >
                      取消
                    </Button>
                    <Button type="submit" disabled={uploading}>
                      {uploading ? '保存中...' : '保存'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            )}
          </div>
        </div>

        {/* 搜索和筛选 */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="搜索公司名称..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {showFilters && (
            <div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="选择合同分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部分类</SelectItem>
                  <SelectItem value="行政合同">行政合同</SelectItem>
                  <SelectItem value="内部合同">内部合同</SelectItem>
                  <SelectItem value="业务合同">业务合同</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* 合同列表 */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : filteredContracts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              暂无合同记录
            </div>
          ) : (
            filteredContracts.map((contract) => (
            <Card key={contract.id} className="relative">
              {selectionMode && (
                <div className="absolute top-2 right-2">
                  <Checkbox
                    checked={selectedContracts.has(contract.id)}
                    onCheckedChange={(checked) => handleSelectContract(contract.id, checked as boolean)}
                  />
                </div>
              )}
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={getCategoryBadgeVariant(contract.category)}>
                        {contract.category}
                      </Badge>
                      {contract.contract_amount && (
                        <span className="text-sm text-green-600 font-medium">
                          ¥{contract.contract_amount.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="text-sm">
                      <div className="font-medium">{contract.counterparty_company}</div>
                      <div className="text-gray-600">{contract.our_company}</div>
                    </div>
                  </div>
                </div>

                <div className="text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>合同期间:</span>
                    <span>
                      {format(new Date(contract.start_date), 'yyyy-MM-dd')} 至{' '}
                      {format(new Date(contract.end_date), 'yyyy-MM-dd')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>创建时间:</span>
                    <span>{format(new Date(contract.created_at), 'yyyy-MM-dd HH:mm')}</span>
                  </div>
                </div>

                {contract.remarks && (
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">备注:</span> {contract.remarks}
                  </div>
                )}

                {(contract.contract_original_url || contract.attachment_url) && (
                  <div className="flex gap-2">
                    {contract.contract_original_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(contract.contract_original_url, '_blank')}
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        原件
                      </Button>
                    )}
                    {contract.attachment_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(contract.attachment_url, '_blank')}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        附件
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <DirectConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="确认删除"
        description={`确定要删除选中的 ${selectedContracts.size} 个合同吗？此操作不可撤销。`}
        onConfirm={handleBatchDelete}
        loading={deleting}
      />
    </div>
    </MobileLayout>
  );
}