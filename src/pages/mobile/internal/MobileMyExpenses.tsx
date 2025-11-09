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
  ArrowRight,
  Camera,
  ImagePlus,
  X
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
      import('./MobileMyWaybills');      // 行程记录
      import('./MobileDriverSalary');    // 我的收入
      import('./MobileSalaryRecords');   // 收支明细
      import('./MobileQuickEntry');      // 快速录单
      import('./MobileMyVehicles');      // 我的车辆
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
      // ✅ 先上传照片到七牛云
      let photoUrls: string[] = [];
      if (selectedFiles.length > 0) {
        setUploading(true);
        photoUrls = await uploadFilesToQiniu();
        setUploading(false);
      }

      // ✅ 调用 RPC 函数提交费用申请
      const { data, error } = await supabase.rpc('submit_expense_application', {
        p_expense_date: formData.expense_date,
        p_expense_type: formData.expense_type,
        p_amount: parseFloat(formData.amount),
        p_description: formData.description,
        p_receipt_photos: photoUrls.length > 0 ? photoUrls : null
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
      setSelectedFiles([]);  // 清空已选照片
      
      loadApplications();
    } catch (error: any) {
      console.error('提交失败:', error);
      toast({
        title: '提交失败',
        description: error.message || '请稍后重试',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  // 选择照片文件
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // 选择照片
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length !== files.length) {
      toast({
        title: "提示",
        description: "只能上传图片文件",
        variant: "destructive",
      });
    }

    setSelectedFiles(prev => [...prev, ...imageFiles]);
  };

  // 拍照上传
  const handleCameraCapture = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // 优先使用后置摄像头
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) {
        setSelectedFiles(prev => [...prev, ...files]);
      }
    };
    input.click();
  };

  // 删除照片
  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 上传照片到七牛云
  const uploadFilesToQiniu = async (): Promise<string[]> => {
    if (selectedFiles.length === 0) return [];

    const filesToUpload = selectedFiles.map(file => ({
      fileName: file.name,
      fileData: ''
    }));

    // 读取文件为 base64
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const reader = new FileReader();
      await new Promise((resolve) => {
        reader.onload = () => {
          const base64 = reader.result as string;
          filesToUpload[i].fileData = base64.split(',')[1]; // 去掉前缀
          resolve(null);
        };
        reader.readAsDataURL(file);
      });
    }

    // ✅ 调用七牛云上传，存储到 other/siji/feiyong/ 目录
    const { data, error } = await supabase.functions.invoke('qiniu-upload', {
      body: { 
        files: filesToUpload,
        namingParams: {
          projectName: 'feiyong',  // ✅ 触发费用上传模式
          customName: `${profile?.full_name || '司机'}-${format(new Date(), 'yyyyMMdd-HHmmss')}`
        }
      }
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error || '上传失败');

    return data.urls;
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
    <MobileLayout title="工作台" showBack={false}>
      <div className="space-y-3 pb-20">
        {/* 顶部状态栏 - 类似货拉拉 */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 -mx-4 -mt-4 px-4 py-4 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <User className="h-6 w-6" />
                  </div>
                  <div>
                <div className="font-bold text-lg">{profile?.full_name || '司机'}</div>
                <div className="text-xs text-blue-100">
                  {format(new Date(), 'MM月dd日 EEEE', { locale: zhCN })}
                  </div>
                </div>
                </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20"
              onClick={() => {
                loadApplications();
                loadPendingDispatches();
                toast({ title: '已刷新' });
              }}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
              </div>
            </div>

        {/* 🔔 待接单派单提示（最重要 - 类似滴滴的接单提示） */}
        {pendingDispatchCount > 0 && (
          <Card 
            className="border-2 border-orange-400 shadow-xl cursor-pointer hover:shadow-2xl transition-all animate-pulse"
            onClick={() => navigate('/m/internal/my-dispatches')}
          >
            <CardContent className="p-0">
              <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 text-white p-5">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-white/30 flex items-center justify-center backdrop-blur-sm">
                    <Bell className="h-9 w-9 text-white animate-bounce" />
                  </div>
                  <div className="flex-1">
                    <div className="text-2xl font-bold mb-1">有新派单！</div>
                    <div className="text-base opacity-95">{pendingDispatchCount} 个派单等待接单</div>
                  </div>
                  <ArrowRight className="h-8 w-8" />
                </div>
              </div>
              <div className="bg-orange-50 px-5 py-3 text-center">
                <span className="text-orange-900 font-medium text-sm">👆 点击立即查看详情</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 主要任务卡片 - 类似货拉拉的订单卡片 */}
        <Card className="shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600" />
              运输任务
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 divide-x">
              <div 
                className="p-6 text-center cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={() => navigate('/m/internal/my-dispatches')}
              >
                <div className="w-14 h-14 mx-auto rounded-full bg-blue-100 flex items-center justify-center mb-3">
                  <FileText className="h-7 w-7 text-blue-600" />
                </div>
                <div className="font-bold text-lg mb-1">派单接单</div>
                <div className="text-xs text-muted-foreground">查看和接受派单</div>
              </div>
          
              <div 
                className="p-6 text-center cursor-pointer hover:bg-green-50 transition-colors"
                onClick={() => navigate('/m/internal/quick-entry')}
              >
                <div className="w-14 h-14 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-3">
                  <Plus className="h-7 w-7 text-green-600" />
                </div>
                <div className="font-bold text-lg mb-1">手动录单</div>
                <div className="text-xs text-muted-foreground">自主录入运单</div>
              </div>
            </div>
            </CardContent>
          </Card>

        {/* 我的服务 - 类似支付宝的宫格布局 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">我的服务</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div 
                className="flex flex-col items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/m/internal/driver-salary')}
              >
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <span className="text-xs text-center">我的收入</span>
        </div>

              <div 
                className="flex flex-col items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/m/internal/my-vehicles')}
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Truck className="h-6 w-6 text-blue-600" />
              </div>
                <span className="text-xs text-center">我的车辆</span>
            </div>
              
              <div 
                className="flex flex-col items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/m/internal/salary-records')}
              >
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-purple-600" />
              </div>
                <span className="text-xs text-center">收支明细</span>
            </div>
          
              <div 
                className="flex flex-col items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setShowNewDialog(true)}
              >
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <Plus className="h-6 w-6 text-orange-600" />
              </div>
                <span className="text-xs text-center">费用申请</span>
            </div>
            </div>
          </CardContent>
        </Card>

        {/* 本月数据统计 - 简洁版 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">本月数据</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">待审核</div>
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              </div>
              <div className="text-center border-x">
                <div className="text-sm text-muted-foreground mb-1">已通过</div>
                <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">费用合计</div>
                <div className="text-xl font-bold text-blue-600">¥{stats.thisMonth.toFixed(0)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 最近费用申请 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">最近费用申请</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setShowNewDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                新建
          </Button>
        </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {applications.slice(0, 3).map(app => (
                <div 
                  key={app.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    setSelectedApp(app);
                    setShowDetailDialog(true);
                  }}
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{EXPENSE_TYPES.find(t => t.value === app.expense_type)?.label || app.expense_type}</div>
                    <div className="text-xs text-muted-foreground">{app.expense_date}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-blue-600">¥{app.amount}</div>
                    <Badge variant={app.status === 'pending' ? 'default' : app.status === 'approved' ? 'secondary' : 'outline'} className="text-xs">
                      {app.status === 'pending' ? '待审核' : app.status === 'approved' ? '已通过' : '已驳回'}
                    </Badge>
                  </div>
                </div>
              ))}
              {applications.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  暂无费用申请记录
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 隐藏旧的内容 */}
        <div className="hidden">
          {/* 旧的车辆卡片等内容 */}
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
                <Label>凭证照片（可选）</Label>
                
                {/* 上传按钮区域 - 符合主流APP设计 */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-24 flex flex-col gap-2"
                    onClick={handleCameraCapture}
                    disabled={uploading}
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <Camera className="h-6 w-6 text-blue-600" />
                    </div>
                    <span className="text-sm">拍照</span>
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    className="h-24 flex flex-col gap-2"
                    onClick={() => document.getElementById('photo-file-input')?.click()}
                    disabled={uploading}
                  >
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                      <ImagePlus className="h-6 w-6 text-green-600" />
                    </div>
                    <span className="text-sm">相册</span>
                  </Button>
                </div>
                
                {/* 隐藏的文件输入 */}
                <input
                  id="photo-file-input"
                    type="file"
                    accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                
                {/* 照片预览网格 */}
                {selectedFiles.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="relative aspect-square">
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt={`照片${index + 1}`} 
                          className="w-full h-full object-cover rounded-lg border-2 border-gray-200"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg"
                          onClick={() => removeSelectedFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                  {uploading && (
                  <div className="flex items-center justify-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    正在上传照片到云端...
                    </div>
                  )}
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

