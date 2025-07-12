import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Package, Loader2, Upload, Download, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SupabaseStorage } from "@/utils/supabase";
import { Project, Location, Partner, ProjectPartner } from "@/types";
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";

export default function Projects() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
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
  const [selectedPartners, setSelectedPartners] = useState<{partnerId: string, level: number, taxRate: number, partnerName?: string}[]>([]);

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
      
      // 加载所有项目的合作方信息
      const allProjectPartners: {[key: string]: ProjectPartner[]} = {};
      for (const project of loadedProjects) {
        const partners = await loadProjectPartners(project.id);
        allProjectPartners[project.id] = partners;
      }
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
        .order('level', { ascending: true });

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

  const loadProjectPartners = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('project_partners')
        .select(`
          *,
          partners:partner_id (
            id,
            name
          )
        `)
        .eq('project_id', projectId)
        .order('level', { ascending: true });

      if (error) throw error;

      const formattedData: ProjectPartner[] = data.map(item => ({
        id: item.id,
        projectId: item.project_id,
        partnerId: item.partner_id,
        level: item.level,
        taxRate: Number(item.tax_rate),
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
    setSelectedPartners([]);
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
    
    // 加载项目合作方
    const currentProjectPartners = projectPartners[project.id] || [];
    const partnersWithDetails = currentProjectPartners.map(pp => {
      const partner = partners.find(p => p.id === pp.partnerId);
      return {
        partnerId: pp.partnerId,
        level: pp.level,
        taxRate: pp.taxRate || partner?.taxRate || 0
      };
    });
    setSelectedPartners(partnersWithDetails);
    
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

    try {
      setIsSubmitting(true);
      
      // 先确保装货和卸货地址存在于地址库中
      await findOrCreateLocation(formData.loadingAddress);
      await findOrCreateLocation(formData.unloadingAddress);

      let projectId: string;
      
      if (editingProject) {
        await SupabaseStorage.updateProject(editingProject.id, formData);
        projectId = editingProject.id;
        
        // 删除现有的项目合作方关联
        await supabase
          .from('project_partners')
          .delete()
          .eq('project_id', projectId);
          
        toast({
          title: "项目更新成功",
          description: `项目 "${formData.name}" 已更新，相关地址已自动加入地址库`,
        });
      } else {
        const newProject = await SupabaseStorage.addProject(formData);
        projectId = newProject.id;
        toast({
          title: "项目创建成功",
          description: `项目 "${formData.name}" 已创建，相关地址已自动加入地址库`,
        });
      }

      // 保存项目合作方关联
      if (selectedPartners.length > 0) {
        const projectPartnersData = [];
        
        for (const sp of selectedPartners) {
          let partnerId = sp.partnerId;
          
          // 如果是新合作方（没有partnerId），先创建合作方记录
          if (!sp.partnerId && sp.partnerName) {
            const { data: newPartner, error: createPartnerError } = await supabase
              .from('partners')
              .insert({
                name: sp.partnerName,
                tax_rate: sp.taxRate
              })
              .select()
              .single();

            if (createPartnerError) {
              console.error('Error creating new partner:', createPartnerError);
              toast({
                title: "创建合作方失败",
                description: `无法创建合作方"${sp.partnerName}"`,
                variant: "destructive",
              });
              continue;
            }
            
            partnerId = newPartner.id;
          } else if (sp.partnerId) {
            // 更新现有合作方的税点信息
            const { error: partnerUpdateError } = await supabase
              .from('partners')
              .update({ tax_rate: sp.taxRate })
              .eq('id', sp.partnerId);

            if (partnerUpdateError) {
              console.error('Error updating partner tax rate:', partnerUpdateError);
            }
          }

          if (partnerId) {
            projectPartnersData.push({
              project_id: projectId,
              partner_id: partnerId,
              level: sp.level,
              tax_rate: sp.taxRate
            });
          }
        }

        if (projectPartnersData.length > 0) {
          const { error: partnersError } = await supabase
            .from('project_partners')
            .insert(projectPartnersData);

          if (partnersError) {
            console.error('Error saving project partners:', partnersError);
            toast({
              title: "合作方关联保存失败",
              description: "项目已保存，但合作方关联保存失败",
              variant: "destructive",
            });
          }
        }
      }

      // 重新加载数据
      await loadData();
      
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error saving project:', error);
      toast({
        title: "操作失败",
        description: "创建或更新项目时出现错误",
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

  // Excel导入功能
  const handleExcelImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        let importedCount = 0;
        let duplicateCount = 0;

        for (const row of jsonData as any[]) {
          // 检查是否已存在相同项目名称
          const existingProject = projects.find(p => p.name === row['项目名称']);
          
          if (existingProject) {
            duplicateCount++;
            continue;
          }

          const projectData = {
            name: row['项目名称'] || '',
            startDate: row['开始日期'] ? (row['开始日期'].toString().includes('T') ? row['开始日期'].toString().split('T')[0] : row['开始日期'].toString()) : '',
            endDate: row['结束日期'] ? (row['结束日期'].toString().includes('T') ? row['结束日期'].toString().split('T')[0] : row['结束日期'].toString()) : '',
            manager: row['项目负责人'] || '',
            loadingAddress: row['装货地址'] || '',
            unloadingAddress: row['卸货地址'] || '',
          };

          // 验证必填字段
          if (!projectData.name || !projectData.startDate || !projectData.endDate || !projectData.manager || !projectData.loadingAddress || !projectData.unloadingAddress) {
            console.warn(`跳过行：缺少必填字段`, row);
            continue;
          }

          // 确保装货和卸货地址存在于地址库中
          await findOrCreateLocation(projectData.loadingAddress);
          await findOrCreateLocation(projectData.unloadingAddress);

          await SupabaseStorage.addProject(projectData);
          importedCount++;
        }

        toast({
          title: "导入完成",
          description: `成功导入 ${importedCount} 个项目，跳过 ${duplicateCount} 个重复项目`,
        });

        await loadData();
      } catch (error) {
        console.error('Error importing Excel:', error);
        toast({
          title: "导入失败",
          description: "Excel文件格式不正确或数据有误",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
    
    // 清空文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Excel导出功能
  const handleExcelExport = () => {
    try {
      const exportData = projects.map(project => ({
        '项目名称': project.name,
        '开始日期': project.startDate,
        '结束日期': project.endDate,
        '项目负责人': project.manager,
        '装货地址': project.loadingAddress,
        '卸货地址': project.unloadingAddress,
        '创建时间': new Date(project.createdAt).toLocaleDateString()
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '项目列表');

      const fileName = `项目列表_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast({
        title: "导出成功",
        description: `已导出 ${projects.length} 个项目到 ${fileName}`,
      });
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast({
        title: "导出失败",
        description: "无法导出Excel文件",
        variant: "destructive",
      });
    }
  };

  // 获取合作链路显示
  const getPartnerChain = (projectId: string) => {
    const partners = projectPartners[projectId] || [];
    if (partners.length === 0) return "无合作方";
    
    return partners
      .sort((a, b) => a.level - b.level)
      .map(p => `${p.partnerName}(${p.level}级,${(p.taxRate * 100).toFixed(1)}%)`)
      .join(" → ");
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
            <p className="opacity-90">管理所有物流项目的基本信息（Supabase数据库）</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                新增项目
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProject ? "编辑项目" : "新增项目"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                  <Label htmlFor="startDate">项目开始日期 *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({...prev, startDate: e.target.value}))}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">项目结束日期 *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({...prev, endDate: e.target.value}))}
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
                  <Label htmlFor="loadingAddress">装货地址 *</Label>
                  <Input
                    id="loadingAddress"
                    value={formData.loadingAddress}
                    onChange={(e) => setFormData(prev => ({...prev, loadingAddress: e.target.value}))}
                    placeholder="请输入装货地址（自动加入地址库）"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unloadingAddress">卸货地址 *</Label>
                  <Input
                    id="unloadingAddress"
                    value={formData.unloadingAddress}
                    onChange={(e) => setFormData(prev => ({...prev, unloadingAddress: e.target.value}))}
                    placeholder="请输入卸货地址（自动加入地址库）"
                    disabled={isSubmitting}
                  />
                </div>
                
                {/* 合作方设置 */}
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">项目合作方设置</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const nextLevel = selectedPartners.length + 1;
                        // 添加新的合作方选项，默认为空选择状态
                        setSelectedPartners(prev => [...prev, {
                          partnerId: '', // 空的partnerId表示需要选择
                          level: nextLevel,
                          taxRate: 0.03 // 默认税点3%
                        }]);
                      }}
                      disabled={isSubmitting}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      添加合作方
                    </Button>
                  </div>
                  
                  {selectedPartners.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedPartners.map((sp, index) => {
                        const partner = partners.find(p => p.id === sp.partnerId);
                        return (
                           <div key={index} className="flex items-center space-x-2 p-2 border rounded">
                             <div className="flex-1">
                               <select
                                 value={sp.partnerId}
                                 onChange={(e) => {
                                   const partnerId = e.target.value;
                                    if (partnerId === 'new') {
                                      // 选择新增合作方
                                      setSelectedPartners(prev => prev.map((item, i) => 
                                        i === index ? {
                                          ...item,
                                          partnerId: '',
                                          partnerName: '',
                                          taxRate: 0.03
                                        } : item
                                      ));
                                   } else if (partnerId) {
                                     // 选择现有合作方
                                     const selectedPartner = partners.find(p => p.id === partnerId);
                                     if (selectedPartner) {
                                       setSelectedPartners(prev => prev.map((item, i) => 
                                         i === index ? {
                                           ...item,
                                           partnerId,
                                           partnerName: selectedPartner.name,
                                           taxRate: selectedPartner.taxRate
                                         } : item
                                       ));
                                     }
                                   } else {
                                     // 清空选择
                                     setSelectedPartners(prev => prev.map((item, i) => 
                                       i === index ? {
                                         ...item,
                                         partnerId: '',
                                         partnerName: '',
                                         taxRate: 0.03
                                       } : item
                                     ));
                                   }
                                 }}
                                 className="w-full p-1 border rounded text-sm"
                                 disabled={isSubmitting}
                               >
                                 <option value="">请选择合作方</option>
                                 {partners.filter(p => !selectedPartners.some((sp2, i2) => i2 !== index && sp2.partnerId === p.id)).map(p => (
                                   <option key={p.id} value={p.id}>
                                     {p.name} (默认税点: {(p.taxRate * 100).toFixed(2)}%)
                                   </option>
                                 ))}
                                 <option value="new">+ 新增合作方</option>
                               </select>
                               
                               {/* 如果选择了新增合作方，显示输入框 */}
                               {!sp.partnerId && (
                                 <input
                                   type="text"
                                   value={sp.partnerName || ''}
                                   onChange={(e) => {
                                     setSelectedPartners(prev => prev.map((item, i) => 
                                       i === index ? { ...item, partnerName: e.target.value } : item
                                     ));
                                   }}
                                   className="w-full p-1 border rounded text-sm mt-1"
                                   placeholder="输入新合作方名称"
                                   disabled={isSubmitting}
                                 />
                               )}
                             </div>
                            <div className="w-16">
                              <input
                                type="number"
                                min="1"
                                value={sp.level}
                                onChange={(e) => {
                                  const level = parseInt(e.target.value) || 1;
                                  setSelectedPartners(prev => prev.map((item, i) => 
                                    i === index ? { ...item, level } : item
                                  ));
                                }}
                                className="w-full p-1 border rounded text-sm"
                                placeholder="级别"
                                disabled={isSubmitting}
                              />
                            </div>
                            <div className="w-20">
                              <input
                                type="number"
                                step="0.0001"
                                min="0"
                                max="0.9999"
                                value={sp.taxRate}
                                onChange={(e) => {
                                  const taxRate = parseFloat(e.target.value) || 0;
                                  setSelectedPartners(prev => prev.map((item, i) => 
                                    i === index ? { ...item, taxRate } : item
                                  ));
                                }}
                                className="w-full p-1 border rounded text-sm"
                                placeholder="税点"
                                disabled={isSubmitting}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedPartners(prev => prev.filter((_, i) => i !== index));
                              }}
                              disabled={isSubmitting}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {selectedPartners.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded">
                      暂无合作方，点击"添加合作方"开始配置
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
                  <Button type="submit" className="bg-gradient-primary hover:bg-primary-hover" disabled={isSubmitting}>
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
            <div className="flex space-x-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelImport}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-2"
              >
                <Upload className="h-4 w-4" />
                <span>导入Excel</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleExcelExport}
                className="flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>导出Excel</span>
              </Button>
            </div>
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
                   <React.Fragment key={project.id}>
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
                           {getPartnerChain(project.id)}
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
                           <div className="p-4 space-y-3 animate-fade-in">
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
                                <div>
                                  <span className="text-muted-foreground">项目编码：</span>
                                  <span className="font-mono text-xs">{project.autoCode || '未生成'}</span>
                                </div>
                             </div>
                             
                             {(projectPartners[project.id] || []).length > 0 && (
                               <div className="mt-4">
                                 <h5 className="font-medium text-sm mb-2">合作方详情</h5>
                                 <div className="flex flex-wrap gap-2">
                                   {(projectPartners[project.id] || [])
                                     .sort((a, b) => a.level - b.level)
                                     .map((partner, index) => (
                                     <div key={partner.id} className="flex items-center bg-background border rounded-lg p-2">
                                       <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium mr-2">
                                         {partner.level}
                                       </div>
                                       <div className="text-sm">
                                         <div className="font-medium">{partner.partnerName}</div>
                                         <div className="text-xs text-muted-foreground">税点: {(partner.taxRate * 100).toFixed(2)}%</div>
                                       </div>
                                       {index < (projectPartners[project.id] || []).length - 1 && (
                                         <ChevronRight className="h-4 w-4 text-muted-foreground ml-2" />
                                       )}
                                     </div>
                                   ))}
                                 </div>
                               </div>
                             )}
                           </div>
                         </TableCell>
                       </TableRow>
                     )}
                   </React.Fragment>
                 ))}
                 {projects.length === 0 && (
                   <TableRow>
                     <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                       暂无项目数据，请点击"新增项目"开始添加
                     </TableCell>
                   </TableRow>
                 )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}