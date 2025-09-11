import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { 
  Search, 
  Plus, 
  MoreVertical, 
  FileText, 
  Calendar,
  Truck,
  MapPin,
  Phone,
  Banknote,
  Weight,
  Filter,
  SortAsc,
  SortDesc,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface LogisticsRecord {
  id: string;
  auto_number: string;
  project_name: string;
  driver_name: string;
  license_plate: string;
  driver_phone: string;
  loading_location: string;
  unloading_location: string;
  loading_date: string;
  unloading_date?: string;
  transport_type: string;
  loading_weight?: number;
  unloading_weight?: number;
  current_cost?: number;
  extra_cost?: number;
  payable_cost?: number;
  payment_status: string;
  remarks?: string;
}

export default function MobileBusinessEntry() {
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<LogisticsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<LogisticsRecord | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'project' | 'driver'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterProject, setFilterProject] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin } = usePermissions();

  useEffect(() => {
    loadRecords();
  }, []);

  useEffect(() => {
    filterAndSortRecords();
  }, [records, searchTerm, sortBy, sortOrder, filterProject, filterStatus]);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('logistics_records')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error loading records:', error);
      toast({
        title: "加载失败",
        description: "无法加载业务记录",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortRecords = () => {
    let filtered = [...records];

    // 搜索过滤
    if (searchTerm) {
      filtered = filtered.filter(record => 
        record.auto_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.driver_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.license_plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.driver_phone?.includes(searchTerm)
      );
    }

    // 项目过滤
    if (filterProject && filterProject !== 'all') {
      filtered = filtered.filter(record => record.project_name === filterProject);
    }

    // 状态过滤
    if (filterStatus && filterStatus !== 'all') {
      filtered = filtered.filter(record => record.payment_status === filterStatus);
    }

    // 排序
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.loading_date).getTime() - new Date(b.loading_date).getTime();
          break;
        case 'project':
          comparison = a.project_name.localeCompare(b.project_name);
          break;
        case 'driver':
          comparison = a.driver_name.localeCompare(b.driver_name);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredRecords(filtered);
  };

  const formatCurrency = (value?: number) => {
    if (!value) return '¥0.00';
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Paid': return 'bg-green-100 text-green-800';
      case 'Unpaid': return 'bg-red-100 text-red-800';
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'Paid': return '已付款';
      case 'Unpaid': return '未付款';
      case 'Pending': return '待付款';
      default: return status;
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      toast({
        title: "权限不足",
        description: "只有管理员可以删除记录",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('logistics_records')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "删除成功",
        description: "记录已成功删除",
      });

      loadRecords();
    } catch (error) {
      console.error('Error deleting record:', error);
      toast({
        title: "删除失败",
        description: "无法删除记录",
        variant: "destructive",
      });
    }
  };

  const uniqueProjects = [...new Set(records.map(r => r.project_name))];
  const uniqueStatuses = [...new Set(records.map(r => r.payment_status))];

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">业务录入</h1>
        <Button onClick={() => navigate('/m/business-entry/new')} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          新增
        </Button>
      </div>

      {/* 搜索和过滤 */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索运单号、项目、司机或车牌..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* 筛选和排序 */}
          <div className="flex items-center justify-between">
            <Drawer open={showFilters} onOpenChange={setShowFilters}>
              <DrawerTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  筛选
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>筛选条件</DrawerTitle>
                </DrawerHeader>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">项目筛选</label>
                    <Select value={filterProject} onValueChange={setFilterProject}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择项目" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部项目</SelectItem>
                        {uniqueProjects.map(project => (
                          <SelectItem key={project} value={project}>
                            {project}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">付款状态</label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择状态" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部状态</SelectItem>
                        {uniqueStatuses.map(status => (
                          <SelectItem key={status} value={status}>
                            {getStatusText(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        setFilterProject('');
                        setFilterStatus('');
                      }}
                    >
                      清除
                    </Button>
                    <Button 
                      className="flex-1"
                      onClick={() => setShowFilters(false)}
                    >
                      确定
                    </Button>
                  </div>
                </div>
              </DrawerContent>
            </Drawer>

            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">日期</SelectItem>
                  <SelectItem value="project">项目</SelectItem>
                  <SelectItem value="driver">司机</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 记录列表 */}
      <div className="space-y-3">
        {filteredRecords.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">暂无记录</h3>
              <p className="text-muted-foreground mb-4">还没有找到匹配的业务记录</p>
              <Button onClick={() => navigate('/m/business-entry/new')}>
                <Plus className="h-4 w-4 mr-2" />
                创建第一条记录
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredRecords.map((record) => (
            <Card key={record.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm">{record.auto_number}</h3>
                      <Badge variant="outline" className="text-xs">
                        {record.transport_type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{record.project_name}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${getStatusColor(record.payment_status)}`}>
                      {getStatusText(record.payment_status)}
                    </Badge>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedRecord(record)}>
                          <Eye className="h-4 w-4 mr-2" />
                          查看详情
                        </DropdownMenuItem>
                        {isAdmin && (
                          <DropdownMenuItem onClick={() => navigate(`/m/business-entry/edit/${record.id}`)}>
                            <Edit className="h-4 w-4 mr-2" />
                            编辑
                          </DropdownMenuItem>
                        )}
                        {isAdmin && (
                          <DropdownMenuItem 
                            onClick={() => handleDelete(record.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-2" />
                    {format(new Date(record.loading_date), 'yyyy-MM-dd')}
                  </div>
                  
                  <div className="flex items-center text-muted-foreground">
                    <Truck className="h-4 w-4 mr-2" />
                    {record.driver_name} • {record.license_plate}
                  </div>
                  
                  <div className="flex items-center text-muted-foreground">
                    <MapPin className="h-4 w-4 mr-2" />
                    {record.loading_location?.substring(0, 4)} → {record.unloading_location?.substring(0, 4)}
                  </div>

                  {record.payable_cost && (
                    <div className="flex items-center text-muted-foreground">
                      <Banknote className="h-4 w-4 mr-2" />
                      司机应收: <span className="font-semibold text-foreground ml-1">
                        {formatCurrency(record.payable_cost)}
                      </span>
                    </div>
                  )}

                  {(record.loading_weight || record.unloading_weight) && (
                    <div className="flex items-center text-muted-foreground">
                      <Weight className="h-4 w-4 mr-2" />
                      装货 {record.loading_weight?.toFixed(2) || '0.00'}吨 / 
                      卸货 {record.unloading_weight?.toFixed(2) || '0.00'}吨
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 记录详情对话框 */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>运单详情</DialogTitle>
          </DialogHeader>
          
          {selectedRecord && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">基本信息</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">运单编号:</span>
                    <span className="font-mono">{selectedRecord.auto_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">项目名称:</span>
                    <span>{selectedRecord.project_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">运输类型:</span>
                    <span>{selectedRecord.transport_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">付款状态:</span>
                    <Badge className={getStatusColor(selectedRecord.payment_status)}>
                      {getStatusText(selectedRecord.payment_status)}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">司机信息</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">司机姓名:</span>
                    <span>{selectedRecord.driver_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">车牌号:</span>
                    <span className="font-mono">{selectedRecord.license_plate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">联系电话:</span>
                    <span>{selectedRecord.driver_phone}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">运输信息</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">装货地点:</span>
                    <span>{selectedRecord.loading_location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">卸货地点:</span>
                    <span>{selectedRecord.unloading_location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">装货日期:</span>
                    <span>{format(new Date(selectedRecord.loading_date), 'yyyy-MM-dd')}</span>
                  </div>
                  {selectedRecord.unloading_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">卸货日期:</span>
                      <span>{format(new Date(selectedRecord.unloading_date), 'yyyy-MM-dd')}</span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2">重量费用</h4>
                <div className="space-y-2 text-sm">
                  {selectedRecord.loading_weight && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">装货重量:</span>
                      <span>{selectedRecord.loading_weight.toFixed(2)}吨</span>
                    </div>
                  )}
                  {selectedRecord.unloading_weight && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">卸货重量:</span>
                      <span>{selectedRecord.unloading_weight.toFixed(2)}吨</span>
                    </div>
                  )}
                  {selectedRecord.current_cost && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">运费:</span>
                      <span>{formatCurrency(selectedRecord.current_cost)}</span>
                    </div>
                  )}
                  {selectedRecord.extra_cost && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">额外费用:</span>
                      <span>{formatCurrency(selectedRecord.extra_cost)}</span>
                    </div>
                  )}
                  {selectedRecord.payable_cost && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">司机应收:</span>
                      <span className="font-semibold">{formatCurrency(selectedRecord.payable_cost)}</span>
                    </div>
                  )}
                </div>
              </div>

              {selectedRecord.remarks && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">备注</h4>
                    <p className="text-sm text-muted-foreground">{selectedRecord.remarks}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}