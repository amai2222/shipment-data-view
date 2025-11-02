// 货主看板 - 桌面端（最小化版本）
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { Package, Weight, DollarSign, Briefcase, AlertCircle, Download, RefreshCw, Building2 } from 'lucide-react';
import { format, subDays } from 'date-fns';

// 类型定义
interface ShipperDashboardStats {
  summary: {
    totalRecords: number;
    totalWeight: number;
    totalAmount: number;
    selfRecords: number;
    selfWeight: number;
    selfAmount: number;
    subordinatesRecords: number;
    subordinatesWeight: number;
    subordinatesAmount: number;
    activeProjects: number;
    activeDrivers: number;
  };
  pending: {
    pendingPayments: number;
    pendingInvoices: number;
    overduePayments: number;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

interface SubordinateShipper {
  shipper_id: string;
  shipper_name: string;
  hierarchy_depth: number;
  parent_id: string | null;
  parent_name: string | null;
  record_count: number;
  total_weight: number;
  total_amount: number;
  active_projects: number;
  pending_payments: number;
  pending_invoices: number;
}

// 格式化数字
const formatNumber = (num: number) => {
  if (num >= 10000) return `${(num / 10000).toFixed(2)}万`;
  return num.toLocaleString('zh-CN');
};

// 格式化金额
const formatCurrency = (num: number) => {
  if (num >= 10000) return `¥${(num / 10000).toFixed(2)}万`;
  return `¥${num.toLocaleString('zh-CN')}`;
};

// 格式化重量
const formatWeight = (num: number) => {
  return `${num.toFixed(2)}吨`;
};

export default function ShipperDashboard() {
  const { user } = useAuth() as { user: { role: string; id: string } | null };
  const { toast } = useToast();

  // 状态管理
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<ShipperDashboardStats | null>(null);
  const [subordinates, setSubordinates] = useState<SubordinateShipper[]>([]);
  const [availableShippers, setAvailableShippers] = useState<Array<{id: string, name: string}>>([]);
  
  // 筛选器状态
  const [dateRange, setDateRange] = useState<'7days' | '30days' | 'thisMonth' | 'lastMonth'>('30days');
  const [shipperScope, setShipperScope] = useState<'all' | 'self' | 'direct'>('all');
  const [selectedShipperId, setSelectedShipperId] = useState<string | null>(null);

  // 判断用户类型和权限
  const userRole = user?.role || 'viewer';
  const isPartnerRole = userRole === 'partner';
  const currentShipperId = isPartnerRole ? null : selectedShipperId;

  // 计算日期范围
  const getDateRange = (range: string) => {
    const today = new Date();
    let startDate: Date;
    
    switch (range) {
      case '7days':
        startDate = subDays(today, 7);
        break;
      case '30days':
        startDate = subDays(today, 30);
        break;
      case 'thisMonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'lastMonth': {
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        return {
          startDate: format(lastMonth, 'yyyy-MM-dd'),
          endDate: format(lastMonthEnd, 'yyyy-MM-dd')
        };
      }
      default:
        startDate = subDays(today, 30);
    }
    
    return {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(today, 'yyyy-MM-dd')
    };
  };

  // 加载可用货主列表（非合作方角色使用）
  const loadAvailableShippers = useCallback(async () => {
    if (isPartnerRole) return;
    
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('id, name')
        .eq('partner_type', '货主')
        .eq('is_root', true)
        .order('name');
      
      if (error) throw error;
      
      setAvailableShippers(data || []);
      
      // 如果还没有选择货主，默认选择第一个
      if (!selectedShipperId && data && data.length > 0) {
        setSelectedShipperId(data[0].id);
      }
    } catch (error: unknown) {
      console.error('加载货主列表失败:', error);
    }
  }, [isPartnerRole, selectedShipperId]);

