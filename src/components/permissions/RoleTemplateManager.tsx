import React, { useState, useMemo, useRef } from 'react';
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
import { OptimizedPermissionSelector } from './OptimizedPermissionSelector';
import { RoleManagementService, RoleCreationData } from '@/services/RoleManagementService';
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
  UserPlus
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MENU_PERMISSIONS, FUNCTION_PERMISSIONS, PROJECT_PERMISSIONS, DATA_PERMISSIONS, ROLES } from '@/config/permissions';
import { RoleTemplate } from '@/types/permission';

interface RoleTemplateManagerProps {
  roleTemplates: Record<string, RoleTemplate>;
  onUpdate: () => void;
}

export function RoleTemplateManager({ roleTemplates, onUpdate }: RoleTemplateManagerProps) {
  const { toast } = useToast();
  
  const [showCreateRoleDialog, setShowCreateRoleDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<string>('');
  const [newTemplate, setNewTemplate] = useState({
    role: '',
    menu_permissions: [] as string[],
    function_permissions: [] as string[],
    project_permissions: [] as string[],
    data_permissions: [] as string[]
  });
  const [newRole, setNewRole] = useState<RoleCreationData>({
    roleKey: '',
    label: '',
    color: 'bg-gray-500',
    description: '',
    menu_permissions: [],
    function_permissions: [],
    project_permissions: [],
    data_permissions: []
  });

  // 滚动位置保持
  const scrollAreaRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // 创建新角色
  const handleCreateRole = async () => {
    try {
      if (!newRole.roleKey || !newRole.label) {
        toast({
          title: "输入错误",
          description: "请填写角色键值和显示名称",
          variant: "destructive"
        });
        return;
      }

      await RoleManagementService.createRole(newRole);

      toast({
        title: "创建成功",
        description: `角色 ${newRole.label} 已创建`,
      });

      setShowCreateRoleDialog(false);
      setNewRole({
        roleKey: '',
        label: '',
        color: 'bg-gray-500',
        description: '',
        menu_permissions: [],
        function_permissions: [],
        project_permissions: [],
        data_permissions: []
      });
      onUpdate();
    } catch (error: any) {
      console.error('创建角色失败:', error);
      toast({
        title: "创建失败",
        description: error.message || "创建角色失败",
        variant: "destructive"
      });
    }
  };


  // 更新模板
  const handleUpdateTemplate = async () => {
    try {
      // 验证权限数据
      if (!newTemplate.menu_permissions || !newTemplate.function_permissions) {
        toast({
          title: "数据验证失败",
          description: "权限数据不完整，请检查配置",
          variant: "destructive"
        });
        return;
      }

      const updateData = {
        role: editingRole,
        menu_permissions: newTemplate.menu_permissions,
        function_permissions: newTemplate.function_permissions,
        project_permissions: newTemplate.project_permissions || [],
        data_permissions: newTemplate.data_permissions || [],
        updated_at: new Date().toISOString()
      };

      // 使用 upsert 操作，避免更新失败
      const { error } = await supabase
        .from('role_permission_templates')
        .upsert(updateData, {
          onConflict: 'role'
        });

      if (error) {
        console.error('数据库错误详情:', error);
        throw new Error(`数据库操作失败: ${error.message}`);
      }

      toast({
        title: "更新成功",
        description: "角色模板已更新",
      });

      setShowEditDialog(false);
      setEditingRole('');
      onUpdate();
    } catch (error: any) {
      console.error('更新模板失败:', error);
      toast({
        title: "更新失败",
        description: error.message || "更新角色模板失败，请重试",
        variant: "destructive"
      });
    }
  };

  // 删除模板
  const handleDeleteTemplate = async (role: string) => {
    try {
      const { error } = await supabase
        .from('role_permission_templates')
        .delete()
        .eq('role', role);

      if (error) throw error;

      toast({
        title: "删除成功",
        description: "角色模板已删除",
      });

      onUpdate();
    } catch (error: any) {
      console.error('删除模板失败:', error);
      toast({
        title: "删除失败",
        description: "删除角色模板失败",
        variant: "destructive"
      });
    }
  };

  // 复制模板
  const handleCopyTemplate = (sourceRole: string) => {
    const sourceTemplate = roleTemplates[sourceRole];
    if (sourceTemplate) {
      setNewTemplate({
        role: '',
        menu_permissions: [...sourceTemplate.menu_permissions],
        function_permissions: [...sourceTemplate.function_permissions],
        project_permissions: [...sourceTemplate.project_permissions],
        data_permissions: [...sourceTemplate.data_permissions]
      });
      setShowCreateDialog(true);
    }
  };

  // 编辑模板
  const handleEditTemplate = (role: string) => {
    const template = roleTemplates[role];
    if (template) {
      setEditingRole(role);
      setNewTemplate({
        role: role,
        menu_permissions: [...template.menu_permissions],
        function_permissions: [...template.function_permissions],
        project_permissions: [...template.project_permissions],
        data_permissions: [...template.data_permissions]
      });
      setShowEditDialog(true);
    }
  };

  // 获取权限统计
  const getPermissionStats = (template: RoleTemplate) => {
    return {
      menu: template.menu_permissions?.length || 0,
      function: template.function_permissions?.length || 0,
      project: template.project_permissions?.length || 0,
      data: template.data_permissions?.length || 0,
      total: (template.menu_permissions?.length || 0) + 
             (template.function_permissions?.length || 0) + 
             (template.project_permissions?.length || 0) + 
             (template.data_permissions?.length || 0)
    };
  };

  // 权限选择组件
  const PermissionSelector = ({ 
    title, 
    permissions, 
    selectedPermissions, 
    onSelectionChange 
  }: {
    title: string;
    permissions: any[];
    selectedPermissions: string[];
    onSelectionChange: (permissions: string[]) => void;
  }) => {
    const handleGroupToggle = (groupKey: string, checked: boolean) => {
      const group = permissions.find(p => p.key === groupKey);
      if (!group) return;

      const groupPermissions = group.children?.map((child: any) => child.key) || [];
      
      if (checked) {
        // 去重：只添加不存在的权限
        const newPermissions = [...selectedPermissions];
        groupPermissions.forEach(permission => {
          if (!newPermissions.includes(permission)) {
            newPermissions.push(permission);
          }
        });
        onSelectionChange(newPermissions);
      } else {
        const filteredPermissions = selectedPermissions.filter(p => !groupPermissions.includes(p));
        onSelectionChange(filteredPermissions);
      }
    };

    const handlePermissionToggle = (permissionKey: string, checked: boolean) => {
      // 使用更稳定的滚动位置保持方法
      const scrollContainer = scrollAreaRefs.current[title];
      const scrollTop = scrollContainer?.scrollTop || 0;
      const scrollHeight = scrollContainer?.scrollHeight || 0;
      
      // 使用 requestAnimationFrame 确保在DOM更新后恢复滚动位置
      const restoreScroll = () => {
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollTop;
        }
      };
      
      if (checked) {
        // 去重：只添加不存在的权限
        if (!selectedPermissions.includes(permissionKey)) {
          const newPermissions = [...selectedPermissions, permissionKey];
          onSelectionChange(newPermissions);
        }
      } else {
        const filteredPermissions = selectedPermissions.filter(p => p !== permissionKey);
        onSelectionChange(filteredPermissions);
      }
      
      // 使用 requestAnimationFrame 确保滚动位置在DOM更新后恢复
      requestAnimationFrame(() => {
        requestAnimationFrame(restoreScroll);
      });
    };

    return (
      <div className="space-y-4">
        <h4 className="font-medium">{title}</h4>
        <div 
          ref={(el) => scrollAreaRefs.current[title] = el}
          className="space-y-2 max-h-80 overflow-y-auto scroll-smooth border rounded-lg p-4"
        >
          {permissions.map(group => (
            <div key={group.key} className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={group.key}
                  checked={group.children?.every((child: any) => selectedPermissions.includes(child.key))}
                  onCheckedChange={(checked) => handleGroupToggle(group.key, checked as boolean)}
                />
                <Label htmlFor={group.key} className="font-medium">
                  {group.label}
                </Label>
              </div>
              <div className="ml-6 space-y-1">
                {group.children?.map((permission: any) => (
                  <div key={permission.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={permission.key}
                      checked={selectedPermissions.includes(permission.key)}
                      onCheckedChange={(checked) => handlePermissionToggle(permission.key, checked as boolean)}
                    />
                    <Label htmlFor={permission.key} className="text-sm">
                      {permission.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 预设权限模板 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>权限模板</CardTitle>
              <CardDescription>
                预设的权限配置模板，可快速应用到用户
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog open={showCreateRoleDialog} onOpenChange={setShowCreateRoleDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <UserPlus className="h-4 w-4 mr-2" />
                    创建角色
                  </Button>
                </DialogTrigger>
              </Dialog>
              
              {/* 创建角色对话框 */}
              <Dialog open={showCreateRoleDialog} onOpenChange={setShowCreateRoleDialog}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>创建新角色</DialogTitle>
                  <DialogDescription>
                    创建一个新的系统角色，包括角色定义和权限配置
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="roleKey">角色键值</Label>
                      <Input
                        id="roleKey"
                        value={newRole.roleKey}
                        onChange={(e) => setNewRole(prev => ({ ...prev, roleKey: e.target.value }))}
                        placeholder="例如: manager"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="label">显示名称</Label>
                      <Input
                        id="label"
                        value={newRole.label}
                        onChange={(e) => setNewRole(prev => ({ ...prev, label: e.target.value }))}
                        placeholder="例如: 项目经理"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="color">角色颜色</Label>
                      <Select value={newRole.color} onValueChange={(value) => setNewRole(prev => ({ ...prev, color: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bg-red-500">红色</SelectItem>
                          <SelectItem value="bg-blue-500">蓝色</SelectItem>
                          <SelectItem value="bg-green-500">绿色</SelectItem>
                          <SelectItem value="bg-yellow-500">黄色</SelectItem>
                          <SelectItem value="bg-purple-500">紫色</SelectItem>
                          <SelectItem value="bg-gray-500">灰色</SelectItem>
                          <SelectItem value="bg-indigo-500">靛蓝</SelectItem>
                          <SelectItem value="bg-pink-500">粉色</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">角色描述</Label>
                      <Input
                        id="description"
                        value={newRole.description}
                        onChange={(e) => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="角色的职责描述"
                      />
                    </div>
                  </div>

                  <PermissionSelector
                    title="菜单权限"
                    permissions={MENU_PERMISSIONS}
                    selectedPermissions={newRole.menu_permissions}
                    onSelectionChange={(permissions) => setNewRole(prev => ({ ...prev, menu_permissions: permissions }))}
                  />

                  <PermissionSelector
                    title="功能权限"
                    permissions={FUNCTION_PERMISSIONS}
                    selectedPermissions={newRole.function_permissions}
                    onSelectionChange={(permissions) => setNewRole(prev => ({ ...prev, function_permissions: permissions }))}
                  />

                  <PermissionSelector
                    title="项目权限"
                    permissions={PROJECT_PERMISSIONS}
                    selectedPermissions={newRole.project_permissions}
                    onSelectionChange={(permissions) => setNewRole(prev => ({ ...prev, project_permissions: permissions }))}
                  />

                  <PermissionSelector
                    title="数据权限"
                    permissions={DATA_PERMISSIONS}
                    selectedPermissions={newRole.data_permissions}
                    onSelectionChange={(permissions) => setNewRole(prev => ({ ...prev, data_permissions: permissions }))}
                  />

                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowCreateRoleDialog(false)}>
                      取消
                    </Button>
                    <Button onClick={handleCreateRole}>
                      创建角色
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(roleTemplates)
              .sort(([a], [b]) => {
                // 定义固定的角色排序顺序
                const roleOrder = ['admin', 'finance', 'business', 'operator', 'partner', 'viewer'];
                const aIndex = roleOrder.indexOf(a);
                const bIndex = roleOrder.indexOf(b);
                return aIndex - bIndex;
              })
              .map(([role, template]) => {
              const stats = getPermissionStats(template);
              
              return (
                <Card key={role} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{template.name || role}</CardTitle>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyTemplate(role)}
                          title="复制模板"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditTemplate(role)}
                          title="编辑模板"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTemplate(role)}
                          title="删除模板"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-blue-500" />
                          <span>菜单: {stats.menu}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Key className="h-4 w-4 text-green-500" />
                          <span>功能: {stats.function}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-purple-500" />
                          <span>项目: {stats.project}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-orange-500" />
                          <span>数据: {stats.data}</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">总权限:</span>
                          <Badge variant="outline">{stats.total}</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 编辑模板对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>编辑角色模板</DialogTitle>
            <DialogDescription>
              编辑 "{editingRole}" 的权限配置
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="menu" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="menu" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                菜单权限 ({newTemplate.menu_permissions.length})
              </TabsTrigger>
              <TabsTrigger value="function" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                功能权限 ({newTemplate.function_permissions.length})
              </TabsTrigger>
              <TabsTrigger value="project" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                项目权限 ({newTemplate.project_permissions.length})
              </TabsTrigger>
              <TabsTrigger value="data" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                数据权限 ({newTemplate.data_permissions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="menu" className="space-y-4 mt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span>配置 {editingRole} 角色的菜单访问权限</span>
              </div>
              <div className="max-h-96 overflow-y-auto scroll-smooth border rounded-lg p-4">
                <PermissionSelector
                  title="菜单权限"
                  permissions={MENU_PERMISSIONS}
                  selectedPermissions={newTemplate.menu_permissions}
                  onSelectionChange={(permissions) => {
                    setNewTemplate(prev => ({ ...prev, menu_permissions: permissions }));
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="function" className="space-y-4 mt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Settings className="h-4 w-4" />
                <span>配置 {editingRole} 角色的功能操作权限</span>
              </div>
              <div className="max-h-96 overflow-y-auto scroll-smooth border rounded-lg p-4">
                <PermissionSelector
                  title="功能权限"
                  permissions={FUNCTION_PERMISSIONS}
                  selectedPermissions={newTemplate.function_permissions}
                  onSelectionChange={(permissions) => setNewTemplate(prev => ({ ...prev, function_permissions: permissions }))}
                />
              </div>
            </TabsContent>

            <TabsContent value="project" className="space-y-4 mt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>配置 {editingRole} 角色的项目访问权限</span>
              </div>
              <div className="max-h-96 overflow-y-auto scroll-smooth border rounded-lg p-4">
                <PermissionSelector
                  title="项目权限"
                  permissions={PROJECT_PERMISSIONS}
                  selectedPermissions={newTemplate.project_permissions}
                  onSelectionChange={(permissions) => setNewTemplate(prev => ({ ...prev, project_permissions: permissions }))}
                />
              </div>
            </TabsContent>

            <TabsContent value="data" className="space-y-4 mt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Database className="h-4 w-4" />
                <span>配置 {editingRole} 角色的数据操作权限</span>
              </div>
              <div className="max-h-96 overflow-y-auto scroll-smooth border rounded-lg p-4">
                <PermissionSelector
                  title="数据权限"
                  permissions={DATA_PERMISSIONS}
                  selectedPermissions={newTemplate.data_permissions}
                  onSelectionChange={(permissions) => setNewTemplate(prev => ({ ...prev, data_permissions: permissions }))}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 pt-4 border-t">
            <Button onClick={handleUpdateTemplate} className="flex-1">
              更新模板
            </Button>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
