import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { AlertCircle, RefreshCw, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useShipperDashboardData } from './Dashboard/hooks/useShipperDashboardData';
import { ShipperSelector } from './Dashboard/components/ShipperSelector';
import { ShipperStatsCards } from './Dashboard/components/ShipperStatsCards';
import { PendingItemsCard } from './Dashboard/components/PendingItemsCard';
import { SubordinatesTable } from './Dashboard/components/SubordinatesTable';

export default function ShipperDashboard() {
  const { toast } = useToast();
  
  const {
    user,
    isLoading,
    stats,
    subordinates,
    availableShippers,
    dateRange,
    setDateRange,
    shipperScope,
    setShipperScope,
    selectedShipperId,
    setSelectedShipperId,
    isPartnerRole,
    loadData,
  } = useShipperDashboardData();

  // 导出报表
  const handleExport = () => {
    toast({
      title: '导出功能',
      description: '报表导出功能正在开发中...'
    });
  };

  // 合作方角色：暂时不支持
  if (isPartnerRole) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              功能开发中
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              合作方角色的货主看板功能正在开发中，请使用其他角色访问。
            </p>
            <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
              <p><strong>调试信息：</strong></p>
              <p>用户角色: {user?.role}</p>
              <p>用户ID: {user?.id}</p>
              <p>状态: 功能开发中</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 非合作方角色但没有可用货主
  if (!isPartnerRole && availableShippers.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              暂无数据
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              系统中还没有货主数据，请先在"合作方管理"中添加货主类型的合作方。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* 页面头部 */}
      <PageHeader
        title="货主看板"
        icon={Building2}
        description="货主数据统计和层级管理"
      >
        <ShipperSelector
          selectedShipperId={selectedShipperId}
          setSelectedShipperId={setSelectedShipperId}
          availableShippers={availableShippers}
          dateRange={dateRange}
          setDateRange={setDateRange}
          shipperScope={shipperScope}
          setShipperScope={setShipperScope}
          onExport={handleExport}
          onRefresh={loadData}
          isLoading={isLoading}
          isPartnerRole={isPartnerRole}
        />
      </PageHeader>

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>加载中...</span>
          </div>
        </div>
      )}

      {/* 主要内容 */}
      {!isLoading && stats && (
        <>
          {/* 总体统计 */}
          <ShipperStatsCards summary={stats.summary} />

          {/* 待处理事项 */}
          <PendingItemsCard pending={stats.pending} />

          {/* 下级货主列表 */}
          <SubordinatesTable data={subordinates} />
        </>
      )}
    </div>
  );
}
