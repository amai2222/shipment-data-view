// 权限模板和预设组件

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
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
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  
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
        .insert([{
          role: newTemplate.role as any,
          name: newTemplate.name,
          description: newTemplate.description,
          color: newTemplate.color,
          menu_permissions: newTemplate.menu_permissions,
          function_permissions: newTemplate.function_permissions,
          project_permissions: [],
          data_permissions: [],
          is_system: false
        }]);

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

  // 更新模板
  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('role_permission_templates')
        .update({
          name: editingTemplate.name,
          description: editingTemplate.description,
          menu_permissions: editingTemplate.menu_permissions || [],
          function_permissions: editingTemplate.function_permissions || [],
          project_permissions: editingTemplate.project_permissions || [],
          data_permissions: editingTemplate.data_permissions || []
        })
        .eq('id', editingTemplate.id);

      if (error) throw error;

      toast({
        title: "成功",
        description: "权限模板更新成功",
      });

      setEditDialogOpen(false);
      setEditingTemplate(null);
      onDataChange();
    } catch (error) {
      console.error('更新模板失败:', error);
      toast({
        title: "错误",
        description: "更新模板失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 获取角色颜色
  const getRoleColor = (role: string) => {
    const colorMap: Record<string, string> = {
      admin: 'bg-red-500',
      finance: 'bg-green-500',
      business: 'bg-blue-500',
      operator: 'bg-yellow-500',
      partner: 'bg-purple-500',
      viewer: 'bg-gray-500'
    };
    return colorMap[role] || 'bg-gray-500';
  };

  // 应用预设模板 - 使用数据库中的角色模板
  const applyPresetTemplate = async (presetType: string) => {
    try {
      // 从数据库获取对应角色的模板，而不是使用硬编码
      const { data: roleTemplate, error: fetchError } = await supabase
        .from('role_permission_templates')
        .select('*')
        .eq('role', presetType)
        .single();

      if (fetchError || !roleTemplate) {
        toast({
          title: "模板不存在",
          description: `角色 ${presetType} 的模板不存在，请先创建该角色模板`,
          variant: "destructive"
        });
        return;
      }

      // 使用数据库中的模板数据
      const preset = {
        role: roleTemplate.role,
        name: roleTemplate.name || roleTemplate.role,
        description: roleTemplate.description || '',
        color: getRoleColor(roleTemplate.role),
        menu_permissions: roleTemplate.menu_permissions || [],
        function_permissions: roleTemplate.function_permissions || [],
        project_permissions: roleTemplate.project_permissions || [],
        data_permissions: roleTemplate.data_permissions || []
      };

      setLoading(true);
      
      const { error: insertError } = await supabase
        .from('role_permission_templates')
        .insert({
          ...preset,
          project_permissions: [],
          data_permissions: [],
          is_system: false
        });

      if (insertError) throw insertError;

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
                  onClick={() => {
                    setSelectedTemplate(template);
                    setEditingTemplate({...template});
                    setEditDialogOpen(true);
                  }}
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

      {/* 编辑模板对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑权限模板</DialogTitle>
            <DialogDescription>
              编辑 "{selectedTemplate?.name}" 的权限配置
            </DialogDescription>
          </DialogHeader>
          
          {editingTemplate && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="template-name">模板名称</Label>
                  <Input
                    id="template-name"
                    value={editingTemplate.name}
                    onChange={(e) => setEditingTemplate({...editingTemplate, name: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="template-role">角色</Label>
                  <Input
                    id="template-role"
                    value={editingTemplate.role}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="template-description">描述</Label>
                <Input
                  id="template-description"
                  value={editingTemplate.description || ''}
                  onChange={(e) => setEditingTemplate({...editingTemplate, description: e.target.value})}
                  placeholder="输入模板描述"
                />
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label>菜单权限 ({editingTemplate.menu_permissions?.length || 0})</Label>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-2">
                      {editingTemplate.menu_permissions?.map((permission: string) => (
                        <Badge key={permission} variant="outline" className="text-xs">
                          {permission}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div>
                  <Label>功能权限 ({editingTemplate.function_permissions?.length || 0})</Label>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-2">
                      {editingTemplate.function_permissions?.map((permission: string) => (
                        <Badge key={permission} variant="outline" className="text-xs">
                          {permission}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div>
                  <Label>项目权限 ({editingTemplate.project_permissions?.length || 0})</Label>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-2">
                      {editingTemplate.project_permissions?.map((permission: string) => (
                        <Badge key={permission} variant="outline" className="text-xs">
                          {permission}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div>
                  <Label>数据权限 ({editingTemplate.data_permissions?.length || 0})</Label>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-2">
                      {editingTemplate.data_permissions?.map((permission: string) => (
                        <Badge key={permission} variant="outline" className="text-xs">
                          {permission}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  取消
                </Button>
                <Button 
                  onClick={handleUpdateTemplate}
                  disabled={loading}
                >
                  <Save className="h-4 w-4 mr-2" />
                  保存更改
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}