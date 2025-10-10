import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  FileText, 
  RefreshCw, 
  Shield,
  Building2,
  Users
} from 'lucide-react';
import { ContractPermissionManager } from '@/components/contracts/ContractPermissionManagerEnhanced';
import { PageHeader } from '@/components/PageHeader';

export default function ContractPermissionPage() {
  const { toast } = useToast();

  // 处理权限更新
  const handlePermissionUpdate = () => {
    toast({
      title: "权限更新",
      description: "合同权限已更新",
    });
  };

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="合同权限"
        description="管理合同相关的权限配置"
        icon={FileText}
        iconColor="text-blue-600"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </PageHeader>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">合同管理</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">全局</div>
            <p className="text-xs text-muted-foreground">
              合同权限管理
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">权限类型</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">多级</div>
            <p className="text-xs text-muted-foreground">
              菜单 + 功能权限
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">管理模式</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">全局</div>
            <p className="text-xs text-muted-foreground">
              统一权限管理
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">状态</CardTitle>
            <Badge variant="default">
              已启用
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              合同权限管理已启用
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 合同权限管理组件 */}
      <Card>
        <CardContent>
          <ContractPermissionManager 
            mode="global"
            onPermissionUpdate={handlePermissionUpdate}
          />
        </CardContent>
      </Card>
    </div>
  );
}
