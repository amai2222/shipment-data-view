import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MobileContractList } from '@/components/mobile/MobileContractList';
import { MobileContractDetail } from '@/components/mobile/MobileContractDetail';
import { MobileContractDashboard } from '@/components/mobile/MobileContractDashboard';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, Plus, FileText, Calendar, Building, DollarSign, List, Eye, ArrowLeft, BarChart3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  contract_number?: string;
  status?: 'active' | 'expired' | 'terminated' | 'archived';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  responsible_person?: string;
  department?: string;
  is_confidential?: boolean;
  last_accessed_at?: string;
  access_count?: number;
  contract_tag_relations?: Array<{
    contract_tags: {
      id: string;
      name: string;
      color: string;
    };
  }>;
}

interface ContractFormData {
  category: '行政合同' | '内部合同' | '业务合同';
  start_date: string;
  end_date: string;
  counterparty_company: string;
  our_company: string;
  contract_amount: string;
  remarks: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  responsible_person: string;
  department: string;
  is_confidential: boolean;
}

type ViewMode = 'dashboard' | 'list' | 'detail' | 'form';

export default function MobileContractManagement() {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [uploading, setUploading] = useState(false);
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

  const uploadFiles = async (contractData: { counterparty_company: string; our_company: string }) => {
    const uploadResults: { original?: string; attachment?: string } = {};

    if (selectedFiles.original) {
      const originalFile = selectedFiles.original;
      const fileExtension = originalFile.name.split('.').pop();
      const timestamp = Date.now();
      const fileName = `原件-${contractData.counterparty_company}-${contractData.our_company}-${timestamp}.${fileExtension}`;
      
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
      const timestamp = Date.now();
      const fileName = `附件-${contractData.counterparty_company}-${contractData.our_company}-${timestamp}.${fileExtension}`;
      
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

      setViewMode('list');
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

  const handleContractSelect = (contract: Contract) => {
    setSelectedContract(contract);
    setViewMode('detail');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedContract(null);
  };

  const handleEditContract = (contract: Contract) => {
    setFormData({
      category: contract.category,
      start_date: contract.start_date,
      end_date: contract.end_date,
      counterparty_company: contract.counterparty_company,
      our_company: contract.our_company,
      contract_amount: contract.contract_amount?.toString() || '',
      remarks: contract.remarks || '',
      priority: contract.priority || 'normal',
      responsible_person: contract.responsible_person || '',
      department: contract.department || '',
      is_confidential: contract.is_confidential || false
    });
    setViewMode('form');
  };

  const handleSearch = (filters: any) => {
    // 这里可以实现搜索逻辑
    console.log('Search filters:', filters);
  };

  const renderHeader = () => {
    switch (viewMode) {
      case 'detail':
        return (
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={handleBackToList}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回列表
            </Button>
            <h1 className="text-xl font-bold">合同详情</h1>
            <div className="w-16"></div>
          </div>
        );
      case 'form':
        return (
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={handleBackToList}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回列表
            </Button>
            <h1 className="text-xl font-bold">新增合同</h1>
            <div className="w-16"></div>
          </div>
        );
      default:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold">合同管理</h1>
              <Button size="sm" onClick={() => setViewMode('form')}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {/* 标签页导航 */}
            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="dashboard" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  仪表盘
                </TabsTrigger>
                <TabsTrigger value="list" className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  合同列表
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        );
    }
  };

  const renderContent = () => {
    switch (viewMode) {
      case 'dashboard':
        return <MobileContractDashboard />;
      case 'detail':
        return selectedContract ? (
          <MobileContractDetail
            contract={selectedContract}
            onBack={handleBackToList}
            onEdit={handleEditContract}
          />
        ) : null;
      case 'form':
        return (
          <Card>
            <CardContent className="p-4">
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
                    onClick={handleBackToList}
                    disabled={uploading}
                  >
                    取消
                  </Button>
                  <Button type="submit" disabled={uploading}>
                    {uploading ? '保存中...' : '保存'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        );
      default:
        return (
          <MobileContractList
            onContractSelect={handleContractSelect}
            onSearch={handleSearch}
          />
        );
    }
  };

  return (
    <MobileLayout>
      <div className="space-y-4">
        {renderHeader()}
        {renderContent()}
      </div>
    </MobileLayout>
  );
}