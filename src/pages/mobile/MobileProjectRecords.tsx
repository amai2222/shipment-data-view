// 移动端项目运单列表页面
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Search,
  Filter,
  Calendar,
  User,
  Truck,
  Package,
  DollarSign,
  MapPin,
  Phone,
  FileText,
  Eye,
  Edit,
  MoreVertical,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  Navigation,
  Weight,
  CreditCard
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 类型定义
interface LogisticsRecord {
  id: string;
  auto_number: string;
  project_id: string;
  project_name: string;
  driver_name: string;
  license_plate: string;
  driver_phone?: string;
  loading_date: string;
  unloading_date?: string;
  loading_location: string;
  unloading_location: string;
  loading_weight: number;
  unloading_weight?: number;
  payable_cost: number;
  transport_type: string;
  remarks?: string;
  created_at: string;
  partner_chains?: {
    chain_name: string;
  };
}

interface Project {
  id: string;
  name: string;
  manager: string;
  project_status: string;
}

const transportTypeConfig = {
  '实际运输': { color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50' },
  '空车返回': { color: 'bg-gray-500', textColor: 'text-gray-700', bgColor: 'bg-gray-50' },
  '倒短': { color: 'bg-blue-500', textColor: 'text-blue-700', bgColor: 'bg-blue-50' }
};

export default function MobileProjectRecords() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [transportTypeFilter, setTransportTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'weight' | 'amount'>('date');
  const [activeTab, setActiveTab] = useState('list');

  // 获取项目信息
  const { data: project } = useQuery<Project>({
    queryKey: ['projectInfo', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('项目ID不存在');
      
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, manager, project_status')
        .eq('id', projectId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // 获取运单列表
  const { data: records, isLoading, error } = useQuery<LogisticsRecord[]>({
    queryKey: ['projectRecords', projectId, transportTypeFilter, dateFilter],
    queryFn: async () => {
      if (!projectId) throw new Error('项目ID不存在');

      let query = supabase
        .from('logistics_records')
        .select(`
          *,
          partner_chains(chain_name)
        `)
        .eq('project_id', projectId)
        .order('loading_date', { ascending: false });

      // 运输类型筛选
      if (transportTypeFilter !== 'all') {
        query = query.eq('transport_type', transportTypeFilter);
      }

      // 日期筛选
      if (dateFilter !== 'all') {
        const now = new Date();
        let startDate: Date;
        
        switch (dateFilter) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          default:
            startDate = new Date(0);
        }
        
        query = query.gte('loading_date', startDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId,
  });

  // 过滤和排序记录
  const filteredAndSortedRecords = React.useMemo(() => {
    if (!records) return [];
    
    let filtered = records.filter(record => {
      const matchesSearch = 
        record.driver_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.license_plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.auto_number.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesSearch;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'weight':
          return (b.loading_weight || 0) - (a.loading_weight || 0);
        case 'amount':
          return (b.payable_cost || 0) - (a.payable_cost || 0);
        default:
          return new Date(b.loading_date).getTime() - new Date(a.loading_date).getTime();
      }
    });

    return filtered;
  }, [records, searchQuery, sortBy]);

  const formatWeight = (weight: number | undefined | null) => {
    if (!weight && weight !== 0) return '0吨';
    return `${weight.toFixed(1)}吨`;
  };

  const formatAmount = (amount: number | undefined | null) => {
    if (!amount && amount !== 0) return '¥0';
    return `¥${amount.toLocaleString()}`;
  };

  const handleRecordClick = (record: LogisticsRecord) => {
    navigate(`/m/waybill/${record.id}`);
  };

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">加载运单数据中...</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (error) {
    return (
      <MobileLayout>
        <div className="text-center py-12">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">加载失败</h3>
          <p className="text-muted-foreground mb-4">无法加载运单数据</p>
          <Button onClick={() => navigate(-1)}>
            返回上一页
          </Button>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="space-y-6 pb-6">
        {/* 页面头部 */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(-1)}
              className="p-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">项目运单</h1>
              {project && (
                <p className="text-sm text-muted-foreground">{project.name}</p>
              )}
            </div>
            <Badge 
              variant="outline" 
              className="bg-blue-50 text-blue-700 border-blue-200"
            >
              {filteredAndSortedRecords.length} 条
            </Badge>
          </div>

          {/* 搜索和筛选 */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索司机、车牌号、运单号..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/90 backdrop-blur-sm border-gray-200 rounded-xl"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={transportTypeFilter} onValueChange={setTransportTypeFilter}>
                <SelectTrigger className="flex-1 bg-white/90 backdrop-blur-sm border-gray-200 rounded-xl">
                  <SelectValue placeholder="运输类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="实际运输">实际运输</SelectItem>
                  <SelectItem value="空车返回">空车返回</SelectItem>
                  <SelectItem value="倒短">倒短</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="flex-1 bg-white/90 backdrop-blur-sm border-gray-200 rounded-xl">
                  <SelectValue placeholder="时间范围" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部时间</SelectItem>
                  <SelectItem value="today">今天</SelectItem>
                  <SelectItem value="week">本周</SelectItem>
                  <SelectItem value="month">本月</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-24 bg-white/90 backdrop-blur-sm border-gray-200 rounded-xl">
                  <Filter className="h-4 w-4" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">按日期</SelectItem>
                  <SelectItem value="weight">按重量</SelectItem>
                  <SelectItem value="amount">按金额</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* 标签页 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white/90 backdrop-blur-sm rounded-xl p-1 shadow-sm">
            <TabsTrigger 
              value="list" 
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white"
            >
              <FileText className="h-4 w-4" />
              运单列表
            </TabsTrigger>
            <TabsTrigger 
              value="summary" 
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white"
            >
              <Package className="h-4 w-4" />
              统计汇总
            </TabsTrigger>
          </TabsList>

          {/* 运单列表 */}
          <TabsContent value="list" className="space-y-4 mt-4">
            {filteredAndSortedRecords.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">暂无运单数据</h3>
                  <p className="text-muted-foreground">
                    {searchQuery || transportTypeFilter !== 'all' || dateFilter !== 'all' 
                      ? '没有找到匹配的运单记录' 
                      : '该项目暂无运单记录'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredAndSortedRecords.map((record) => (
                  <Card 
                    key={record.id}
                    className="hover:shadow-md transition-all duration-200 cursor-pointer"
                    onClick={() => handleRecordClick(record)}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* 头部信息 */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm font-mono">
                                {record.auto_number}
                              </span>
                              <Badge 
                                variant="outline"
                                className={`text-xs ${transportTypeConfig[record.transport_type as keyof typeof transportTypeConfig]?.bgColor} ${transportTypeConfig[record.transport_type as keyof typeof transportTypeConfig]?.textColor} border-0`}
                              >
                                {record.transport_type}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(parseISO(record.loading_date), 'MM月dd日 HH:mm', { locale: zhCN })}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-600">
                              {formatAmount(record.payable_cost)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatWeight(record.loading_weight)}
                            </div>
                          </div>
                        </div>

                        {/* 司机信息 */}
                        <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {record.driver_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{record.driver_name}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{record.license_plate}</span>
                              {record.driver_phone && (
                                <span>{record.driver_phone}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 运输路线 */}
                        <div className="space-y-2">
                          <div className="flex items-start gap-2 text-xs">
                            <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
                            <div>
                              <span className="text-muted-foreground">装货：</span>
                              <span className="font-medium">{record.loading_location}</span>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 text-xs">
                            <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0"></div>
                            <div>
                              <span className="text-muted-foreground">卸货：</span>
                              <span className="font-medium">{record.unloading_location}</span>
                            </div>
                          </div>
                        </div>

                        {/* 底部信息 */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {record.partner_chains?.chain_name && (
                              <span>链路: {record.partner_chains.chain_name}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Eye className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">查看详情</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* 统计汇总 */}
          <TabsContent value="summary" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {filteredAndSortedRecords.length}
                    </div>
                    <div className="text-sm text-muted-foreground">运单总数</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {formatWeight(
                        filteredAndSortedRecords.reduce((sum, record) => sum + (record.loading_weight || 0), 0)
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">总重量</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {formatAmount(
                        filteredAndSortedRecords.reduce((sum, record) => sum + (record.payable_cost || 0), 0)
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">总金额</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {new Set(filteredAndSortedRecords.map(r => r.driver_name)).size}
                    </div>
                    <div className="text-sm text-muted-foreground">司机数量</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 运输类型分布 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">运输类型分布</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(
                  filteredAndSortedRecords.reduce((acc, record) => {
                    acc[record.transport_type] = (acc[record.transport_type] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline"
                        className={`text-xs ${transportTypeConfig[type as keyof typeof transportTypeConfig]?.bgColor} ${transportTypeConfig[type as keyof typeof transportTypeConfig]?.textColor} border-0`}
                      >
                        {type}
                      </Badge>
                    </div>
                    <div className="text-sm font-medium">{count} 单</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MobileLayout>
  );
}
