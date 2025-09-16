import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  Copy,
  Shield,
  Users,
  Building2,
  Database,
  Key,
  UserPlus,
  Eye,
  EyeOff
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MENU_PERMISSIONS, FUNCTION_PERMISSIONS, PROJECT_PERMISSIONS, DATA_PERMISSIONS } from '@/config/permissions';
import { RoleTemplate } from '@/types/permissions';

interface PermissionTemplatesProps {
  roleTemplates: RoleTemplate[];
  onDataChange?: () => void;
}

interface PermissionCategory {
  key: string;
  label: string;
  permissions: string[];
  icon: React.ReactNode;
}

export function PermissionTemplates({ roleTemplates, onDataChange }: PermissionTemplatesProps) {
  const { toast } = useToast();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RoleTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    role: '',
    menu_permissions: [] as string[],
    function_permissions: [] as string[],
    project_permissions: [] as string[],
    data_permissions: [] as string[]
  });
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());

  const permissionCategories: PermissionCategory[] = [
    {
      key: 'menu_permissions',
      label: '菜单权限',
      permissions: MENU_PERMISSIONS,
      icon: <Shield className="h-4 w-4" />
    },
    {
      key: 'function_permissions',
      label: '功能权限',
      permissions: FUNCTION_PERMISSIONS,
      icon: <Settings className="h-4 w-4" />
    },
    {
      key: 'project_permissions',
      label: '项目权限',
      permissions: PROJECT_PERMISSIONS,
      icon: <Building2 className="h-4 w-4" />
    },
    {
      key: 'data_permissions',
      label: '数据权限',
      permissions: DATA_PERMISSIONS,
      icon: <Database className="h-4 w-4" />
    }
  ];

  const handleCreateTemplate = async () => {
    if (!newTemplate.role.trim()) {
      toast({
        title: "错误",
        description: "请输入角色名称",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('role_templates')
        .insert([{
          role: newTemplate.role,
          menu_permissions: newTemplate.menu_permissions,
          function_permissions: newTemplate.function_permissions,
          project_permissions: newTemplate.project_permissions,
          data_permissions: newTemplate.data_permissions
        }]);

      if (error) throw error;

      toast({
        title: "成功",
        description: "权限模板创建成功"
      });

      setShowCreateDialog(false);
      setNewTemplate({
        role: '',
        menu_permissions: [],
        function_permissions: [],
        project_permissions: [],
        data_permissions: []
      });
      onDataChange?.();
    } catch (error) {
      console.error('创建权限模板失败:', error);
      toast({
        title: "错误",
        description: "创建权限模板失败",
        variant: "destructive"
      });
    }
  };

  const handleEditTemplate = async () => {
    if (!editingTemplate) return;

    try {
      const { error } = await supabase
        .from('role_templates')
        .update({
          menu_permissions: editingTemplate.menu_permissions,
          function_permissions: editingTemplate.function_permissions,
          project_permissions: editingTemplate.project_permissions,
          data_permissions: editingTemplate.data_permissions
        })
        .eq('role', editingTemplate.role);

      if (error) throw error;

      toast({
        title: "成功",
        description: "权限模板更新成功"
      });

      setShowEditDialog(false);
      setEditingTemplate(null);
      onDataChange?.();
    } catch (error) {
      console.error('更新权限模板失败:', error);
      toast({
        title: "错误",
        description: "更新权限模板失败",
        variant: "destructive"
      });
    }
  };

  const handleDeleteTemplate = async (role: string) => {
    try {
      const { error } = await supabase
        .from('role_templates')
        .delete()
        .eq('role', role);

      if (error) throw error;

      toast({
        title: "成功",
        description: "权限模板删除成功"
      });

      onDataChange?.();
    } catch (error) {
      console.error('删除权限模板失败:', error);
      toast({
        title: "错误",
        description: "删除权限模板失败",
        variant: "destructive"
      });
    }
  };

  const handleCopyTemplate = (template: RoleTemplate) => {
    setNewTemplate({
      role: `${template.role}_副本`,
      menu_permissions: [...template.menu_permissions],
      function_permissions: [...template.function_permissions],
      project_permissions: [...template.project_permissions],
      data_permissions: [...template.data_permissions]
    });
    setShowCreateDialog(true);
  };

  const togglePermission = (category: string, permission: string, isChecked: boolean) => {
    if (editingTemplate) {
      const updatedTemplate = { ...editingTemplate };
      const permissions = updatedTemplate[category as keyof RoleTemplate] as string[];
      
      if (isChecked) {
        updatedTemplate[category as keyof RoleTemplate] = [...permissions, permission];
      } else {
        updatedTemplate[category as keyof RoleTemplate] = permissions.filter(p => p !== permission);
      }
      
      setEditingTemplate(updatedTemplate);
    } else {
      const updatedTemplate = { ...newTemplate };
      const permissions = updatedTemplate[category as keyof typeof newTemplate] as string[];
      
      if (isChecked) {
        updatedTemplate[category as keyof typeof newTemplate] = [...permissions, permission];
      } else {
        updatedTemplate[category as keyof typeof newTemplate] = permissions.filter(p => p !== permission);
      }
      
      setNewTemplate(updatedTemplate);
    }
  };

  const toggleTemplateExpansion = (role: string) => {
    const newExpanded = new Set(expandedTemplates);
    if (newExpanded.has(role)) {
      newExpanded.delete(role);
    } else {
      newExpanded.add(role);
    }
    setExpandedTemplates(newExpanded);
  };

  const getPermissionCount = (template: RoleTemplate) => {
    return template.menu_permissions.length + 
           template.function_permissions.length + 
           template.project_permissions.length + 
           template.data_permissions.length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">权限模板管理</h2>
          <p className="text-muted-foreground">
            管理角色权限模板，快速配置用户权限
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              创建模板
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>创建权限模板</DialogTitle>
              <DialogDescription>
                创建一个新的角色权限模板
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="role">角色名称</Label>
                <Input
                  id="role"
                  value={newTemplate.role}
                  onChange={(e) => setNewTemplate({ ...newTemplate, role: e.target.value })}
                  placeholder="输入角色名称"
                />
              </div>

              <Tabs defaultValue="menu" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  {permissionCategories.map((category) => (
                    <TabsTrigger key={category.key} value={category.key}>
                      {category.icon}
                      <span className="ml-2">{category.label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>

                {permissionCategories.map((category) => (
                  <TabsContent key={category.key} value={category.key} className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                      {category.permissions.map((permission) => (
                        <div key={permission} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${category.key}-${permission}`}
                            checked={newTemplate[category.key as keyof typeof newTemplate].includes(permission)}
                            onCheckedChange={(checked) => 
                              togglePermission(category.key, permission, checked as boolean)
                            }
                          />
                          <Label 
                            htmlFor={`${category.key}-${permission}`}
                            className="text-sm font-normal"
                          >
                            {permission}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  取消
                </Button>
                <Button onClick={handleCreateTemplate}>
                  创建模板
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {roleTemplates.map((template) => (
          <Card key={template.role}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Shield className="h-5 w-5" />
                  <div>
                    <CardTitle className="text-lg">{template.role}</CardTitle>
                    <CardDescription>
                      包含 {getPermissionCount(template)} 个权限
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleTemplateExpansion(template.role)}
                  >
                    {expandedTemplates.has(template.role) ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyTemplate(template)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingTemplate(template);
                      setShowEditDialog(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteTemplate(template.role)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            {expandedTemplates.has(template.role) && (
              <CardContent>
                <div className="space-y-4">
                  {permissionCategories.map((category) => {
                    const permissions = template[category.key as keyof RoleTemplate] as string[];
                    return (
                      <div key={category.key} className="space-y-2">
                        <div className="flex items-center space-x-2">
                          {category.icon}
                          <h4 className="font-medium">{category.label}</h4>
                          <Badge variant="secondary">{permissions.length}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {permissions.map((permission) => (
                            <Badge key={permission} variant="outline">
                              {permission}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* 编辑对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑权限模板</DialogTitle>
            <DialogDescription>
              编辑 {editingTemplate?.role} 的权限配置
            </DialogDescription>
          </DialogHeader>
          
          {editingTemplate && (
            <div className="space-y-4">
              <Tabs defaultValue="menu" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  {permissionCategories.map((category) => (
                    <TabsTrigger key={category.key} value={category.key}>
                      {category.icon}
                      <span className="ml-2">{category.label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>

                {permissionCategories.map((category) => (
                  <TabsContent key={category.key} value={category.key} className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                      {category.permissions.map((permission) => (
                        <div key={permission} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-${category.key}-${permission}`}
                            checked={editingTemplate[category.key as keyof RoleTemplate].includes(permission)}
                            onCheckedChange={(checked) => 
                              togglePermission(category.key, permission, checked as boolean)
                            }
                          />
                          <Label 
                            htmlFor={`edit-${category.key}-${permission}`}
                            className="text-sm font-normal"
                          >
                            {permission}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  取消
                </Button>
                <Button onClick={handleEditTemplate}>
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
