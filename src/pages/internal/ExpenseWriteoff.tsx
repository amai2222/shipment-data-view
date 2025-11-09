// PC端 - 费用冲销管理
// 管理员可以查看和管理所有司机的费用冲销记录

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { PageHeader } from '@/components/PageHeader';
import {
  FileText,
  Calculator,
  DollarSign,
  RefreshCw,
  Eye,
  Loader2,
  TrendingUp,
  TrendingDown,
  Download,
  Search
} from 'lucide-react';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EXPENSE_TYPES: Record<string, { label: string; color: string }> = {
  fuel: { label: '🛢️ 加油费', color: 'bg-blue-100 text-blue-800' },
  charging: { label: '⚡ 充电费', color: 'bg-emerald-100 text-emerald-800' },
  car_wash: { label: '🚿 洗车费', color: 'bg-cyan-100 text-cyan-800' },
  parking: { label: '🅿️ 停车费', color: 'bg-green-100 text-green-800' },
  toll: { label: '🛣️ 过路费', color: 'bg-yellow-100 text-yellow-800' },
  maintenance: { label: '🔧 维修费', color: 'bg-red-100 text-red-800' },
  fine: { label: '⚠️ 罚款', color: 'bg-orange-100 text-orange-800' },
  meal: { label: '🍔 餐费', color: 'bg-purple-100 text-purple-800' },
  accommodation: { label: '🏨 住宿费', color: 'bg-pink-100 text-pink-800' },
  other: { label: '📝 其他', color: 'bg-gray-100 text-gray-800' }
};

interface ExpenseApplication {
  id: string;
  application_number: string;
  driver_name: string;
  expense_date: string;
  expense_type: string;
  amount: number;
  actual_amount: number | null;
  description: string;
  status: string;
  created_at: string;
  writeoff_time: string | null;
}

interface DriverBalance {
  fleet_manager_id: string;
  fleet_manager_name: string;
  driver_id: string;
  driver_name: string;
  balance: number;
}

interface FleetManagerGroup {
  fleet_manager_id: string;
  fleet_manager_name: string;
  drivers: DriverBalance[];
  totalBalance: number;
}

