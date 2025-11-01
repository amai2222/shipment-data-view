import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { 
  ChevronDown, 
  ChevronRight, 
  Eye, 
  Edit, 
  Trash2, 
  Plus, 
  Settings,
  BarChart3,
  Users,
  FileText,
  Truck,
  Banknote,
  Shield,
  CheckCircle,
  XCircle,
  AlertCircle,
  Building2,
  Database
} from 'lucide-react';
import { MENU_PERMISSIONS, FUNCTION_PERMISSIONS, PROJECT_PERMISSIONS, DATA_PERMISSIONS } from '@/config/permissions';

interface PermissionVisualizerProps {
  userPermissions: {
    menu: string[];
    function: string[];
    project: string[];
    data: string[];
  };
  rolePermissions: {
    menu: string[];
    function: string[];
    project: string[];
    data: string[];
  };
  onPermissionChange?: (type: 'menu' | 'function' | 'project' | 'data', key: string, checked: boolean) => void;
  readOnly?: boolean;
}

// 菜单图标映射
const menuIcons: Record<string, React.ComponentType<any>> = {
  'dashboard': BarChart3,
  'business': Users,
  'contract': FileText,
  'transport': Truck,
  'finance': Banknote, // 使用Banknote图标表示财务相关功能
  'settings': Settings,
  'default': Eye
};

// 权限类型颜色
const permissionColors = {
  menu: 'bg-blue-100 text-blue-800 border-blue-200',
  function: 'bg-green-100 text-green-800 border-green-200',
  project: 'bg-purple-100 text-purple-800 border-purple-200',
  data: 'bg-orange-100 text-orange-800 border-orange-200'
};

