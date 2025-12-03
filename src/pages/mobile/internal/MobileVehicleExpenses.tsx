// 移动端 - 车辆费用页面
// 功能：展示审核过的费用+冲销差额+收入

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { DriverMobileLayout } from '@/components/mobile/DriverMobileLayout';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
  Calendar,
  CheckCircle,
  Clock,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface Vehicle {
  vehicle_id: string;
  license_plate: string;
  vehicle_type: string;
  is_primary: boolean;
}

interface ExpenseRecord {
  id: string;
  application_number: string;
  expense_date: string;
  expense_type: string;
  amount: number;
  actual_amount: number | null;
  status: string;
  description: string | null;
  writeoff_time: string | null;
  review_time: string | null;
  review_comment: string | null;
  payment_time: string | null;
  receipt_photos: string[] | null;
  created_at: string;
}

interface IncomeRecord {
  id: string;
  auto_number: string;
  loading_date: string;
  payable_cost: number;
  project_name: string;
  unloading_location?: string | null;
  loading_location?: string | null;
  driver_name?: string | null;
  created_at?: string;
}

interface ExpenseSummary {
  totalApproved: number;      // 审核通过的费用总额
  totalWriteoff: number;      // 已冲销的费用总额
  totalDifference: number;    // 冲销差额（审核金额 - 实际金额）
  totalIncome: number;        // 收入总额
  netBalance: number;          // 净余额（收入 - 费用 + 差额）
}

