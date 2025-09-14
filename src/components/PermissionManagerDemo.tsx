// 集成权限管理优化演示组件
// 文件: src/components/PermissionManagerDemo.tsx

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Shield, 
  Building2, 
  Settings,
  RefreshCw,
  Copy,
  CheckCircle
} from 'lucide-react';
import { UserCardSelector } from './UserCardSelector';

// 模拟用户数据
const mockUsers = [
  {
    id: '1',
    full_name: 'szf',
    email: 'dmuxue@gmail.com',
    role: 'admin',
    is_active: true
  },
  {
    id: '2',
    full_name: '张三',
    email: 'zhangsan@example.com',
    role: 'user',
    is_active: true
  },
  {
    id: '3',
    full_name: '李四',
    email: 'lisi@example.com',
    role: 'manager',
    is_active: false
  },
  {
    id: '4',
    full_name: '王五',
    email: 'wangwu@example.com',
    role: 'user',
    is_active: true
  }
];

export function PermissionManagerDemo() {
  const [activeTab, setActiveTab] = useState('permissions');
  const [selectedUserId, setSelectedUserId] = useState('1');

  const selectedUser = mockUsers.find(user => user.id === selectedUserId);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>集成权限管理 - 优化演示</CardTitle>
          <CardDescription>
            展示用户卡片选择和标签页蓝色底色的优化效果
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* 标签页导航 - 带蓝色底色 */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 bg-gray-100">
              <TabsTrigger 
                value="users" 
                className={`flex items-center gap-2 transition-all duration-200 ${
                  activeTab === 'users' 
                    ? 'bg-blue-500 text-white shadow-md' 
                    : 'hover:bg-gray-200'
                }`}
              >
                <Users className="h-4 w-4" />
                用户管理
              </TabsTrigger>
              <TabsTrigger 
                value="permissions" 
                className={`flex items-center gap-2 transition-all duration-200 ${
                  activeTab === 'permissions' 
                    ? 'bg-blue-500 text-white shadow-md' 
                    : 'hover:bg-gray-200'
                }`}
              >
                <Shield className="h-4 w-4" />
                权限配置
              </TabsTrigger>
              <TabsTrigger 
                value="contracts" 
                className={`flex items-center gap-2 transition-all duration-200 ${
                  activeTab === 'contracts' 
                    ? 'bg-blue-500 text-white shadow-md' 
                    : 'hover:bg-gray-200'
                }`}
              >
                <Building2 className="h-4 w-4" />
                合同权限
              </TabsTrigger>
              <TabsTrigger 
                value="templates" 
                className={`flex items-center gap-2 transition-all duration-200 ${
                  activeTab === 'templates' 
                    ? 'bg-blue-500 text-white shadow-md' 
                    : 'hover:bg-gray-200'
                }`}
              >
                <Settings className="h-4 w-4" />
                角色模板
              </TabsTrigger>
            </TabsList>

            {/* 权限配置标签页内容 */}
            <TabsContent value="permissions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>权限配置</CardTitle>
                  <CardDescription>
                    选择用户后配置个性化权限，支持可视化权限管理
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* 用户选择 - 卡片形式 */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">选择用户</label>
                      <UserCardSelector
                        users={mockUsers}
                        selectedUserId={selectedUserId}
                        onUserSelect={setSelectedUserId}
                      />
                    </div>

                    {/* 选中用户信息 */}
                    {selectedUser && (
                      <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <Users className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <h3 className="font-medium">{selectedUser.full_name}</h3>
                                <p className="text-sm text-gray-600">{selectedUser.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{selectedUser.role}</Badge>
                              <Badge variant={selectedUser.is_active ? "default" : "secondary"}>
                                {selectedUser.is_active ? "启用" : "禁用"}
                              </Badge>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm">
                                <RefreshCw className="h-4 w-4 mr-2" />
                                重置权限
                              </Button>
                              <Button variant="outline" size="sm">
                                <Copy className="h-4 w-4 mr-2" />
                                复制权限
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* 权限概览 */}
                    {selectedUser && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            权限概览
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-3 bg-gray-50 rounded-lg">
                              <div className="text-2xl font-bold text-blue-600">12</div>
                              <div className="text-sm text-gray-600">菜单权限</div>
                            </div>
                            <div className="text-center p-3 bg-gray-50 rounded-lg">
                              <div className="text-2xl font-bold text-green-600">8</div>
                              <div className="text-sm text-gray-600">功能权限</div>
                            </div>
                            <div className="text-center p-3 bg-gray-50 rounded-lg">
                              <div className="text-2xl font-bold text-purple-600">5</div>
                              <div className="text-sm text-gray-600">项目权限</div>
                            </div>
                            <div className="text-center p-3 bg-gray-50 rounded-lg">
                              <div className="text-2xl font-bold text-orange-600">3</div>
                              <div className="text-sm text-gray-600">数据权限</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 其他标签页内容 */}
            <TabsContent value="users" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>用户管理</CardTitle>
                  <CardDescription>管理用户信息和状态</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">用户管理功能内容...</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contracts" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>合同权限</CardTitle>
                  <CardDescription>管理合同相关权限</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">合同权限功能内容...</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="templates" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>角色模板</CardTitle>
                  <CardDescription>管理角色权限模板</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">角色模板功能内容...</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default PermissionManagerDemo;