export default function ExpenseWriteoff() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [applications, setApplications] = useState<ExpenseApplication[]>([]);
  const [filteredApplications, setFilteredApplications] = useState<ExpenseApplication[]>([]);
  const [mainTab, setMainTab] = useState('writeoff');  // ✅ 主标签页：费用冲销 / 司机余额
  const [statusFilter, setStatusFilter] = useState('all');  // ✅ 费用冲销列表的状态筛选：全部 / 待冲销 / 已冲销
  const [selectedApp, setSelectedApp] = useState<ExpenseApplication | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [searchTerm, setSearchTerm] = useState('');
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [drivers, setDrivers] = useState<{ name: string }[]>([]);
  
  // ✅ 司机余额相关状态
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [fleetManagerGroups, setFleetManagerGroups] = useState<FleetManagerGroup[]>([]);
  const [selectedFleetManager, setSelectedFleetManager] = useState<string>('all');

  // 统计数据
  const [stats, setStats] = useState({
    totalApproved: 0,
    totalWriteoffed: 0,
    totalBalance: 0,
    totalSurplus: 0,
    totalDeficit: 0
  });

  useEffect(() => {
    if (mainTab === 'writeoff') {
      loadApplications();
      loadDrivers();
    } else if (mainTab === 'balance') {
      loadDriverBalances();
    }
  }, [mainTab]);

  useEffect(() => {
    filterApplications();
  }, [applications, statusFilter, searchTerm, driverFilter]);

  // 加载司机列表
  const loadDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('internal_driver_expense_applications')
        .select('driver_name')
        .not('driver_name', 'is', null);
      
      if (error) throw error;
      
      const uniqueDrivers = Array.from(
        new Set((data || []).map((d: any) => d.driver_name))
      ).map(name => ({ name }));
      
      setDrivers(uniqueDrivers);
    } catch (error: any) {
      console.error('加载司机列表失败:', error);
    }
  };

  // 加载费用申请列表
  const loadApplications = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('internal_driver_expense_applications')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      
      const { data, error } = await query;

      if (error) throw error;
      
      const apps = (data || []) as ExpenseApplication[];
      setApplications(apps);
      
      // 计算统计数据
      const totalApproved = apps.length;
      const totalWriteoffed = apps.filter(a => a.actual_amount !== null).length;
      const totalBalance = apps.reduce((sum, a) => {
        const actual = a.actual_amount ?? a.amount;
        return sum + (a.amount - actual);
      }, 0);
      const totalSurplus = apps
        .filter(a => a.actual_amount !== null && a.amount > a.actual_amount)
        .reduce((sum, a) => sum + (a.amount - a.actual_amount!), 0);
      const totalDeficit = apps
        .filter(a => a.actual_amount !== null && a.amount < a.actual_amount)
        .reduce((sum, a) => sum + (a.actual_amount! - a.amount), 0);
      
      setStats({
        totalApproved,
        totalWriteoffed,
        totalBalance,
        totalSurplus,
        totalDeficit
      });
    } catch (error: any) {
      console.error('加载失败:', error);
      toast({
        title: '加载失败',
        description: error.message || '无法加载费用申请',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // 过滤申请列表
  const filterApplications = () => {
    let filtered = [...applications];

    // 按状态过滤
    if (statusFilter === 'writeoffed') {
      filtered = filtered.filter(a => a.actual_amount !== null);
    } else if (statusFilter === 'pending') {
      filtered = filtered.filter(a => a.actual_amount === null);
    }

    // 按司机过滤
    if (driverFilter !== 'all') {
      filtered = filtered.filter(a => a.driver_name === driverFilter);
    }

    // 按搜索关键词过滤
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(a =>
        a.application_number.toLowerCase().includes(term) ||
        a.driver_name.toLowerCase().includes(term) ||
        (a.description && a.description.toLowerCase().includes(term))
      );
    }

    setFilteredApplications(filtered);
    setPage(1);
  };

  // 计算结余
  const calculateBalance = (app: ExpenseApplication): number | null => {
    if (app.actual_amount === null) return null;
    return app.amount - app.actual_amount;
  };

  // ✅ 加载司机余额（按车队长分组）
  const loadDriverBalances = async () => {
    setLoadingBalances(true);
    try {
      const { data, error } = await supabase.rpc('get_driver_balances_by_fleet_manager');
      
      if (error) throw error;
      
      // 按车队长分组
      const grouped = new Map<string, FleetManagerGroup>();
      
      (data || []).forEach((item: DriverBalance) => {
        const key = item.fleet_manager_id || 'unassigned';
        
        if (!grouped.has(key)) {
          grouped.set(key, {
            fleet_manager_id: item.fleet_manager_id || '',
            fleet_manager_name: item.fleet_manager_name,
            drivers: [],
            totalBalance: 0
          });
        }
        
        const group = grouped.get(key)!;
        group.drivers.push(item);
        group.totalBalance += item.balance;
      });
      
      // 转换为数组并排序
      const groups = Array.from(grouped.values()).sort((a, b) => {
        if (a.fleet_manager_name === '未分配') return 1;
        if (b.fleet_manager_name === '未分配') return -1;
        return a.fleet_manager_name.localeCompare(b.fleet_manager_name);
      });
      
      setFleetManagerGroups(groups);
    } catch (error: any) {
      console.error('加载司机余额失败:', error);
      toast({
        title: '加载失败',
        description: error.message || '无法加载司机余额',
        variant: 'destructive'
      });
    } finally {
      setLoadingBalances(false);
    }
  };

  // 分页
  const paginatedApps = filteredApplications.slice(
    (page - 1) * pageSize,
    page * pageSize
  );
  const totalPages = Math.ceil(filteredApplications.length / pageSize);

  // ✅ 过滤车队长的司机余额
  const filteredFleetManagerGroups = selectedFleetManager === 'all'
    ? fleetManagerGroups
    : fleetManagerGroups.filter(g => g.fleet_manager_id === selectedFleetManager);

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="费用冲销管理"
        description="查看和管理所有司机的费用冲销记录"
        icon={Calculator}
        iconColor="text-orange-600"
      />

      {/* ✅ 标签页 */}
      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="writeoff">费用冲销</TabsTrigger>
          <TabsTrigger value="balance">司机余额</TabsTrigger>
        </TabsList>

        {/* ✅ 费用冲销标签页 */}
        <TabsContent value="writeoff" className="space-y-4">

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">已审核通过</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalApproved}</div>
            <p className="text-xs text-muted-foreground mt-1">总申请数</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-600">已冲销</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.totalWriteoffed}</div>
            <p className="text-xs text-muted-foreground mt-1">已冲销数</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              总余额
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ¥{stats.totalBalance.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">结余总额</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              总结余
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">¥{stats.totalSurplus.toFixed(2)}</div>
            <p className="text-xs text-green-600 mt-1">正数结余</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-1">
              <TrendingDown className="h-4 w-4" />
              待补报销
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">¥{stats.totalDeficit.toFixed(2)}</div>
            <p className="text-xs text-red-600 mt-1">负数结余</p>
          </CardContent>
        </Card>
      </div>

      {/* 筛选和搜索 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>费用冲销列表</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索申请单号、司机..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
              <Select value={driverFilter} onValueChange={setDriverFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="选择司机" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部司机</SelectItem>
                  {drivers.map(d => (
                    <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={loadApplications}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              全部
            </Button>
            <Button
              variant={statusFilter === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('pending')}
            >
              待冲销
            </Button>
            <Button
              variant={statusFilter === 'writeoffed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('writeoffed')}
            >
              已冲销
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 申请列表 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">申请单号</TableHead>
                  <TableHead>司机</TableHead>
                  <TableHead>费用类型</TableHead>
                  <TableHead>费用日期</TableHead>
                  <TableHead className="text-right">申请金额</TableHead>
                  <TableHead className="text-right">实际金额</TableHead>
                  <TableHead className="text-right">结余</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>冲销时间</TableHead>
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : paginatedApps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedApps.map(app => {
                    const typeConfig = EXPENSE_TYPES[app.expense_type] || EXPENSE_TYPES.other;
                    const balance = calculateBalance(app);
                    const isWriteoffed = app.actual_amount !== null;
                    
                    return (
                      <TableRow key={app.id} className="hover:bg-muted/50">
                        <TableCell className="font-mono text-xs">{app.application_number}</TableCell>
                        <TableCell className="font-medium">{app.driver_name}</TableCell>
                        <TableCell>
                          <Badge className={typeConfig.color}>
                            {typeConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(app.expense_date), 'yyyy-MM-dd')}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ¥{app.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {isWriteoffed ? (
                            <span className="font-medium">¥{app.actual_amount!.toFixed(2)}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {balance !== null ? (
                            <span className={`font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {balance >= 0 ? '+' : ''}¥{balance.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isWriteoffed ? (
                            <Badge className="bg-blue-100 text-blue-800">已冲销</Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-800">待冲销</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {app.writeoff_time
                            ? format(new Date(app.writeoff_time), 'MM-dd HH:mm')
                            : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setSelectedApp(app);
                              setShowDetailDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* 分页 */}
          {!loading && filteredApplications.length > 0 && (
            <div className="flex items-center justify-between mt-4 p-4 border-t">
              <div className="text-sm text-muted-foreground">
                显示 {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, filteredApplications.length)} 条，共 {filteredApplications.length} 条
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  上一页
                </Button>
                <span className="text-sm flex items-center">第 {page} / {totalPages} 页</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 详情对话框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          {selectedApp && (
            <>
              <DialogHeader>
                <DialogTitle>费用申请详情</DialogTitle>
                <DialogDescription>{selectedApp.application_number}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label>司机</Label>
                    <p className="font-medium mt-1">{selectedApp.driver_name}</p>
                  </div>
                  <div>
                    <Label>费用类型</Label>
                    <div className="mt-1">
                      <Badge className={EXPENSE_TYPES[selectedApp.expense_type]?.color}>
                        {EXPENSE_TYPES[selectedApp.expense_type]?.label}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label>费用日期</Label>
                    <p className="mt-1">{format(new Date(selectedApp.expense_date), 'yyyy-MM-dd')}</p>
                  </div>
                  <div>
                    <Label>申请金额</Label>
                    <p className="font-bold text-primary text-lg mt-1">¥{selectedApp.amount.toFixed(2)}</p>
                  </div>
                  {selectedApp.actual_amount !== null && (
                    <>
                      <div>
                        <Label>实际金额</Label>
                        <p className="font-medium text-lg mt-1">¥{selectedApp.actual_amount.toFixed(2)}</p>
                      </div>
                      <div>
                        <Label>结余</Label>
                        <p className={`font-bold text-lg mt-1 ${calculateBalance(selectedApp)! >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {calculateBalance(selectedApp)! >= 0 ? '+' : ''}¥{calculateBalance(selectedApp)!.toFixed(2)}
                        </p>
                      </div>
                    </>
                  )}
                  {selectedApp.writeoff_time && (
                    <div>
                      <Label>冲销时间</Label>
                      <p className="mt-1">{format(new Date(selectedApp.writeoff_time), 'yyyy-MM-dd HH:mm:ss')}</p>
                    </div>
                  )}
                </div>

                {selectedApp.description && (
                  <div>
                    <Label>费用说明</Label>
                    <p className="mt-2 text-sm bg-muted p-3 rounded">{selectedApp.description}</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                  关闭
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
        </TabsContent>

        {/* ✅ 司机余额标签页 */}
        <TabsContent value="balance" className="space-y-4">
          {/* 筛选 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>司机余额统计</CardTitle>
                <div className="flex gap-2">
                  <Select value={selectedFleetManager} onValueChange={setSelectedFleetManager}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="选择车队长" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部车队长</SelectItem>
                      {fleetManagerGroups.map(g => (
                        <SelectItem key={g.fleet_manager_id || 'unassigned'} value={g.fleet_manager_id || 'unassigned'}>
                          {g.fleet_manager_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={loadDriverBalances}>
                    <RefreshCw className={`h-4 w-4 ${loadingBalances ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* 按车队长分组的司机余额 */}
          {loadingBalances ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">加载中...</p>
                </div>
              </CardContent>
            </Card>
          ) : filteredFleetManagerGroups.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground">
                  <p>暂无司机余额数据</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredFleetManagerGroups.map(group => (
              <Card key={group.fleet_manager_id || 'unassigned'}>
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {group.fleet_manager_name}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        ({group.drivers.length} 位司机)
                      </span>
                    </CardTitle>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">总余额</div>
                      <div className={`text-2xl font-bold ${group.totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {group.totalBalance >= 0 ? '+' : ''}¥{group.totalBalance.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">司机姓名</TableHead>
                          <TableHead className="text-right">费用余额</TableHead>
                          <TableHead>状态</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.drivers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                              该车队长下暂无司机
                            </TableCell>
                          </TableRow>
                        ) : (
                          group.drivers.map(driver => (
                            <TableRow key={driver.driver_id}>
                              <TableCell className="font-medium">{driver.driver_name}</TableCell>
                              <TableCell className="text-right">
                                <span className={`font-bold text-lg ${driver.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {driver.balance >= 0 ? '+' : ''}¥{driver.balance.toFixed(2)}
                                </span>
                              </TableCell>
                              <TableCell>
                                {driver.balance >= 0 ? (
                                  <Badge className="bg-green-100 text-green-800">有结余</Badge>
                                ) : (
                                  <Badge className="bg-red-100 text-red-800">待补报销</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

