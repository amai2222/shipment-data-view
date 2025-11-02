import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { 
  Building2, 
  Users, 
  Eye, 
  EyeOff, 
  Search,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';

interface ProjectPermissionManagerProps {
  userId: string;
  userName: string;
  userRole: string;
  userProjectPermissions: string[];
  onPermissionChange: (projectId: string, hasAccess: boolean) => void;
}

export function ProjectPermissionManager({
  userId,
  userName,
  userRole,
  userProjectPermissions,
  onPermissionChange
}: ProjectPermissionManagerProps) {
  const { projects, loading } = useProjects();
  const [searchTerm, setSearchTerm] = useState('');

  // 过滤项目
  const filteredProjects = useMemo(() => {
    if (!searchTerm) return projects;
    return projects.filter(project =>
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.manager.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.loading_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.unloading_address.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [projects, searchTerm]);

  // 获取项目状态
  const getProjectStatus = (project: any) => {
    // 修复：默认所有项目都可访问，除非明确限制
    // 如果用户权限列表为空或包含该项目，则认为可访问
    const hasAccess = userProjectPermissions.length === 0 || userProjectPermissions.includes(project.id);
    const isActive = project.project_status === '进行中';
    
    return {
      hasAccess,
      isActive,
      status: hasAccess ? 'accessible' : 'restricted'
    };
  };

  // 获取状态图标
  const getStatusIcon = (status: string, isActive: boolean) => {
    if (!isActive) {
      return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
    
    switch (status) {
      case 'accessible':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'restricted':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  // 获取状态标签
  const getStatusBadge = (status: string, isActive: boolean) => {
    if (!isActive) {
      return <Badge variant="outline" className="text-gray-500 border-gray-300">已结束</Badge>;
    }
    
    switch (status) {
      case 'accessible':
        return <Badge variant="outline" className="text-green-700 border-green-300">可访问</Badge>;
      case 'restricted':
        return <Badge variant="outline" className="text-red-700 border-red-300">受限</Badge>;
      default:
        return <Badge variant="outline" className="text-gray-500 border-gray-300">未知</Badge>;
    }
  };

  // 统计信息
  const stats = useMemo(() => {
    const total = projects.length;
    // 修复：默认所有项目都可访问，除非明确限制
    const accessible = projects.filter(p => 
      userProjectPermissions.length === 0 || userProjectPermissions.includes(p.id)
    ).length;
    const restricted = total - accessible;
    const active = projects.filter(p => p.project_status === '进行中').length;
    
    return { total, accessible, restricted, active };
  }, [projects, userProjectPermissions]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">加载项目数据中...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 权限概览 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            项目权限概览
          </CardTitle>
          <CardDescription>
            管理用户 {userName} 的项目访问权限
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-gray-500">总项目数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.accessible}</div>
              <div className="text-sm text-gray-500">可访问</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.restricted}</div>
              <div className="text-sm text-gray-500">受限</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.active}</div>
              <div className="text-sm text-gray-500">进行中</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 搜索和操作 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
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
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-100 text-blue-800">
                {userRole}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 项目列表 */}
      <Card>
        <CardHeader>
          <CardTitle>项目权限配置</CardTitle>
          <CardDescription>
            默认用户可以访问所有项目，取消勾选将限制用户访问该项目
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
                const { hasAccess, isActive, status } = getProjectStatus(project);
                
                return (
                  <div key={project.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
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
                      
                      <div className="flex items-center gap-3">
                        {getStatusIcon(status, isActive)}
                        {getStatusBadge(status, isActive)}
                        <Checkbox
                          checked={hasAccess}
                          onCheckedChange={(checked) => onPermissionChange(project.id, checked as boolean)}
                          disabled={!isActive}
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
              <h4 className="font-medium text-blue-800">项目权限说明</h4>
              <ul className="text-sm text-blue-700 mt-2 space-y-1">
                <li>• 默认情况下，用户拥有所有项目的访问权限</li>
                <li>• 取消勾选项目将限制用户访问该项目</li>
                <li>• 已结束的项目无法修改权限设置</li>
                <li>• 权限变更需要保存后才能生效</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
