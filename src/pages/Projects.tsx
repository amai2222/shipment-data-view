import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Package, Loader2, Upload, Download, ChevronDown, ChevronRight, Link } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SupabaseStorage } from "@/utils/supabase";
import { Project, Location, Partner, ProjectPartner, PartnerChain } from "@/types";
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
    manager: "",
    loadingAddress: "",
    unloadingAddress: "",
  });
  
  // 合作链路配置状态
  const [selectedChains, setSelectedChains] = useState<{
    id: string; // 添加唯一ID
    dbId?: string; // 数据库原始ID
    chainName: string;
    description?: string;
    partners: {id: string, dbId?: string, partnerId: string, level: number, taxRate: number, calculationMethod: "tax" | "profit", profitRate?: number, partnerName?: string}[]; // 为partners也添加唯一ID
  }[]>([]);

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [loadedProjects, loadedLocations, loadedPartners] = await Promise.all([
        SupabaseStorage.getProjects(),
        SupabaseStorage.getLocations(),
        loadPartners()
      ]);
      setProjects(loadedProjects);
      setLocations(loadedLocations);
      
      // 加载所有项目的合作链路和合作方信息
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
      console.error('Error loading data:', error);
      toast({
        title: "数据加载失败",
        description: "无法从数据库加载数据，请重试。",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      const formattedData: Partner[] = data.map(item => ({
        id: item.id,
        name: item.name,
        taxRate: Number(item.tax_rate),
        createdAt: item.created_at,
      }));

      setPartners(formattedData);
      return formattedData;
    } catch (error) {
      console.error('Error loading partners:', error);
      return [];
    }
  };

  const loadPartnerChains = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('partner_chains')
        .select('*')
        .eq('project_id', projectId)
        .order('is_default', { ascending: false });

      if (error) throw error;

      const formattedData: PartnerChain[] = data.map(item => ({
        id: item.id,
        projectId: item.project_id,
        chainName: item.chain_name,
        description: item.description,
        isDefault: item.is_default,
        createdAt: item.created_at,
      }));

      return formattedData;
    } catch (error) {
      console.error('Error loading partner chains:', error);
      return [];
    }
  };

  const loadProjectPartners = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('project_partners')
        .select(`
          *,
          partners:partner_id (
            id,
            name
          ),
          partner_chains:chain_id (
            id,
            chain_name
          )
        `)
        .eq('project_id', projectId)
        .order('level', { ascending: true });

      if (error) throw error;

      const formattedData: ProjectPartner[] = data.map(item => ({
        id: item.id,
        projectId: item.project_id,
        partnerId: item.partner_id,
        chainId: item.chain_id,
        level: item.level,
        taxRate: Number(item.tax_rate),
        calculationMethod: (item.calculation_method as "tax" | "profit") || "tax",
        profitRate: item.profit_rate ? Number(item.profit_rate) : 0,
        createdAt: item.created_at,
        partnerName: item.partners?.name || '',
      }));

      return formattedData;
    } catch (error) {
      console.error('Error loading project partners:', error);
      return [];
    }
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: "",
      startDate: "",
      endDate: "",
      manager: "",
      loadingAddress: "",
      unloadingAddress: "",
    });
    setSelectedChains([]);
    setEditingProject(null);
  };

  // 打开编辑对话框
  const handleEdit = async (project: Project) => {
    setFormData({
      name: project.name,
      startDate: project.startDate,
      endDate: project.endDate,
      manager: project.manager,
      loadingAddress: project.loadingAddress,
      unloadingAddress: project.unloadingAddress,
    });
    setEditingProject(project);
    
    // 加载项目的合作链路
    const chains = partnerChains[project.id] || [];
    const partners = projectPartners[project.id] || [];
    
    // FIX: Preserve the original database ID for each chain and partner
    const chainsWithPartners = chains.map(chain => {
      const chainPartners = partners.filter(p => p.chainId === chain.id);
      return {
        // Use a stable temporary ID for React keys
        id: `chain-existing-${chain.id}`,
        // ADD: Store the original database ID
        dbId: chain.id,
        chainName: chain.chainName,
        description: chain.description,
        partners: chainPartners.map((pp, index) => ({
          // Use a stable temporary ID for React keys
          id: `partner-existing-${pp.id}`,
          // ADD: Store the original database ID
          dbId: pp.id,
          partnerId: pp.partnerId,
          level: pp.level,
          taxRate: pp.taxRate,
          calculationMethod: pp.calculationMethod || "tax",
          profitRate: pp.profitRate || 0,
          partnerName: pp.partnerName
        }))
      };
    });
    
    setSelectedChains(chainsWithPartners);
    setIsDialogOpen(true);
  };

  // 查找或创建地址
  const findOrCreateLocation = async (address: string) => {
    const existingLocation = locations.find(loc => loc.name === address);
    if (existingLocation) {
      return existingLocation;
    }
    
    // 创建新地址
    const newLocation = await SupabaseStorage.findOrCreateLocation(address);
    return newLocation;
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.startDate || !formData.endDate || !formData.manager || !formData.loadingAddress || !formData.unloadingAddress) {
      toast({
        title: "请填写所有字段",
        description: "所有字段都是必填的",
        variant: "destructive",
      });
      return;
    }

    // 验证每个链路至少有一个合作方
    for (let i = 0; i < selectedChains.length; i++) {
      if (selectedChains[i].partners.length === 0) {
        toast({
          title: `链路 ${i + 1} 缺少合作方`,
          description: "每个链路至少需要一个合作方",
          variant: "destructive",
        });
        return;
      }
      
      // 验证每个合作方都已选择
      for (let j = 0; j < selectedChains[i].partners.length; j++) {
        if (!selectedChains[i].partners[j].partnerId) {
          toast({
            title: `链路 ${i + 1} 第 ${j + 1} 个合作方未选择`,
            description: "请为所有合作方选择具体的合作方",
            variant: "destructive",
          });
          return;
        }
      }
    }

    try {
      setIsSubmitting(true);
      
      console.log('开始保存项目，选择的链路数量:', selectedChains.length);
      console.log('链路详情:', selectedChains);
      
      // 先确保装货和卸货地址存在于地址库中
      await findOrCreateLocation(formData.loadingAddress);
      await findOrCreateLocation(formData.unloadingAddress);

      let projectId: string;
      
      if (editingProject) {
        await SupabaseStorage.updateProject(editingProject.id, formData);
        projectId = editingProject.id;
      } else {
        const newProject = await SupabaseStorage.addProject(formData);
        projectId = newProject.id;
      }

      // FIX: Prepare the payload for the RPC with the correct IDs
      const chainsPayload = selectedChains.map((chain, index) => ({
        // Send the original DB ID for updates, or null for inserts
        id: chain.dbId,
        chainName: chain.chainName || `链路${index + 1}`,
        description: chain.description || '',
        // The first chain is the default one
        isDefault: index === 0,
        partners: chain.partners.map(p => ({
          // Send the original DB ID for updates, or null for inserts
          id: p.dbId,
          partnerId: p.partnerId,
          level: Number(p.level),
          taxRate: Number(p.taxRate),
          calculationMethod: p.calculationMethod || 'tax',
          profitRate: Number(p.profitRate || 0)
        }))
      }));

      console.log('调用 RPC 保存项目数据:', { projectId, formData, chainsPayload });

      const { error } = await supabase.rpc('save_project_with_chains', {
        project_id_in: projectId,
        project_data: formData,
        chains_data: chainsPayload
      });

      if (error) {
        console.error('RPC 调用失败:', error);
        throw error;
      }

      toast({
        title: editingProject ? "项目更新成功" : "项目创建成功",
        description: `项目 "${formData.name}" 已成功保存，相关地址已自动加入地址库`,
      });

      console.log('所有数据保存完成，重新加载数据');

      // 重新加载数据
      await loadData();
      
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('通过 RPC 保存项目时出错:', error);
      toast({
        title: "操作失败",
        description: "保存项目时发生错误，请重试",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 删除项目
  const handleDelete = async (id: string, name: string) => {
    try {
      await SupabaseStorage.deleteProject(id);
      await loadData();
      toast({
        title: "项目删除成功",
        description: `项目"${name}"已从列表中移除`,
      });
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: "删除失败",
        description: "删除项目时出现错误",
        variant: "destructive",
      });
    }
  };

  // 获取合作链路显示
  const getPartnerChainsDisplay = (projectId: string) => {
    const chains = partnerChains[projectId] || [];
    const partners = projectPartners[projectId] || [];
    
    if (chains.length === 0) return "无合作链路";
    
    return chains.map(chain => {
      const chainPartners = partners
        .filter(p => p.chainId === chain.id)
        .sort((a, b) => a.level - b.level);
      
      const chainDisplay = chainPartners
        .map(p => `${p.partnerName}(${p.level}级,${(p.taxRate * 100).toFixed(1)}%)`)
        .join(" → ");
      
      return `${chain.chainName}: ${chainDisplay || '无合作方'}`;
    }).join(" | ");
  };

  // 添加新合作链路
  const addNewChain = () => {
    setSelectedChains(prev => [...prev, {
      // A unique temporary ID for React keys
      id: `chain-new-${Date.now()}`,
      // FIX: A new chain has no dbId
      dbId: undefined,
      chainName: `链路${prev.length + 1}`,
      description: '',
      partners: []
    }]);
  };

  // 删除合作链路
  const removeChain = (chainIndex: number) => {
    setSelectedChains(prev => prev.filter((_, i) => i !== chainIndex));
  };

  // 添加合作方到链路
  const addPartnerToChain = (chainIndex: number) => {
    setSelectedChains(prev => prev.map((chain, i) => 
      i === chainIndex 
        ? {
            ...chain,
            partners: [...chain.partners, {
              // A unique temporary ID for React keys
              id: `partner-new-${Date.now()}`,
              // FIX: A new partner has no dbId
              dbId: undefined,
              partnerId: '',
              level: chain.partners.length + 1,
              taxRate: 0.03,
              calculationMethod: "tax" as "tax" | "profit",
              profitRate: 0
            }]
          }
        : chain
    ));
  };

  // 从链路中删除合作方
  const removePartnerFromChain = (chainIndex: number, partnerIndex: number) => {
    setSelectedChains(prev => prev.map((chain, i) => 
      i === chainIndex 
        ? {
            ...chain,
            partners: chain.partners.filter((_, pi) => pi !== partnerIndex)
          }
        : chain
    ));
  };

  // 更新合作方信息 - 添加详细的日志
  const updatePartnerInChain = (chainIndex: number, partnerIndex: number, field: string, value: any) => {
    console.log(`更新链路 ${chainIndex} 合作方 ${partnerIndex} 的 ${field} 为:`, value);
    
    setSelectedChains(prev => {
      const newChains = prev.map((chain, ci) => {
        if (ci === chainIndex) {
          const newPartners = chain.partners.map((partner, pi) => {
            if (pi === partnerIndex) {
              const updatedPartner = { ...partner, [field]: value };
              
              // 如果是选择合作方，同时更新合作方名称和默认税率
              if (field === 'partnerId') {
                const selectedPartner = partners.find(p => p.id === value);
                if (selectedPartner) {
                  updatedPartner.partnerName = selectedPartner.name;
                  // 如果当前是税点计算方法，更新税率为合作方的默认税率
                  if (updatedPartner.calculationMethod === "tax") {
                    updatedPartner.taxRate = selectedPartner.taxRate;
                  }
                }
              }
              
              console.log(`更新后的合作方信息:`, updatedPartner);
              return updatedPartner;
            }
            return partner;
          });
          
          return { ...chain, partners: newPartners };
        }
        return chain;
      });
      
      console.log(`更新后的所有链路:`, newChains);
      return newChains;
    });
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
      {/* 页面标题 */}
      <div className="bg-gradient-primary p-6 rounded-lg shadow-primary text-primary-foreground">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2 flex items-center">
              <Package className="mr-2" />
              项目管理
            </h1>
            <p className="opacity-90">管理所有物流项目的基本信息，支持多种合作链路配置</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                新增项目
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProject ? "编辑项目" : "新增项目"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 基本信息 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">项目基本信息</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">项目名称 *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
                        placeholder="请输入项目名称"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manager">项目负责人 *</Label>
                      <Input
                        id="manager"
                        value={formData.manager}
                        onChange={(e) => setFormData(prev => ({...prev, manager: e.target.value}))}
                        placeholder="请输入负责人姓名"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="startDate">开始日期 *</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData(prev => ({...prev, startDate: e.target.value}))}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">结束日期 *</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData(prev => ({...prev, endDate: e.target.value}))}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="loadingAddress">装货地址 *</Label>
                      <Input
                        id="loadingAddress"
                        value={formData.loadingAddress}
                        onChange={(e) => setFormData(prev => ({...prev, loadingAddress: e.target.value}))}
                        placeholder="请输入装货地址"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unloadingAddress">卸货地址 *</Label>
                      <Input
                        id="unloadingAddress"
                        value={formData.unloadingAddress}
                        onChange={(e) => setFormData(prev => ({...prev, unloadingAddress: e.target.value}))}
                        placeholder="请输入卸货地址"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>

                {/* 合作链路设置 */}
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">合作链路配置</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addNewChain}
                      disabled={isSubmitting}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      添加链路
                    </Button>
                  </div>
                  
                  {selectedChains.length > 0 ? (
                    <div className="space-y-4">
                      {selectedChains.map((chain, chainIndex) => (
                        <div key={chain.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Link className="h-4 w-4" />
                              <Input
                                value={chain.chainName}
                                onChange={(e) => {
                                  setSelectedChains(prev => prev.map((c, i) => 
                                    i === chainIndex ? { ...c, chainName: e.target.value } : c
                                  ));
                                }}
                                placeholder="链路名称"
                                className="w-40"
                                disabled={isSubmitting}
                              />
                              <Input
                                value={chain.description || ''}
                                onChange={(e) => {
                                  setSelectedChains(prev => prev.map((c, i) => 
                                    i === chainIndex ? { ...c, description: e.target.value } : c
                                  ));
                                }}
                                placeholder="链路描述（可选）"
                                className="flex-1"
                                disabled={isSubmitting}
                              />
                            </div>
                            <div className="flex space-x-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addPartnerToChain(chainIndex)}
                                disabled={isSubmitting}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                添加合作方
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeChain(chainIndex)}
                                disabled={isSubmitting}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          {/* 合作方列表 */}
                          {chain.partners.length > 0 ? (
                            <div className="space-y-2">
                               {chain.partners.map((partner, partnerIndex) => (
                                 <div key={partner.id} className="flex items-center space-x-2 p-2 bg-muted/30 rounded">
                                  <div className="flex-1">
                                    <select
                                      value={partner.partnerId}
                                      onChange={(e) => updatePartnerInChain(chainIndex, partnerIndex, 'partnerId', e.target.value)}
                                      className="w-full p-1 border rounded text-sm"
                                      disabled={isSubmitting}
                                    >
                                      <option value="">请选择合作方</option>
                                      {partners.map(p => (
                                        <option key={p.id} value={p.id}>
                                          {p.name} (默认税点: {(p.taxRate * 100).toFixed(2)}%)
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="w-16">
                                    <input
                                      type="number"
                                      min="1"
                                      value={partner.level}
                                      onChange={(e) => updatePartnerInChain(chainIndex, partnerIndex, 'level', parseInt(e.target.value) || 1)}
                                      className="w-full p-1 border rounded text-sm"
                                      placeholder="级别"
                                      disabled={isSubmitting}
                                    />
                                  </div>
                                   <div className="w-24">
                                     <select
                                       value={partner.calculationMethod}
                                       onChange={(e) => updatePartnerInChain(chainIndex, partnerIndex, 'calculationMethod', e.target.value)}
                                       className="w-full p-1 border rounded text-sm"
                                       disabled={isSubmitting}
                                     >
                                       <option value="tax">税点</option>
                                       <option value="profit">利润</option>
                                     </select>
                                   </div>
                                   <div className="w-20">
                                     <input
                                       type="number"
                                       step="0.001"
                                       min="0"
                                       max={partner.calculationMethod === "tax" ? "0.999" : "999"}
                                       value={partner.calculationMethod === "tax" ? partner.taxRate : (partner.profitRate || 0)}
                                       onChange={(e) => {
                                         const value = parseFloat(e.target.value) || 0;
                                         const field = partner.calculationMethod === "tax" ? 'taxRate' : 'profitRate';
                                         updatePartnerInChain(chainIndex, partnerIndex, field, value);
                                       }}
                                       className="w-full p-1 border rounded text-sm"
                                       placeholder={partner.calculationMethod === "tax" ? "税点" : "利润"}
                                       disabled={isSubmitting}
                                     />
                                   </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removePartnerFromChain(chainIndex, partnerIndex)}
                                    disabled={isSubmitting}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded">
                              暂无合作方，点击"添加合作方"开始配置
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded">
                      暂无合作链路，点击"添加链路"开始配置多种合作方案
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    取消
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {editingProject ? "更新中..." : "添加中..."}
                      </>
                    ) : (
                      editingProject ? "更新" : "添加"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 项目列表 */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>项目列表 ({projects.length} 个项目)</CardTitle>
          </div>
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
                  <TableHead className="min-w-60">合作链路</TableHead>
                  <TableHead className="w-32">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setExpandedProject(expandedProject === project.id ? null : project.id)}
                    >
                      <TableCell className="w-8">
                        {expandedProject === project.id ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell>{project.manager}</TableCell>
                      <TableCell>{project.loadingAddress}</TableCell>
                      <TableCell>{project.unloadingAddress}</TableCell>
                      <TableCell className="text-sm">
                        <div className="max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                          {getPartnerChainsDisplay(project.id)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(project);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(project.id, project.name);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    
                    {expandedProject === project.id && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30 p-0">
                          <div className="p-4 space-y-4">
                            <h4 className="font-semibold text-sm mb-3">项目详细信息</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">开始日期：</span>
                                <span className="font-medium">{project.startDate}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">结束日期：</span>
                                <span className="font-medium">{project.endDate}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">创建时间：</span>
                                <span className="font-medium">{new Date(project.createdAt).toLocaleDateString('zh-CN')}</span>
                              </div>
                            </div>
                            
                            {/* 合作链路详情 */}
                            <div className="space-y-3">
                              <h5 className="font-semibold text-sm">合作链路详情</h5>
                              {(partnerChains[project.id] || []).map((chain) => {
                                const chainPartners = (projectPartners[project.id] || [])
                                  .filter(p => p.chainId === chain.id)
                                  .sort((a, b) => a.level - b.level);
                                
                                return (
                                  <div key={chain.id} className="bg-background/50 rounded p-3 border">
                                    <div className="flex items-center justify-between mb-2">
                                      <h6 className="font-medium text-sm">
                                        {chain.chainName} 
                                        {chain.isDefault && <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded">默认</span>}
                                      </h6>
                                      {chain.description && (
                                        <span className="text-xs text-muted-foreground">{chain.description}</span>
                                      )}
                                    </div>
                                    {chainPartners.length > 0 ? (
                                      <div className="grid gap-2">
                                        {chainPartners.map((partner) => (
                                          <div key={partner.id} className="flex items-center justify-between text-xs">
                                            <span className="flex items-center">
                                              <span className="w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center mr-2 text-xs">
                                                {partner.level}
                                              </span>
                                              {partner.partnerName}
                                            </span>
                                            <span className="text-muted-foreground">
                                              {partner.calculationMethod === "tax" 
                                                ? `税点: ${(partner.taxRate * 100).toFixed(2)}%`
                                                : `利润: ${partner.profitRate}元`
                                              }
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-xs text-muted-foreground">暂无合作方</div>
                                    )}
                                  </div>
                                );
                              })}
                              {(!partnerChains[project.id] || partnerChains[project.id].length === 0) && (
                                <div className="text-xs text-muted-foreground">暂无合作链路配置</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}