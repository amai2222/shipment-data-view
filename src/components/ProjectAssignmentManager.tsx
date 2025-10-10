import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Building2, 
  Users, 
  Search, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Plus,
  Minus,
  Settings,
  Shield
} from 'lucide-react';
import { ProjectAssignmentService, UserProjectAssignment, ProjectAssignmentStats, PROJECT_ROLE_PERMISSIONS } from '@/services/ProjectAssignmentService';
import { DynamicRoleService } from '@/services/DynamicRoleService';
import { ROLES } from '@/config/permissions';

interface ProjectAssignmentManagerProps {
  userId: string;
  userName: string;
  userRole: string;
  onAssignmentChange?: () => void;
}

export function ProjectAssignmentManager({
  userId,
  userName,
  userRole,
  onAssignmentChange
}: ProjectAssignmentManagerProps) {
  const { toast } = useToast();
  
  // 状态管理
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<UserProjectAssignment[]>([]);
  const [stats, setStats] = useState<ProjectAssignmentStats>({
    totalProjects: 0,
    assignedProjects: 0,
    unassignedProjects: 0,
    activeProjects: 0
  });
  
  // 搜索和过滤
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  
  // 批量操作
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkRole, setBulkRole] = useState<string>(DynamicRoleService.getDefaultProjectRole());

  // 加载数据
  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projectsData, assignmentsData, statsData] = await Promise.all([
        ProjectAssignmentService.getAllProjects(),
        ProjectAssignmentService.getUserProjectAssignments(userId),
        ProjectAssignmentService.getUserProjectStats(userId)
      ]);

      setProjects(projectsData);
      setAssignments(assignmentsData);
      setStats(statsData);
    } catch (error) {
      console.error('加载项目分配数据失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载项目分配数据',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // 过滤项目
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    // 搜索过滤
    if (searchTerm) {
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.manager.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.loading_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.unloading_address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 状态过滤
    if (statusFilter !== 'all') {
      filtered = filtered.filter(project => {
        if (statusFilter === 'active') return project.project_status === '进行中';
        if (statusFilter === 'inactive') return project.project_status !== '进行中';
        return true;
      });
    }

    return filtered;
  }, [projects, searchTerm, statusFilter]);

  // 获取项目分配状态
  const getProjectAssignmentStatus = (projectId: string) => {
    const assignment = assignments.find(a => a.project_id === projectId);
    
    // 修复：正确判断项目分配状态
    // 默认所有用户都有所有项目权限
    // 只有在 user_projects 表中有明确限制时才显示为未分配
    
    // 如果没有分配记录，表示使用默认权限（已分配）
    if (!assignment) {
      return {
        isAssigned: true, // 默认已分配
        role: DynamicRoleService.getDefaultProjectRole(),
        canView: true,
        canEdit: true,
        canDelete: false,
        assignment: null
      };
    }
    
    // 如果有分配记录，检查是否被明确限制
    const isExplicitlyRestricted = assignment.can_view === false;
    
    return {
      isAssigned: !isExplicitlyRestricted, // 只有明确限制查看才算未分配
      role: assignment.role || DynamicRoleService.getDefaultProjectRole(),
      canView: assignment.can_view ?? true,
      canEdit: assignment.can_edit ?? true,
      canDelete: assignment.can_delete ?? false,
      assignment
    };
  };

  // 切换项目分配
  const toggleProjectAssignment = async (projectId: string, assigned: boolean, role: string = DynamicRoleService.getDefaultProjectRole()) => {
    try {
      setSaving(true);
      
      if (assigned) {
        // 分配项目：创建或更新 user_projects 记录，设置完整权限
        await ProjectAssignmentService.assignProjectToUser(userId, projectId, role);
      } else {
        // 取消分配：创建限制性记录，设置所有权限为 false
        await ProjectAssignmentService.restrictProjectFromUser(userId, projectId);
      }

      // 重新加载数据
      await loadData();
      
      toast({
        title: '操作成功',
        description: assigned ? '项目分配成功' : '项目访问已限制'
      });

      onAssignmentChange?.();
    } catch (error) {
      console.error('切换项目分配失败:', error);
      toast({
        title: '操作失败',
        description: '无法更新项目分配',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // 批量分配项目
  const handleBulkAssign = async () => {
    if (selectedProjects.length === 0) return;

    try {
      setSaving(true);
      await ProjectAssignmentService.batchAssignProjectsToUser(userId, selectedProjects, bulkRole);
      
      await loadData();
      setSelectedProjects([]);
      setShowBulkDialog(false);
      
      toast({
        title: '批量分配成功',
        description: `已为用户分配 ${selectedProjects.length} 个项目`
      });

      onAssignmentChange?.();
    } catch (error) {
      console.error('批量分配失败:', error);
      toast({
        title: '批量分配失败',
        description: '无法批量分配项目',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // 批量移除项目分配
  const handleBulkRemove = async () => {
    if (selectedProjects.length === 0) return;

    try {
      setSaving(true);
      await ProjectAssignmentService.batchRemoveProjectsFromUser(userId, selectedProjects);
      
      await loadData();
      setSelectedProjects([]);
      
      toast({
        title: '批量移除成功',
        description: `已移除 ${selectedProjects.length} 个项目分配`
      });

      onAssignmentChange?.();
    } catch (error) {
      console.error('批量移除失败:', error);
      toast({
        title: '批量移除失败',
        description: '无法批量移除项目分配',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // 获取状态图标
  const getStatusIcon = (isAssigned: boolean, isActive: boolean) => {
    if (!isActive) {
      return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
    
    return isAssigned ? 
      <CheckCircle className="h-4 w-4 text-green-600" /> : 
      <XCircle className="h-4 w-4 text-red-600" />;
  };

  // 获取状态标签
  const getStatusBadge = (isAssigned: boolean, isActive: boolean, role: string, canEdit: boolean, canDelete: boolean) => {
    if (!isActive) {
      return <Badge variant="outline" className="text-gray-500 border-gray-300">已结束</Badge>;
    }
    
    if (isAssigned) {
      // 动态获取角色颜色和显示名称
      const roleColor = DynamicRoleService.getRoleColor(role);
      const roleText = DynamicRoleService.getRoleDisplayName(role);
      
      // 转换颜色类名为适合Badge的格式
      const roleColors: Record<string, string> = {};
      Object.keys(ROLES).forEach(roleKey => {
        const color = DynamicRoleService.getRoleColor(roleKey);
        // 将 bg-red-500 转换为 bg-red-100 text-red-800 border-red-300 格式
        const colorMap: Record<string, string> = {
          'bg-red-500': 'bg-red-100 text-red-800 border-red-300',
          'bg-blue-500': 'bg-blue-100 text-blue-800 border-blue-300',
          'bg-green-500': 'bg-green-100 text-green-800 border-green-300',
          'bg-yellow-500': 'bg-yellow-100 text-yellow-800 border-yellow-300',
          'bg-purple-500': 'bg-purple-100 text-purple-800 border-purple-300',
          'bg-gray-500': 'bg-gray-100 text-gray-800 border-gray-300'
        };
        roleColors[roleKey] = colorMap[color] || 'bg-gray-100 text-gray-800 border-gray-300';
      });
      
      // 显示对应的权限系统权限
      const rolePermissions = PROJECT_ROLE_PERMISSIONS[role as keyof typeof PROJECT_ROLE_PERMISSIONS];
      const permissionCount = rolePermissions?.additionalPermissions.length || 0;
      
      return (
        <Badge variant="outline" className={roleColors[role as keyof typeof roleColors] || roleColors.operator}>
          {roleText} ({permissionCount}项权限)
        </Badge>
      );
    }
    
    return <Badge variant="outline" className="text-red-700 border-red-300">未分配</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">加载项目分配数据中...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 统计概览 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            项目分配概览
          </CardTitle>
          <CardDescription>
            管理用户 {userName} 的项目分配权限
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalProjects}</div>
              <div className="text-sm text-gray-500">总项目数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.assignedProjects}</div>
              <div className="text-sm text-gray-500">已分配</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.activeProjects}</div>
              <div className="text-sm text-gray-500">进行中</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.unassignedProjects}</div>
              <div className="text-sm text-gray-500">未分配</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 搜索和过滤 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="搜索项目名称、负责人、地址..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="active">进行中</SelectItem>
                  <SelectItem value="inactive">已结束</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="outline" className="bg-blue-100 text-blue-800">
                {userRole}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 批量操作 */}
      {selectedProjects.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  已选择 {selectedProjects.length} 个项目
                </span>
              </div>
              <div className="flex gap-2">
                <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-1" />
                      批量分配
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>批量分配项目</DialogTitle>
                      <DialogDescription>
                        为选中的 {selectedProjects.length} 个项目设置角色
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>项目角色</Label>
                        <Select value={bulkRole} onValueChange={(value: any) => setBulkRole(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DynamicRoleService.generateRoleSelectOptions().map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
                          取消
                        </Button>
                        <Button onClick={handleBulkAssign} disabled={saving}>
                          {saving ? '分配中...' : '确认分配'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleBulkRemove}
                  disabled={saving}
                >
                  <Minus className="h-4 w-4 mr-1" />
                  批量移除
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setSelectedProjects([])}
                >
                  取消选择
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 项目列表 */}
      <Card>
        <CardHeader>
          <CardTitle>项目分配管理</CardTitle>
          <CardDescription>
            默认所有用户都具有所有项目的访问权限，取消勾选将限制用户访问该项目
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredProjects.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? '没有找到匹配的项目' : '暂无项目数据'}
              </div>
            ) : (
              filteredProjects.map((project) => {
                const { isAssigned, role, canView, canEdit, canDelete } = getProjectAssignmentStatus(project.id);
                const isActive = project.project_status === '进行中';
                const isSelected = selectedProjects.includes(project.id);
                
                return (
                  <div key={project.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedProjects([...selectedProjects, project.id]);
                            } else {
                              setSelectedProjects(selectedProjects.filter(id => id !== project.id));
                            }
                          }}
                          disabled={!isActive}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Building2 className="h-4 w-4 text-gray-600" />
                            <h4 className="font-semibold">{project.name}</h4>
                            <Badge variant="outline" className="text-xs">
                              {project.project_status}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
                            <div>
                              <span className="font-medium">负责人:</span> {project.manager}
                            </div>
                            <div>
                              <span className="font-medium">装货地址:</span> {project.loading_address}
                            </div>
                            <div>
                              <span className="font-medium">卸货地址:</span> {project.unloading_address}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>开始: {new Date(project.start_date).toLocaleDateString()}</span>
                            <span>结束: {new Date(project.end_date).toLocaleDateString()}</span>
                            {project.auto_code && <span>编码: {project.auto_code}</span>}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {getStatusIcon(isAssigned, isActive)}
                        {getStatusBadge(isAssigned, isActive, role, canEdit, canDelete)}
                        <Checkbox
                          checked={isAssigned}
                          onCheckedChange={(checked) => toggleProjectAssignment(project.id, checked as boolean, role)}
                          disabled={!isActive || saving}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* 说明信息 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-800">项目分配说明</h4>
              <ul className="text-sm text-blue-700 mt-2 space-y-1">
                <li>• 默认情况下，所有用户都具有所有项目的访问权限</li>
                <li>• 取消勾选项目将限制用户访问该项目</li>
                <li>• 已结束的项目无法修改分配设置</li>
                {Object.entries(PROJECT_ROLE_PERMISSIONS).map(([roleKey, permissions]) => (
                  <li key={roleKey}>
                    • <strong>{DynamicRoleService.getRoleDisplayName(roleKey)}</strong>：
                    +{permissions.additionalPermissions.length}项额外权限 
                    ({permissions.additionalPermissions.slice(0, 3).join(', ')}
                    {permissions.additionalPermissions.length > 3 ? '...' : ''})
                  </li>
                ))}
                <li>• 分配变更需要保存后才能生效</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
