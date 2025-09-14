// 用户卡片选择组件
// 文件: src/components/UserCardSelector.tsx

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, CheckCircle, Mail, Shield } from 'lucide-react';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface UserCardSelectorProps {
  users: User[];
  selectedUserId?: string;
  onUserSelect: (userId: string) => void;
  className?: string;
}

export function UserCardSelector({ 
  users, 
  selectedUserId, 
  onUserSelect, 
  className = "" 
}: UserCardSelectorProps) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto ${className}`}>
      {users.map(user => (
        <Card 
          key={user.id} 
          className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
            selectedUserId === user.id 
              ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-200' 
              : 'hover:bg-gray-50 border-gray-200'
          }`}
          onClick={() => onUserSelect(user.id)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {/* 用户头像和姓名 */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-gray-900">{user.full_name}</h3>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Mail className="h-3 w-3" />
                      {user.email}
                    </div>
                  </div>
                </div>

                {/* 角色和状态标签 */}
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="secondary" 
                    className="text-xs flex items-center gap-1"
                  >
                    <Shield className="h-3 w-3" />
                    {user.role}
                  </Badge>
                  <Badge 
                    variant={user.is_active ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {user.is_active ? "启用" : "禁用"}
                  </Badge>
                </div>
              </div>

              {/* 选中状态指示器 */}
              {selectedUserId === user.id && (
                <div className="flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-blue-500" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default UserCardSelector;
