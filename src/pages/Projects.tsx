// 文件路径: src/pages/Projects.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
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

// 扩展 Project 类型，使其可以直接包含链路和合作方
interface ProjectWithDetails extends Project {
  partnerChains: (PartnerChain & { partners: ProjectPartner[] })[];
}

// 美化合作链路的横向展示组件
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
              {partner.calculationMethod === "tax" ? `税点: ${(partner.taxRate * 100).toFixed(1)}%` : `利润: ${partner.profitRate}元`}
            </span>
          </div>
          {index < partners.length - 1 && (<ChevronRight className="h-5 w-5 text-muted-foreground" />)}
        </React.Fragment>
      ))}
    </div>
  );
};

export default function Projects() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<ProjectWithDetails[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithDetails | null>(null);
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
      // 【核心优化】一次性获取所有需要的数据
      const { data: projectsData, error: projectsError } = await supabase.rpc('get_projects_with_details');
      if (projectsError) throw projectsError;
      setProjects(projectsData || []);

      // 其他辅助数据可以并行加载
      const { data: locationsData } = await SupabaseStorage.getLocations();
      setLocations(locationsData);
      
      const { data: partnersData, error: partnersError } = await supabase.from('partners').select('*').order('name', { ascending: true });
      if(partnersError) throw partnersError;
      setPartners(partnersData.map(p => ({...p, taxRate: Number(p.tax_rate)})));

    } catch (error) {
      toast({ title: "数据加载失败", description: "无法从数据库加载数据，请重试。", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const resetForm = () => {
    setFormData({ name: "", startDate: "", endDate: "", manager: "", loadingAddress: "", unloadingAddress: "" });
    setSelectedChains([]);
    setEditingProject(null);
  };

  const handleEdit = (project: ProjectWithDetails) => {
    setFormData({
      name: project.name, startDate: project.startDate, endDate: project.endDate,
      manager: project.manager, loadingAddress: project.loadingAddress, unloadingAddress: project.unloadingAddress,
    });
    setEditingProject(project);
    
    const chainsWithPartners = project.partnerChains.map(chain => ({
      id: `chain-existing-${chain.id}`, dbId: chain.id, chainName: chain.chainName,
      description: chain.description,
      partners: chain.partners.map((pp) => ({
        id: `partner-existing-${pp.id}`, dbId: pp.id, partnerId: pp.partnerId,
        level: pp.level, taxRate: pp.taxRate,
        calculationMethod: pp.calculationMethod || "tax",
        profitRate: pp.profitRate || 0, partnerName: pp.partnerName
      }))
    }));
    
    setSelectedChains(chainsWithPartners);
    setIsDialogOpen(true);
  };

  const findOrCreateLocation = async (address: string) => {
    const existingLocation = locations.find(loc => loc.name === address);
    if (existingLocation) return existingLocation;
    const newLocation = await SupabaseStorage.findOrCreateLocation(address);
    setLocations(prev => [...prev, newLocation]); // 更新前端状态
    return newLocation;
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
      const projectPayloadForDb = {
        name: formData.name, start_date: formData.startDate, end_date: formData.endDate,
        manager: formData.manager, loading_address: formData.loadingAddress, unloading_address: formData.unloadingAddress,
      };

      const chainsPayload = selectedChains.map((chain, index) => ({
        id: chain.dbId, chain_name: chain.chainName || `链路${index + 1}`,
        description: chain.description || '', is_default: index === 0,
        partners: chain.partners.map(p => ({
          id: p.dbId, partner_id: p.partnerId, level: Number(p.level),
          tax_rate: Number(p.taxRate), calculation_method: p.calculationMethod || 'tax',
          profit_rate: Number(p.profitRate || 0)
        }))
      }));

      const { error } = await supabase.rpc('save_project_with_chains', {
        project_id_in: projectId, project_data: projectPayloadForDb, chains_data: chainsPayload
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

  const handleDelete = async (id: string, name: string) => { /* ... */ };
  const addNewChain = () => { /* ... */ };
  const removeChain = (chainIndex: number) => { /* ... */ };
  const addPartnerToChain = (chainIndex: number) => { /* ... */ };
  const removePartnerFromChain = (chainIndex: number, partnerIndex: number) => { /* ... */ };
  const updatePartnerInChain = (chainIndex: number, partnerIndex: number, field: string, value: any) => { /* ... */ };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">加载项目数据中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ... 页面标题和新增按钮 ... */}
      
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between"><CardTitle>项目列表 ({projects.length} 个项目)</CardTitle></div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead className="w-8"></TableHead><TableHead className="w-48">项目名称</TableHead><TableHead className="w-32">项目负责人</TableHead><TableHead className="w-40">装货地址</TableHead><TableHead className="w-40">卸货地址</TableHead><TableHead className="w-32">操作</TableHead></TableRow></TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <React.Fragment key={project.id}>
                    <TableRow className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setExpandedProject(expandedProject === project.id ? null : project.id)}>
                      <TableCell>{expandedProject === project.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell>{project.manager}</TableCell>
                      <TableCell>{project.loadingAddress}</TableCell>
                      <TableCell>{project.unloadingAddress}</TableCell>
                      <TableCell><div className="flex space-x-2"><Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(project); }}><Edit className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(project.id, project.name); }}><Trash2 className="h-4 w-4" /></Button></div></TableCell>
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
                              {(project.partnerChains || []).map((chain) => {
                                const sortedPartners = [...(chain.partners || [])].sort((a, b) => a.level - b.level);
                                return (
                                  <div key={chain.id} className="bg-background/50 rounded p-3 border">
                                    <div className="flex items-center justify-between mb-3">
                                      <h6 className="font-medium text-sm flex items-center"><Link className="h-4 w-4 mr-2 text-muted-foreground"/>{chain.chainName} {chain.isDefault && <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">默认</span>}</h6>
                                      {chain.description && (<span className="text-xs text-muted-foreground">{chain.description}</span>)}
                                    </div>
                                    <PartnerChainDisplay partners={sortedPartners} />
                                  </div>
                                );
                              })}
                              {(!project.partnerChains || project.partnerChains.length === 0) && (
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