export function PermissionVisualizer({ 
  userPermissions, 
  rolePermissions, 
  onPermissionChange,
  readOnly = false 
}: PermissionVisualizerProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    menu: true,
    function: true,
    project: true,
    data: true
  });

  // 计算权限统计
  const permissionStats = useMemo(() => {
    const stats = {
      menu: { total: 0, granted: 0, inherited: 0, custom: 0 },
      function: { total: 0, granted: 0, inherited: 0, custom: 0 },
      project: { total: 0, granted: 0, inherited: 0, custom: 0 },
      data: { total: 0, granted: 0, inherited: 0, custom: 0 }
    };

    // 计算菜单权限总数
    MENU_PERMISSIONS.forEach(menuGroup => {
      // 主菜单项
      stats.menu.total++;
      // 子菜单项
      if (menuGroup.children) {
        stats.menu.total += menuGroup.children.length;
      }
    });

    // 计算菜单权限已授权数量
    MENU_PERMISSIONS.forEach(menuGroup => {
      // 主菜单项
      const hasUserPermission = userPermissions.menu.includes(menuGroup.key);
      const hasRolePermission = rolePermissions.menu.includes(menuGroup.key);
      
      if (hasUserPermission || hasRolePermission) {
        stats.menu.granted++;
        if (hasRolePermission) {
          stats.menu.inherited++;
        } else {
          stats.menu.custom++;
        }
      }

      // 子菜单项
      if (menuGroup.children) {
        menuGroup.children.forEach(child => {
          const hasUserPermission = userPermissions.menu.includes(child.key);
          const hasRolePermission = rolePermissions.menu.includes(child.key);
          
          if (hasUserPermission || hasRolePermission) {
            stats.menu.granted++;
            if (hasRolePermission) {
              stats.menu.inherited++;
            } else {
              stats.menu.custom++;
            }
          }
        });
      }
    });

    // 计算功能权限总数
    FUNCTION_PERMISSIONS.forEach(funcGroup => {
      // 主功能组
      stats.function.total++;
      // 子功能项
      if (funcGroup.children) {
        stats.function.total += funcGroup.children.length;
      }
    });

    // 计算功能权限已授权数量
    FUNCTION_PERMISSIONS.forEach(funcGroup => {
      // 主功能组
      const hasUserPermission = userPermissions.function.includes(funcGroup.key);
      const hasRolePermission = rolePermissions.function.includes(funcGroup.key);
      
      if (hasUserPermission || hasRolePermission) {
        stats.function.granted++;
        if (hasRolePermission) {
          stats.function.inherited++;
        } else {
          stats.function.custom++;
        }
      }

      // 子功能项
      if (funcGroup.children) {
        funcGroup.children.forEach(child => {
          const hasUserPermission = userPermissions.function.includes(child.key);
          const hasRolePermission = rolePermissions.function.includes(child.key);
          
          if (hasUserPermission || hasRolePermission) {
            stats.function.granted++;
            if (hasRolePermission) {
              stats.function.inherited++;
            } else {
              stats.function.custom++;
            }
          }
        });
      }
    });

    // 计算项目权限总数
    PROJECT_PERMISSIONS.forEach(projectGroup => {
      // 主项目组
      stats.project.total++;
      // 子项目权限
      if (projectGroup.children) {
        stats.project.total += projectGroup.children.length;
      }
    });

    // 计算项目权限已授权数量
    PROJECT_PERMISSIONS.forEach(projectGroup => {
      // 主项目组
      const hasUserPermission = userPermissions.project.includes(projectGroup.key);
      const hasRolePermission = rolePermissions.project.includes(projectGroup.key);
      
      if (hasUserPermission || hasRolePermission) {
        stats.project.granted++;
        if (hasRolePermission) {
          stats.project.inherited++;
        } else {
          stats.project.custom++;
        }
      }

      // 子项目权限
      if (projectGroup.children) {
        projectGroup.children.forEach(permission => {
          const hasUserPermission = userPermissions.project.includes(permission.key);
          const hasRolePermission = rolePermissions.project.includes(permission.key);
          
          if (hasUserPermission || hasRolePermission) {
            stats.project.granted++;
            if (hasRolePermission) {
              stats.project.inherited++;
            } else {
              stats.project.custom++;
            }
          }
        });
      }
    });

    // 计算数据权限总数
    DATA_PERMISSIONS.forEach(dataGroup => {
      // 主数据组
      stats.data.total++;
      // 子数据权限
      if (dataGroup.children) {
        stats.data.total += dataGroup.children.length;
      }
    });

    // 计算数据权限已授权数量
    DATA_PERMISSIONS.forEach(dataGroup => {
      // 主数据组
      const hasUserPermission = userPermissions.data.includes(dataGroup.key);
      const hasRolePermission = rolePermissions.data.includes(dataGroup.key);
      
      if (hasUserPermission || hasRolePermission) {
        stats.data.granted++;
        if (hasRolePermission) {
          stats.data.inherited++;
        } else {
          stats.data.custom++;
        }
      }

      // 子数据权限
      if (dataGroup.children) {
        dataGroup.children.forEach(permission => {
          const hasUserPermission = userPermissions.data.includes(permission.key);
          const hasRolePermission = rolePermissions.data.includes(permission.key);
          
          if (hasUserPermission || hasRolePermission) {
            stats.data.granted++;
            if (hasRolePermission) {
              stats.data.inherited++;
            } else {
              stats.data.custom++;
            }
          }
        });
      }
    });

    return stats;
  }, [userPermissions, rolePermissions]);

  // 切换展开状态
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // 获取权限状态
  const getPermissionStatus = (type: 'menu' | 'function' | 'project' | 'data', key: string) => {
    const hasUserPermission = userPermissions[type].includes(key);
    const hasRolePermission = rolePermissions[type].includes(key);
    
    // 修复逻辑：如果用户没有特定权限但有角色权限，应该显示为"继承"
    if (hasRolePermission) {
      return hasUserPermission ? 'inherited' : 'inherited'; // 角色权限应该显示为继承
    } else if (hasUserPermission) {
      return 'custom';
    } else {
      return 'none';
    }
  };

  // 权限状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'inherited':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'custom':
        return <AlertCircle className="h-4 w-4 text-blue-600" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-300" />;
    }
  };

  // 权限状态标签
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'inherited':
        return <Badge variant="outline" className="text-green-700 border-green-300">继承</Badge>;
      case 'custom':
        return <Badge variant="outline" className="text-blue-700 border-blue-300">自定义</Badge>;
      default:
        return <Badge variant="outline" className="text-gray-400 border-gray-200">无权限</Badge>;
    }
  };

  // 渲染菜单权限
  const renderMenuPermissions = () => {
    const groupedMenus = MENU_PERMISSIONS.reduce((acc, menu) => {
      const group = menu.label || '其他';
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(menu);
      return acc;
    }, {} as Record<string, typeof MENU_PERMISSIONS>);

    return (
      <div className="space-y-4">
        {Object.entries(groupedMenus).map(([groupName, menus]) => (
          <Card key={groupName} className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-blue-700">
                {groupName}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {menus.map((menu) => {
                  const status = getPermissionStatus('menu', menu.key);
                  const Icon = menuIcons[menu.key.split('.')[0]] || menuIcons.default;
                  
                  return (
                    <div key={menu.key} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-gray-600" />
                        <div>
                          <div className="font-medium text-sm">{menu.label}</div>
                          <div className="text-xs text-gray-500">{menu.key}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(status)}
                        {getStatusBadge(status)}
                        {!readOnly && (
                          <Checkbox
                            checked={userPermissions.menu.includes(menu.key)}
                            onCheckedChange={(checked) => 
                              onPermissionChange?.('menu', menu.key, checked as boolean)
                            }
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  // 渲染功能权限
  const renderFunctionPermissions = () => {
    const groupedFunctions = FUNCTION_PERMISSIONS.reduce((acc, func) => {
      const group = func.label || '其他';
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(func);
      return acc;
    }, {} as Record<string, typeof FUNCTION_PERMISSIONS>);

    return (
      <div className="space-y-4">
        {Object.entries(groupedFunctions).map(([groupName, functions]) => (
          <Card key={groupName} className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-green-700">
                {groupName}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {functions.map((func) => {
                  const status = getPermissionStatus('function', func.key);
                  
                  return (
                    <div key={func.key} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
                      <div className="flex items-center gap-3">
                        <Settings className="h-4 w-4 text-gray-600" />
                        <div>
                          <div className="font-medium text-sm">{func.label}</div>
                          <div className="text-xs text-gray-500">{func.key}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(status)}
                        {getStatusBadge(status)}
                        {!readOnly && (
                          <Checkbox
                            checked={userPermissions.function.includes(func.key)}
                            onCheckedChange={(checked) => 
                              onPermissionChange?.('function', func.key, checked as boolean)
                            }
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 权限概览 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            权限概览
          </CardTitle>
          <CardDescription>
            当前用户的权限配置情况
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(permissionStats).map(([type, stats]) => (
              <div key={type} className="text-center">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${permissionColors[type as keyof typeof permissionColors]}`}>
                  {type === 'menu' ? '菜单权限' : 
                   type === 'function' ? '功能权限' :
                   type === 'project' ? '项目权限' : '数据权限'}
                </div>
                <div className="mt-2 space-y-1">
                  <div className="text-2xl font-bold">{stats.granted}</div>
                  <div className="text-xs text-gray-500">
                    已授权 / {stats.total} 总计
                  </div>
                  <div className="flex justify-center gap-1 text-xs">
                    <Badge variant="outline" className="text-green-600">
                      继承 {stats.inherited}
                    </Badge>
                    <Badge variant="outline" className="text-blue-600">
                      自定义 {stats.custom}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 菜单权限详情 */}
      <Card>
        <Collapsible 
          open={expandedSections.menu} 
          onOpenChange={() => toggleSection('menu')}
        >
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {expandedSections.menu ? 
                    <ChevronDown className="h-4 w-4" /> : 
                    <ChevronRight className="h-4 w-4" />
                  }
                  <CardTitle className="text-lg">菜单权限</CardTitle>
                  <Badge variant="outline" className="bg-blue-100 text-blue-800">
                    {permissionStats.menu.granted} / {permissionStats.menu.total}
                  </Badge>
                </div>
                <div className="text-sm text-gray-500">
                  控制用户可访问的菜单项
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {renderMenuPermissions()}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* 功能权限详情 */}
      <Card>
        <Collapsible 
          open={expandedSections.function} 
          onOpenChange={() => toggleSection('function')}
        >
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {expandedSections.function ? 
                    <ChevronDown className="h-4 w-4" /> : 
                    <ChevronRight className="h-4 w-4" />
                  }
                  <CardTitle className="text-lg">功能权限</CardTitle>
                  <Badge variant="outline" className="bg-green-100 text-green-800">
                    {permissionStats.function.granted} / {permissionStats.function.total}
                  </Badge>
                </div>
                <div className="text-sm text-gray-500">
                  控制用户可执行的操作
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {renderFunctionPermissions()}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* 项目权限详情 */}
      <Card>
        <Collapsible 
          open={expandedSections.project} 
          onOpenChange={() => toggleSection('project')}
        >
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {expandedSections.project ? 
                    <ChevronDown className="h-4 w-4" /> : 
                    <ChevronRight className="h-4 w-4" />
                  }
                  <CardTitle className="text-lg">项目权限</CardTitle>
                  <Badge variant="outline" className="bg-purple-100 text-purple-800">
                    {permissionStats.project.granted} / {permissionStats.project.total}
                  </Badge>
                </div>
                <div className="text-sm text-gray-500">
                  控制用户可访问的项目范围
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <h4 className="font-medium text-purple-800 mb-2">项目权限说明</h4>
                  <p className="text-sm text-purple-700">
                    默认情况下，用户拥有所有项目的访问权限。可以通过取消勾选来限制用户访问特定项目。
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PROJECT_PERMISSIONS.map((projectGroup) => {
                    const hasGroupUserPermission = userPermissions.project.includes(projectGroup.key);
                    const hasGroupRolePermission = rolePermissions.project.includes(projectGroup.key);
                    
                    let groupStatus = 'none';
                    if (hasGroupRolePermission) {
                      groupStatus = 'inherited';
                    } else if (hasGroupUserPermission) {
                      groupStatus = 'custom';
                    }
                    
                    return (
                      <Card key={projectGroup.key} className="border-l-4 border-l-purple-500">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-purple-700">
                              {projectGroup.label}
                            </CardTitle>
                            {/* 显示分组key的勾选状态 */}
                            <div className="flex items-center gap-2">
                              {getStatusIcon(groupStatus)}
                              {getStatusBadge(groupStatus)}
                              {!readOnly && (
                                <Checkbox
                                  checked={hasGroupRolePermission || hasGroupUserPermission}
                                  onCheckedChange={(checked) => 
                                    onPermissionChange?.('project', projectGroup.key, checked as boolean)
                                  }
                                />
                              )}
                            </div>
                          </div>
                          <CardDescription className="text-xs">
                            分组权限key: {projectGroup.key}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-3">
                            {projectGroup.children?.map((permission) => {
                              const hasUserPermission = userPermissions.project.includes(permission.key);
                              const hasRolePermission = rolePermissions.project.includes(permission.key);
                              
                              let status = 'none';
                              if (hasRolePermission) {
                                status = 'inherited';
                              } else if (hasUserPermission) {
                                status = 'custom';
                              }
                              
                              return (
                                <div key={permission.key} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 ml-4">
                                  <div className="flex items-center gap-3">
                                    <Building2 className="h-4 w-4 text-gray-600" />
                                    <div>
                                      <div className="font-medium text-sm">{permission.label}</div>
                                      <div className="text-xs text-gray-500">{permission.description}</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {getStatusIcon(status)}
                                    {getStatusBadge(status)}
                                    {!readOnly && (
                                      <Checkbox
                                        checked={hasRolePermission || hasUserPermission}
                                        onCheckedChange={(checked) => 
                                          onPermissionChange?.('project', permission.key, checked as boolean)
                                        }
                                      />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* 数据权限详情 */}
      <Card>
        <Collapsible 
          open={expandedSections.data} 
          onOpenChange={() => toggleSection('data')}
        >
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {expandedSections.data ? 
                    <ChevronDown className="h-4 w-4" /> : 
                    <ChevronRight className="h-4 w-4" />
                  }
                  <CardTitle className="text-lg">数据权限</CardTitle>
                  <Badge variant="outline" className="bg-orange-100 text-orange-800">
                    {permissionStats.data.granted} / {permissionStats.data.total}
                  </Badge>
                </div>
                <div className="text-sm text-gray-500">
                  控制用户可查看和操作的数据范围
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DATA_PERMISSIONS.map((dataGroup) => {
                  const hasGroupUserPermission = userPermissions.data.includes(dataGroup.key);
                  const hasGroupRolePermission = rolePermissions.data.includes(dataGroup.key);
                  
                  let groupStatus = 'none';
                  if (hasGroupRolePermission) {
                    groupStatus = 'inherited';
                  } else if (hasGroupUserPermission) {
                    groupStatus = 'custom';
                  }
                  
                  return (
                    <Card key={dataGroup.key} className="border-l-4 border-l-purple-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Database className="h-4 w-4 text-purple-600" />
                            {dataGroup.label}
                          </CardTitle>
                          {/* 显示分组key的勾选状态 */}
                          <div className="flex items-center gap-2">
                            {getStatusIcon(groupStatus)}
                            {getStatusBadge(groupStatus)}
                            {!readOnly && (
                              <Checkbox
                                checked={hasGroupRolePermission || hasGroupUserPermission}
                                onCheckedChange={(checked) => 
                                  onPermissionChange?.('data', dataGroup.key, checked as boolean)
                                }
                              />
                            )}
                          </div>
                        </div>
                        <CardDescription className="text-xs">
                          分组权限key: {dataGroup.key}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-3">
                          {dataGroup.children?.map((permission) => {
                            const hasUserPermission = userPermissions.data.includes(permission.key);
                            const hasRolePermission = rolePermissions.data.includes(permission.key);
                          
                            let status = 'none';
                            if (hasRolePermission) {
                              status = 'inherited';
                            } else if (hasUserPermission) {
                              status = 'custom';
                            }
                            
                            return (
                              <div key={permission.key} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 ml-4">
                                <div className="flex items-center gap-3">
                                  <Database className="h-4 w-4 text-gray-600" />
                                  <div>
                                    <div className="font-medium text-sm">{permission.label}</div>
                                    <div className="text-xs text-gray-500">{permission.description}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(status)}
                                  {getStatusBadge(status)}
                                  {!readOnly && (
                                    <Checkbox
                                      checked={hasRolePermission || hasUserPermission}
                                      onCheckedChange={(checked) => 
                                        onPermissionChange?.('data', permission.key, checked as boolean)
                                      }
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
