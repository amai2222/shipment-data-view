import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Search, 
  Building2, 
  Edit,
  Trash2,
  X,
  Eye,
  EyeOff
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Partner } from "@/types";
import { useUnifiedPermissions } from "@/hooks/useUnifiedPermissions";
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { MobileCard } from '@/components/mobile/MobileCard';
import { useQueryClient } from '@tanstack/react-query';

interface PartnerWithProjects extends Partner {
  projects: {
    projectId: string;
    projectName: string;
    projectCode: string;
    level: number;
    taxRate: number;
  }[];
}

export default function MobilePartners() {
  const queryClient = useQueryClient();
  const [partners, setPartners] = useState<PartnerWithProjects[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSensitive, setShowSensitive] = useState(false);
  const [activeTab, setActiveTab] = useState<'货主' | '合作商' | '资方' | '本公司'>('货主');
  const [showDetails, setShowDetails] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    fullName: '',
    bankAccount: '',
    bankName: '',
    branchName: '',
    taxRate: 0,
    partnerType: '货主' as '货主' | '合作商' | '资方' | '本公司'
  });

  const { toast } = useToast();
  const { hasDataAccess } = useUnifiedPermissions();
  const canViewSensitive = hasDataAccess('data.all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
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

      const formattedData: PartnerWithProjects[] = data.map((item: any) => ({
        id: item.id,
        name: item.name,
        fullName: item.partner_bank_details?.[0]?.full_name || '',
        bankAccount: item.partner_bank_details?.[0]?.bank_account || '',
        bankName: item.partner_bank_details?.[0]?.bank_name || '',
        branchName: item.partner_bank_details?.[0]?.branch_name || '',
        taxNumber: item.partner_bank_details?.[0]?.tax_number || '',
        companyAddress: item.partner_bank_details?.[0]?.company_address || '',
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
      }));

      setPartners(formattedData);
    } catch (error) {
      console.error('Error loading partners:', error);
      toast({
        title: "加载失败",
        description: "无法加载合作方数据",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ 
      name: '',
      fullName: '',
      bankAccount: '',
      bankName: '',
      branchName: '',
      taxRate: 0,
      partnerType: '货主'
    });
    setEditingPartner(null);
  };

  const handleEdit = async (partner: Partner) => {
    setFormData({
      name: partner.name,
      fullName: partner.fullName || '',
      bankAccount: partner.bankAccount || '',
      bankName: partner.bankName || '',
      branchName: partner.branchName || '',
      taxRate: partner.taxRate,
      partnerType: partner.partnerType || '货主'
    });
    setEditingPartner(partner);
    setShowAddDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({ 
        title: "请输入合作方名称", 
        variant: "destructive" 
      });
      return;
    }
    
    if (formData.taxRate < 0 || formData.taxRate >= 1) {
      toast({ 
        title: "税点必须在0-1之间", 
        variant: "destructive" 
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "无法获取用户信息，请重新登录",
          variant: "destructive"
        });
        return;
      }

      const partnerData = {
        user_id: user.id,
        name: formData.name.trim(),
        full_name: formData.fullName.trim() || null,
        tax_rate: formData.taxRate,
        partner_type: formData.partnerType
      };

      if (editingPartner) {
        const { user_id, ...updateData } = partnerData;
        const { error: pErr } = await supabase
          .from('partners')
          .update(updateData)
          .eq('id', editingPartner.id);
        
        if (pErr) throw pErr;

        // 更新银行信息
        const bankPayload = {
          partner_id: editingPartner.id,
          bank_account: formData.bankAccount.trim() || null,
          bank_name: formData.bankName.trim() || null,
          branch_name: formData.branchName.trim() || null,
          user_id: user.id,
        };
        
        const { error: bErr } = await supabase
          .from('partner_bank_details')
          .upsert(bankPayload, { onConflict: 'partner_id' });
        
        if (bErr) throw bErr;
        toast({ title: "更新成功" });
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from('partners')
          .insert([partnerData])
          .select('id')
          .maybeSingle();
        
        if (insErr) throw insErr;

        if (inserted) {
          const hasBank = !!(formData.bankAccount.trim() || formData.bankName.trim() || formData.branchName.trim());
          if (hasBank) {
            const { error: bErr } = await supabase
              .from('partner_bank_details')
              .insert({
                partner_id: inserted.id,
                bank_account: formData.bankAccount.trim() || null,
                bank_name: formData.bankName.trim() || null,
                branch_name: formData.branchName.trim() || null,
                user_id: user.id,
              });
            if (bErr) throw bErr;
          }
        }
        toast({ title: "添加成功" });
      }
      
      await loadData();
      // 使项目管理页面的合作方缓存失效，确保新合作方立即显示
      queryClient.invalidateQueries({ queryKey: ['partners-list'] });
      setShowAddDialog(false);
      resetForm();
    } catch (error: any) {
      console.error('Error saving partner:', error);
      if (error.code === '23505') {
        toast({ title: "合作方名称已存在", variant: "destructive" });
      } else {
        toast({ title: "保存失败", variant: "destructive" });
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('partners')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({ title: "删除成功" });
      await loadData();
      // 使项目管理页面的合作方缓存失效，确保删除的合作方立即消失
      queryClient.invalidateQueries({ queryKey: ['partners-list'] });
    } catch (error) {
      console.error('Error deleting partner:', error);
      toast({ 
        title: "删除失败", 
        description: "可能该合作方仍被项目使用",
        variant: "destructive" 
      });
    } finally {
      setShowDeleteDialog(null);
    }
  };

  const filteredPartners = partners
    .filter(partner => partner.partnerType === activeTab)
    .filter(partner =>
      partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
    <MobileLayout>
      <div className="space-y-4">
        {/* 类型标签页 */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as '货主' | '合作商' | '资方' | '本公司')} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="货主" className="text-xs">货主</TabsTrigger>
            <TabsTrigger value="合作商" className="text-xs">合作商</TabsTrigger>
            <TabsTrigger value="资方" className="text-xs">资方</TabsTrigger>
            <TabsTrigger value="本公司" className="text-xs">本公司</TabsTrigger>
          </TabsList>
        
        {/* 搜索和添加 */}
        <div className="space-y-3 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索合作方名称..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-8 w-8 p-0"
                onClick={() => setSearchTerm('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2"
            >
              {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showDetails ? '隐藏' : '详细'}
            </Button>
            
            <Dialog open={showAddDialog} onOpenChange={(open) => {
              setShowAddDialog(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="flex-1">
                  <Plus className="h-4 w-4 mr-2" />
                  新增合作方
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingPartner ? '编辑合作方' : '新增合作方'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">合作方名称 *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="请输入合作方名称"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="partnerType">合作方类型 *</Label>
                    <Select 
                      value={formData.partnerType} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, partnerType: value as '货主' | '合作商' | '资方' | '本公司' }))}
                    >
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
                    <Input
                      id="fullName"
                      value={formData.fullName}
                      onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                      placeholder="请输入合作方全名（选填）"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="taxRate">默认税点 (0-1之间) *</Label>
                    <Input
                      id="taxRate"
                      type="number"
                      step="0.0001"
                      min="0"
                      max="0.9999"
                      value={formData.taxRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
                      placeholder="例如：0.03 表示3%"
                    />
                  </div>
                  
                  {canViewSensitive && (
                    <>
                      <div>
                        <Label htmlFor="bankAccount">银行账户</Label>
                        <Input
                          id="bankAccount"
                          value={formData.bankAccount}
                          onChange={(e) => setFormData(prev => ({ ...prev, bankAccount: e.target.value }))}
                          placeholder="请输入银行账户（选填）"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="bankName">开户行名称</Label>
                        <Input
                          id="bankName"
                          value={formData.bankName}
                          onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                          placeholder="请输入开户行名称（选填）"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="branchName">支行网点</Label>
                        <Input
                          id="branchName"
                          value={formData.branchName}
                          onChange={(e) => setFormData(prev => ({ ...prev, branchName: e.target.value }))}
                          placeholder="请输入支行网点（选填）"
                        />
                      </div>
                    </>
                  )}
                  
                  <div className="flex gap-2 pt-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowAddDialog(false)}
                      className="flex-1"
                    >
                      取消
                    </Button>
                    <Button type="submit" className="flex-1">
                      {editingPartner ? '更新' : '添加'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {canViewSensitive && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSensitive(!showSensitive)}
              >
                {showSensitive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>

        {/* 合作方列表 */}
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredPartners.length === 0 ? (
          <MobileCard>
            <CardContent className="text-center py-8">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchTerm ? "没有找到符合条件的合作方" : "暂无合作方数据"}
              </p>
            </CardContent>
          </MobileCard>
        ) : (
          <div className="space-y-3">
            {filteredPartners.map((partner) => (
              <MobileCard key={partner.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        {partner.name}
                      </CardTitle>
                      {showDetails && partner.fullName && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {partner.fullName}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(partner)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDeleteDialog(partner.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* 基础信息（始终显示） */}
                  {canViewSensitive && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">默认税点</span>
                      <Badge variant="secondary">
                        {(partner.taxRate * 100).toFixed(2)}%
                      </Badge>
                    </div>
                  )}

                  {/* 详细信息（可展开） */}
                  {showDetails && (
                    <div className="space-y-2">
                      {partner.taxNumber && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">税号：</span>
                          <span className="font-mono">{partner.taxNumber}</span>
                        </div>
                      )}
                      {partner.companyAddress && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">地址：</span>
                          <span>{partner.companyAddress}</span>
                        </div>
                      )}
                      {canViewSensitive && (partner.bankAccount || partner.bankName || partner.branchName) && (
                        <div className="text-sm space-y-1 pt-2 border-t border-border">
                          <span className="text-muted-foreground">银行信息</span>
                          {partner.bankAccount && (
                            <p><span className="font-medium">账户:</span> {partner.bankAccount}</p>
                          )}
                          {partner.bankName && (
                            <p><span className="font-medium">银行:</span> {partner.bankName}</p>
                          )}
                          {partner.branchName && (
                            <p><span className="font-medium">网点:</span> {partner.branchName}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {partner.projects.length > 0 && (
                    <div>
                      <span className="text-sm text-muted-foreground">关联项目</span>
                      <div className="space-y-1 mt-1">
                        {partner.projects.slice(0, 3).map((project) => (
                          <div key={project.projectId} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-xs">
                                {project.projectCode || 'N/A'}
                              </Badge>
                              <span className="truncate">{project.projectName}</span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <span>Lv.{project.level}</span>
                              {canViewSensitive && (
                                <span>({(project.taxRate * 100).toFixed(1)}%)</span>
                              )}
                            </div>
                          </div>
                        ))}
                        {partner.projects.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            还有 {partner.projects.length - 3} 个项目...
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                    创建时间：{new Date(partner.createdAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </MobileCard>
            ))}
          </div>
        )}

        {/* 删除确认对话框 */}
        <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                您确定要删除这个合作方吗？相关的项目合作链路也会被影响，此操作无法撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => showDeleteDialog && handleDelete(showDeleteDialog)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </Tabs>
      </div>
    </MobileLayout>
  );
}