// 移动端角色模板管理页面
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { ArrowLeft, Settings } from 'lucide-react';

// 引用桌面端的角色模板组件
import RoleTemplatePage from '@/pages/Settings/RoleTemplate';

export default function MobileRoleTemplate() {
  const navigate = useNavigate();

  return (
    <MobileLayout>
      <div className="space-y-4">
        {/* 移动端头部 */}
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/m/settings')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">角色模板</h1>
            <p className="text-sm text-muted-foreground">
              管理角色权限模板
            </p>
          </div>
        </div>

        {/* 使用桌面端组件，但适配移动端样式 */}
        <div className="mobile-role-template">
          <RoleTemplatePage />
        </div>
      </div>
    </MobileLayout>
  );
}
