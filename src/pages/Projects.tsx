// 文件路径: src/pages/Projects.tsx
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Package, Loader2, ChevronDown, ChevronRight, Link } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SupabaseStorage } from "@/utils/supabase";
import { Project, Location, Partner, ProjectPartner, PartnerChain } from "@/types";
import { supabase } from "@/integrations/supabase/client";

// 【全新组件】用于美化合作链路的横向展示
const PartnerChainDisplay = ({ partners }: { partners: ProjectPartner[] }) => {
  if (!partners || partners.length === 0) {
    return <div className="text-xs text-muted-foreground">暂无合作方</div>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {partners.map((partner, index) => (
        <React.Fragment key={partner.id}>
          <div className="flex flex-col items-center p-2 border rounded-md bg-primary text-primary-foreground shadow-sm">
            <span className="text-sm font-semibold">{partner.partnerName}</span>
            <span className="text-xs text-primary-foreground/80">
              {partner.calculationMethod === "tax"
                ? `税点: ${(partner.taxRate * 100).toFixed(1)}%`
                : `利润: ${partner.profitRate}元`
              }
            </span>
          </div>
          {index < partners.length - 1 && (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default function Projects() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerChains, setPartnerChains] = useState<{[key: string]: PartnerChain[]}>({});
  const [projectPartners, setProjectPartners] = useState<{[key: string]: ProjectPartner[]}>({});
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "", startDate: "", endDate: "", manager: "", loadingAddress: "", unloadingAddress: "",
  });

  const [selectedChains, setSelectedChains] = useState<{
    id: string; dbId?: string; chainName: string; description?: string;
    partners: {id: string, dbId?: string, partnerId: string, level: number, taxRate: number, calculationMethod: "tax" | "profit", profitRate?: number, partnerName?: string}[];
  }[]>([]);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [loadedProjects, loadedLocations, loadedPartners] = await Promise.all([
        SupabaseStorage.getProjects(),
        SupabaseStorage.getLocations(),
        loadPartners()
      ]);
      setProjects(loadedProjects);
      setLocations(loadedLocations);

      const allPartnerChains: {[key: string]: PartnerChain[]} = {};
      const allProjectPartners: {[key: string]: ProjectPartner[]} = {};

      for (const project of loadedProjects) {
        const chains = await loadPartnerChains(project.id);
        const partners = await loadProjectPartners(project.id);
        allPartnerChains[project.id] = chains;
        allProjectPartners[project.id] = partners;
      }

      setPartnerChains(allPartnerChains);
      setProjectPartners(allProjectPartners);

    } catch (error) {
      toast({ title: "数据加载失败", description: "无法从数据库加载数据，请重试。", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadPartners = async () => {
    try {
      const { data, error } = await supabase.from('partners').select('*').order('name', { ascending: true });
      if (error) throw error;
      const formattedData: Partner[] = data.map(item => ({
        id: item.id, name: item.name, taxRate: Number(item.tax_rate), createdAt: item.created_at,
      }));
      setPartners(formattedData);
      return formattedData;
    } catch (error) { console.error('Error loading partners:', error); return []; }
  };

  const loadPartnerChains = async (projectId: string) => {
    try {
      const { data, error } = await supabase.from('partner_chains').select('*').eq('project_id', projectId).order('is_default', { ascending: false });
      if (error) throw error;
      return data.map(item => ({
        id: item.id, projectId: item.project_id, chainName: item.chain_name,
        description: item.description, isDefault: item.is_default, createdAt: item.created_at,
      }));
    } catch (error) { console.error('Error loading partner chains:', error); return []; }
  };

  const loadProjectPartners = async (projectId: string) => {
    try {
      const { data, error } = await supabase.from('project_partners').select(`*, partners:partner_id(id, name)`).eq('project_id', projectId).order('level', { ascending: true });
      if (error) throw error;
      return data.map(item => ({
        id: item.id, projectId: item.project_id, partnerId: item.partner_id, chainId: item.chain_id,
        level: item.level, taxRate: Number(item.tax_rate),
        calculationMethod: (item.calculation_method as "tax" | "profit") || "tax",
        profitRate: item.profit_rate ? Number(item.profit_rate) : 0,
        createdAt: item.created_at, partnerName: item.partners?.name || '',
      }));
    } catch (error) { console.error('Error loading project partners:', error); return []; }
  };

  const resetForm = () => {
    setFormData({ name: "", startDate: "", endDate: "", manager: "", loadingAddress: "", unloadingAddress: "" });
    setSelectedChains([]);
    setEditingProject(null);
  };

  const handleEdit = (project: Project) => {
    setFormData({
      name: project.name, startDate: project.startDate, endDate: project.endDate,
      manager: project.manager, loadingAddress: project.loadingAddress, unloadingAddress: project.unloadingAddress,
    });
    setEditingProject(project);

    const chains = partnerChains[project.id] || [];
    const partners = projectPartners[project.id] || [];

    const chainsWithPartners = chains.map(chain => {
      const chainPartners = partners.filter(p => p.chainId === chain.id);
      return {
        id: `chain-existing-${chain.id}`, dbId: chain.id, chainName: chain.chainName,
        description: chain.description,
        partners: chainPartners.map((pp) => ({
          id: `partner-existing-${pp.id}`, dbId: pp.id, partnerId: pp.partnerId,
          level: pp.level, taxRate: pp.taxRate,
          calculationMethod: pp.calculationMethod || "tax",
          profitRate: pp.profitRate || 0, partnerName: pp.partnerName
        }))
      };
    });

    setSelectedChains(chainsWithPartners);
    setIsDialogOpen(true);
  };

  const findOrCreateLocation = async (address: string) => {
    const existingLocation = locations.find(loc => loc.name === address);
    if (existingLocation) return existingLocation;
    return await SupabaseStorage.findOrCreateLocation(address);
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
      await findOrCreateLocation(formData.loadingAddress);
      await findOrCreateLocation(formData.unloadingAddress);

      const projectId = editingProject ? editingProject.id : null;

      // ====================================================================
      // 【核心修复】高亮开始
      // 原因：这里将所有前端的驼峰命名（如startDate）转换为数据库期望的下划线命名（如start_date）
      // 这是解决“保存失败”BUG的关键。
      // ====================================================================
      const projectPayloadForDb = {
        name: formData.name,
        start_date: formData.startDate,
        end_date: formData.endDate,
        manager: formData.manager,
        loading_address: formData.loadingAddress,
        unloading_address: formData.unloadingAddress,
      };

      const chainsPayload = selectedChains.map((chain, index) => ({
        id: chain.dbId,
        chain_name: chain.chainName || `链路${index + 1}`,
        description: chain.description || '',
        is_default: index === 0,
        partners: chain.partners.map(p => ({
          id: p.dbId,
          partner_id: p.partnerId,
          level: Number(p.level),
          tax_rate: Number(p.taxRate) || 0,
          calculation_method: p.calculationMethod || 'tax',
          profit_rate: Number(p.profitRate) || 0
        }))
      }));
      // ====================================================================
      // 【核心修复】高亮结束
      // ====================================================================

      const { error } = await supabase.rpc('save_project_with_chains', {
        project_id_in: projectId,
        project_data: projectPayloadForDb,
        chains_data: chainsPayload
      });

      if (error) throw error;

      toast({ title: editingProject ? "项目更新成功" : "项目创建成功", description: `项目 "${formData.name}" 已成功保存。` });

      await loadData();
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
      await loadData();
      toast({ title: "项目删除成功", description: `项目"${name}"已从列表中移除` });
    } catch (error) {
      toast({ title: "删除失败", description: "删除项目时出现错误", variant: "destructive" });
    }
  };

  const addNewChain = () => {
    setSelectedChains(prev => [...prev, {
      id: `chain-new-${Date.now()}`, dbId: undefined,
      chainName: `链路${prev.length + 1}`, description: '', partners: []
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
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">加载项目数据中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-gradient-primary p-6 rounded-lg shadow-primary text-primary-foreground">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2 flex items-center"><Package className="mr-2" />项目管理</h1>
            <p className="opacity-90">管理所有物流项目的基本信息，支持多种合作链路配置</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild><Button variant="secondary" onClick={resetForm}><Plus className="h-4 w-4 mr-2" />新增项目</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingProject ? "编辑项目" : "新增项目"}</DialogTitle></DialogHeader>
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
                  </div>
                </div>
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between"><h3 className="text-lg font-medium">合作链路配置</h3><Button type="button" variant="outline" size="sm" onClick={addNewChain} disabled={isSubmitting}><Plus className="h-4 w-4 mr-1" />添加链路</Button></div>
                  {selectedChains.length > 0 ? (
                    <div className="space-y-4">
                      {selectedChains.map((chain, chainIndex) => (
                        <div key={chain.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2"><Link className="h-4 w-4" /><Input value={chain.chainName} onChange={(e) => setSelectedChains(prev => prev.map((c, i) => i === chainIndex ? { ...c, chainName: e.target.value } : c))} placeholder="链路名称" className="w-40" disabled={isSubmitting}/></div>
                            <div className="flex space-x-2"><Button type="button" variant="outline" size="sm" onClick={() => addPartnerToChain(chainIndex)} disabled={isSubmitting}><Plus className="h-4 w-4 mr-1" />添加合作方</Button><Button type="button" variant="outline" size="sm" onClick={() => removeChain(chainIndex)} disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button></div>
                          </div>
                          {chain.partners.length > 0 ? (
                            <div className="space-y-2">
                               {chain.partners.map((partner, partnerIndex) => (
                                <div key={partner.id} className="flex items-center space-x-2 p-2 bg-muted/30 rounded">
                                  <div className="flex-1"><select value={partner.partnerId} onChange={(e) => updatePartnerInChain(chainIndex, partnerIndex, 'partnerId', e.target.value)} className="w-full p-1 border rounded text-sm" disabled={isSubmitting}><option value="">请选择合作方</option>{partners.map(p => (<option key={p.id} value={p.id}>{p.name} (默认税点: {(p.taxRate * 100).toFixed(2)}%)</option>))}</select></div>
                                  <div className="w-16"><input type="number" min="1" value={partner.level} onChange={(e) => updatePartnerInChain(chainIndex, partnerIndex, 'level', parseInt(e.target.value) || 1)} className="w-full p-1 border rounded text-sm" placeholder="级别" disabled={isSubmitting}/></div>
                                  <div className="w-24"><select value={partner.calculationMethod} onChange={(e) => updatePartnerInChain(chainIndex, partnerIndex, 'calculationMethod', e.target.value)} className="w-full p-1 border rounded text-sm" disabled={isSubmitting}><option value="tax">税点</option><option value="profit">利润</option></select></div>
                                  <div className="w-20"><input type="number" step="0.001" min="0" max={partner.calculationMethod === "tax" ? "0.999" : "999"} value={partner.calculationMethod === "tax" ? partner.taxRate : (partner.profitRate || 0)} onChange={(e) => { const value = parseFloat(e.target.value) || 0; const field = partner.calculationMethod === "tax" ? 'taxRate' : 'profitRate'; updatePartnerInChain(chainIndex, partnerIndex, field, value); }} className="w-full p-1 border rounded text-sm" placeholder={partner.calculationMethod === "tax" ? "税点" : "利润"} disabled={isSubmitting}/></div>
                                  <Button type="button" variant="outline" size="sm" onClick={() => removePartnerFromChain(chainIndex, partnerIndex)} disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button>
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
        </div>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between"><CardTitle>项目列表 ({projects.length} 个项目)</CardTitle></div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="w-48">项目名称</TableHead>
                  <TableHead className="w-32">项目负责人</TableHead>
                  <TableHead className="w-40">装货地址</TableHead>
                  <TableHead className="w-40">卸货地址</TableHead>
                  <TableHead className="w-32">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <React.Fragment key={project.id}>
                    <TableRow className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setExpandedProject(expandedProject === project.id ? null : project.id)}>
                      <TableCell>{expandedProject === project.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell>{project.manager}</TableCell>
                      <TableCell>{project.loadingAddress}</TableCell>
                      <TableCell>{project.unloadingAddress}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(project); }}><Edit className="h-4 w-4" /></Button>
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(project.id, project.name); }}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    
                    {expandedProject === project.id && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/30 p-0">
                          <div className="p-4 space-y-4">
                            <h4 className="font-semibold text-sm mb-3">项目详细信息</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div><span className="text-muted-foreground">开始日期：</span><span className="font-medium">{project.startDate}</span></div>
                              <div><span className="text-muted-foreground">结束日期：</span><span className="font-medium">{project.endDate}</span></div>
                              <div><span className="text-muted-foreground">创建时间：</span><span className="font-medium">{new Date(project.createdAt).toLocaleDateString('zh-CN')}</span></div>
                            </div>
                            
                            <div className="space-y-4 pt-4 border-t">
                              <h5 className="font-semibold text-sm">合作链路详情</h5>
                              {(partnerChains[project.id] || []).map((chain) => {
                                const chainPartners = (projectPartners[project.id] || []).filter(p => p.chainId === chain.id).sort((a, b) => a.level - b.level);
                                return (
                                  <div key={chain.id} className="bg-background/50 rounded p-3 border">
                                    <div className="flex items-center justify-between mb-3">
                                      <h6 className="font-medium text-sm flex items-center">
                                        <Link className="h-4 w-4 mr-2 text-muted-foreground"/>
                                        {chain.chainName} 
                                        {chain.isDefault && <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">默认</span>}
                                      </h6>
                                      {chain.description && (<span className="text-xs text-muted-foreground">{chain.description}</span>)}
                                    </div>
                                    <PartnerChainDisplay partners={chainPartners} />
                                  </div>
                                );
                              })}
                              {(!partnerChains[project.id] || partnerChains[project.id].length === 0) && (
                                <div className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded">暂无合作链路配置</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
