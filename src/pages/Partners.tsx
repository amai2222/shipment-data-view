// 文件路径: src/pages/Partners.tsx
// 这是修复后的完整代码，请直接替换

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { supabase } from '@/integrations/supabase/client';
import { Partner } from '@/types';
import { Trash2, Edit, Plus, Download, Upload, Users, Eye, EyeOff } from 'lucide-react';
import * as XLSX from 'xlsx';
import { PageHeader } from '@/components/PageHeader';
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions';
import { useQueryClient } from '@tanstack/react-query';

// 扩展 Partner 类型，使其可以直接包含项目列表
interface PartnerWithProjects extends Partner {
  projects: {
    projectId: string;
    projectName: string;
    projectCode: string;
    level: number;
    taxRate: number;
  }[];
}

// 删除确认组件
const DeleteConfirmButton = ({ partnerId, partnerName, onConfirm }: { partnerId: string, partnerName: string, onConfirm: (id: string) => void }) => {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="确认删除"
        description={`您确定要删除合作方 "${partnerName}" 吗？相关的项目合作链路也会被影响，这个操作无法撤销。`}
        onConfirm={() => {
          onConfirm(partnerId);
          setOpen(false);
        }}
        variant="destructive"
      />
    </>
  );
};

export default function Partners() {
  const { hasDataAccess } = useUnifiedPermissions();
  const canViewSensitive = hasDataAccess('data.all');
  const queryClient = useQueryClient();
  const [partners, setPartners] = useState<PartnerWithProjects[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [activeTab, setActiveTab] = useState<'货主' | '合作商' | '资方' | '本公司'>('货主');
  const [showDetails, setShowDetails] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    fullName: '',
    bankAccount: '',
    bankName: '',
    branchName: '',
    taxNumber: '',
    companyAddress: '',
    taxRate: 0,
    partnerType: '货主' as '货主' | '合作商' | '资方' | '本公司'
  });

  const fetchPartners = useCallback(async () => {
    try {
      let data: any, error: any;
      if (canViewSensitive) {
        ({ data, error } = await supabase
          .from('partners')
          .select(`
            id, name, tax_rate, partner_type, created_at,
            partner_bank_details ( full_name, tax_number, company_address, bank_account, bank_name, branch_name ),
            project_partners (
              level, tax_rate,
              projects ( id, name, auto_code )
            )
          `)
          .order('name', { ascending: true }));
      } else {
        ({ data, error } = await supabase
          .from('partners')
          .select(`
            id, name, full_name, tax_rate, partner_type, created_at,
            project_partners (
              level,
              projects ( id, name, auto_code )
            )
          `)
          .order('name', { ascending: true }));
      }

      if (error) throw error;


      const formattedData: PartnerWithProjects[] = data.map(item => {
        // 处理partner_bank_details，可能是对象或数组
        const bankDetails = Array.isArray(item.partner_bank_details) 
          ? item.partner_bank_details[0] 
          : item.partner_bank_details;
        
        return {
          id: item.id,
          name: item.name,
          fullName: bankDetails?.full_name || '',
          bankAccount: bankDetails?.bank_account || '',
          bankName: bankDetails?.bank_name || '',
          branchName: bankDetails?.branch_name || '',
          taxNumber: bankDetails?.tax_number || '',
          companyAddress: bankDetails?.company_address || '',
          taxRate: Number(item.tax_rate),
          partnerType: item.partner_type || '货主',
          createdAt: item.created_at,
        projects: (item.project_partners || []).map((pp: any) => ({
          projectId: pp.projects.id,
          projectName: pp.projects.name,
          projectCode: pp.projects.auto_code,
          level: pp.level,
          taxRate: Number(pp.tax_rate)
        }))
        };
      });

      setPartners(formattedData);
    } catch (error) {
      console.error('获取合作方失败:', error);
      toast.error('获取合作方失败');
    }
  }, [canViewSensitive]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  // 【【【核心修复逻辑在这里】】】
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('请输入合作方名称'); return; }
    if (formData.taxRate < 0 || formData.taxRate >= 1) { toast.error('税点必须在0-1之间'); return; }

    try {
      // 获取当前登录用户的ID，这是新增操作所必需的
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('无法获取用户信息，请重新登录');
        return;
      }

      const partnerData = {
        user_id: user.id,
        name: formData.name.trim(),
        tax_rate: formData.taxRate,
        partner_type: formData.partnerType
      };

      if (editingPartner) {
        // 更新 partners 基本信息
        const { user_id, ...updateData } = partnerData;
        const { error: pErr } = await supabase.from('partners').update(updateData).eq('id', editingPartner.id);
        if (pErr) throw pErr;

        // 同步/创建扩展信息（受更严格的RLS保护）
        const bankPayload = {
          partner_id: editingPartner.id,
          full_name: formData.fullName.trim() || null,
          tax_number: formData.taxNumber.trim() || null,
          company_address: formData.companyAddress.trim() || null,
          bank_account: formData.bankAccount.trim() || null,
          bank_name: formData.bankName.trim() || null,
          branch_name: formData.branchName.trim() || null,
          user_id: user.id,
        };
        const { error: bErr } = await supabase.from('partner_bank_details').upsert(bankPayload, { onConflict: 'partner_id' });
        if (bErr) throw bErr;
        toast.success('合作方更新成功');
      } else {
        // 新增 partners 基本信息
        const { data: inserted, error: insErr } = await supabase
          .from('partners')
          .insert([partnerData])
          .select('id')
          .maybeSingle();
        if (insErr) throw insErr;

        if (inserted) {
          const hasExtendedInfo = !!(formData.fullName.trim() || formData.taxNumber.trim() || formData.companyAddress.trim() || formData.bankAccount.trim() || formData.bankName.trim() || formData.branchName.trim());
          if (hasExtendedInfo) {
            const { error: bErr } = await supabase.from('partner_bank_details').insert({
              partner_id: inserted.id,
              full_name: formData.fullName.trim() || null,
              tax_number: formData.taxNumber.trim() || null,
              company_address: formData.companyAddress.trim() || null,
              bank_account: formData.bankAccount.trim() || null,
              bank_name: formData.bankName.trim() || null,
              branch_name: formData.branchName.trim() || null,
              user_id: user.id,
            });
            if (bErr) throw bErr;
          }
        }
        toast.success('合作方添加成功');
      }

      closeDialog();
      fetchPartners(); // 重新加载数据
      // 使项目管理页面的合作方缓存失效，确保新合作方立即显示
      queryClient.invalidateQueries({ queryKey: ['partners-list'] });
    } catch (error: any) {
      console.error('保存合作方失败:', error);
      if (error.code === '23505') {
        toast.error('合作方名称已存在');
      } else {
        toast.error('保存合作方失败');
      }
    }
  };

  const handleEdit = async (partner: Partner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      fullName: partner.fullName || '',
      bankAccount: partner.bankAccount || '',
      bankName: partner.bankName || '',
      branchName: partner.branchName || '',
      taxNumber: partner.taxNumber || '',
      companyAddress: partner.companyAddress || '',
      taxRate: partner.taxRate,
      partnerType: partner.partnerType || '货主'
    });

    // 非财务/管理员用户可编辑但默认不展示，编辑时拉取自身可见的银行信息
    if (!canViewSensitive) {
      const { data: bd } = await supabase
        .from('partner_bank_details')
        .select('bank_account, bank_name, branch_name')
        .eq('partner_id', partner.id)
        .maybeSingle();
      if (bd) {
        setFormData(prev => ({
          ...prev,
          bankAccount: bd.bank_account || '',
          bankName: bd.bank_name || '',
          branchName: bd.branch_name || '',
        }));
      }
    }
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('partners').delete().eq('id', id);
      if (error) throw error;
      toast.success('合作方删除成功');
      fetchPartners(); // 重新加载数据
      // 使项目管理页面的合作方缓存失效，确保删除的合作方立即消失
      queryClient.invalidateQueries({ queryKey: ['partners-list'] });
    } catch (error) {
      console.error('删除合作方失败:', error);
      toast.error('删除合作方失败，可能该合作方仍被项目使用');
    }
  };

  const exportToExcel = () => {
    const exportData = partners.map(partner => ({
      '合作方名称': partner.name,
      ...(canViewSensitive ? { '默认税点': (partner.taxRate * 100).toFixed(2) + '%' } : {}),
      '关联项目数': partner.projects.length,
      '创建时间': new Date(partner.createdAt).toLocaleDateString(),
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '合作方数据');
    XLSX.writeFile(wb, `合作方数据_${new Date().toLocaleDateString()}.xlsx`);
    toast.success('导出成功');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        const importData = jsonData.map((row: any) => ({
          name: row['合作方名称'] || row['name'] || '',
          tax_rate: parseFloat((row['默认税点'] || row['税点'] || row['taxRate'] || '0').toString().replace('%', '')) / 100,
          user_id: supabase.auth.getUser() ? supabase.auth.getUser().then(u => u.data.user.id) : null // 导入时也尝试添加user_id
        }));
        const validData = importData.filter(item => item.name && item.tax_rate >= 0 && item.tax_rate < 1);
        if (validData.length === 0) { toast.error('没有有效的数据可导入'); return; }
        const existingNames = partners.map(p => p.name);
        const newData = validData.filter(item => !existingNames.includes(item.name));
        if (newData.length === 0) { toast.error('所有合作方已存在'); return; }
        // 确保 user_id 被正确解析
        const resolvedData = await Promise.all(newData.map(async item => ({...item, user_id: await item.user_id})));
        const { error } = await supabase.from('partners').insert(resolvedData);
        if (error) throw error;
        toast.success(`成功导入 ${newData.length} 个合作方`);
        fetchPartners();
      } catch (error) {
        console.error('导入失败:', error);
        toast.error('导入失败');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingPartner(null);
    setFormData({
      name: '',
      fullName: '',
      bankAccount: '',
      bankName: '',
      branchName: '',
      taxNumber: '',
      companyAddress: '',
      taxRate: 0,
      partnerType: '货主'
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader 
        title="合作方管理" 
        description="管理物流合作伙伴信息"
        icon={Users}
        iconColor="text-indigo-600"
      >
          <Button variant="outline" onClick={exportToExcel}><Download className="h-4 w-4 mr-2" />导出</Button>
          <label className="cursor-pointer">
            <Button variant="outline" asChild><span><Upload className="h-4 w-4 mr-2" />导入</span></Button>
            <input type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
          </label>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setIsDialogOpen(true); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />添加合作方</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingPartner ? '编辑合作方' : '添加合作方'}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">合作方名称 *</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="请输入合作方名称" />
                </div>
                <div>
                  <Label htmlFor="partnerType">合作方类型 *</Label>
                  <Select value={formData.partnerType} onValueChange={(value) => setFormData({ ...formData, partnerType: value as '货主' | '合作商' | '资方' | '本公司' })}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择合作方类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="货主">货主（支持层级管理）</SelectItem>
                      <SelectItem value="合作商">合作商</SelectItem>
                      <SelectItem value="资方">资方</SelectItem>
                      <SelectItem value="本公司">本公司</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="fullName">合作方全名</Label>
                  <Input id="fullName" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} placeholder="请输入合作方全名（选填）" />
                </div>
                <div>
                  <Label htmlFor="taxNumber">税号</Label>
                  <Input id="taxNumber" value={formData.taxNumber} onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })} placeholder="请输入税号（选填）" />
                </div>
                <div>
                  <Label htmlFor="companyAddress">公司地址</Label>
                  <Input id="companyAddress" value={formData.companyAddress} onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })} placeholder="请输入公司地址（选填）" />
                </div>
                <div>
                  <Label htmlFor="taxRate">默认税点 (0-1之间的小数) *</Label>
                  <Input id="taxRate" type="number" step="0.0001" min="0" max="0.9999" value={formData.taxRate} onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })} placeholder="例如：0.03 表示3%" />
                </div>
                <div>
                  <Label htmlFor="bankAccount">银行账户</Label>
                  <Input id="bankAccount" value={formData.bankAccount} onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })} placeholder="请输入银行账户（选填）" />
                </div>
                <div>
                  <Label htmlFor="bankName">开户行名称</Label>
                  <Input id="bankName" value={formData.bankName} onChange={(e) => setFormData({ ...formData, bankName: e.target.value })} placeholder="请输入开户行名称（选填）" />
                </div>
                <div>
                  <Label htmlFor="branchName">支行网点</Label>
                  <Input id="branchName" value={formData.branchName} onChange={(e) => setFormData({ ...formData, branchName: e.target.value })} placeholder="请输入支行网点（选填）" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeDialog}>取消</Button>
                  <Button type="submit">{editingPartner ? '更新' : '添加'}</Button>
                </div>
              </form>
            </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="space-y-6">

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as '货主' | '合作商' | '资方' | '本公司')} className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="grid w-auto grid-cols-4">
            <TabsTrigger value="货主">货主</TabsTrigger>
            <TabsTrigger value="合作商">合作商</TabsTrigger>
            <TabsTrigger value="资方">资方</TabsTrigger>
            <TabsTrigger value="本公司">本公司</TabsTrigger>
          </TabsList>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2"
          >
            {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showDetails ? '隐藏详细' : '显示详细'}
          </Button>
        </div>

        {(['货主', '合作商', '资方', '本公司'] as const).map((type) => (
          <TabsContent key={type} value={type}>
            <Card>
              <CardHeader>
                <CardTitle>{type}列表 ({partners.filter(p => p.partnerType === type).length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>合作方名称</TableHead>
                      {showDetails && <TableHead>合作方全名</TableHead>}
                      {showDetails && <TableHead>税号</TableHead>}
                      {showDetails && <TableHead>公司地址</TableHead>}
                      {showDetails && canViewSensitive && <TableHead>银行信息</TableHead>}
                      {canViewSensitive && <TableHead>默认税点</TableHead>}
                      <TableHead>关联项目</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partners.filter(p => p.partnerType === type).map((partner) => (
                      <TableRow key={partner.id}>
                        <TableCell className="font-medium">{partner.name}</TableCell>
                        {showDetails && (
                          <TableCell className="text-sm">
                            {partner.fullName || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                        )}
                        {showDetails && (
                          <TableCell className="text-sm">
                            {partner.taxNumber || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                        )}
                        {showDetails && (
                          <TableCell className="text-sm">
                            {partner.companyAddress || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                        )}
                        {showDetails && canViewSensitive && (
                          <TableCell className="text-sm">
                            <div className="space-y-1">
                              {partner.bankAccount && (
                                <div><span className="font-medium">账户:</span> {partner.bankAccount}</div>
                              )}
                              {partner.bankName && (
                                <div><span className="font-medium">银行:</span> {partner.bankName}</div>
                              )}
                              {partner.branchName && (
                                <div><span className="font-medium">网点:</span> {partner.branchName}</div>
                              )}
                              {!partner.bankAccount && !partner.bankName && !partner.branchName && (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                          </TableCell>
                        )}
                        {canViewSensitive && (
                          <TableCell>{(partner.taxRate * 100).toFixed(2)}%</TableCell>
                        )}
                  <TableCell>
                    <div className="max-w-xs space-y-1">
                      {partner.projects.length > 0 ? (
                        <>
                          {partner.projects.slice(0, 2).map((project) => (
                              <div key={project.projectId} className="text-xs flex items-center">
                                <span className="font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-md">{project.projectCode || 'N/A'}</span>
                                <span className="text-muted-foreground ml-2 truncate">{project.projectName}</span>
                                {canViewSensitive ? (
                                  <span className="ml-2 text-orange-600 whitespace-nowrap">(Lv.{project.level}, {(project.taxRate * 100).toFixed(1)}%)</span>
                                ) : (
                                  <span className="ml-2 text-orange-600 whitespace-nowrap">(Lv.{project.level})</span>
                                )}
                              </div>
                          ))}
                          {partner.projects.length > 2 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              ...以及其他 {partner.projects.length - 2} 个项目
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground text-xs">未关联项目</span>
                      )}
                    </div>
                  </TableCell>
                        <TableCell>{new Date(partner.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleEdit(partner)}><Edit className="h-4 w-4" /></Button>
                            <DeleteConfirmButton 
                              partnerId={partner.id}
                              partnerName={partner.name}
                              onConfirm={handleDelete}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {partners.filter(p => p.partnerType === type).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={showDetails ? (canViewSensitive ? 9 : 7) : (canViewSensitive ? 5 : 4)} className="text-center py-8 text-muted-foreground">
                          暂无{type}数据
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
      </div>
    </div>
  );
}
