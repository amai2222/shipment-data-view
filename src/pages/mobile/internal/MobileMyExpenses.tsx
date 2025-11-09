// 移动端 - 我的费用申请（司机端）
// 司机登录后的默认首页

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
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
import { useAuth } from '@/contexts/AuthContext';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { useOptimizedRealtimeSubscription } from '@/hooks/useMemoryLeakFix';
import {
  Plus,
  Calendar,
  DollarSign,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Upload,
  Image as ImageIcon,
  Loader2,
  ArrowLeft,
  User,
  Truck,
  RefreshCw,
  Bell,
  ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 费用类型配置
const EXPENSE_TYPES = [
  { value: 'fuel', label: '🛢️ 加油费', color: 'bg-blue-100 text-blue-800' },
  { value: 'charging', label: '⚡ 充电费', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'car_wash', label: '🚿 洗车费', color: 'bg-cyan-100 text-cyan-800' },
  { value: 'parking', label: '🅿️ 停车费', color: 'bg-green-100 text-green-800' },
  { value: 'toll', label: '🛣️ 过路费', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'maintenance', label: '🔧 维修费', color: 'bg-red-100 text-red-800' },
  { value: 'fine', label: '⚠️ 罚款', color: 'bg-orange-100 text-orange-800' },
  { value: 'meal', label: '🍔 餐费', color: 'bg-purple-100 text-purple-800' },
  { value: 'accommodation', label: '🏨 住宿费', color: 'bg-pink-100 text-pink-800' },
  { value: 'other', label: '📝 其他', color: 'bg-gray-100 text-gray-800' }
];

// 申请状态配置
const STATUS_CONFIG = {
  pending: { label: '待审核', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { label: '已通过', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejected: { label: '已驳回', color: 'bg-red-100 text-red-800', icon: XCircle },
  paid: { label: '已付款', color: 'bg-blue-100 text-blue-800', icon: CheckCircle }
};

interface ExpenseApplication {
  id: string;
  application_number: string;
  expense_date: string;
  expense_type: string;
  amount: number;
  description: string;
  receipt_photos: string[];
  status: string;
  review_comment: string | null;
  created_at: string;
}

export default function MobileMyExpenses() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [myVehicles, setMyVehicles] = useState<any[]>([]);
  const [applications, setApplications] = useState<ExpenseApplication[]>([]);
  const [pendingDispatchCount, setPendingDispatchCount] = useState(0);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedApp, setSelectedApp] = useState<ExpenseApplication | null>(null);
  
  // 新申请表单
  const [formData, setFormData] = useState({
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    expense_type: 'fuel',
    amount: '',
    description: '',
    receipt_photos: [] as string[]
  });
  
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadApplications();
    loadMyVehicles();
    loadPendingDispatches();
    
    // ✅ 预加载常用页面，避免首次点击时出现"刷新"
    setTimeout(() => {
      import('./MobileMyDispatches');    // 我的派单（优先）
      import('./MobileDriverSalary');    // 我的工资
      import('./MobileSalaryRecords');  // 工资记录
      import('./MobileQuickEntry');     // 快速录单
      import('./MobileMyVehicles');     // 我的车辆
    }, 1000); // 页面加载1秒后开始预加载
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ 添加实时订阅 - 监听费用申请表的变化
  const handleRealtimeUpdate = useCallback((payload: any) => {
    console.log('费用申请数据变更:', payload);
    
    // 当有数据变更时，重新加载列表
    if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
      // 延迟一点刷新，确保数据已提交
      setTimeout(() => {
        loadApplications();
      }, 500);
      
      // 如果是审核状态变更，显示提示
      if (payload.eventType === 'UPDATE' && payload.new?.status !== payload.old?.status) {
        const newStatus = payload.new?.status;
        if (newStatus === 'approved') {
          toast({
            title: '审核通过 ✅',
            description: `费用申请 ${payload.new?.application_number} 已通过审核`,
          });
        } else if (newStatus === 'rejected') {
          toast({
            title: '审核未通过 ❌',
            description: `费用申请 ${payload.new?.application_number} 已被驳回`,
            variant: 'destructive'
          });
        }
      }
    }
  }, [toast]);

  // ✅ 订阅派单通知
  const handleDispatchUpdate = useCallback((payload: any) => {
    console.log('派单数据变更:', payload);
    
    // 新派单通知
    if (payload.eventType === 'INSERT' && payload.new?.status === 'pending') {
      toast({
        title: '新派单通知 🔔',
        description: `收到新的派单：${payload.new?.order_number || ''}`,
        duration: 10000,  // 显示10秒
      });
      loadPendingDispatches();
    }
    
    // 派单状态变更
    if (payload.eventType === 'UPDATE') {
      loadPendingDispatches();
    }
  }, [toast]);

  // 订阅费用申请表的实时变化
  useOptimizedRealtimeSubscription(
    'internal_driver_expense_applications',
    handleRealtimeUpdate,
    true  // 启用实时订阅
  );

  // ✅ 订阅派单表的实时变化
  useOptimizedRealtimeSubscription(
    'dispatch_orders',
    handleDispatchUpdate,
    true  // 启用实时订阅
  );

  // 加载我的车辆
  const loadMyVehicles = async () => {
    try {
      const { data, error } = await supabase.rpc('get_my_vehicles');
      if (error) throw error;
      setMyVehicles(data || []);
    } catch (error) {
      console.error('加载车辆失败:', error);
    }
  };

  // ✅ 加载待接单的派单数量
  const loadPendingDispatches = async () => {
    try {
      const { data, error } = await supabase.rpc('get_my_dispatch_orders', {
        p_status: 'pending'
      });
      
      if (error) throw error;
      setPendingDispatchCount(data?.length || 0);
    } catch (error) {
      console.error('加载派单失败:', error);
    }
  };

  // 加载费用申请列表
  const loadApplications = async () => {
    setLoading(true);
    try {
      // ✅ 使用实际的数据库查询
      const { data: driverInfo, error: driverError } = await supabase.rpc('get_my_driver_info');
      
      if (driverError) throw driverError;
      
      if (!driverInfo || driverInfo.length === 0) {
        toast({
          title: '提示',
          description: '未找到司机档案信息',
          variant: 'destructive'
        });
        setApplications([]);
        return;
      }

      const driverId = driverInfo[0].driver_id;  // ✅ 修复：使用正确的字段名

      const { data, error } = await supabase
        .from('internal_driver_expense_applications')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setApplications(data || []);
    } catch (error) {
      console.error('加载失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载费用申请记录',
        variant: 'destructive'
      });
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  // 提交费用申请
  const handleSubmit = async () => {
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast({
        title: '输入错误',
        description: '请输入有效的费用金额',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      // ✅ 调用 RPC 函数提交费用申请
      const { data, error } = await supabase.rpc('submit_expense_application', {
        p_expense_date: formData.expense_date,
        p_expense_type: formData.expense_type,
        p_amount: parseFloat(formData.amount),
        p_description: formData.description,
        p_receipt_photos: formData.receipt_photos
      });

      if (error) throw error;
      
      if (!data.success) {
        toast({ title: '提交失败', description: data.message, variant: 'destructive' });
        return;
      }

      toast({
        title: '提交成功',
        description: '费用申请已提交，等待审核'
      });

      setShowNewDialog(false);
      setFormData({
        expense_date: format(new Date(), 'yyyy-MM-dd'),
        expense_type: 'fuel',
        amount: '',
        description: '',
        receipt_photos: []
      });
      
      loadApplications();
    } catch (error) {
      console.error('提交失败:', error);
      toast({
        title: '提交失败',
        description: '请稍后重试',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // 上传凭证照片
  const handleUploadReceipt = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const file = files[0];
      
      // 读取文件为 Base64
      const reader = new FileReader();
      const fileData = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]);
        };
        reader.readAsDataURL(file);
      });

      // 上传到七牛云
      const { data, error } = await supabase.functions.invoke('qiniu-upload', {
        body: {
          files: [{
            fileName: file.name,
            fileData: fileData
          }],
          namingParams: {
            projectName: 'expense',
            customName: `费用凭证-${profile?.full_name}-${Date.now()}.${file.name.split('.').pop()}`
          }
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error('上传失败');

      setFormData(prev => ({
        ...prev,
        receipt_photos: [...prev.receipt_photos, ...data.urls]
      }));

      toast({
        title: '上传成功',
        description: '凭证照片已上传'
      });
    } catch (error) {
      console.error('上传失败:', error);
      toast({
        title: '上传失败',
        description: '请重试',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  // 获取费用类型配置
  const getExpenseTypeConfig = (type: string) => {
    return EXPENSE_TYPES.find(t => t.value === type) || EXPENSE_TYPES[EXPENSE_TYPES.length - 1];
  };

  // 获取状态配置
  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  };

  // 统计数据
  const stats = {
    pending: applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    thisMonth: applications.filter(a => 
      new Date(a.expense_date).getMonth() === new Date().getMonth()
    ).reduce((sum, a) => sum + a.amount, 0)
  };

  return (
    <MobileLayout title="司机工作台">
      <div className="space-y-4 pb-20">
        {/* 欢迎信息 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">你好，{profile?.full_name || '司机'}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {format(new Date(), 'yyyy年MM月dd日 EEEE', { locale: zhCN })}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadApplications();
              loadPendingDispatches();
              toast({ title: '已刷新' });
            }}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* 🔔 派单任务区域（最醒目的位置） */}
        <Card className="border-2 border-orange-200 shadow-lg">
          <CardHeader className="pb-3 bg-gradient-to-r from-orange-50 to-red-50">
            <CardTitle className="flex items-center gap-2 text-orange-900">
              <FileText className="h-5 w-5" />
              派单任务
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* 待接单派单 - 醒目提示 */}
            {pendingDispatchCount > 0 && (
              <div 
                className="p-4 bg-gradient-to-br from-orange-500 to-red-500 text-white cursor-pointer hover:from-orange-600 hover:to-red-600 transition-all border-b-2 border-orange-600"
                onClick={() => navigate('/m/internal/my-dispatches')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm animate-pulse">
                      <Bell className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-xl">🔔 新派单待接</div>
                      <div className="text-sm opacity-90 mt-1">您有 {pendingDispatchCount} 个派单需要处理</div>
                    </div>
                  </div>
                  <ArrowRight className="h-6 w-6" />
                </div>
              </div>
            )}
            
            {/* 快捷入口 */}
            <div className="grid grid-cols-2 gap-0 divide-x">
              <Button
                variant="ghost"
                className="h-20 rounded-none flex flex-col gap-2 hover:bg-blue-50"
                onClick={() => navigate('/m/internal/my-dispatches')}
              >
                <FileText className="h-6 w-6 text-blue-600" />
                <span className="text-sm font-medium">查看派单</span>
              </Button>
              <Button
                variant="ghost"
                className="h-20 rounded-none flex flex-col gap-2 hover:bg-green-50"
                onClick={() => navigate('/m/internal/quick-entry')}
              >
                <Plus className="h-6 w-6 text-green-600" />
                <span className="text-sm font-medium">手动录单</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 快捷功能卡片 */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/m/internal/driver-salary')}>
            <CardContent className="p-4 text-center">
              <DollarSign className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <div className="text-sm font-medium">我的工资</div>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/m/internal/my-vehicles')}>
            <CardContent className="p-4 text-center">
              <Truck className="h-6 w-6 mx-auto mb-2 text-blue-600" />
              <div className="text-sm font-medium">我的车辆</div>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/m/internal/salary-records')}>
            <CardContent className="p-4 text-center">
              <Calendar className="h-6 w-6 mx-auto mb-2 text-purple-600" />
              <div className="text-sm font-medium">工资记录</div>
            </CardContent>
          </Card>
        </div>

        {/* 费用申请统计 */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
            <CardContent className="p-3 text-center">
              <Clock className="h-4 w-4 mx-auto mb-1 text-yellow-600" />
              <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
              <div className="text-xs text-yellow-600">待审核费用</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-3 text-center">
              <CheckCircle className="h-4 w-4 mx-auto mb-1 text-green-600" />
              <div className="text-2xl font-bold text-green-700">{stats.approved}</div>
              <div className="text-xs text-green-600">已通过费用</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <CardContent className="p-3 text-center">
              <DollarSign className="h-4 w-4 mx-auto mb-1 text-blue-600" />
              <div className="text-xl font-bold text-blue-700">¥{stats.thisMonth.toFixed(0)}</div>
              <div className="text-xs text-blue-600">本月费用</div>
            </CardContent>
          </Card>
        </div>

        {/* 快捷操作按钮 - 美化版 */}
        <div className="grid grid-cols-3 gap-3">
          <Button 
            onClick={() => navigate('/m/internal/quick-entry')}
            className="h-24 bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 hover:from-green-600 hover:to-teal-700 shadow-lg border-0 rounded-2xl"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Truck className="h-6 w-6" />
              </div>
              <span className="text-sm font-medium">录入运单</span>
            </div>
          </Button>
          
          <Button 
            onClick={() => setShowNewDialog(true)}
            className="h-24 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg border-0 rounded-2xl"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Plus className="h-6 w-6" />
              </div>
              <span className="text-sm font-medium">费用申请</span>
            </div>
          </Button>
          
          <Button 
            onClick={() => navigate('/m/internal/driver-salary')}
            className="h-24 bg-gradient-to-br from-orange-400 via-amber-500 to-yellow-600 hover:from-orange-500 hover:to-yellow-700 shadow-lg border-0 rounded-2xl"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <DollarSign className="h-6 w-6" />
              </div>
              <span className="text-sm font-medium">我的工资</span>
            </div>
          </Button>
        </div>

        {/* 我的车辆卡片 - 从数据库读取 */}
        {myVehicles.length > 0 && (
          <Card className="border-0 shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 p-4">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">我的车辆</h3>
                    <p className="text-xs text-slate-300">Vehicle Info</p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={() => navigate('/m/internal/my-vehicles')}
                  className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
                >
                  查看详情
                </Button>
              </div>
            </div>
            <CardContent className="p-4 bg-gradient-to-br from-slate-50 to-slate-100">
              <div className="space-y-3">
                {myVehicles.map((vehicle, index) => (
                  <div key={vehicle.vehicle_id} className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm">
                    <div className={`w-2 h-12 ${index === 0 ? 'bg-green-500' : 'bg-blue-400'} rounded-full`}></div>
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">{index === 0 ? '主车' : '备用车'}</div>
                      <div className="text-lg font-bold">{vehicle.license_plate}</div>
                      <div className="text-xs text-muted-foreground">
                        {vehicle.vehicle_brand || ''} {vehicle.vehicle_model || vehicle.vehicle_type || ''}
                      </div>
                    </div>
                    <Badge className={index === 0 ? 'bg-green-100 text-green-700 border-0' : 'bg-blue-100 text-blue-700 border-0'}>
                      {index === 0 ? '主车' : '备用'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 申请记录列表 - 美化版 */}
        <Card className="border-0 shadow-md">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                <FileText className="h-4 w-4 text-indigo-600" />
              </div>
              <span className="font-semibold text-gray-800">我的申请记录</span>
              <Badge variant="secondary" className="ml-auto">
                {applications.length} 条
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">加载中...</p>
              </div>
            ) : applications.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground mt-2">暂无费用申请</p>
                <Button 
                  variant="link" 
                  onClick={() => setShowNewDialog(true)}
                  className="mt-2"
                >
                  点击新增
                </Button>
              </div>
            ) : (
              applications.map(app => {
                const typeConfig = getExpenseTypeConfig(app.expense_type);
                const statusConfig = getStatusConfig(app.status);
                const StatusIcon = statusConfig.icon;
                
                return (
                  <Card 
                    key={app.id} 
                    className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] border-0 shadow-sm bg-gradient-to-br from-white to-gray-50"
                    onClick={() => {
                      setSelectedApp(app);
                      setShowDetailDialog(true);
                    }}
                  >
                    <CardContent className="p-4 relative overflow-hidden">
                      {/* 装饰性背景图案 */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 to-transparent rounded-full -mr-16 -mt-16 opacity-50"></div>
                      
                      <div className="flex items-start justify-between relative z-10">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-3">
                            <Badge className={`${typeConfig.color} shadow-sm`}>
                              {typeConfig.label}
                            </Badge>
                            <Badge className={`${statusConfig.color} shadow-sm`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(app.expense_date), 'yyyy年MM月dd日', { locale: zhCN })}
                            </div>
                            
                            {app.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {app.description}
                              </p>
                            )}
                            
                            <div className="text-xs text-muted-foreground">
                              申请单号：{app.application_number}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right ml-4">
                          <div className="text-2xl font-bold text-primary">
                            ¥{app.amount.toFixed(2)}
                          </div>
                          {app.receipt_photos.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-end gap-1">
                              <ImageIcon className="h-3 w-3" />
                              {app.receipt_photos.length}张凭证
                            </div>
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

        {/* 新增费用申请对话框 */}
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                新增费用申请
              </DialogTitle>
              <DialogDescription>
                填写费用信息并上传凭证照片
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>费用日期</Label>
                <Input
                  type="date"
                  value={formData.expense_date}
                  onChange={e => setFormData(prev => ({ ...prev, expense_date: e.target.value }))}
                />
              </div>
              
              <div className="grid gap-2">
                <Label>费用类型</Label>
                <Select
                  value={formData.expense_type}
                  onValueChange={value => setFormData(prev => ({ ...prev, expense_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label>费用金额（元）</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={e => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  step="0.01"
                />
              </div>
              
              <div className="grid gap-2">
                <Label>费用说明</Label>
                <Textarea
                  placeholder="请输入费用说明..."
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>
              
              <div className="grid gap-2">
                <Label>凭证照片</Label>
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadReceipt}
                    disabled={uploading}
                  />
                  {uploading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      上传中...
                    </div>
                  )}
                  {formData.receipt_photos.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      已上传 {formData.receipt_photos.length} 张照片
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewDialog(false)}>
                取消
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                提交申请
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 申请详情对话框 */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-md">
            {selectedApp && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    申请详情
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge className={getExpenseTypeConfig(selectedApp.expense_type).color}>
                      {getExpenseTypeConfig(selectedApp.expense_type).label}
                    </Badge>
                    <Badge className={getStatusConfig(selectedApp.status).color}>
                      {getStatusConfig(selectedApp.status).label}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">申请单号</div>
                      <div className="font-mono">{selectedApp.application_number}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">费用日期</div>
                      <div>{format(new Date(selectedApp.expense_date), 'yyyy-MM-dd')}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-muted-foreground">费用金额</div>
                      <div className="text-2xl font-bold text-primary">¥{selectedApp.amount.toFixed(2)}</div>
                    </div>
                    {selectedApp.description && (
                      <div className="col-span-2">
                        <div className="text-muted-foreground">费用说明</div>
                        <div className="mt-1">{selectedApp.description}</div>
                      </div>
                    )}
                    {selectedApp.review_comment && (
                      <div className="col-span-2">
                        <div className="text-muted-foreground">审核意见</div>
                        <div className="mt-1 text-orange-600">{selectedApp.review_comment}</div>
                      </div>
                    )}
                  </div>
                  
                  {selectedApp.receipt_photos.length > 0 && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">凭证照片</div>
                      <div className="grid grid-cols-3 gap-2">
                        {selectedApp.receipt_photos.map((url, index) => (
                          <img
                            key={index}
                            src={url}
                            alt={`凭证${index + 1}`}
                            className="w-full h-20 object-cover rounded border"
                          />
                        ))}
                      </div>
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
      </div>
    </MobileLayout>
  );
}

