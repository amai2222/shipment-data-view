import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { DirectConfirmDialog } from '@/components/ConfirmDialog';
import { FileViewerDialog } from '@/components/FileViewerDialog';
import { ContractNumberingManager } from '@/components/contracts/ContractNumberingManager';
import { ContractTagManager } from '@/components/contracts/ContractTagManager';
import { ContractPermissionManager } from '@/components/contracts/ContractPermissionManager';
import { ContractFileManager } from '@/components/contracts/ContractFileManager';
import { ContractAdvancedSearch } from '@/components/contracts/ContractAdvancedSearch';
import { ContractReminderSystem } from '@/components/contracts/ContractReminderSystem';
import { ContractAuditLogs } from '@/components/contracts/ContractAuditLogs';
import { ContractAdvancedPermissions } from '@/components/contracts/ContractAdvancedPermissions';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useFilterState } from '@/hooks/useFilterState';
import { Upload, Search, FileText, Filter, Plus, Download, Trash2, Settings, Tag, Hash, Shield, Archive, Bell, FileSearch, UserCheck } from 'lucide-react';
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
  // 新增字段
  contract_number?: string;
  status?: 'active' | 'expired' | 'terminated' | 'archived';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  responsible_person?: string;
  department?: string;
  is_confidential?: boolean;
  last_accessed_at?: string;
  access_count?: number;
}

interface ContractFormData {
  category: '行政合同' | '内部合同' | '业务合同';
  start_date: string;
  end_date: string;
  counterparty_company: string;
  our_company: string;
  contract_amount: string;
  remarks: string;
  // 新增字段
  priority: 'low' | 'normal' | 'high' | 'urgent';
  responsible_person: string;
  department: string;
  is_confidential: boolean;
}

interface ContractFilters {
  category: string;
  counterparty_company: string;
  our_company: string;
  start_date: string;
  end_date: string;
  // 新增筛选字段
  contract_number: string;
  status: string;
  priority: string;
  responsible_person: string;
  department: string;
  is_confidential: string;
}

const initialFilters: ContractFilters = {
  category: '',
  counterparty_company: '',
  our_company: '',
  start_date: '',
  end_date: '',
  contract_number: '',
  status: '',
  priority: '',
  responsible_person: '',
  department: '',
  is_confidential: ''
};

