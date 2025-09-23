// 移动端合同权限管理页面
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { ArrowLeft, FileText } from 'lucide-react';

// 引用桌面端的合同权限组件
import ContractPermissionPage from '@/pages/Settings/ContractPermission';

export default function MobileContractPermission() {
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
            <h1 className="text-xl font-bold">合同权限</h1>
            <p className="text-sm text-muted-foreground">
              合同相关权限管理
            </p>
          </div>
        </div>

        {/* 使用桌面端组件，但适配移动端样式 */}
        <div className="mobile-contract-permission">
          <ContractPermissionPage />
        </div>
      </div>
    </MobileLayout>
  );
}
