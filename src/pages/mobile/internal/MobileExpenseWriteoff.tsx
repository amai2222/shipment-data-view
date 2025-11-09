// 移动端 - 费用冲销页面
// 司机对已审核通过的费用申请进行冲销，输入实际消费金额

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import {
  FileText,
  DollarSign,
  CheckCircle,
  Loader2,
  Calculator,
  ArrowLeft,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 费用类型配置
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
  expense_date: string;
  expense_type: string;
  amount: number;
  actual_amount: number | null;
  description: string;
  status: string;
  created_at: string;
  writeoff_time: string | null;
}

export default function MobileExpenseWriteoff() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [applications, setApplications] = useState<ExpenseApplication[]>([]);
  const [selectedApp, setSelectedApp] = useState<ExpenseApplication | null>(null);
  const [showWriteoffDialog, setShowWriteoffDialog] = useState(false);
  const [actualAmount, setActualAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadApplications();
  }, []);

  // 加载已审核通过的费用申请
  const loadApplications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('internal_driver_expense_applications')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setApplications((data || []) as ExpenseApplication[]);
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

  // 打开冲销对话框
  const handleOpenWriteoff = (app: ExpenseApplication) => {
    setSelectedApp(app);
    setActualAmount(app.actual_amount?.toString() || '');
    setShowWriteoffDialog(true);
  };

  // 提交冲销
  const handleWriteoff = async () => {
    if (!selectedApp) return;

    const actual = parseFloat(actualAmount);
    if (isNaN(actual) || actual < 0) {
      toast({
        title: '输入错误',
        description: '实际消费金额必须大于等于0',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('writeoff_expense_application', {
        p_application_id: selectedApp.id,
        p_actual_amount: actual
      });

      if (error) throw error;
      
      if (!data.success) {
        toast({
          title: '冲销失败',
          description: data.message || '无法完成冲销',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: '冲销成功',
        description: `结余：¥${data.balance.toFixed(2)} ${data.balance >= 0 ? '(结余)' : '(待补报销)'}`
      });

      setShowWriteoffDialog(false);
      setSelectedApp(null);
      setActualAmount('');
      loadApplications();
    } catch (error: any) {
      console.error('冲销失败:', error);
      toast({
        title: '冲销失败',
        description: error.message || '请稍后重试',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 计算结余
  const calculateBalance = (app: ExpenseApplication): number | null => {
    if (app.actual_amount === null) return null;
    return app.amount - app.actual_amount;
  };

  return (
    <MobileLayout title="费用冲销" showBack={true}>
      <div className="space-y-3 pb-20">
        {/* 说明卡片 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Calculator className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">费用冲销说明</p>
                <p>对已审核通过的费用申请进行冲销，输入实际消费金额。</p>
                <p className="mt-1">• 正数结余：申请金额大于实际金额，表示有结余</p>
                <p>• 负数结余：申请金额小于实际金额，表示待补报销</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 申请列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">已审核通过的费用申请</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">加载中...</p>
              </div>
            ) : applications.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground mt-2">暂无已审核通过的费用申请</p>
              </div>
            ) : (
              applications.map(app => {
                const typeConfig = EXPENSE_TYPES[app.expense_type] || EXPENSE_TYPES.other;
                const balance = calculateBalance(app);
                const isWriteoffed = app.actual_amount !== null;
                
                return (
                  <Card 
                    key={app.id} 
                    className={`cursor-pointer hover:shadow-lg transition-all ${isWriteoffed ? 'bg-gray-50' : ''}`}
                    onClick={() => !isWriteoffed && handleOpenWriteoff(app)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={typeConfig.color}>
                              {typeConfig.label}
                            </Badge>
                            {isWriteoffed && (
                              <Badge className="bg-gray-100 text-gray-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                已冲销
                              </Badge>
                            )}
                          </div>
                          
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(app.expense_date), 'yyyy年MM月dd日', { locale: zhCN })}
                            </div>
                            
                            <div className="text-xs text-muted-foreground">
                              申请单号：{app.application_number}
                            </div>
                            
                            {app.description && (
                              <p className="text-muted-foreground line-clamp-1">
                                {app.description}
                              </p>
                            )}
                            
                            {isWriteoffed && (
                              <div className="mt-2 space-y-1 pt-2 border-t">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">申请金额：</span>
                                  <span className="font-medium">¥{app.amount.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">实际金额：</span>
                                  <span className="font-medium">¥{app.actual_amount!.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs font-bold">
                                  <span className={balance! >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    {balance! >= 0 ? '结余：' : '待补：'}
                                  </span>
                                  <span className={balance! >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    ¥{Math.abs(balance!).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-right ml-4">
                          <div className="text-2xl font-bold text-primary">
                            ¥{app.amount.toFixed(2)}
                          </div>
                          {!isWriteoffed && (
                            <Button
                              size="sm"
                              className="mt-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenWriteoff(app);
                              }}
                            >
                              <Calculator className="h-4 w-4 mr-1" />
                              冲销
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* 冲销对话框 */}
        <Dialog open={showWriteoffDialog} onOpenChange={setShowWriteoffDialog}>
          <DialogContent className="max-w-md">
            {selectedApp && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    费用冲销
                  </DialogTitle>
                  <DialogDescription>
                    {selectedApp.application_number}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
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
                    {selectedApp.description && (
                      <div>
                        <Label>费用说明</Label>
                        <p className="mt-1 text-sm bg-muted p-2 rounded">{selectedApp.description}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid gap-2">
                    <Label>实际消费金额（元）*</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={actualAmount}
                      onChange={e => setActualAmount(e.target.value)}
                      step="0.01"
                      min="0"
                    />
                    <p className="text-xs text-muted-foreground">
                      请输入实际消费金额，系统将自动计算结余
                    </p>
                  </div>
                  
                  {actualAmount && !isNaN(parseFloat(actualAmount)) && (
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="text-sm space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">申请金额：</span>
                          <span className="font-medium">¥{selectedApp.amount.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">实际金额：</span>
                          <span className="font-medium">¥{parseFloat(actualAmount).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between font-bold border-t pt-1 mt-1">
                          <span className={parseFloat(actualAmount) <= selectedApp.amount ? 'text-green-600' : 'text-red-600'}>
                            {parseFloat(actualAmount) <= selectedApp.amount ? '结余：' : '待补：'}
                          </span>
                          <span className={parseFloat(actualAmount) <= selectedApp.amount ? 'text-green-600' : 'text-red-600'}>
                            ¥{Math.abs(selectedApp.amount - parseFloat(actualAmount)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowWriteoffDialog(false);
                      setActualAmount('');
                    }}
                    disabled={submitting}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleWriteoff}
                    disabled={submitting || !actualAmount || isNaN(parseFloat(actualAmount))}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        提交中...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        确认冲销
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MobileLayout>
  );
}

