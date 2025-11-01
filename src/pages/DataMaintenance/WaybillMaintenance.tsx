// 运单维护页面
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  FileUp, 
  Trash2, 
  AlertTriangle, 
  Database, 
  Download,
  RefreshCw,
  Filter
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUnifiedPermissions } from "@/hooks/useUnifiedPermissions";
import { Project } from "@/types";
import { UpdateModeImportDialog } from '@/pages/BusinessEntry/components/UpdateModeImportDialog';
import { useExcelImportWithUpdate } from '@/pages/BusinessEntry/hooks/useExcelImportWithUpdate';
import TemplateMappingManager from '@/components/TemplateMappingManager';
import TemplateBasedImport from '@/components/TemplateBasedImport';
import { PageHeader } from "@/components/PageHeader";
import * as XLSX from 'xlsx';

export default function WaybillMaintenance() {
  const { toast } = useToast();
  const { hasButtonAccess, hasRole } = useUnifiedPermissions();
  const isAdmin = hasRole('admin');
  const isOperator = hasRole('operator');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [waybillCount, setWaybillCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'standard' | 'template' | 'mapping'>('standard');

  // Excel导入相关状态
  const {
    isImporting, 
    isImportModalOpen, 
    importStep, 
    importPreview, 
    importMode,
    setImportMode,
    importLogs, 
    importLogRef, 
    handleExcelImport, 
    executeFinalImport, 
    closeImportModal,
    approvedDuplicates,
    setApprovedDuplicates
  } = useExcelImportWithUpdate(() => { 
    loadWaybillCount(); 
  });

  // 检查权限
  if (!isAdmin && !isOperator) {
    return (
      <div className="container mx-auto p-4">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>权限不足</AlertTitle>
          <AlertDescription>
            您没有权限访问此页面。只有系统管理员和操作员可以访问数据维护功能。
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // 加载项目列表
  const loadProjects = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, start_date, end_date, project_status')
        .order('name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      console.error('加载项目失败:', error);
      toast({ title: "错误", description: "加载项目列表失败", variant: "destructive" });
    }
  }, [toast]);

  // 加载指定项目的运单数量
  const loadWaybillCount = useCallback(async () => {
    if (!selectedProject) {
      setWaybillCount(0);
      return;
    }

    setIsLoading(true);
    try {
      const { count, error } = await supabase
        .from('logistics_records')
        .select('*', { count: 'exact', head: true })
        .eq('project_name', selectedProject);

      if (error) throw error;
      setWaybillCount(count || 0);
    } catch (error: any) {
      console.error('加载运单数量失败:', error);
      toast({ title: "错误", description: "加载运单数量失败", variant: "destructive" });
      setWaybillCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProject, toast]);

  // 按项目删除运单
  const handleDeleteByProject = async () => {
    if (!selectedProject) {
      toast({ title: "错误", description: "请先选择要删除的项目", variant: "destructive" });
      return;
    }

    if (waybillCount === 0) {
      toast({ title: "提示", description: "该项目下没有运单记录", variant: "default" });
      return;
    }

    const confirmed = window.confirm(
      `确定要删除项目 "${selectedProject}" 下的所有运单记录吗？\n\n` +
      `这将删除 ${waybillCount} 条运单记录及其相关的成本记录。\n` +
      `此操作不可撤销！`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.rpc('delete_waybills_by_project', {
        p_project_name: selectedProject
      });

      if (error) throw error;

      toast({ 
        title: "删除成功", 
        description: `已成功删除项目 "${selectedProject}" 下的所有运单记录` 
      });

      // 重新加载运单数量
      await loadWaybillCount();
    } catch (error: any) {
      console.error('删除运单失败:', error);
      toast({ 
        title: "删除失败", 
        description: error.message || "删除运单记录时发生错误", 
        variant: "destructive" 
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // 下载模板
  const handleTemplateDownload = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      // 表头
      ['项目名称*', '合作链路(可选)', '司机姓名*', '车牌号*', '司机电话(可选)', '装货地点*', '卸货地点*', '装货日期*', '卸货日期(可选)', '装货数量*', '卸货数量(可选)', '运费金额(可选)', '额外费用(可选)', '运输类型(可选)', '备注(可选)', '其他平台名称(可选)', '其他平台运单号(可选)'],
      // 字段说明行
      ['必填(验重)', '可选', '必填(验重)', '必填(验重)', '可选', '必填(验重)', '必填(验重)', '必填(验重)', '可选', '必填(验重)', '可选', '可选', '可选', '可选(默认:实际运输)', '可选', '可选', '可选'],
      // 示例数据
      ['示例项目A', '默认链路', '张三', '京A12345', '13800138000', '北京仓库', '上海仓库', '2025-01-15', '2025-01-16', '10.5', '10.2', '5000', '200', '实际运输', '正常运输', '平台A,平台B', '运单1|运单2,运单3']
    ]);
    
    XLSX.utils.book_append_sheet(wb, ws, "运单导入模板");
    XLSX.writeFile(wb, "运单导入模板.xlsx");
  };

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadWaybillCount();
  }, [loadWaybillCount]);

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="运单维护"
        description="运单数据的导入、删除和维护管理"
        icon={Database}
        iconColor="text-blue-600"
      />
      
      <div className="mx-auto max-w-7xl">
        <Card className="shadow-sm">
          <CardContent className="p-6 space-y-6">
            {/* 权限提示 */}
            <Alert className="bg-blue-50 border-blue-200">
              <Database className="h-4 w-4" />
              <AlertTitle>数据维护权限</AlertTitle>
              <AlertDescription>
                您当前拥有数据维护权限，可以进行运单数据的导入和删除操作。
              </AlertDescription>
            </Alert>

            {/* 标签页 */}
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="standard">标准导入</TabsTrigger>
                <TabsTrigger value="template">模板导入</TabsTrigger>
                <TabsTrigger value="mapping">模板管理</TabsTrigger>
              </TabsList>

              {/* 标准导入标签页 */}
              <TabsContent value="standard" className="space-y-6">
                {/* 项目筛选器 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span className="font-medium">项目筛选</span>
              </div>
              <div className="flex items-center gap-4">
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="选择项目" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.name}>
                        <div className="flex items-center gap-2">
                          <span>{project.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {project.project_status || '进行中'}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadWaybillCount}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  刷新
                </Button>
              </div>
            </div>

            {/* 运单统计 */}
            {selectedProject && (
              <div className="p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">项目运单统计</h3>
                    <p className="text-sm text-muted-foreground">
                      项目: {selectedProject}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      {isLoading ? '...' : waybillCount}
                    </div>
                    <div className="text-sm text-muted-foreground">条运单记录</div>
                  </div>
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Excel导入 */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileUp className="h-8 w-8 text-green-600" />
                  <div>
                    <h3 className="font-semibold">Excel导入</h3>
                    <p className="text-sm text-muted-foreground">批量导入运单数据</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button onClick={handleTemplateDownload} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    模板
                  </Button>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleExcelImport}
                      disabled={isImporting}
                      className="hidden"
                      id="waybill-import"
                    />
                    <Button asChild disabled={isImporting}>
                      <label htmlFor="waybill-import" className="cursor-pointer">
                        {isImporting ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            处理中...
                          </>
                        ) : (
                          <>
                            <FileUp className="h-4 w-4 mr-2" />
                            导入
                          </>
                        )}
                      </label>
                    </Button>
                  </div>
                </div>
              </div>

              {/* 删除运单 */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Trash2 className="h-8 w-8 text-red-600" />
                  <div>
                    <h3 className="font-semibold">删除运单</h3>
                    <p className="text-sm text-muted-foreground">按项目删除所有运单记录</p>
                  </div>
                </div>
                <Button 
                  onClick={handleDeleteByProject}
                  disabled={!selectedProject || isDeleting || waybillCount === 0}
                  variant="destructive"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      删除中...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      删除
                    </>
                  )}
                </Button>
              </div>
            </div>

                {/* 危险操作警告 */}
                {selectedProject && waybillCount > 0 && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>危险操作警告</AlertTitle>
                    <AlertDescription>
                      删除操作将永久移除项目 "{selectedProject}" 下的所有 {waybillCount} 条运单记录及其相关数据。
                      此操作不可撤销，请谨慎操作！
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              {/* 模板导入标签页 */}
              <TabsContent value="template" className="space-y-6">
                <TemplateBasedImport />
              </TabsContent>

              {/* 模板管理标签页 */}
              <TabsContent value="mapping" className="space-y-6">
                <TemplateMappingManager />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      
      {/* 导入对话框 */}
      <UpdateModeImportDialog
          isOpen={isImportModalOpen}
          onClose={closeImportModal}
          importStep={importStep}
          importPreview={importPreview}
          importMode={importMode}
          setImportMode={setImportMode}
          importLogs={importLogs}
          importLogRef={importLogRef}
          onExecuteImport={executeFinalImport}
          approvedDuplicates={approvedDuplicates}
          setApprovedDuplicates={setApprovedDuplicates}
        />
    </div>
  );
}