  // 加载数据
  const loadData = useCallback(async () => {
    // 合作方角色：暂时不支持（需要实现用户-合作方关联）
    if (isPartnerRole) {
      toast({
        title: '功能暂未开放',
        description: '合作方角色的货主看板功能正在开发中，请使用其他角色访问',
        variant: 'destructive'
      });
      setIsLoading(false);
      return;
    }
    
    // 非合作方角色：必须选择一个货主
    if (!isPartnerRole && !currentShipperId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const dates = getDateRange(dateRange);
      
      // 加载总体统计
      const { data: statsData, error: statsError } = await supabase.rpc(
        'get_shipper_dashboard_stats',
        {
          p_shipper_id: currentShipperId,
          p_start_date: dates.startDate,
          p_end_date: dates.endDate,
          p_include_self: shipperScope !== 'direct',
          p_include_subordinates: shipperScope !== 'self'
        }
      );

      if (statsError) throw statsError;
      setStats(statsData as unknown as ShipperDashboardStats);

      // 加载下级货主列表
      const { data: subordinatesData, error: subordinatesError } = await supabase.rpc(
        'get_subordinate_shippers_stats',
        {
          p_shipper_id: currentShipperId,
          p_start_date: dates.startDate,
          p_end_date: dates.endDate
        }
      );

      if (subordinatesError) throw subordinatesError;
      setSubordinates(subordinatesData as unknown as SubordinateShipper[] || []);

    } catch (error: unknown) {
      console.error('加载失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast({
        title: '加载失败',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [isPartnerRole, currentShipperId, dateRange, shipperScope, toast]);

  // 初始加载可用货主列表
  useEffect(() => {
    if (!isPartnerRole) {
      loadAvailableShippers();
    }
  }, [isPartnerRole, loadAvailableShippers]);

  // 初始加载和筛选器变化时重新加载
  useEffect(() => {
    if (currentShipperId) {
      loadData();
    }
  }, [currentShipperId, loadData]);

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
        <div className="flex items-center gap-4">
          {/* 货主选择（非合作方角色显示） */}
          {!isPartnerRole && availableShippers.length > 0 && (
            <Select value={selectedShipperId || ''} onValueChange={setSelectedShipperId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="选择货主" />
              </SelectTrigger>
              <SelectContent>
                {availableShippers.map(shipper => (
                  <SelectItem key={shipper.id} value={shipper.id}>
                    {shipper.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* 时间范围筛选 */}
          <Select value={dateRange} onValueChange={(value: '7days' | '30days' | 'thisMonth' | 'lastMonth') => setDateRange(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">最近7天</SelectItem>
              <SelectItem value="30days">最近30天</SelectItem>
              <SelectItem value="thisMonth">本月</SelectItem>
              <SelectItem value="lastMonth">上月</SelectItem>
            </SelectContent>
          </Select>

          {/* 货主范围筛选 */}
          <Select value={shipperScope} onValueChange={(value: 'all' | 'self' | 'direct') => setShipperScope(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="self">仅本级</SelectItem>
              <SelectItem value="direct">仅下级</SelectItem>
            </SelectContent>
          </Select>

          {/* 操作按钮 */}
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出报表
          </Button>
          
          <Button onClick={loadData} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总运单数</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(stats.summary.totalRecords)}</div>
                <p className="text-xs text-muted-foreground">
                  本级: {formatNumber(stats.summary.selfRecords)} | 下级: {formatNumber(stats.summary.subordinatesRecords)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总重量</CardTitle>
                <Weight className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatWeight(stats.summary.totalWeight)}</div>
                <p className="text-xs text-muted-foreground">
                  本级: {formatWeight(stats.summary.selfWeight)} | 下级: {formatWeight(stats.summary.subordinatesWeight)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总金额</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.summary.totalAmount)}</div>
                <p className="text-xs text-muted-foreground">
                  本级: {formatCurrency(stats.summary.selfAmount)} | 下级: {formatCurrency(stats.summary.subordinatesAmount)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">活跃项目</CardTitle>
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.summary.activeProjects}</div>
                <p className="text-xs text-muted-foreground">
                  活跃司机: {stats.summary.activeDrivers}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 待处理事项 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                待处理事项
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <DollarSign className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">待付款</p>
                    <p className="text-2xl font-bold">{stats.pending.pendingPayments}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Download className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">待开票</p>
                    <p className="text-2xl font-bold">{stats.pending.pendingInvoices}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">逾期付款</p>
                    <p className="text-2xl font-bold">{stats.pending.overduePayments}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 下级货主列表 */}
          {subordinates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>下级货主</CardTitle>
                <CardDescription>下级货主的运单统计</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>货主名称</TableHead>
                      <TableHead>层级</TableHead>
                      <TableHead>运单数</TableHead>
                      <TableHead>总重量</TableHead>
                      <TableHead>总金额</TableHead>
                      <TableHead>活跃项目</TableHead>
                      <TableHead>待付款</TableHead>
                      <TableHead>待开票</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subordinates.map((shipper) => (
                      <TableRow key={shipper.shipper_id}>
                        <TableCell className="font-medium">{shipper.shipper_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            第{shipper.hierarchy_depth}级
                          </Badge>
                        </TableCell>
                        <TableCell>{formatNumber(shipper.record_count)}</TableCell>
                        <TableCell>{formatWeight(shipper.total_weight)}</TableCell>
                        <TableCell>{formatCurrency(shipper.total_amount)}</TableCell>
                        <TableCell>{shipper.active_projects}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {shipper.pending_payments}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {shipper.pending_invoices}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}