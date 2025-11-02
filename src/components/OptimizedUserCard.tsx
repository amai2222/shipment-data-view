// 优化的用户卡片组件 - 使用 React.memo 减少重新渲染
// 文件: src/components/OptimizedUserCard.tsx

import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Shield, Mail, Phone, Building2 } from 'lucide-react';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  work_wechat_userid?: string | null;
  work_wechat_name?: string | null;
  phone?: string | null;
  permissions?: {
    menu: string[];
    function: string[];
    project: string[];
    data: string[];
  };
}

interface OptimizedUserCardProps {
  user: User;
  isSelected: boolean;
  onSelect: (userId: string) => void;
  onEdit: (user: User) => void;
}

export const OptimizedUserCard = memo<OptimizedUserCardProps>(({ 
  user, 
  isSelected, 
  onSelect, 
  onEdit 
}) => {
  const handleCardClick = () => {
    onSelect(user.id);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(user);
  };

  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
        isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
      }`}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium">{user.full_name}</CardTitle>
              <p className="text-xs text-gray-600">{user.email}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEditClick}
            className="text-xs"
          >
            配置
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-2">
          {/* 角色和状态 */}
          <div className="flex items-center gap-2">
            <Badge 
              variant={
                user.role === 'admin' ? 'destructive' :
                user.role === 'operator' ? 'default' :
                'secondary'
              }
              className="text-xs"
            >
              <Shield className="h-3 w-3 mr-1" />
              {user.role}
            </Badge>
            <Badge 
              variant={user.is_active ? "default" : "secondary"}
              className="text-xs"
            >
              {user.is_active ? "启用" : "禁用"}
            </Badge>
          </div>

          {/* 企业微信信息 */}
          {user.work_wechat_userid && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Building2 className="h-3 w-3" />
              <span>企业微信: {user.work_wechat_name || user.work_wechat_userid}</span>
            </div>
          )}

          {/* 手机号 */}
          {user.phone && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Phone className="h-3 w-3" />
              <span>{user.phone}</span>
            </div>
          )}

          {/* 权限统计 */}
          {user.permissions && (
            <div className="text-xs text-gray-500">
              权限: 菜单({user.permissions.menu.length}) 功能({user.permissions.function.length}) 
              项目({user.permissions.project.length}) 数据({user.permissions.data.length})
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数，只在关键属性变化时重新渲染
  return (
    prevProps.user.id === nextProps.user.id &&
    prevProps.user.is_active === nextProps.user.is_active &&
    prevProps.user.role === nextProps.user.role &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.user.work_wechat_userid === nextProps.user.work_wechat_userid &&
    prevProps.user.phone === nextProps.user.phone &&
    JSON.stringify(prevProps.user.permissions) === JSON.stringify(nextProps.user.permissions)
  );
});

OptimizedUserCard.displayName = 'OptimizedUserCard';
