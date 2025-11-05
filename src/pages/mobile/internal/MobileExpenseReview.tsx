// 移动端 - 费用申请审核（车队长）

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  User,
  Truck,
  Calendar,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';

interface ExpenseApplication {
  id: string;
  application_number: string;
  driver_name: string;
  vehicle: string;
  expense_date: string;
  expense_type: string;
  amount: number;
  description: string;
  receipt_photos: string[];
  status: string;
  created_at: string;
}

const EXPENSE_TYPES = {
  fuel: { label: '🛢️ 加油费', color: 'bg-blue-100 text-blue-800' },
  parking: { label: '🅿️ 停车费', color: 'bg-green-100 text-green-800' },
  toll: { label: '🛣️ 过路费', color: 'bg-yellow-100 text-yellow-800' },
  maintenance: { label: '🔧 维修费', color: 'bg-red-100 text-red-800' },
  fine: { label: '⚠️ 罚款', color: 'bg-orange-100 text-orange-800' },
  meal: { label: '🍔 餐费', color: 'bg-purple-100 text-purple-800' },
  accommodation: { label: '🏨 住宿费', color: 'bg-pink-100 text-pink-800' },
  other: { label: '📝 其他', color: 'bg-gray-100 text-gray-800' }
};

export default function MobileExpenseReview() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [applications, setApplications] = useState<ExpenseApplication[]>([]);
  const [filterStatus, setFilterStatus] = useState('pending');
  
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [selectedApp, setSelectedApp] = useState<ExpenseApplication | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    loadApplications();
  }, [filterStatus]);

  const loadApplications = async () => {
    setLoading(true);
    try {
      // TODO: 调用实际的查询函数
      // const { data, error } = await supabase
      //   .from('internal_driver_expense_applications')
      //   .select('*, driver:internal_drivers(name), vehicle:internal_vehicles(license_plate)')
      //   .eq('status', filterStatus)
      //   .order('created_at', { ascending: false });
      
      // 临时模拟数据
      setApplications([
        {
          id: '1',
          application_number: 'FY20251104-0001',
          driver_name: '王师傅',
          vehicle: '云F97310',
          expense_date: '2025-11-03',
          expense_type: 'fuel',
          amount: 551.00,
          description: '2月份公司加油',
          receipt_photos: [],
          status: 'pending',
          created_at: '2025-11-03T10:00:00'
        },
        {
          id: '2',
          application_number: 'FY20251104-0002',
          driver_name: '李师傅',
          vehicle: '云F88520',
          expense_date: '2025-11-02',
          expense_type: 'parking',
          amount: 50.00,
          description: '市区停车费',
          receipt_photos: [],
          status: 'pending',
          created_at: '2025-11-02T15:00:00'
        },
        {
          id: '3',
          application_number: 'FY20251104-0003',
          driver_name: '张师傅',
          vehicle: '云F66789',
          expense_date: '2025-11-01',
          expense_type: 'maintenance',
          amount: 1200.00,
          description: '更换机油和机滤',
          receipt_photos: [],
          status: 'pending',
          created_at: '2025-11-01T09:00:00'
        }
      ]);
    } catch (error) {
      console.error('加载失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载费用申请',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // 审批申请
  const handleReview = async (approved: boolean) => {
    if (!selectedApp) return;

    setReviewing(true);
    try {
      // TODO: 调用审批函数
      // const { data, error } = await supabase.rpc('approve_expense_application', {
      //   p_application_id: selectedApp.id,
      //   p_approved: approved,
      //   p_review_comment: reviewComment || null
      // });

      toast({
        title: approved ? '已通过' : '已驳回',
        description: `费用申请${approved ? '已通过' : '已驳回'}`
      });

      setShowReviewDialog(false);
      setSelectedApp(null);
      setReviewComment('');
      loadApplications();
    } catch (error) {
      console.error('审批失败:', error);
      toast({
        title: '审批失败',
        description: '请稍后重试',
        variant: 'destructive'
      });
    } finally {
      setReviewing(false);
    }
  };

  const getExpenseTypeConfig = (type: string) => {
    return EXPENSE_TYPES[type as keyof typeof EXPENSE_TYPES] || EXPENSE_TYPES.other;
  };

  const totalAmount = applications.reduce((sum, app) => sum + app.amount, 0);

  return (
    <MobileLayout>
      <div className="space-y-4 pb-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
            <CardContent className="p-4 text-center">
              <div className="text-xs text-yellow-600 mb-1">待审核</div>
              <div className="text-3xl font-bold text-yellow-700">
                {applications.filter(a => a.status === 'pending').length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4 text-center">
              <div className="text-xs text-blue-600 mb-1">金额合计</div>
              <div className="text-2xl font-bold text-blue-700">
                ¥{totalAmount.toFixed(0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 状态筛选 */}
        <Card>
          <CardContent className="p-4">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">待审核</SelectItem>
                <SelectItem value="approved">已通过</SelectItem>
                <SelectItem value="rejected">已驳回</SelectItem>
                <SelectItem value="paid">已付款</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* 申请列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">费用申请列表</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              </div>
            ) : applications.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                暂无{filterStatus === 'pending' ? '待审核' : ''}申请
              </div>
            ) : (
              applications.map(app => {
                const typeConfig = getExpenseTypeConfig(app.expense_type);
                
                return (
                  <Card 
                    key={app.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => {
                      setSelectedApp(app);
                      setShowReviewDialog(true);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={typeConfig.color}>
                                {typeConfig.label}
                              </Badge>
                              {app.status === 'pending' && (
                                <Badge className="bg-yellow-100 text-yellow-800">
                                  <Clock className="h-3 w-3 mr-1" />
                                  待审核
                                </Badge>
                              )}
                            </div>
                            
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <User className="h-3 w-3" />
                                {app.driver_name}
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Truck className="h-3 w-3" />
                                {app.vehicle}
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(app.expense_date), 'yyyy-MM-dd')}
                              </div>
                              {app.description && (
                                <p className="text-muted-foreground line-clamp-1">
                                  {app.description}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-right ml-4">
                            <div className="text-2xl font-bold text-primary">
                              ¥{app.amount.toFixed(2)}
                            </div>
                            {app.receipt_photos.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1 flex items-center justify-end gap-1">
                                <ImageIcon className="h-3 w-3" />
                                {app.receipt_photos.length}张
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* 审核对话框 */}
        <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
          <DialogContent className="max-w-md">
            {selectedApp && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    费用申请审核
                  </DialogTitle>
                  <DialogDescription>
                    审核司机提交的费用申请
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">申请单号</div>
                      <div className="font-mono text-xs">{selectedApp.application_number}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">申请日期</div>
                      <div>{format(new Date(selectedApp.created_at), 'MM-dd HH:mm')}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">司机</div>
                      <div className="font-medium">{selectedApp.driver_name}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">车辆</div>
                      <div className="font-medium">{selectedApp.vehicle}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">费用类型</div>
                      <Badge className={getExpenseTypeConfig(selectedApp.expense_type).color}>
                        {getExpenseTypeConfig(selectedApp.expense_type).label}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-muted-foreground">费用日期</div>
                      <div>{format(new Date(selectedApp.expense_date), 'yyyy-MM-dd')}</div>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <div className="text-center mb-2">
                      <div className="text-sm text-muted-foreground">费用金额</div>
                      <div className="text-4xl font-bold text-primary">
                        ¥{selectedApp.amount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  
                  {selectedApp.description && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">费用说明</div>
                      <div className="text-sm bg-gray-50 p-3 rounded">
                        {selectedApp.description}
                      </div>
                    </div>
                  )}
                  
                  {selectedApp.receipt_photos.length > 0 && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">凭证照片</div>
                      <div className="grid grid-cols-3 gap-2">
                        {selectedApp.receipt_photos.map((url, index) => (
                          <img
                            key={index}
                            src={url}
                            alt={`凭证${index + 1}`}
                            className="w-full h-20 object-cover rounded border cursor-pointer"
                            onClick={() => window.open(url, '_blank')}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {selectedApp.status === 'pending' && (
                    <div className="grid gap-2">
                      <Label>审批意见（可选）</Label>
                      <Textarea
                        placeholder="输入审批意见..."
                        value={reviewComment}
                        onChange={e => setReviewComment(e.target.value)}
                        rows={3}
                      />
                    </div>
                  )}
                </div>
                
                <DialogFooter className="flex-col gap-2">
                  {selectedApp.status === 'pending' ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 w-full">
                        <Button
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => handleReview(false)}
                          disabled={reviewing}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          驳回
                        </Button>
                        <Button
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleReview(true)}
                          disabled={reviewing}
                        >
                          {reviewing ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          通过
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button 
                      variant="outline" 
                      onClick={() => setShowReviewDialog(false)}
                      className="w-full"
                    >
                      关闭
                    </Button>
                  )}
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MobileLayout>
  );
}

