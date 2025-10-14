// 文件路径: src/pages/Projects.tsx
// 描述: 这是包含了所有修复的、最终的、完整的代码。

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Package, Loader2, ChevronDown, ChevronRight, Link, Settings, Search, Filter, X, ArrowUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SupabaseStorage } from "@/utils/supabase";
import { Project, Location, Partner, ProjectPartner, PartnerChain } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";

// 【核心类型】扩展 Project 类型，使其可以直接包含从后端一次性获取的嵌套数据
interface ProjectWithDetails extends Project {
  partnerChains: (PartnerChain & { partners: ProjectPartner[] })[];
}

// 【美化组件】用于美化合作链路的横向展示
const PartnerChainDisplay = ({ partners }: { partners: ProjectPartner[] }) => {
  if (!partners || partners.length === 0) {
    return <div className="text-xs text-muted-foreground">暂无合作方</div>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {partners.map((partner, index) => (
        <div key={partner.id} className="flex items-center">
          <div className="flex flex-col items-center p-2 border rounded-md bg-primary text-primary-foreground shadow-sm">
            <span className="text-sm font-semibold">{partner.partnerName}</span>
            <span className="text-xs text-primary-foreground/80">
              {partner.calculationMethod === "tax" ? `税点: ${(partner.taxRate * 100).toFixed(1)}%` : `利润: ${partner.profitRate}元`}
            </span>
          </div>
          {index < partners.length - 1 && (<ChevronRight className="h-5 w-5 text-muted-foreground mx-2" />)}
        </div>
      ))}
    </div>
  );
};

