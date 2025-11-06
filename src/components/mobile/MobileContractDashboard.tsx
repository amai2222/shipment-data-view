// 移动端合同管理仪表盘组件
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, 
  AlertTriangle, 
  Calendar, 
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw
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
  total_amount: number;
  categories: Record<string, number>;
  priorities: Record<string, number>;
}

interface ExpiringContract {
  id: string;
  contract_number: string;
  counterparty_company: string;
  end_date: string;
  days_until_expiry: number;
  priority: string;
}

export function MobileContractDashboard() {
  const [stats, setStats] = useState<ContractStats>({
    total: 0,
    active: 0,
    expired: 0,
    expiring_soon: 0,
    total_amount: 0,
    categories: {},
    priorities: {}
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
      
      const { data: contracts, error } = await supabase
        .from('contracts')
        .select('*');

      if (error) throw error;

      const now = new Date();
      const thirtyDaysFromNow = addDays(now, 30);

      const contractStats: ContractStats = {
        total: contracts?.length || 0,
        active: 0,
        expired: 0,
        expiring_soon: 0,
        total_amount: 0,
        categories: {},
        priorities: {}
      };

      const expiring: ExpiringContract[] = [];

      contracts?.forEach(contract => {
        const endDate = new Date(contract.end_date);
        const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // 状态统计
        if (contract.status === 'archived') {
          // 已归档
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
            priority: contract.priority || 'normal'
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
      });

      // 按到期时间排序
      expiring.sort((a, b) => a.days_until_expiry - b.days_until_expiry);

      setStats(contractStats);
      setExpiringContracts(expiring.slice(0, 5)); // 移动端只显示5个
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
    if (amount >= 10000) {
      return `${(amount / 10000).toFixed(1)}万`;
    }
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
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">合同总数</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">合同总额</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.total_amount)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">即将到期</p>
                <p className="text-2xl font-bold text-orange-600">{stats.expiring_soon}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">已过期</p>
                <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 状态分布 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">合同状态</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                有效合同
              </span>
              <span>{stats.active}个</span>
            </div>
            <Progress value={(stats.active / stats.total) * 100} className="h-2" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                即将到期
              </span>
              <span>{stats.expiring_soon}个</span>
            </div>
            <Progress value={(stats.expiring_soon / stats.total) * 100} className="h-2" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                已过期
              </span>
              <span>{stats.expired}个</span>
            </div>
            <Progress value={(stats.expired / stats.total) * 100} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* 即将到期的合同 */}
      {expiringContracts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-500" />
              即将到期
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {expiringContracts.map(contract => (
              <div key={contract.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">{contract.contract_number}</span>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getPriorityColor(contract.priority)} text-white border-0`}
                    >
                      {contract.priority === 'urgent' ? '急' : 
                       contract.priority === 'high' ? '高' :
                       contract.priority === 'normal' ? '普' : '低'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{contract.counterparty_company}</p>
                </div>
                <div className="text-right ml-2">
                  <div className={`text-sm font-medium ${
                    contract.days_until_expiry <= 7 ? 'text-red-600' :
                    contract.days_until_expiry <= 15 ? 'text-orange-600' : 'text-yellow-600'
                  }`}>
                    {contract.days_until_expiry > 0 ? `${contract.days_until_expiry}天` : '已过期'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(contract.end_date), 'MM-dd', { locale: zhCN })}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 分类统计 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">合同分类</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(stats.categories).map(([category, count]) => (
            <div key={category} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{category}</span>
                <span>{count}个</span>
              </div>
              <Progress value={(count / stats.total) * 100} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 刷新按钮 */}
      <div className="flex justify-center pt-4">
        <Button onClick={loadDashboardData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新数据
        </Button>
      </div>
    </div>
  );
}
