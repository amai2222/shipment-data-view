// 菜单配置管理页面
// 允许管理员在后台管理菜单结构、图标、排序等

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Edit, Trash2, MoveUp, MoveDown, RefreshCw, GripVertical, Menu } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PermissionSyncManager } from '@/components/permissions/PermissionSyncManager';
import { PageHeader } from '@/components/PageHeader';

interface MenuConfig {
  id: string;
  key: string;
  parent_key: string | null;
  title: string;
  url: string | null;
  icon: string | null;
  order_index: number;
  is_active: boolean;
  is_group: boolean;
  required_permissions: string[] | null;
}

export default function MenuConfigPage() {
  const [menus, setMenus] = useState<MenuConfig[]>([]);
  const [originalMenus, setOriginalMenus] = useState<MenuConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMenu, setEditingMenu] = useState<MenuConfig | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draggedMenu, setDraggedMenu] = useState<MenuConfig | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  // 可用的图标列表
  const availableIcons = [
    'BarChart3', 'Database', 'FileText', 'Calculator', 'PieChart', 
    'Banknote', 'Truck', 'Package', 'MapPin', 'Users', 'Plus',
    'ClipboardList', 'Settings', 'Weight', 'Shield', 'History',
    'TreePine', 'CheckCircle2', 'CreditCard', 'Menu', 'DollarSign'
  ];

  // 加载菜单配置
  const loadMenus = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('menu_config')
        .select('*')
        .order('order_index');

      if (error) throw error;
      setMenus(data || []);
      setOriginalMenus(data || []); // 保存原始数据用于对比
      setHasChanges(false);
    } catch (error: any) {
      toast({
        title: '加载失败',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMenus();
  }, []);

  // 保存菜单
  const handleSave = async (menu: Partial<MenuConfig>) => {
    try {
      if (editingMenu?.id) {
        // 更新
        const { error } = await supabase
          .from('menu_config')
          .update(menu)
          .eq('id', editingMenu.id);

        if (error) throw error;

        toast({
          title: '更新成功',
          description: '菜单配置已更新',
        });
      } else {
        // 新建
        const { error } = await supabase
          .from('menu_config')
          .insert([menu]);

        if (error) throw error;

        toast({
          title: '创建成功',
          description: '新菜单已创建，侧边栏将自动显示',
        });
      }

      setIsDialogOpen(false);
      setEditingMenu(null);
      loadMenus();
    } catch (error: any) {
      toast({
        title: '保存失败',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // 删除菜单
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个菜单吗？')) return;

    try {
      const { error } = await supabase
        .from('menu_config')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: '删除成功',
        description: '菜单已删除，侧边栏将自动更新',
      });

      loadMenus();
    } catch (error: any) {
      toast({
        title: '删除失败',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // 切换激活状态（本地修改）
  const toggleActive = (menu: MenuConfig) => {
    setMenus(prev => 
      prev.map(m => 
        m.id === menu.id 
          ? { ...m, is_active: !m.is_active }
          : m
      )
    );
    setHasChanges(true);
  };

  // 调整顺序（本地修改，每次移动10个单位）
  const moveMenu = (menu: MenuConfig, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' 
      ? menu.order_index - 10
      : menu.order_index + 10;

    setMenus(prev => 
      prev.map(m => 
        m.id === menu.id 
          ? { ...m, order_index: newIndex }
          : m
      )
    );
    setHasChanges(true);
  };

  // 拖拽重新排序（本地修改）
  const handleDragReorder = (draggedId: string, targetOrderIndex: number) => {
    setMenus(prev => 
      prev.map(m => 
        m.id === draggedId 
          ? { ...m, order_index: targetOrderIndex }
          : m
      )
    );
    setHasChanges(true);
  };

  // 保存所有更改
  const handleSaveAllChanges = async () => {
    try {
      // 找出所有有变化的菜单
      const updates = menus.filter(menu => {
        const original = originalMenus.find(o => o.id === menu.id);
        return original && (
          original.is_active !== menu.is_active ||
          original.order_index !== menu.order_index
        );
      });

      if (updates.length === 0) {
        toast({
          title: '无变更',
          description: '没有需要保存的更改',
        });
        return;
      }

      // 批量更新
      for (const menu of updates) {
        const { error } = await supabase
          .from('menu_config')
          .update({
            is_active: menu.is_active,
            order_index: menu.order_index
          })
          .eq('id', menu.id);

        if (error) throw error;
      }

      toast({
        title: '保存成功',
        description: `已保存 ${updates.length} 项更改，侧边栏将自动更新`,
      });

      // 重新加载
      await loadMenus();
    } catch (error: any) {
      toast({
        title: '保存失败',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // 取消更改
  const handleCancelChanges = () => {
    setMenus([...originalMenus]);
    setHasChanges(false);
    toast({
      title: '已取消',
      description: '所有未保存的更改已撤销',
    });
  };

  // 分离分组和菜单项，并按 order_index 排序
  const groups = menus
    .filter(m => m.is_group)
    .sort((a, b) => a.order_index - b.order_index);
    
  const items = menus
    .filter(m => !m.is_group)
    .sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="菜单配置管理"
        description="管理系统菜单结构、图标、排序和权限"
        icon={Menu}
      >
        <div className="flex gap-2">
          {hasChanges && (
            <>
              <Button onClick={handleCancelChanges} variant="outline">
                取消
              </Button>
              <Button onClick={handleSaveAllChanges} className="bg-green-600 hover:bg-green-700">
                <RefreshCw className="h-4 w-4 mr-2" />
                保存更改
              </Button>
            </>
          )}
          <Button onClick={loadMenus} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingMenu(null)}>
                <Plus className="h-4 w-4 mr-2" />
                新建菜单
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <MenuConfigForm
                menu={editingMenu}
                groups={groups}
                availableIcons={availableIcons}
                onSave={handleSave}
                onCancel={() => {
                  setIsDialogOpen(false);
                  setEditingMenu(null);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      {/* 权限同步管理 */}
      <PermissionSyncManager />

      <div className="grid gap-6">
        {/* 分组列表 */}
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">菜单分组</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>图标</TableHead>
                <TableHead>排序</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map(menu => (
                <TableRow key={menu.id}>
                  <TableCell className="font-medium">{menu.title}</TableCell>
                  <TableCell><code className="text-xs">{menu.key}</code></TableCell>
                  <TableCell><Badge variant="outline">{menu.icon}</Badge></TableCell>
                  <TableCell>{menu.order_index}</TableCell>
                  <TableCell>
                    <Switch
                      checked={menu.is_active}
                      onCheckedChange={() => toggleActive(menu)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => moveMenu(menu, 'up')}>
                        <MoveUp className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => moveMenu(menu, 'down')}>
                        <MoveDown className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingMenu(menu);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(menu.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* 菜单项列表（按分组显示，与侧边栏顺序一致） */}
        {groups.map(group => {
          const groupItems = items
            .filter(item => item.parent_key === group.key)
            .sort((a, b) => a.order_index - b.order_index);  // 确保组内也排序
          if (groupItems.length === 0) return null;
          
          return (
            <div key={group.id} className="bg-card rounded-lg border p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Badge variant="default">{group.title}</Badge>
                <span className="text-sm text-muted-foreground">
                  ({groupItems.length} 个菜单 · 排序值: {group.order_index})
                </span>
              </h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">拖动</TableHead>
                    <TableHead>标题</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>所属分组</TableHead>
                    <TableHead>图标</TableHead>
                    <TableHead>权限</TableHead>
                    <TableHead>排序</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupItems.map(menu => (
                    <TableRow 
                      key={menu.id}
                      draggable
                      onDragStart={() => setDraggedMenu(menu)}
                      onDragOver={(e) => {
                        e.preventDefault();
                      }}
                      onDrop={() => {
                        if (draggedMenu && draggedMenu.id !== menu.id) {
                          handleDragReorder(draggedMenu.id, menu.order_index);
                        }
                        setDraggedMenu(null);
                      }}
                      onDragEnd={() => setDraggedMenu(null)}
                      className={`
                        cursor-move transition-all
                        ${draggedMenu?.id === menu.id ? 'opacity-50 bg-blue-50' : ''}
                        ${draggedMenu && draggedMenu.id !== menu.id ? 'hover:bg-blue-50 hover:border-t-2 hover:border-blue-500' : ''}
                      `}
                    >
                      <TableCell>
                        <GripVertical className="h-4 w-4 text-gray-400" />
                      </TableCell>
                      <TableCell className="font-medium">{menu.title}</TableCell>
                      <TableCell><code className="text-xs">{menu.url}</code></TableCell>
                      <TableCell>
                        <Badge variant="secondary">{group.title}</Badge>
                      </TableCell>
                      <TableCell><Badge variant="outline">{menu.icon}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {menu.required_permissions?.map(p => (
                            <Badge key={p} variant="secondary" className="text-xs">
                              {p}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{menu.order_index}</TableCell>
                      <TableCell>
                        <Switch
                          checked={menu.is_active}
                          onCheckedChange={() => toggleActive(menu)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingMenu(menu);
                              setIsDialogOpen(true);
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(menu.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 菜单配置表单组件
function MenuConfigForm({
  menu,
  groups,
  availableIcons,
  onSave,
  onCancel
}: {
  menu: MenuConfig | null;
  groups: MenuConfig[];
  availableIcons: string[];
  onSave: (menu: Partial<MenuConfig>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Partial<MenuConfig>>({
    key: menu?.key || '',
    parent_key: menu?.parent_key || null,
    title: menu?.title || '',
    url: menu?.url || '',
    icon: menu?.icon || '',
    order_index: menu?.order_index || 10,
    is_active: menu?.is_active ?? true,
    is_group: menu?.is_group ?? false,
    required_permissions: menu?.required_permissions || [],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{menu ? '编辑菜单' : '新建菜单'}</DialogTitle>
        <DialogDescription>
          配置菜单的基本信息、图标和权限
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="key">菜单Key *</Label>
          <Input
            id="key"
            value={formData.key}
            onChange={e => setFormData({ ...formData, key: e.target.value })}
            placeholder="dashboard.transport"
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="title">显示标题 *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })}
            placeholder="运输看板"
            required
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="is_group"
              checked={formData.is_group}
              onCheckedChange={checked => setFormData({ ...formData, is_group: checked })}
            />
            <Label htmlFor="is_group">是否为分组</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={checked => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">启用状态</Label>
          </div>
        </div>

        {!formData.is_group && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="parent_key">所属分组</Label>
              <Select
                value={formData.parent_key || ''}
                onValueChange={value => setFormData({ ...formData, parent_key: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择分组" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(g => (
                    <SelectItem key={g.key} value={g.key}>
                      {g.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="url">路由URL</Label>
              <Input
                id="url"
                value={formData.url || ''}
                onChange={e => setFormData({ ...formData, url: e.target.value })}
                placeholder="/dashboard/transport"
              />
            </div>
          </>
        )}

        <div className="grid gap-2">
          <Label htmlFor="icon">图标</Label>
          <Select
            value={formData.icon || ''}
            onValueChange={value => setFormData({ ...formData, icon: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择图标" />
            </SelectTrigger>
            <SelectContent>
              {availableIcons.map(icon => (
                <SelectItem key={icon} value={icon}>
                  {icon}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="order_index">排序索引</Label>
          <Input
            id="order_index"
            type="number"
            value={formData.order_index}
            onChange={e => setFormData({ ...formData, order_index: parseInt(e.target.value) })}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="permissions">所需权限（多个用逗号分隔）</Label>
          <Input
            id="permissions"
            value={formData.required_permissions?.join(', ') || ''}
            onChange={e => setFormData({
              ...formData,
              required_permissions: e.target.value.split(',').map(p => p.trim()).filter(Boolean)
            })}
            placeholder="dashboard.transport, dashboard"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit">
          保存
        </Button>
      </div>
    </form>
  );
}