export default function Projects() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "", startDate: "", endDate: "", manager: "", loadingAddress: "", unloadingAddress: "",
    financeManager: "", plannedTotalTons: "", projectStatus: "进行中", cargoType: "货品",
    effectiveQuantityType: "min_value" as "min_value" | "loading" | "unloading",
  });
  
  const [selectedChains, setSelectedChains] = useState<{
    id: string; dbId?: string; chainName: string; description?: string; billingTypeId?: number | null;
    partners: {id: string, dbId?: string, partnerId: string, level: number, taxRate: number, calculationMethod: "tax" | "profit", profitRate?: number, partnerName?: string}[];
  }[]>([]);
  
  // 筛选和排序状态
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<"status" | "date">("status"); // 默认按状态排序

  // 优化：使用React Query缓存项目数据
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects-with-details'],
    queryFn: async () => {
      const { data: projectsData, error: projectsError } = await supabase.rpc('get_projects_with_details_fixed');
      if (projectsError) throw projectsError;

      const payload = (projectsData as any) || {};
      const rawProjects: any[] = Array.isArray(payload.projects) ? payload.projects : [];
      const chainsMap: Record<string, any[]> = payload.chains || {};
      const partnersMap: Record<string, any[]> = payload.partners || {};

      const composedProjects: ProjectWithDetails[] = rawProjects.map((p: any) => {
        const chains = (chainsMap[p.id] || []).map((c: any) => ({
          ...c,
          partners: (partnersMap[p.id] || []).filter((pp: any) => pp.chainId === c.id)
        }));
        return { ...p, partnerChains: chains } as ProjectWithDetails;
      });

      return composedProjects;
    },
    staleTime: 2 * 60 * 1000, // 2分钟缓存
    cacheTime: 10 * 60 * 1000, // 10分钟保留
    refetchOnWindowFocus: false,
  });

  // 优化：使用React Query缓存合作方数据
  const { data: partners = [] } = useQuery({
    queryKey: ['partners-list'],
    queryFn: async () => {
      const { data: partnersData, error: partnersError } = await supabase
        .from('partners')
        .select('*')
        .order('name', { ascending: true });

      if (partnersError) throw partnersError;
      return partnersData?.map(p => ({...p, taxRate: Number(p.tax_rate), createdAt: p.created_at})) || [];
    },
    staleTime: 10 * 60 * 1000, // 10分钟缓存（合作方变化不频繁）
    cacheTime: 30 * 60 * 1000,
  });

  // 筛选和排序逻辑
  const filteredAndSortedProjects = useMemo(() => {
    let filtered = [...projects];

    // 1. 搜索筛选
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project => 
        project.name.toLowerCase().includes(query) ||
        project.manager.toLowerCase().includes(query) ||
        (project.financeManager && project.financeManager.toLowerCase().includes(query)) ||
        project.loadingAddress.toLowerCase().includes(query) ||
        project.unloadingAddress.toLowerCase().includes(query)
      );
    }

    // 2. 状态筛选
    if (statusFilter !== "all") {
      filtered = filtered.filter(project => 
        (project as any).projectStatus === statusFilter
      );
    }

    // 3. 排序
    filtered.sort((a, b) => {
      if (sortBy === "status") {
        // 按状态排序：进行中 > 已暂停 > 已完成 > 已取消
        const statusOrder: Record<string, number> = {
          '进行中': 1,
          '已暂停': 2,
          '已完成': 3,
          '已取消': 4
        };
        const statusA = (a as any).projectStatus || '进行中';
        const statusB = (b as any).projectStatus || '进行中';
        const orderDiff = (statusOrder[statusA] || 999) - (statusOrder[statusB] || 999);
        
        // 如果状态相同，按创建时间降序（最新的在上面）
        if (orderDiff === 0) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return orderDiff;
      } else {
        // 按日期排序：最新的在上面
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  }, [projects, searchQuery, statusFilter, sortBy]);

  // 清除筛选器
  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
  };

  // 活动筛选器数量
  const activeFiltersCount = (searchQuery ? 1 : 0) + (statusFilter !== "all" ? 1 : 0);

  const isLoading = isLoadingProjects;

  const resetForm = useCallback(() => {
    setFormData({ name: "", startDate: "", endDate: "", manager: "", loadingAddress: "", unloadingAddress: "", financeManager: "", plannedTotalTons: "", projectStatus: "进行中", cargoType: "货品", effectiveQuantityType: "min_value" });
    setSelectedChains([]);
    setEditingProject(null);
  }, []);

  const handleEdit = (project: ProjectWithDetails) => {
    setFormData({
      name: project.name,
      startDate: project.startDate,
      endDate: project.endDate,
      manager: project.manager,
      loadingAddress: project.loadingAddress,
      unloadingAddress: project.unloadingAddress,
      financeManager: project.financeManager || "",
      plannedTotalTons: (project.plannedTotalTons != null ? String(project.plannedTotalTons) : ""),
      projectStatus: (project as any).projectStatus || "进行中",
      cargoType: (project as any).cargoType || "货品",
      effectiveQuantityType: (project as any).effectiveQuantityType || "min_value",
    });
    setEditingProject(project);
    
    const chainsWithPartners = (project.partnerChains || []).map(chain => ({
      id: `chain-existing-${chain.id}`, dbId: chain.id, chainName: chain.chainName,
      description: chain.description,
      billingTypeId: Number((chain as any).billing_type_id) || 1,
      partners: (chain.partners || []).map((pp) => ({
        id: `partner-existing-${pp.id}`, dbId: pp.id, partnerId: pp.partnerId,
        level: pp.level, taxRate: pp.taxRate,
        calculationMethod: pp.calculationMethod || "tax",
        profitRate: pp.profitRate || 0, partnerName: pp.partnerName
      }))
    }));
    
    setSelectedChains(chainsWithPartners);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.startDate || !formData.endDate || !formData.manager || !formData.loadingAddress || !formData.unloadingAddress) {
      toast({ title: "请填写所有基本信息字段", variant: "destructive" });
      return;
    }
    for (const chain of selectedChains) {
      if (chain.partners.length === 0) {
        toast({ title: `链路 "${chain.chainName}" 缺少合作方`, description: "每个链路至少需要一个合作方", variant: "destructive" });
        return;
      }
      for (const partner of chain.partners) {
        if (!partner.partnerId) {
          toast({ title: `链路 "${chain.chainName}" 中有未选择的合作方`, variant: "destructive" });
          return;
        }
      }
    }

    try {
      setIsSubmitting(true);
      
      const projectId = editingProject ? editingProject.id : null;
      
      const projectPayloadForDb = {
        name: formData.name,
        start_date: formData.startDate,
        end_date: formData.endDate,
        manager: formData.manager,
        loading_address: formData.loadingAddress,
        unloading_address: formData.unloadingAddress,
        finance_manager: formData.financeManager || null,
        planned_total_tons: formData.plannedTotalTons ? Number(formData.plannedTotalTons) : null,
        project_status: formData.projectStatus,
        cargo_type: formData.cargoType,
        effective_quantity_type: formData.effectiveQuantityType,
      };

      const chainsPayload = selectedChains.map((chain, index) => ({
        id: chain.dbId,
        chain_name: chain.chainName || `链路${index + 1}`,
        description: chain.description || '',
        is_default: index === 0,
        billing_type_id: chain.billingTypeId ?? 1,
        partners: chain.partners.map(p => ({
          id: p.dbId,
          partner_id: p.partnerId,
          level: Number(p.level),
          tax_rate: Number(p.taxRate) || 0,
          calculation_method: p.calculationMethod || 'tax',
          profit_rate: Number(p.profitRate) || 0
        }))
      }));

      const { error } = await supabase.rpc('save_project_with_chains_fixed', {
        project_id_in: projectId,
        project_data: projectPayloadForDb,
        chains_data: chainsPayload
      });

      if (error) throw error;
      toast({ title: editingProject ? "项目更新成功" : "项目创建成功", description: `项目 "${formData.name}" 已成功保存。` });

      // 优化：只刷新缓存，不重新加载
      await queryClient.invalidateQueries({ queryKey: ['projects-with-details'] });
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('通过 RPC 保存项目时出错:', error);
      toast({ title: "操作失败", description: "保存项目时发生错误，请检查控制台日志。", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await SupabaseStorage.deleteProject(id);
      // 优化：只刷新缓存
      await queryClient.invalidateQueries({ queryKey: ['projects-with-details'] });
      toast({ title: "项目删除成功", description: `项目"${name}"已从列表中移除` });
    } catch (error) {
      toast({ title: "删除失败", description: "删除项目时出现错误", variant: "destructive" });
    }
  };

  const handleStatusChange = async (projectId: string, newStatus: string, projectName: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ project_status: newStatus })
        .eq('id', projectId);

      if (error) throw error;

      toast({ 
        title: "状态更新成功", 
        description: `项目"${projectName}"状态已更新为"${newStatus}"` 
      });

      // 优化：只刷新缓存
      await queryClient.invalidateQueries({ queryKey: ['projects-with-details'] });
    } catch (error) {
      // KEEP: 错误日志保留
      console.error('更新项目状态失败:', error);
      toast({ 
        title: "状态更新失败", 
        description: "更新项目状态时出现错误", 
        variant: "destructive" 
      });
    }
  };
  
  const addNewChain = () => {
    setSelectedChains(prev => [...prev, {
      id: `chain-new-${Date.now()}`, dbId: undefined,
      chainName: `链路${prev.length + 1}`, description: '', billingTypeId: 1, partners: []
    }]);
  };

  const removeChain = (chainIndex: number) => { setSelectedChains(prev => prev.filter((_, i) => i !== chainIndex)); };

  const addPartnerToChain = (chainIndex: number) => {
    setSelectedChains(prev => prev.map((chain, i) => 
      i === chainIndex 
        ? { ...chain, partners: [...chain.partners, {
            id: `partner-new-${Date.now()}`, dbId: undefined, partnerId: '',
            level: chain.partners.length + 1, taxRate: 0.03,
            calculationMethod: "tax" as "tax" | "profit", profitRate: 0
          }] }
        : chain
    ));
  };

  const removePartnerFromChain = (chainIndex: number, partnerIndex: number) => {
    setSelectedChains(prev => prev.map((chain, i) => 
      i === chainIndex 
        ? { ...chain, partners: chain.partners.filter((_, pi) => pi !== partnerIndex) }
        : chain
    ));
  };

  const updatePartnerInChain = (chainIndex: number, partnerIndex: number, field: string, value: any) => {
    setSelectedChains(prev => prev.map((chain, ci) => {
      if (ci === chainIndex) {
        const newPartners = chain.partners.map((partner, pi) => {
          if (pi === partnerIndex) {
            const updatedPartner = { ...partner, [field]: value };
            if (field === 'partnerId') {
              const selectedPartner = partners.find(p => p.id === value);
              if (selectedPartner) {
                updatedPartner.partnerName = selectedPartner.name;
                if (updatedPartner.calculationMethod === "tax") {
                  updatedPartner.taxRate = selectedPartner.taxRate;
                }
              }
            }
            return updatedPartner;
          }
          return partner;
        });
        return { ...chain, partners: newPartners };
      }
      return chain;
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">加载项目数据中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader 
        title="项目管理" 
        description="管理所有物流项目的基本信息，支持多种合作链路配置"
        icon={Package}
        iconColor="text-purple-600"
      >
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild><Button onClick={resetForm}><Plus className="h-4 w-4 mr-2" />新增项目</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProject ? "编辑项目" : "新增项目"}</DialogTitle>
                <DialogDescription>
                  {editingProject ? "修改项目信息和合作链路配置" : "创建新项目并配置合作链路"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6 p-1">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">项目基本信息</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="name">项目名称 *</Label><Input id="name" value={formData.name} onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))} placeholder="请输入项目名称" disabled={isSubmitting}/></div>
                    <div className="space-y-2"><Label htmlFor="manager">项目负责人 *</Label><Input id="manager" value={formData.manager} onChange={(e) => setFormData(prev => ({...prev, manager: e.target.value}))} placeholder="请输入负责人姓名" disabled={isSubmitting}/></div>
                    <div className="space-y-2"><Label htmlFor="startDate">开始日期 *</Label><Input id="startDate" type="date" value={formData.startDate} onChange={(e) => setFormData(prev => ({...prev, startDate: e.target.value}))} disabled={isSubmitting}/></div>
                    <div className="space-y-2"><Label htmlFor="endDate">结束日期 *</Label><Input id="endDate" type="date" value={formData.endDate} onChange={(e) => setFormData(prev => ({...prev, endDate: e.target.value}))} disabled={isSubmitting}/></div>
                    <div className="space-y-2"><Label htmlFor="loadingAddress">装货地址 *</Label><Input id="loadingAddress" value={formData.loadingAddress} onChange={(e) => setFormData(prev => ({...prev, loadingAddress: e.target.value}))} placeholder="请输入装货地址" disabled={isSubmitting}/></div>
                    <div className="space-y-2"><Label htmlFor="unloadingAddress">卸货地址 *</Label><Input id="unloadingAddress" value={formData.unloadingAddress} onChange={(e) => setFormData(prev => ({...prev, unloadingAddress: e.target.value}))} placeholder="请输入卸货地址" disabled={isSubmitting}/></div>
                     <div className="space-y-2"><Label htmlFor="financeManager">财务负责人</Label><Input id="financeManager" value={formData.financeManager} onChange={(e) => setFormData(prev => ({...prev, financeManager: e.target.value}))} placeholder="请输入财务负责人" disabled={isSubmitting}/></div>
                     <div className="space-y-2"><Label htmlFor="plannedTotalTons">计划数</Label><Input id="plannedTotalTons" type="number" min="0" step="0.01" value={formData.plannedTotalTons} onChange={(e) => setFormData(prev => ({...prev, plannedTotalTons: e.target.value}))} placeholder="请输入计划数（纯数字）" disabled={isSubmitting}/></div>
                     <div className="space-y-2">
                       <Label htmlFor="projectStatus">项目状态</Label>
                       <Select value={formData.projectStatus} onValueChange={(value) => setFormData(prev => ({...prev, projectStatus: value}))} disabled={isSubmitting}>
                         <SelectTrigger>
                           <SelectValue placeholder="选择项目状态" />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="进行中">进行中</SelectItem>
                           <SelectItem value="已完成">已完成</SelectItem>
                           <SelectItem value="已暂停">已暂停</SelectItem>
                           <SelectItem value="已取消">已取消</SelectItem>
                         </SelectContent>
                       </Select>
                     </div>
                     <div className="space-y-2"><Label htmlFor="cargoType">货物名称</Label><Input id="cargoType" value={formData.cargoType} onChange={(e) => setFormData(prev => ({...prev, cargoType: e.target.value}))} placeholder="请输入货物名称" disabled={isSubmitting}/></div>
                     <div className="space-y-2">
                       <Label htmlFor="effectiveQuantityType">有效数量计算方式</Label>
                       <Select value={formData.effectiveQuantityType} onValueChange={(value: "min_value" | "loading" | "unloading") => setFormData(prev => ({...prev, effectiveQuantityType: value}))} disabled={isSubmitting}>
                         <SelectTrigger>
                           <SelectValue placeholder="选择有效数量计算方式" />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="min_value">装货数量和卸货数量取较小值</SelectItem>
                           <SelectItem value="loading">取装货数量</SelectItem>
                           <SelectItem value="unloading">取卸货数量</SelectItem>
                         </SelectContent>
                       </Select>
                     </div>
                  </div>
                </div>
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between"><h3 className="text-lg font-medium">合作链路配置</h3><Button type="button" variant="outline" size="sm" onClick={addNewChain} disabled={isSubmitting}><Plus className="h-4 w-4 mr-1" />添加链路</Button></div>
                  {selectedChains.length > 0 ? (
                    <div className="space-y-4">
                      {selectedChains.map((chain, chainIndex) => (
                        <div key={chain.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Link className="h-4 w-4" />
                              <Input value={chain.chainName} onChange={(e) => setSelectedChains(prev => prev.map((c, i) => i === chainIndex ? { ...c, chainName: e.target.value } : c))} placeholder="链路名称" className="w-40" disabled={isSubmitting}/>
                              <div className="flex items-center space-x-2">
                                <Label className="text-xs">计费模式</Label>
                                {/* 【【【最终修复】】】 */}
                                <select
                                  value={String(chain.billingTypeId ?? 1)}
                                  onChange={(e) => setSelectedChains(prev => prev.map((c, i) => i === chainIndex ? { ...c, billingTypeId: Number(e.target.value) } : c))}
                                  className="p-1 border rounded text-sm"
                                  disabled={isSubmitting}
                                >
                                  <option value="1">计吨</option>
                                  <option value="2">计车</option>
                                  <option value="3">计方</option>
                                </select>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <Button type="button" variant="outline" size="sm" onClick={() => addPartnerToChain(chainIndex)} disabled={isSubmitting}>
                                <Plus className="h-4 w-4 mr-1" />添加合作方
                              </Button>
                              <Button type="button" variant="outline" size="sm" onClick={() => removeChain(chainIndex)} disabled={isSubmitting} aria-label="删除合作链路">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {chain.partners.length > 0 ? (
                            <div className="space-y-2">
                               {chain.partners.map((partner, partnerIndex) => (
                                <div key={partner.id} className="flex items-center space-x-2 p-2 bg-muted/30 rounded">
                                  <div className="flex-1"><select value={partner.partnerId} onChange={(e) => updatePartnerInChain(chainIndex, partnerIndex, 'partnerId', e.target.value)} className="w-full p-1 border rounded text-sm" disabled={isSubmitting}><option value="">请选择合作方</option>{partners.map(p => (<option key={p.id} value={p.id}>{p.name} (默认税点: {(p.taxRate * 100).toFixed(2)}%)</option>))}</select></div>
                                  <div className="w-16"><input type="number" min="1" value={partner.level} onChange={(e) => updatePartnerInChain(chainIndex, partnerIndex, 'level', parseInt(e.target.value) || 1)} className="w-full p-1 border rounded text-sm" placeholder="级别" disabled={isSubmitting}/></div>
                                  <div className="w-24"><select value={partner.calculationMethod} onChange={(e) => updatePartnerInChain(chainIndex, partnerIndex, 'calculationMethod', e.target.value)} className="w-full p-1 border rounded text-sm" disabled={isSubmitting}><option value="tax">税点</option><option value="profit">利润</option></select></div>
                                  <div className="w-20"><input type="number" step="0.001" min="0" max={partner.calculationMethod === "tax" ? "0.999" : "999"} value={partner.calculationMethod === "tax" ? partner.taxRate : (partner.profitRate || 0)} onChange={(e) => { const value = parseFloat(e.target.value) || 0; const field = partner.calculationMethod === "tax" ? 'taxRate' : 'profitRate'; updatePartnerInChain(chainIndex, partnerIndex, field, value); }} className="w-full p-1 border rounded text-sm" placeholder={partner.calculationMethod === "tax" ? "税点" : "利润"} disabled={isSubmitting}/></div>
                                  <Button type="button" variant="outline" size="sm" onClick={() => removePartnerFromChain(chainIndex, partnerIndex)} disabled={isSubmitting} aria-label="从合作链路中移除合作方">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : ( <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded">暂无合作方，点击"添加合作方"开始配置</div> )}
                        </div>
                      ))}
                    </div>
                  ) : ( <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded">暂无合作链路，点击"添加链路"开始配置多种合作方案</div> )}
                </div>
                <div className="flex justify-end space-x-2"><Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>取消</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />{editingProject ? "更新中..." : "添加中..."}</>) : (editingProject ? "更新" : "添加")}</Button></div>
              </form>
            </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="space-y-6">
        <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>项目列表 (共 {projects.length} 个项目，显示 {filteredAndSortedProjects.length} 个)</CardTitle>
          </div>
          
          {/* 筛选和排序工具栏 */}
          <div className="mt-4 space-y-3">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索项目名称、负责人、地址..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* 筛选器和排序 */}
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="relative"
              >
                <Filter className="h-4 w-4 mr-2" />
                筛选
                {activeFiltersCount > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 min-w-[20px] px-1">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
              
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-48">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">按状态排序（默认）</SelectItem>
                  <SelectItem value="date">按创建时间排序</SelectItem>
                </SelectContent>
              </Select>
              
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                >
                  <X className="h-4 w-4 mr-2" />
                  清除筛选
                </Button>
              )}
              
              <span className="text-sm text-muted-foreground">
                显示 {filteredAndSortedProjects.length} / {projects.length} 条
              </span>
            </div>
            
            {/* 高级筛选面板 */}
            {showFilters && (
              <Card className="bg-muted/30">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>项目状态</Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部状态</SelectItem>
                          <SelectItem value="进行中">进行中</SelectItem>
                          <SelectItem value="已暂停">已暂停</SelectItem>
                          <SelectItem value="已完成">已完成</SelectItem>
                          <SelectItem value="已取消">已取消</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredAndSortedProjects.map((project) => (
              <Card key={project.id} className="border shadow-sm">
                <CardHeader 
                  className="cursor-pointer hover:bg-muted/50 transition-colors pb-3" 
                  onClick={() => setExpandedProject(expandedProject === project.id ? null : project.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {expandedProject === project.id ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                      <div>
                        <CardTitle className="text-lg">{project.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          负责人: {project.manager}
                          <span className="mx-2">·</span>
                          财务负责人: {project.financeManager || '—'}
                          <span className="mx-2">·</span>
                          计划数: {project.plannedTotalTons ?? '—'}
                          <span className="mx-2">·</span>
                          状态: <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            (project as any).projectStatus === '进行中' ? 'bg-green-100 text-green-800' :
                            (project as any).projectStatus === '已完成' ? 'bg-blue-100 text-blue-800' :
                            (project as any).projectStatus === '已暂停' ? 'bg-yellow-100 text-yellow-800' :
                            (project as any).projectStatus === '已取消' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {(project as any).projectStatus || '进行中'}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-right">
                        <p className="text-sm font-medium">{project.loadingAddress}</p>
                        <p className="text-xs text-muted-foreground">装货地址</p>
                      </div>
                      <div className="text-muted-foreground">→</div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{project.unloadingAddress}</p>
                        <p className="text-xs text-muted-foreground">卸货地址</p>
                      </div>
                       <div className="flex space-x-2 ml-4">
                         <div onClick={(e) => e.stopPropagation()}>
                           <Select 
                             value={(project as any).projectStatus || '进行中'} 
                             onValueChange={(value) => handleStatusChange(project.id, value, project.name)}
                           >
                             <SelectTrigger className="w-24 h-8">
                               <Settings className="h-3 w-3 mr-1" />
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="进行中">进行中</SelectItem>
                               <SelectItem value="已完成">已完成</SelectItem>
                               <SelectItem value="已暂停">已暂停</SelectItem>
                               <SelectItem value="已取消">已取消</SelectItem>
                             </SelectContent>
                           </Select>
                         </div>
                         <Button 
                           variant="outline" 
                           size="sm" 
                           onClick={(e) => { e.stopPropagation(); handleEdit(project); }}
                         >
                           <Edit className="h-4 w-4" />
                         </Button>
                         <ConfirmDialog 
                           title="确认删除"
                           description={`您确定要删除项目 "${project.name}" 吗？`}
                           onConfirm={() => handleDelete(project.id, project.name)}
                         >
                           <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                             <Trash2 className="h-4 w-4" />
                           </Button>
                         </ConfirmDialog>
                       </div>
                    </div>
                  </div>
                </CardHeader>
                
                {expandedProject === project.id && (
                  <CardContent className="pt-0">
                    <div className="border-t pt-4 space-y-4">
                      <h4 className="font-semibold text-sm mb-3">项目详细信息</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/30 p-3 rounded">
                        <div><span className="text-muted-foreground">开始日期：</span><span className="font-medium">{project.startDate}</span></div>
                        <div><span className="text-muted-foreground">结束日期：</span><span className="font-medium">{project.endDate}</span></div>
                        <div><span className="text-muted-foreground">创建时间：</span><span className="font-medium">{new Date(project.createdAt).toLocaleDateString('zh-CN')}</span></div>
                        <div><span className="text-muted-foreground">项目编号：</span><span className="font-medium font-mono">{project.autoCode || '未生成'}</span></div>
                      </div>
                      
                      <div className="space-y-4">
                        <h5 className="font-semibold text-sm">合作链路详情</h5>
                        {(project.partnerChains || []).map((chain) => {
                          const sortedPartners = [...(chain.partners || [])].sort((a, b) => a.level - b.level);
                          return (
                            <div key={chain.id} className="bg-background border rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h6 className="font-medium text-sm flex items-center">
                                  <Link className="h-4 w-4 mr-2 text-muted-foreground"/>
                                  {chain.chainName} 
                                  {chain.isDefault && <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">默认</span>}
                                </h6>
                                {chain.description && (<span className="text-xs text-muted-foreground">{chain.description}</span>)}
                              </div>
                              <PartnerChainDisplay partners={sortedPartners} />
                            </div>
                          );
                        })}
                        {(!project.partnerChains || project.partnerChains.length === 0) && (
                          <div className="text-xs text-muted-foreground text-center py-8 border border-dashed rounded">暂无合作链路配置</div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
            
            {projects.length === 0 && (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">暂无项目，点击"新增项目"开始创建</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
