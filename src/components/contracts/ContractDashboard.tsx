// 合同管理仪表盘组件
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, 
  AlertTriangle, 
  Calendar, 
  TrendingUp, 
  DollarSign,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Archive
} from 'lucide-react';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, isAfter, isBefore } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface ContractStats {
  total: number;
  active: number;
  expired: number;
  expiring_soon: number;
  archived: number;
  total_amount: number;
  categories: Record<string, number>;
  priorities: Record<string, number>;
  departments: Record<string, number>;
}

interface ExpiringContract {
  id: string;
  contract_number: string;
  counterparty_company: string;
  end_date: string;
  days_until_expiry: number;
  priority: string;
  responsible_person: string;
}

export function ContractDashboard() {
  const [stats, setStats] = useState<ContractStats>({
    total: 0,
    active: 0,
    expired: 0,
    expiring_soon: 0,
    archived: 0,
    total_amount: 0,
    categories: {},
    priorities: {},
    departments: {}
  });
  const [expiringContracts, setExpiringContracts] = useState<ExpiringContract[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // 获取合同统计数据
      const { data: contracts, error } = await supabase
        .from('contracts')
        .select('*');

      if (error) throw error;
      
      // 类型断言
      const typedContracts = contracts as any[];

      const now = new Date();
      const thirtyDaysFromNow = addDays(now, 30);

      const contractStats: ContractStats = {
        total: contracts?.length || 0,
        active: 0,
        expired: 0,
        expiring_soon: 0,
        archived: 0,
        total_amount: 0,
        categories: {},
        priorities: {},
        departments: {}
      };

      const expiring: ExpiringContract[] = [];

      typedContracts?.forEach(contract => {
        const endDate = new Date(contract.end_date);
        const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // 状态统计
        if (contract.status === 'archived') {
          contractStats.archived++;
        } else if (isAfter(now, endDate)) {
          contractStats.expired++;
        } else if (isBefore(endDate, thirtyDaysFromNow)) {
          contractStats.expiring_soon++;
          expiring.push({
            id: contract.id,
            contract_number: contract.contract_number || `合同-${contract.id.slice(0, 8)}`,
            counterparty_company: contract.counterparty_company,
            end_date: contract.end_date,
            days_until_expiry: diffDays,
            priority: contract.priority || 'normal',
            responsible_person: contract.responsible_person || '未指定'
          });
        } else {
          contractStats.active++;
        }

        // 金额统计
        if (contract.contract_amount) {
          contractStats.total_amount += parseFloat(String(contract.contract_amount));
        }

        // 分类统计
        const category = contract.category || '未分类';
        contractStats.categories[category] = (contractStats.categories[category] || 0) + 1;

        // 优先级统计
        const priority = contract.priority || 'normal';
        contractStats.priorities[priority] = (contractStats.priorities[priority] || 0) + 1;

        // 部门统计
        const department = contract.department || '未指定';
        contractStats.departments[department] = (contractStats.departments[department] || 0) + 1;
      });

      // 按到期时间排序
      expiring.sort((a, b) => a.days_until_expiry - b.days_until_expiry);

      setStats(contractStats);
      setExpiringContracts(expiring.slice(0, 10)); // 只显示最近10个即将到期的合同
    } catch (error: any) {
      console.error('加载仪表盘数据失败:', error);
      toast({
        title: "加载失败",
        description: "无法加载仪表盘数据",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'normal': return 'bg-blue-500';
      case 'low': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </CardHeader>
            <CardContent className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">合同总数</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              有效合同 {stats.active} 个
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">即将到期</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.expiring_soon}</div>
            <p className="text-xs text-muted-foreground">
              30天内到期
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已过期</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
            <p className="text-xs text-muted-foreground">
              需要处理
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">合同总额</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.total_amount)}</div>
            <p className="text-xs text-muted-foreground">
              所有合同金额
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 即将到期的合同 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-500" />
              即将到期的合同
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {expiringContracts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                暂无即将到期的合同
              </p>
            ) : (
              expiringContracts.map(contract => (
                <div key={contract.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{contract.contract_number}</span>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getPriorityColor(contract.priority)} text-white border-0`}
                      >
                        {contract.priority === 'urgent' ? '紧急' : 
                         contract.priority === 'high' ? '高' :
                         contract.priority === 'normal' ? '普通' : '低'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{contract.counterparty_company}</p>
                    <p className="text-xs text-muted-foreground">负责人: {contract.responsible_person}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${
                      contract.days_until_expiry <= 7 ? 'text-red-600' :
                      contract.days_until_expiry <= 15 ? 'text-orange-600' : 'text-yellow-600'
                    }`}>
                      {contract.days_until_expiry > 0 ? `${contract.days_until_expiry}天后` : '已过期'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(contract.end_date), 'MM-dd', { locale: zhCN })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* 分类统计 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              合同分类统计
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(stats.categories).map(([category, count]) => (
              <div key={category} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{category}</span>
                  <span className="text-sm text-muted-foreground">{count}个</span>
                </div>
                <Progress 
                  value={(count / stats.total) * 100} 
                  className="h-2"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 优先级和部门统计 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              优先级分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(stats.priorities).map(([priority, count]) => (
                <div key={priority} className="text-center p-3 border rounded-lg">
                  <div className={`text-2xl font-bold ${
                    priority === 'urgent' ? 'text-red-600' :
                    priority === 'high' ? 'text-orange-600' :
                    priority === 'normal' ? 'text-blue-600' : 'text-gray-600'
                  }`}>
                    {count}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {priority === 'urgent' ? '紧急' :
                     priority === 'high' ? '高优先级' :
                     priority === 'normal' ? '普通' : '低优先级'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-500" />
              部门分布
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(stats.departments).slice(0, 6).map(([department, count]) => (
              <div key={department} className="flex items-center justify-between">
                <span className="text-sm">{department}</span>
                <Badge variant="outline">{count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 刷新按钮 */}
      <div className="flex justify-center">
        <Button onClick={loadDashboardData} variant="outline">
          <Clock className="h-4 w-4 mr-2" />
          刷新数据
        </Button>
      </div>
    </div>
  );
}