export default function MobileVehicleExpenses() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [myVehicles, setMyVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [expenseRecords, setExpenseRecords] = useState<ExpenseRecord[]>([]);
  const [incomeRecords, setIncomeRecords] = useState<IncomeRecord[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary>({
    totalApproved: 0,
    totalWriteoff: 0,
    totalDifference: 0,
    totalIncome: 0,
    netBalance: 0
  });
  const [activeTab, setActiveTab] = useState('summary');

  // 加载我的车辆
  const loadMyVehicles = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_my_vehicles');
      if (error) throw error;
      setMyVehicles(data || []);
      
      // 默认选择主车
      const primaryVehicle = data?.find((v: Vehicle) => v.is_primary);
      if (primaryVehicle) {
        setSelectedVehicleId(primaryVehicle.vehicle_id);
      }
    } catch (error) {
      console.error('加载车辆失败:', error);
    }
  }, []);

  // 加载费用记录（审核通过的）
  const loadExpenseRecords = useCallback(async () => {
    if (!selectedVehicleId) return;
    
    setLoading(true);
    try {
      // 获取当前司机信息
      const { data: driverData } = await supabase.rpc('get_my_driver_info');
      if (!driverData || driverData.length === 0) {
        setLoading(false);
        return;
      }
      
      const driverId = driverData[0].id || driverData[0].driver_id;
      if (!driverId) {
        setLoading(false);
        return;
      }
      
      // 查询该司机审核通过的费用申请
      const { data, error } = await supabase
        .from('internal_driver_expense_applications')
        .select('*')
        .eq('driver_id', driverId)
        .eq('status', 'approved')
        .order('expense_date', { ascending: false });
      
      if (error) throw error;
      setExpenseRecords(data || []);
    } catch (error) {
      console.error('加载费用记录失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载费用记录',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [selectedVehicleId, toast]);

  // 加载收入记录（运单收入）
  const loadIncomeRecords = useCallback(async () => {
    if (!selectedVehicleId) return;
    
    try {
      // 获取车辆车牌号
      const { data: vehicleData } = await supabase
        .from('internal_vehicles')
        .select('license_plate')
        .eq('id', selectedVehicleId)
        .single();
      
      if (!vehicleData) return;
      
      // 查询该车辆的运单收入
      const { data, error } = await supabase
        .from('logistics_records')
        .select('id, auto_number, loading_date, payable_cost, project_name, loading_location, unloading_location, driver_name, created_at')
        .eq('license_plate', vehicleData.license_plate)
        .not('payable_cost', 'is', null)
        .order('loading_date', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setIncomeRecords(data || []);
    } catch (error) {
      console.error('加载收入记录失败:', error);
    }
  }, [selectedVehicleId]);

  // 计算汇总数据
  useEffect(() => {
    if (expenseRecords.length === 0 && incomeRecords.length === 0) {
      setSummary({
        totalApproved: 0,
        totalWriteoff: 0,
        totalDifference: 0,
        totalIncome: 0,
        netBalance: 0
      });
      return;
    }
    
    // 计算审核通过的费用总额
    const totalApproved = expenseRecords.reduce((sum, record) => sum + (record.amount || 0), 0);
    
    // 计算已冲销的费用总额（实际金额）
    const totalWriteoff = expenseRecords
      .filter(r => r.writeoff_time && r.actual_amount !== null)
      .reduce((sum, record) => sum + (record.actual_amount || 0), 0);
    
    // 计算冲销差额（审核金额 - 实际金额）
    const totalDifference = expenseRecords
      .filter(r => r.writeoff_time && r.actual_amount !== null)
      .reduce((sum, record) => sum + ((record.amount || 0) - (record.actual_amount || 0)), 0);
    
    // 计算收入总额
    const totalIncome = incomeRecords.reduce((sum, record) => sum + (record.payable_cost || 0), 0);
    
    // 计算净余额：收入 - 审核费用 + 冲销差额（如果实际金额小于审核金额，差额为正，表示节省）
    const netBalance = totalIncome - totalApproved + totalDifference;
    
    setSummary({
      totalApproved,
      totalWriteoff,
      totalDifference,
      totalIncome,
      netBalance
    });
  }, [expenseRecords, incomeRecords]);

  useEffect(() => {
    loadMyVehicles();
  }, [loadMyVehicles]);

  useEffect(() => {
    if (selectedVehicleId) {
      loadExpenseRecords();
      loadIncomeRecords();
    }
  }, [selectedVehicleId, loadExpenseRecords, loadIncomeRecords]);

  const getExpenseTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      fuel: '加油费',
      charging: '充电费',
      car_wash: '洗车费',
      parking: '停车费',
      toll: '过路费',
      maintenance: '维修费',
      fine: '罚款',
      meal: '餐费',
      accommodation: '住宿费',
      other: '其他'
    };
    return typeMap[type] || type;
  };

  const primaryVehicle = myVehicles.find(v => v.is_primary);

  return (
    <DriverMobileLayout title="车辆费用">
      <div className="space-y-4 pb-24 px-1">
        {/* 车辆选择 */}
        {myVehicles.length > 1 && (
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {myVehicles.map(vehicle => (
                  <Button
                    key={vehicle.vehicle_id}
                    variant={selectedVehicleId === vehicle.vehicle_id ? 'default' : 'outline'}
                    size="sm"
                    className="h-10 px-4 text-sm flex-shrink-0"
                    onClick={() => setSelectedVehicleId(vehicle.vehicle_id)}
                  >
                    {vehicle.license_plate}
                    {vehicle.is_primary && <Badge variant="secondary" className="ml-1 text-xs">主</Badge>}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 费用汇总卡片 */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-blue-50 border-blue-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-2">审核费用</p>
                  <p className="text-xl font-bold text-blue-700">
                    ¥{summary.totalApproved.toFixed(2)}
                  </p>
                </div>
                <Receipt className="h-10 w-10 text-blue-500 opacity-50 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-2">收入总额</p>
                  <p className="text-xl font-bold text-green-700">
                    ¥{summary.totalIncome.toFixed(2)}
                  </p>
                </div>
                <TrendingUp className="h-10 w-10 text-green-500 opacity-50 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-orange-50 border-orange-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-2">冲销差额</p>
                  <p className={`text-xl font-bold ${summary.totalDifference >= 0 ? 'text-orange-700' : 'text-red-700'}`}>
                    {summary.totalDifference >= 0 ? '+' : ''}¥{summary.totalDifference.toFixed(2)}
                  </p>
                </div>
                <TrendingDown className="h-10 w-10 text-orange-500 opacity-50 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-purple-50 border-purple-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-2">净余额</p>
                  <p className={`text-xl font-bold ${summary.netBalance >= 0 ? 'text-purple-700' : 'text-red-700'}`}>
                    {summary.netBalance >= 0 ? '+' : ''}¥{summary.netBalance.toFixed(2)}
                  </p>
                </div>
                <DollarSign className="h-10 w-10 text-purple-500 opacity-50 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 费用明细标签页 */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 h-11">
            <TabsTrigger value="summary" className="text-sm">汇总</TabsTrigger>
            <TabsTrigger value="expenses" className="text-sm">费用</TabsTrigger>
            <TabsTrigger value="income" className="text-sm">收入</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-3 mt-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">费用说明</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">审核费用：</span>
                    <span className="font-medium">已审核通过的费用申请总额</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">冲销差额：</span>
                    <span className="font-medium">
                      {summary.totalDifference >= 0 ? '节省' : '超支'} 
                      {Math.abs(summary.totalDifference).toFixed(2)} 元
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">收入总额：</span>
                    <span className="font-medium">运单运费收入</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-semibold">净余额：</span>
                    <span className={`font-bold ${summary.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {summary.netBalance >= 0 ? '+' : ''}¥{summary.netBalance.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-yellow-800">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  净余额 = 收入总额 - 审核费用 + 冲销差额
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expenses" className="space-y-3 mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : expenseRecords.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">暂无费用记录</p>
                </CardContent>
              </Card>
            ) : (
              expenseRecords.map(record => {
                const hasWriteoff = record.writeoff_time && record.actual_amount !== null;
                const difference = hasWriteoff ? (record.amount - (record.actual_amount || 0)) : 0;
                const receiptPhotos = Array.isArray(record.receipt_photos) 
                  ? record.receipt_photos 
                  : (record.receipt_photos ? JSON.parse(record.receipt_photos as unknown as string) : []);
                
                return (
                  <Card key={record.id} className="overflow-hidden shadow-sm border">
                    <CardContent className="p-5">
                      <div className="space-y-3">
                        {/* 头部：类型、日期、金额 */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <Badge variant="outline" className="text-xs">
                              {getExpenseTypeLabel(record.expense_type)}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(record.expense_date), 'yyyy-MM-dd', { locale: zhCN })}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-red-600 text-lg">
                              -¥{record.amount.toFixed(2)}
                            </p>
                            {hasWriteoff && (
                              <p className="text-xs text-muted-foreground">
                                实际：¥{(record.actual_amount || 0).toFixed(2)}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {/* 申请单号 */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          <span>申请单号：{record.application_number}</span>
                        </div>
                        
                        {/* 费用说明 */}
                        {record.description && (
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-sm text-gray-700">{record.description}</p>
                          </div>
                        )}
                        
                        {/* 审核信息 */}
                        {record.review_time && (
                          <div className="flex items-start gap-2 text-xs">
                            <CheckCircle className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <div className="text-muted-foreground">
                                审核时间：{format(new Date(record.review_time), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                              </div>
                              {record.review_comment && (
                                <div className="text-orange-600 mt-1 bg-orange-50 rounded p-1.5">
                                  审核意见：{record.review_comment}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* 冲销信息 */}
                        {hasWriteoff && (
                          <div className="border-t pt-2 space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>冲销时间：{format(new Date(record.writeoff_time!), 'yyyy-MM-dd HH:mm', { locale: zhCN })}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-xs text-muted-foreground">冲销差额：</span>
                              <span className={`text-sm font-medium ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {difference >= 0 ? '+' : ''}¥{difference.toFixed(2)}
                                {difference >= 0 ? ' (节省)' : ' (超支)'}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {/* 付款信息 */}
                        {record.payment_time && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-2">
                            <DollarSign className="h-3 w-3 text-green-600" />
                            <span>付款时间：{format(new Date(record.payment_time), 'yyyy-MM-dd HH:mm', { locale: zhCN })}</span>
                          </div>
                        )}
                        
                        {/* 凭证照片 */}
                        {receiptPhotos && receiptPhotos.length > 0 && (
                          <div className="border-t pt-2">
                            <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                              <ImageIcon className="h-3 w-3" />
                              <span>凭证照片 ({receiptPhotos.length}张)</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {receiptPhotos.slice(0, 3).map((photo: string, index: number) => (
                                <div
                                  key={index}
                                  className="aspect-square rounded overflow-hidden bg-gray-100 cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => window.open(photo, '_blank')}
                                >
                                  <img
                                    src={photo}
                                    alt={`凭证${index + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ))}
                              {receiptPhotos.length > 3 && (
                                <div className="aspect-square rounded bg-gray-100 flex items-center justify-center text-xs text-muted-foreground">
                                  +{receiptPhotos.length - 3}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="income" className="space-y-3 mt-4">
            {incomeRecords.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">暂无收入记录</p>
                </CardContent>
              </Card>
            ) : (
              incomeRecords.map(record => (
                <Card key={record.id} className="overflow-hidden shadow-sm border">
                  <CardContent className="p-5">
                    <div className="space-y-2">
                      {/* 头部：运单号、金额 */}
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{record.auto_number}</p>
                            {record.driver_name && (
                              <Badge variant="outline" className="text-xs">
                                {record.driver_name}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {record.project_name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600 text-lg">
                            +¥{record.payable_cost.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      
                      {/* 路线信息 */}
                      {(record.loading_location || record.unloading_location) && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-gray-50 rounded p-2">
                          <div className="flex items-center gap-1 flex-1">
                            <span className="font-medium">{record.loading_location || '起点'}</span>
                            <ArrowLeft className="h-3 w-3" />
                            <span className="font-medium">{record.unloading_location || '终点'}</span>
                          </div>
                        </div>
                      )}
                      
                      {/* 日期信息 */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          <span>装货日期：{format(new Date(record.loading_date), 'yyyy-MM-dd', { locale: zhCN })}</span>
                        </div>
                        {record.created_at && (
                          <span>创建：{format(new Date(record.created_at), 'MM-dd HH:mm', { locale: zhCN })}</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DriverMobileLayout>
  );
}