export default function ContractManagement() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [currentFileUrl, setCurrentFileUrl] = useState('');
  const [currentFileName, setCurrentFileName] = useState('');
  const [activeTab, setActiveTab] = useState<'contracts' | 'numbering' | 'tags' | 'permissions' | 'files' | 'reminders' | 'audit' | 'advanced-permissions'>('contracts');
  const [advancedFilters, setAdvancedFilters] = useState<any>(null);
  const [formData, setFormData] = useState<ContractFormData>({
    category: '业务合同',
    start_date: '',
    end_date: '',
    counterparty_company: '',
    our_company: '',
    contract_amount: '',
    remarks: '',
    priority: 'normal',
    responsible_person: '',
    department: '',
    is_confidential: false
  });
  const [selectedFiles, setSelectedFiles] = useState<{
    original?: File;
    attachment?: File;
  }>({});

  const { toast } = useToast();
  const { 
    uiFilters, 
    setUiFilters, 
    activeFilters, 
    isStale, 
    handleSearch, 
    handleClear 
  } = useFilterState<ContractFilters>(initialFilters);

  useEffect(() => {
    loadContracts();
  }, [activeFilters]);

  const loadContracts = async (customFilters?: any) => {
    try {
      setLoading(true);
      const filters = customFilters || activeFilters;
      
      let query = supabase
        .from('contracts')
        .select('*');

      // 基础筛选
      if (filters.category) {
        query = query.eq('category', filters.category as '行政合同' | '内部合同' | '业务合同');
      }
      if (filters.counterparty_company) {
        query = query.ilike('counterparty_company', `%${filters.counterparty_company}%`);
      }
      if (filters.our_company) {
        query = query.ilike('our_company', `%${filters.our_company}%`);
      }
      if (filters.start_date) {
        query = query.gte('start_date', filters.start_date);
      }
      if (filters.end_date) {
        query = query.lte('end_date', filters.end_date);
      }

      // 高级筛选
      if (filters.contract_number) {
        query = query.ilike('contract_number', `%${filters.contract_number}%`);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.priority) {
        query = query.eq('priority', filters.priority);
      }
      if (filters.department) {
        query = query.ilike('department', `%${filters.department}%`);
      }
      if (filters.responsible_person) {
        query = query.ilike('responsible_person', `%${filters.responsible_person}%`);
      }
      if (filters.amount_min) {
        query = query.gte('contract_amount', parseFloat(filters.amount_min));
      }
      if (filters.amount_max) {
        query = query.lte('contract_amount', parseFloat(filters.amount_max));
      }
      if (filters.start_date_from) {
        query = query.gte('start_date', filters.start_date_from);
      }
      if (filters.start_date_to) {
        query = query.lte('start_date', filters.start_date_to);
      }
      if (filters.end_date_from) {
        query = query.gte('end_date', filters.end_date_from);
      }
      if (filters.end_date_to) {
        query = query.lte('end_date', filters.end_date_to);
      }
      if (filters.created_date_from) {
        query = query.gte('created_at', filters.created_date_from);
      }
      if (filters.created_date_to) {
        query = query.lte('created_at', filters.created_date_to);
      }
      if (filters.is_confidential && filters.is_confidential !== '') {
        const isConfidential = filters.is_confidential === 'true';
        query = query.eq('is_confidential', isConfidential);
      }
      if (filters.has_files !== null && filters.has_files !== undefined) {
        if (filters.has_files) {
          query = query.or('contract_original_url.not.is.null,attachment_url.not.is.null');
        } else {
          query = query.and('contract_original_url.is.null,attachment_url.is.null');
        }
      }
      if (filters.is_expiring_soon) {
        const expiringDate = new Date();
        expiringDate.setDate(expiringDate.getDate() + (filters.expiring_days || 30));
        query = query.lte('end_date', expiringDate.toISOString().split('T')[0]);
      }

      // 关键词搜索
      if (filters.keyword) {
        query = query.or(`
          contract_number.ilike.%${filters.keyword}%,
          counterparty_company.ilike.%${filters.keyword}%,
          our_company.ilike.%${filters.keyword}%,
          responsible_person.ilike.%${filters.keyword}%,
          department.ilike.%${filters.keyword}%,
          remarks.ilike.%${filters.keyword}%
        `);
      }

      // 排序
      const sortBy = filters.sort_by || 'created_at';
      const sortOrder = filters.sort_order || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      const { data, error } = await query;

      if (error) throw error;
      
      setContracts(data || []);
    } catch (error) {
      console.error('Error loading contracts:', error);
      toast({
        title: "错误", 
        description: `加载合同列表失败: ${error.message || '未知错误'}`,
        variant: "destructive",
      });
      setContracts([]);
    } finally {
      setLoading(false);
    }
  };

  const uploadFiles = async (contractData: { counterparty_company: string; our_company: string }) => {
    const uploadResults: { original?: string; attachment?: string } = {};

    if (selectedFiles.original) {
      const originalFile = selectedFiles.original;
      const timestamp = Date.now();
      const customFileName = `原件-${contractData.counterparty_company}-${contractData.our_company}-${timestamp}`;
      
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
            customName: customFileName
          }
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Upload failed');
      uploadResults.original = data.urls[0];
    }

    if (selectedFiles.attachment) {
      const attachmentFile = selectedFiles.attachment;
      const timestamp = Date.now();
      const customFileName = `附件-${contractData.counterparty_company}-${contractData.our_company}-${timestamp}`;
      
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
            customName: customFileName
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
          priority: formData.priority,
          responsible_person: formData.responsible_person || null,
          department: formData.department || null,
          is_confidential: formData.is_confidential,
          status: 'active'
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
        remarks: '',
        priority: 'normal',
        responsible_person: '',
        department: '',
        is_confidential: false
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

  const handleViewFile = (fileUrl: string, fileName: string) => {
    setCurrentFileUrl(fileUrl);
    setCurrentFileName(fileName);
    setFileViewerOpen(true);
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = contracts.map(contract => contract.id);
      setSelectedContracts(new Set(allIds));
    } else {
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

  const handleAdvancedSearch = (filters: any) => {
    setAdvancedFilters(filters);
    loadContracts(filters);
  };

  const handleClearAdvancedSearch = () => {
    setAdvancedFilters(null);
    loadContracts();
  };

  const isAllSelected = contracts.length > 0 && selectedContracts.size === contracts.length;
  const isPartialSelected = selectedContracts.size > 0 && selectedContracts.size < contracts.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">合同管理</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === 'contracts' ? 'default' : 'outline'}
            onClick={() => setActiveTab('contracts')}
          >
            <FileText className="h-4 w-4 mr-2" />
            合同列表
          </Button>
          <Button
            variant={activeTab === 'numbering' ? 'default' : 'outline'}
            onClick={() => setActiveTab('numbering')}
          >
            <Hash className="h-4 w-4 mr-2" />
            编号管理
          </Button>
          <Button
            variant={activeTab === 'tags' ? 'default' : 'outline'}
            onClick={() => setActiveTab('tags')}
          >
            <Tag className="h-4 w-4 mr-2" />
            标签管理
          </Button>
          <Button
            variant={activeTab === 'permissions' ? 'default' : 'outline'}
            onClick={() => setActiveTab('permissions')}
          >
            <Shield className="h-4 w-4 mr-2" />
            权限管理
          </Button>
          <Button
            variant={activeTab === 'files' ? 'default' : 'outline'}
            onClick={() => setActiveTab('files')}
          >
            <Archive className="h-4 w-4 mr-2" />
            文件管理
          </Button>
          <Button
            variant={activeTab === 'reminders' ? 'default' : 'outline'}
            onClick={() => setActiveTab('reminders')}
          >
            <Bell className="h-4 w-4 mr-2" />
            到期提醒
          </Button>
          <Button
            variant={activeTab === 'audit' ? 'default' : 'outline'}
            onClick={() => setActiveTab('audit')}
          >
            <FileSearch className="h-4 w-4 mr-2" />
            审计日志
          </Button>
          <Button
            variant={activeTab === 'advanced-permissions' ? 'default' : 'outline'}
            onClick={() => setActiveTab('advanced-permissions')}
          >
            <UserCheck className="h-4 w-4 mr-2" />
            高级权限
          </Button>
        </div>
      </div>

      {activeTab === 'contracts' && (
        <>
          {/* 高级搜索组件 */}
          <ContractAdvancedSearch
            onSearch={handleAdvancedSearch}
            onClear={handleClearAdvancedSearch}
            initialFilters={advancedFilters}
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedContracts.size > 0 && (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              删除 ({selectedContracts.size})
            </Button>
          )}
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                新增合同
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>新增合同</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 表单内容 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <Label htmlFor="priority">优先级</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value: 'low' | 'normal' | 'high' | 'urgent') =>
                      setFormData(prev => ({ ...prev, priority: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">低</SelectItem>
                      <SelectItem value="normal">普通</SelectItem>
                      <SelectItem value="high">高</SelectItem>
                      <SelectItem value="urgent">紧急</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="responsible_person">负责人</Label>
                  <Input
                    id="responsible_person"
                    placeholder="输入负责人姓名"
                    value={formData.responsible_person}
                    onChange={(e) => setFormData(prev => ({ ...prev, responsible_person: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="department">部门</Label>
                  <Input
                    id="department"
                    placeholder="输入部门名称"
                    value={formData.department}
                    onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                  />
                </div>

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
              </div>

              <div>
                <Label htmlFor="remarks">备注</Label>
                <Textarea
                  id="remarks"
                  placeholder="输入备注信息"
                  value={formData.remarks}
                  onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_confidential"
                  checked={formData.is_confidential}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_confidential: checked as boolean }))}
                />
                <Label htmlFor="is_confidential">保密合同</Label>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>合同原件</Label>
                  <div className="mt-2">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                      onChange={(e) => handleFileSelect(e, 'original')}
                      className="hidden"
                      id="originalFileInput"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('originalFileInput')?.click()}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      选择合同原件
                    </Button>
                    {selectedFiles.original && (
                      <div className="mt-2 p-2 border rounded flex items-center justify-between">
                        <span className="text-sm">{selectedFiles.original.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile('original')}
                        >
                          删除
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label>附件</Label>
                  <div className="mt-2">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                      onChange={(e) => handleFileSelect(e, 'attachment')}
                      className="hidden"
                      id="attachmentFileInput"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('attachmentFileInput')?.click()}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      选择附件
                    </Button>
                    {selectedFiles.attachment && (
                      <div className="mt-2 p-2 border rounded flex items-center justify-between">
                        <span className="text-sm">{selectedFiles.attachment.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile('attachment')}
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
        </div>
      </div>


      {/* 合同列表 */}
      <Card>
        <CardHeader>
          <CardTitle>合同列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : contracts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无合同记录
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                      className={isPartialSelected ? "data-[state=checked]:bg-primary/50" : ""}
                    />
                  </TableHead>
                  <TableHead>合同编号</TableHead>
                  <TableHead>合同分类</TableHead>
                  <TableHead>对方公司</TableHead>
                  <TableHead>我方公司</TableHead>
                  <TableHead>合同期间</TableHead>
                  <TableHead>合同金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>优先级</TableHead>
                  <TableHead>负责人</TableHead>
                  <TableHead>标签</TableHead>
                  <TableHead>文件</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead>创建时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedContracts.has(contract.id)}
                        onCheckedChange={(checked) => handleSelectContract(contract.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-sm">
                        {contract.contract_number || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getCategoryBadgeVariant(contract.category)}>
                        {contract.category}
                      </Badge>
                    </TableCell>
                    <TableCell>{contract.counterparty_company}</TableCell>
                    <TableCell>{contract.our_company}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{format(new Date(contract.start_date), 'yyyy-MM-dd')}</div>
                        <div className="text-muted-foreground">至</div>
                        <div>{format(new Date(contract.end_date), 'yyyy-MM-dd')}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {contract.contract_amount ? `¥${contract.contract_amount.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        contract.status === 'active' ? 'default' :
                        contract.status === 'expired' ? 'destructive' :
                        contract.status === 'terminated' ? 'secondary' :
                        'outline'
                      }>
                        {contract.status === 'active' ? '有效' :
                         contract.status === 'expired' ? '已到期' :
                         contract.status === 'terminated' ? '已终止' :
                         contract.status === 'archived' ? '已归档' : '未知'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        contract.priority === 'urgent' ? 'destructive' :
                        contract.priority === 'high' ? 'default' :
                        contract.priority === 'normal' ? 'secondary' :
                        'outline'
                      }>
                        {contract.priority === 'urgent' ? '紧急' :
                         contract.priority === 'high' ? '高' :
                         contract.priority === 'normal' ? '普通' :
                         contract.priority === 'low' ? '低' : '普通'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {contract.responsible_person || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {contract.contract_tag_relations?.map((relation: any) => (
                          <Badge
                            key={relation.contract_tags.id}
                            variant="outline"
                            className="text-xs"
                            style={{ 
                              backgroundColor: relation.contract_tags.color + '20',
                              borderColor: relation.contract_tags.color,
                              color: relation.contract_tags.color
                            }}
                          >
                            {relation.contract_tags.name}
                          </Badge>
                        )) || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {/* 修改：恢复到直接打开链接 */}
                      <div className="flex gap-2">
                        {contract.contract_original_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (contract.contract_original_url) {
                                const fileName = `原件-${contract.counterparty_company}-${contract.our_company}`;
                                handleViewFile(contract.contract_original_url, fileName);
                              }
                            }}
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            原件
                          </Button>
                        )}
                        {contract.attachment_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (contract.attachment_url) {
                                const fileName = `附件-${contract.counterparty_company}-${contract.our_company}`;
                                handleViewFile(contract.attachment_url, fileName);
                              }
                            }}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            附件
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-32 truncate" title={contract.remarks || ''}>
                        {contract.remarks || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(contract.created_at), 'yyyy-MM-dd HH:mm')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </>
      )}

      {activeTab === 'numbering' && (
        <ContractNumberingManager onRuleUpdate={loadContracts} />
      )}

      {activeTab === 'tags' && (
        <ContractTagManager onTagUpdate={loadContracts} />
      )}

      {activeTab === 'permissions' && (
        <ContractPermissionManager onPermissionUpdate={loadContracts} />
      )}

      {activeTab === 'files' && (
        <ContractFileManager 
          contractId={selectedContracts.size === 1 ? Array.from(selectedContracts)[0] : ''} 
          contractNumber={contracts.find(c => selectedContracts.has(c.id))?.contract_number}
          onFileUpdate={loadContracts} 
        />
      )}

      {activeTab === 'reminders' && (
        <ContractReminderSystem onReminderUpdate={loadContracts} />
      )}

      {activeTab === 'audit' && (
        <ContractAuditLogs 
          contractId={selectedContracts.size === 1 ? Array.from(selectedContracts)[0] : undefined}
          onLogUpdate={loadContracts} 
        />
      )}

      {activeTab === 'advanced-permissions' && (
        <ContractAdvancedPermissions 
          contractId={selectedContracts.size === 1 ? Array.from(selectedContracts)[0] : undefined}
          onPermissionUpdate={loadContracts} 
        />
      )}

      <DirectConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="确认删除"
        description={`确定要删除选中的 ${selectedContracts.size} 个合同吗？此操作不可撤销。`}
        onConfirm={handleBatchDelete}
        loading={deleting}
      />

      <FileViewerDialog
        open={fileViewerOpen}
        onOpenChange={setFileViewerOpen}
        fileUrl={currentFileUrl}
        fileName={currentFileName}
      />
    </div>
  );
}
