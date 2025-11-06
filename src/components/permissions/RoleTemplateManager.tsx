import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
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
  UserPlus,
  AlertCircle
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MENU_PERMISSIONS, FUNCTION_PERMISSIONS, PROJECT_PERMISSIONS, DATA_PERMISSIONS, ROLES } from '@/config/permissions';
import { RoleTemplate } from '@/types/permission';
import { useDynamicMenuPermissions } from '@/hooks/useDynamicMenuPermissions';

interface RoleTemplateManagerProps {
  roleTemplates: Record<string, RoleTemplate>;
  onUpdate: () => void;
}

export function RoleTemplateManager({ roleTemplates, onUpdate }: RoleTemplateManagerProps) {
  const { toast } = useToast();
  
  // 使用动态菜单权限
  const { loading: menuLoading, menuPermissions: dynamicMenuPermissions } = useDynamicMenuPermissions();
  
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

  // 转换动态菜单权限为 PermissionGroup 格式
  const menuPermissionsForSelector = useMemo(() => {
    if (menuLoading || !dynamicMenuPermissions.length) {
      return MENU_PERMISSIONS; // 加载中时使用默认配置
    }

    return dynamicMenuPermissions.map(group => ({
      key: group.group.toLowerCase().replace(/\s+/g, '_'),
      label: group.group,
      icon: 'Menu',
      children: group.permissions.map(item => ({
        key: item.key,
        label: item.label,
        description: item.url
      }))
    }));
  }, [menuLoading, dynamicMenuPermissions]);

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

      // 重要：自动添加父级菜单key，确保与数据库格式一致
      const menuPermissionsWithParents = addParentMenuKeys(newTemplate.menu_permissions);

      const updateData = {
        role: editingRole,
        menu_permissions: menuPermissionsWithParents,  // 包含父级key的完整权限列表
        function_permissions: newTemplate.function_permissions,
        project_permissions: newTemplate.project_permissions || [],
        data_permissions: newTemplate.data_permissions || [],
        updated_at: new Date().toISOString()
      };

      // 使用 upsert 操作，避免更新失败
      const { error } = await supabase
        .from('role_permission_templates')
        .upsert([updateData], {
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

  // 添加父级菜单权限key的辅助函数
  const addParentMenuKeys = (childKeys: string[]): string[] => {
    const parentKeyMap: Record<string, string> = {
      'dashboard.transport': 'dashboard',
      'dashboard.financial': 'dashboard',
      'dashboard.project': 'dashboard',
      'dashboard.shipper': 'dashboard',
      'dashboard.quantity': 'dashboard',
      'business.entry': 'business',
      'business.scale': 'business',
      'business.payment_request': 'business',
      'business.payment_requests': 'business',
      'business.invoice_request': 'business',
      'maintenance.projects': 'maintenance',
      'maintenance.drivers': 'maintenance',
      'maintenance.locations': 'maintenance',
      'maintenance.locations_enhanced': 'maintenance',
      'maintenance.partners': 'maintenance',
      'finance.reconciliation': 'finance',
      'finance.payment_invoice': 'finance',
      'finance.payment_requests': 'finance',
      'finance.invoice_request_management': 'finance',
      'contracts.list': 'contracts',
      'contracts.create': 'contracts',
      'contracts.edit': 'contracts',
      'contracts.delete': 'contracts',
      'contracts.audit': 'contracts',
      'contracts.files': 'contracts',
      'contracts.permissions': 'contracts',
      'contracts.reminders': 'contracts',
      'contracts.tags': 'contracts',
      'contracts.numbering': 'contracts',
      'audit.invoice': 'audit',
      'audit.payment': 'audit',
      'data_maintenance.waybill': 'data_maintenance',
      'data_maintenance.waybill_enhanced': 'data_maintenance',
      'settings.users': 'settings',
      'settings.permissions': 'settings',
      'settings.contract_permissions': 'settings',
      'settings.role_templates': 'settings',
      'settings.integrated': 'settings',
      'settings.audit_logs': 'settings'
    };

    const result = [...new Set(childKeys)]; // 去重
    const parentKeys = new Set<string>();

    // 为每个子菜单添加对应的父级key
    childKeys.forEach(childKey => {
      const parentKey = parentKeyMap[childKey];
      if (parentKey && !result.includes(parentKey)) {
        parentKeys.add(parentKey);
      }
    });

    // 合并父级key和子菜单key
    return [...result, ...Array.from(parentKeys)];
  };

  // 一键设置操作员权限（基于管理员，排除设置菜单）
  const handleQuickSetupOperator = () => {
    const adminTemplate = roleTemplates['admin'];
    if (!adminTemplate) {
      toast({
        title: "错误",
        description: "管理员模板不存在",
        variant: "destructive"
      });
      return;
    }

    // 从管理员权限中排除设置菜单（7个）
    const operatorMenuPermissions = (adminTemplate.menu_permissions || []).filter(
      (perm: string) => !perm.startsWith('settings')
    );

    // 从管理员权限中排除系统管理功能
    const operatorFunctionPermissions = (adminTemplate.function_permissions || []).filter(
      (perm: string) => !perm.startsWith('system')
    );

    // 设置为操作员模板
    setEditingRole('operator');
    setNewTemplate({
      role: 'operator',
      menu_permissions: operatorMenuPermissions,
      function_permissions: operatorFunctionPermissions,
      project_permissions: [...(adminTemplate.project_permissions || [])],
      data_permissions: [...(adminTemplate.data_permissions || [])]
    });
    setShowEditDialog(true);
    
    toast({
      title: "快速设置",
      description: "已基于管理员权限生成操作员权限（已排除设置菜单和系统管理功能）",
    });
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
      setShowCreateRoleDialog(true);
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

  // 父级菜单key映射（组key到父级菜单key）
  const groupToParentKeyMap: Record<string, string> = {
    'dashboard_group': 'dashboard',
    'business_group': 'business',
    'maintenance_group': 'maintenance',
    'finance_group': 'finance',
    'contracts_group': 'contracts',
    'audit_group': 'audit',
    'data_maintenance_group': 'data_maintenance',
    'settings_group': 'settings'
  };

  // 权限选择组件
  const PermissionSelector = ({ 
    title, 
    permissions, 
    selectedPermissions, 
    onSelectionChange,
    disabled
  }: {
    title: string;
    permissions: any[];
    selectedPermissions: string[];
    onSelectionChange: (permissions: string[]) => void;
    disabled?: boolean;
  }) => {
    const handleGroupToggle = (groupKey: string, checked: boolean) => {
      const group = permissions.find(p => p.key === groupKey);
      if (!group) return;

      // 获取父级菜单key
      const parentKey = groupToParentKeyMap[groupKey];
      const groupPermissions = group.children?.map((child: any) => child.key) || [];
      
      // 合并父级key和子级key
      const allGroupPermissions = parentKey 
        ? [parentKey, ...groupPermissions]
        : groupPermissions;
      
      if (checked) {
        // 去重：只添加不存在的权限
        const newPermissions = [...selectedPermissions];
        allGroupPermissions.forEach(permission => {
          if (!newPermissions.includes(permission)) {
            newPermissions.push(permission);
          }
        });
        onSelectionChange(newPermissions);
      } else {
        const filteredPermissions = selectedPermissions.filter(p => !allGroupPermissions.includes(p));
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
    
    // 获取父级菜单key的显示标签
    const getParentLabel = (groupKey: string): string => {
      const labels: Record<string, string> = {
        'dashboard_group': '数据看板（主）',
        'business_group': '业务管理（主）',
        'maintenance_group': '信息维护（主）',
        'finance_group': '财务管理（主）',
        'contracts_group': '合同管理（主）',
        'audit_group': '审核管理（主）',
        'data_maintenance_group': '数据维护（主）',
        'settings_group': '设置（主）'
      };
      return labels[groupKey] || '主菜单';
    };

    return (
      <div className="space-y-4">
        <h4 className="font-medium">{title}</h4>
        <div 
          ref={(el) => scrollAreaRefs.current[title] = el}
          className="space-y-2 max-h-80 overflow-y-auto scroll-smooth border rounded-lg p-4"
        >
          {permissions.map(group => {
            const parentKey = groupToParentKeyMap[group.key];
            const parentLabel = parentKey 
              ? group.label.replace('数据看板', '数据看板（主）')
                  .replace('业务管理', '业务管理（主）')
                  .replace('信息维护', '信息维护（主）')
                  .replace('财务管理', '财务管理（主）')
                  .replace('合同管理', '合同管理（主）')
                  .replace('审核管理', '审核管理（主）')
                  .replace('数据维护', '数据维护（主）')
                  .replace('设置', '设置（主）')
              : null;
            
            return (
              <div key={group.key} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={group.key}
                    checked={
                      (parentKey ? selectedPermissions.includes(parentKey) : true) &&
                      group.children?.every((child: any) => selectedPermissions.includes(child.key))
                    }
                    onCheckedChange={(checked) => handleGroupToggle(group.key, checked as boolean)}
                  />
                  <Label htmlFor={group.key} className="font-medium">
                    {group.label}
                  </Label>
                </div>
                <div className="ml-6 space-y-1">
                  {/* 显示父级菜单项（如果存在） */}
                  {parentKey && (
                    <div className="flex items-center space-x-2 mb-1 pb-1 border-b border-dashed">
                      <Checkbox
                        id={parentKey}
                        checked={selectedPermissions.includes(parentKey)}
                        onCheckedChange={(checked) => handlePermissionToggle(parentKey, !!checked)}
                      />
                      <Label htmlFor={parentKey} className="text-sm font-medium text-blue-600">
                        {getParentLabel(group.key)}
                      </Label>
                    </div>
                  )}
                  {/* 显示子菜单项 */}
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
            );
          })}
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
                        {role === 'operator' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleQuickSetupOperator}
                            title="一键设置：基于管理员权限，自动排除设置菜单"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            一键设置
                          </Button>
                        )}
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
                {editingRole === 'admin' && (
                  <Badge variant="default" className="ml-2">
                    管理员自动拥有所有菜单权限
                  </Badge>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto scroll-smooth border rounded-lg p-4">
                {menuLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    加载菜单权限配置...
                  </div>
                ) : editingRole === 'admin' ? (
                  <div className="space-y-4">
                    <Alert className="border-blue-500 bg-blue-50">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800">
                        <p className="font-semibold">管理员权限说明</p>
                        <p className="text-sm mt-1">管理员角色自动拥有所有菜单的访问权限，无需手动配置。当添加新菜单时，管理员会自动获得访问权限。</p>
                      </AlertDescription>
                    </Alert>
                    <PermissionSelector
                      title="菜单权限（只读）"
                      permissions={menuPermissionsForSelector}
                      selectedPermissions={newTemplate.menu_permissions}
                      onSelectionChange={(permissions) => {
                        // admin 角色不允许修改
                        toast({
                          title: "提示",
                          description: "管理员自动拥有所有权限，无需修改",
                          variant: "default"
                        });
                      }}
                      disabled={true}
                    />
                  </div>
                ) : (
                  <PermissionSelector
                    title="菜单权限"
                    permissions={menuPermissionsForSelector}
                    selectedPermissions={newTemplate.menu_permissions}
                    onSelectionChange={(permissions) => {
                      setNewTemplate(prev => ({ ...prev, menu_permissions: permissions }));
                    }}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="function" className="space-y-4 mt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Settings className="h-4 w-4" />
                <span>配置 {editingRole} 角色的功能操作权限</span>
                {editingRole === 'admin' && (
                  <Badge variant="default" className="ml-2">
                    管理员拥有所有功能权限
                  </Badge>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto scroll-smooth border rounded-lg p-4">
                <PermissionSelector
                  title={editingRole === 'admin' ? "功能权限（只读）" : "功能权限"}
                  permissions={FUNCTION_PERMISSIONS}
                  selectedPermissions={newTemplate.function_permissions}
                  onSelectionChange={(permissions) => {
                    if (editingRole === 'admin') {
                      toast({
                        title: "提示",
                        description: "管理员自动拥有所有功能权限，无需修改",
                        variant: "default"
                      });
                      return;
                    }
                    setNewTemplate(prev => ({ ...prev, function_permissions: permissions }));
                  }}
                  disabled={editingRole === 'admin'}
                />
              </div>
            </TabsContent>

            <TabsContent value="project" className="space-y-4 mt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>配置 {editingRole} 角色的项目访问权限</span>
                {editingRole === 'admin' && (
                  <Badge variant="default" className="ml-2">
                    管理员拥有所有项目权限
                  </Badge>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto scroll-smooth border rounded-lg p-4">
                <PermissionSelector
                  title={editingRole === 'admin' ? "项目权限（只读）" : "项目权限"}
                  permissions={PROJECT_PERMISSIONS}
                  selectedPermissions={newTemplate.project_permissions}
                  onSelectionChange={(permissions) => {
                    if (editingRole === 'admin') {
                      toast({
                        title: "提示",
                        description: "管理员自动拥有所有项目权限，无需修改",
                        variant: "default"
                      });
                      return;
                    }
                    setNewTemplate(prev => ({ ...prev, project_permissions: permissions }));
                  }}
                  disabled={editingRole === 'admin'}
                />
              </div>
            </TabsContent>

            <TabsContent value="data" className="space-y-4 mt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Database className="h-4 w-4" />
                <span>配置 {editingRole} 角色的数据操作权限</span>
                {editingRole === 'admin' && (
                  <Badge variant="default" className="ml-2">
                    管理员拥有所有数据权限
                  </Badge>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto scroll-smooth border rounded-lg p-4">
                <PermissionSelector
                  title={editingRole === 'admin' ? "数据权限（只读）" : "数据权限"}
                  permissions={DATA_PERMISSIONS}
                  selectedPermissions={newTemplate.data_permissions}
                  onSelectionChange={(permissions) => {
                    if (editingRole === 'admin') {
                      toast({
                        title: "提示",
                        description: "管理员自动拥有所有数据权限，无需修改",
                        variant: "default"
                      });
                      return;
                    }
                    setNewTemplate(prev => ({ ...prev, data_permissions: permissions }));
                  }}
                  disabled={editingRole === 'admin'}
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
