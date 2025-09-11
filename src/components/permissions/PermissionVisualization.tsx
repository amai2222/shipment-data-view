// 权限可视化展示组件

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Users, 
  Shield,
  Eye,
  AlertCircle
} from 'lucide-react';
import { ROLES, MENU_PERMISSIONS, FUNCTION_PERMISSIONS } from '@/config/permissions';

interface PermissionVisualizationProps {
  users: any[];
  roleTemplates: any[];
  userPermissions: any[];
}

export function PermissionVisualization({ 
  users, 
  roleTemplates, 
  userPermissions 
}: PermissionVisualizationProps) {
  
  // 角色分布统计
  const roleDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    users.forEach(user => {
      distribution[user.role] = (distribution[user.role] || 0) + 1;
    });
    return distribution;
  }, [users]);

  // 权限覆盖率统计
  const permissionCoverage = useMemo(() => {
    const totalMenuPermissions = Object.values(MENU_PERMISSIONS).reduce((acc, group) => 
      acc + (group.children?.length || 0), 0
    );
    const totalFunctionPermissions = Object.values(FUNCTION_PERMISSIONS).reduce((acc, group) => 
      acc + (group.children?.length || 0), 0
    );

    return roleTemplates.map(template => ({
      role: template.role,
      name: template.name || template.role,
      color: template.color || ROLES[template.role]?.color || 'bg-gray-500',
      menuCoverage: ((template.menu_permissions?.length || 0) / totalMenuPermissions) * 100,
      functionCoverage: ((template.function_permissions?.length || 0) / totalFunctionPermissions) * 100,
      menuCount: template.menu_permissions?.length || 0,
      functionCount: template.function_permissions?.length || 0
    }));
  }, [roleTemplates]);

  // 活跃用户统计
  const activeUserStats = useMemo(() => {
    const activeUsers = users.filter(user => user.is_active).length;
    const inactiveUsers = users.length - activeUsers;
    const customPermissionUsers = userPermissions.length;
    
    return {
      active: activeUsers,
      inactive: inactiveUsers,
      customPermissions: customPermissionUsers,
      total: users.length
    };
  }, [users, userPermissions]);

  // 权限安全风险评估
  const securityRisks = useMemo(() => {
    const risks = [];
    
    // 检查是否有用户拥有过多权限
    const adminUsers = users.filter(user => user.role === 'admin').length;
    if (adminUsers > users.length * 0.2) {
      risks.push({
        level: 'high',
        message: `管理员用户过多 (${adminUsers}/${users.length})`
      });
    }

    // 检查是否有禁用的用户
    const inactiveUsers = users.filter(user => !user.is_active).length;
    if (inactiveUsers > 0) {
      risks.push({
        level: 'medium',
        message: `${inactiveUsers} 个用户已禁用`
      });
    }

    // 检查是否有用户没有分配角色
    const usersWithoutRole = users.filter(user => !user.role).length;
    if (usersWithoutRole > 0) {
      risks.push({
        level: 'high',
        message: `${usersWithoutRole} 个用户没有分配角色`
      });
    }

    return risks;
  }, [users]);

  return (
    <div className="space-y-6">
      {/* 概览统计 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活跃用户</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeUserStats.active}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round((activeUserStats.active / activeUserStats.total) * 100)}% 用户活跃
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">禁用用户</CardTitle>
            <Users className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{activeUserStats.inactive}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round((activeUserStats.inactive / activeUserStats.total) * 100)}% 用户禁用
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">自定义权限</CardTitle>
            <Shield className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{activeUserStats.customPermissions}</div>
            <p className="text-xs text-muted-foreground">用户特殊权限配置</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">安全风险</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{securityRisks.length}</div>
            <p className="text-xs text-muted-foreground">发现的安全风险</p>
          </CardContent>
        </Card>
      </div>

      {/* 角色分布图表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <PieChart className="h-5 w-5 mr-2" />
            角色分布统计
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Object.entries(roleDistribution).map(([role, count]) => (
              <div key={role} className="text-center">
                <div className={`w-16 h-16 rounded-full ${ROLES[role]?.color || 'bg-gray-500'} mx-auto mb-2 flex items-center justify-center`}>
                  <span className="text-white text-xl font-bold">{count}</span>
                </div>
                <p className="text-sm font-medium">{ROLES[role]?.label || role}</p>
                <p className="text-xs text-muted-foreground">
                  {Math.round((count / users.length) * 100)}%
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 权限覆盖率 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            角色权限覆盖率
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {permissionCoverage.map(coverage => (
            <div key={coverage.role} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`w-4 h-4 rounded-full ${coverage.color} mr-2`} />
                  <span className="font-medium">{coverage.name}</span>
                </div>
                <div className="flex space-x-4 text-sm text-muted-foreground">
                  <span>菜单: {coverage.menuCount}</span>
                  <span>功能: {coverage.functionCount}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>菜单权限覆盖率</span>
                  <span>{Math.round(coverage.menuCoverage)}%</span>
                </div>
                <Progress value={coverage.menuCoverage} className="h-2" />
                
                <div className="flex items-center justify-between text-sm">
                  <span>功能权限覆盖率</span>
                  <span>{Math.round(coverage.functionCoverage)}%</span>
                </div>
                <Progress value={coverage.functionCoverage} className="h-2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 安全风险提醒 */}
      {securityRisks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-yellow-600">
              <AlertCircle className="h-5 w-5 mr-2" />
              安全风险提醒
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {securityRisks.map((risk, index) => (
                <div 
                  key={index} 
                  className={`flex items-center p-3 rounded-lg ${
                    risk.level === 'high' ? 'bg-red-50 border border-red-200' :
                    risk.level === 'medium' ? 'bg-yellow-50 border border-yellow-200' :
                    'bg-blue-50 border border-blue-200'
                  }`}
                >
                  <AlertCircle className={`h-4 w-4 mr-2 ${
                    risk.level === 'high' ? 'text-red-500' :
                    risk.level === 'medium' ? 'text-yellow-500' :
                    'text-blue-500'
                  }`} />
                  <span className="text-sm">{risk.message}</span>
                  <Badge 
                    variant="outline" 
                    className={`ml-auto ${
                      risk.level === 'high' ? 'border-red-300 text-red-700' :
                      risk.level === 'medium' ? 'border-yellow-300 text-yellow-700' :
                      'border-blue-300 text-blue-700'
                    }`}
                  >
                    {risk.level === 'high' ? '高风险' : 
                     risk.level === 'medium' ? '中风险' : '低风险'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}