// 权限模板和预设组件

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  BookTemplate, 
  Plus, 
  Edit, 
  Copy, 
  Trash2, 
  Download,
  Upload,
  Save,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ROLES, MENU_PERMISSIONS, FUNCTION_PERMISSIONS } from '@/config/permissions';

interface PermissionTemplatesProps {
  roleTemplates: any[];
  onDataChange: () => void;
}

export function PermissionTemplates({ roleTemplates, onDataChange }: PermissionTemplatesProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  
  // 新模板表单
  const [newTemplate, setNewTemplate] = useState({
    role: '',
    name: '',
    description: '',
    color: 'bg-blue-500',
    menu_permissions: [] as string[],
    function_permissions: [] as string[]
  });

  // 创建新模板
  const handleCreateTemplate = async () => {
    if (!newTemplate.role || !newTemplate.name) {
      toast({
        title: "错误",
        description: "请填写角色和名称",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('role_permission_templates')
        .insert({
          role: newTemplate.role,
          name: newTemplate.name,
          description: newTemplate.description,
          color: newTemplate.color,
          menu_permissions: newTemplate.menu_permissions,
          function_permissions: newTemplate.function_permissions,
          project_permissions: [],
          data_permissions: [],
          is_system: false
        });

      if (error) throw error;

      toast({
        title: "成功",
        description: "权限模板创建成功",
      });

      setCreateDialogOpen(false);
      setNewTemplate({
        role: '',
        name: '',
        description: '',
        color: 'bg-blue-500',
        menu_permissions: [],
        function_permissions: []
      });
      onDataChange();
    } catch (error) {
      console.error('创建模板失败:', error);
      toast({
        title: "错误",
        description: "创建模板失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 复制模板
  const handleCopyTemplate = async (template: any) => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('role_permission_templates')
        .insert({
          role: template.role,
          name: `${template.name} (副本)`,
          description: `${template.description} - 副本`,
          color: template.color,
          menu_permissions: template.menu_permissions || [],
          function_permissions: template.function_permissions || [],
          project_permissions: template.project_permissions || [],
          data_permissions: template.data_permissions || [],
          is_system: false
        });

      if (error) throw error;

      toast({
        title: "成功",
        description: "模板复制成功",
      });

      onDataChange();
    } catch (error) {
      console.error('复制模板失败:', error);
      toast({
        title: "错误",
        description: "复制模板失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 删除模板
  const handleDeleteTemplate = async (templateId: string) => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('role_permission_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast({
        title: "成功",
        description: "模板删除成功",
      });

      onDataChange();
    } catch (error) {
      console.error('删除模板失败:', error);
      toast({
        title: "错误",
        description: "删除模板失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 导出模板配置
  const handleExportTemplates = () => {
    const exportData = roleTemplates.map(template => ({
      role: template.role,
      name: template.name,
      description: template.description,
      color: template.color,
      menu_permissions: template.menu_permissions || [],
      function_permissions: template.function_permissions || [],
      project_permissions: template.project_permissions || [],
      data_permissions: template.data_permissions || []
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `permission-templates-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "成功",
      description: "模板配置已导出",
    });
  };

  // 应用预设模板
  const applyPresetTemplate = async (presetType: string) => {
    const presets: Record<string, any> = {
      basic: {
        role: 'viewer',
        name: '基础查看者',
        description: '只能查看基本数据',
        color: 'bg-gray-500',
        menu_permissions: ['dashboard'],
        function_permissions: ['data.view']
      },
      business: {
        role: 'business',
        name: '业务人员',
        description: '负责业务录入和基本管理',
        color: 'bg-blue-500',
        menu_permissions: ['dashboard', 'business'],
        function_permissions: ['data.view', 'data.create', 'data.edit']
      },
      manager: {
        role: 'admin',
        name: '管理员',
        description: '拥有完整系统权限',
        color: 'bg-red-500',
        menu_permissions: Object.keys(MENU_PERMISSIONS).reduce((acc: string[], group) => {
          acc.push(group);
          MENU_PERMISSIONS[group].children?.forEach(item => acc.push(item.key));
          return acc;
        }, []),
        function_permissions: Object.keys(FUNCTION_PERMISSIONS).reduce((acc: string[], group) => {
          acc.push(group);
          FUNCTION_PERMISSIONS[group].children?.forEach(item => acc.push(item.key));
          return acc;
        }, [])
      }
    };

    const preset = presets[presetType];
    if (!preset) return;

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('role_permission_templates')
        .insert({
          ...preset,
          project_permissions: [],
          data_permissions: [],
          is_system: false
        });

      if (error) throw error;

      toast({
        title: "成功",
        description: `${preset.name}模板已应用`,
      });

      onDataChange();
    } catch (error) {
      console.error('应用预设模板失败:', error);
      toast({
        title: "错误",
        description: "应用预设模板失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 操作面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BookTemplate className="h-5 w-5 mr-2" />
            权限模板管理
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  创建模板
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>创建权限模板</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="role">角色</Label>
                    <select 
                      className="w-full border rounded-md px-3 py-2"
                      value={newTemplate.role}
                      onChange={(e) => setNewTemplate({...newTemplate, role: e.target.value})}
                    >
                      <option value="">选择角色</option>
                      {Object.entries(ROLES).map(([key, role]) => (
                        <option key={key} value={key}>{role.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <Label htmlFor="name">模板名称</Label>
                    <Input
                      id="name"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                      placeholder="输入模板名称"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="description">描述</Label>
                    <Input
                      id="description"
                      value={newTemplate.description}
                      onChange={(e) => setNewTemplate({...newTemplate, description: e.target.value})}
                      placeholder="输入模板描述"
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      取消
                    </Button>
                    <Button onClick={handleCreateTemplate} disabled={loading}>
                      <Save className="h-4 w-4 mr-2" />
                      保存
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="outline" onClick={handleExportTemplates}>
              <Download className="h-4 w-4 mr-2" />
              导出配置
            </Button>

            <Button variant="outline" disabled>
              <Upload className="h-4 w-4 mr-2" />
              导入配置
            </Button>
          </div>

          {/* 预设模板 */}
          <div>
            <h4 className="text-sm font-medium mb-3">预设模板</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Button 
                variant="outline" 
                onClick={() => applyPresetTemplate('basic')}
                disabled={loading}
              >
                基础查看者
              </Button>
              <Button 
                variant="outline" 
                onClick={() => applyPresetTemplate('business')}
                disabled={loading}
              >
                业务人员
              </Button>
              <Button 
                variant="outline" 
                onClick={() => applyPresetTemplate('manager')}
                disabled={loading}
              >
                系统管理员
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 模板列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roleTemplates.map(template => (
          <Card key={template.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`w-4 h-4 rounded-full ${template.color || 'bg-gray-500'} mr-2`} />
                  <CardTitle className="text-lg">{template.name || template.role}</CardTitle>
                </div>
                <Badge variant={template.is_system ? "default" : "secondary"}>
                  {template.is_system ? "系统" : "自定义"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {template.description || '无描述'}
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>菜单权限:</span>
                  <Badge variant="outline">
                    {template.menu_permissions?.length || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>功能权限:</span>
                  <Badge variant="outline">
                    {template.function_permissions?.length || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>项目权限:</span>
                  <Badge variant="outline">
                    {template.project_permissions?.length || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>数据权限:</span>
                  <Badge variant="outline">
                    {template.data_permissions?.length || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs font-medium border-t pt-2">
                  <span>总权限:</span>
                  <Badge variant="default">
                    {(template.menu_permissions?.length || 0) + 
                     (template.function_permissions?.length || 0) + 
                     (template.project_permissions?.length || 0) + 
                     (template.data_permissions?.length || 0)}
                  </Badge>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyTemplate(template)}
                  disabled={loading}
                >
                  <Copy className="h-3 w-3" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                >
                  <Edit className="h-3 w-3" />
                </Button>
                
                {!template.is_system && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="flex items-center">
                          <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
                          确认删除模板
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          您即将删除模板 "{template.name}"，此操作不可撤销。
                        </p>
                        <div className="flex justify-end space-x-2">
                          <Button variant="outline" size="sm">
                            取消
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => handleDeleteTemplate(template.id)}
                            disabled={loading}
                          >
                            确认删除
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}