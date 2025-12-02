// 移动端 - 我的费用
// 整合费用申请和费用冲销功能

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useAuth } from '@/contexts/AuthContext';
import { DriverMobileLayout } from '@/components/mobile/DriverMobileLayout';
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
  Truck,
  Camera,
  ImagePlus,
  X,
  Calculator
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { limitAmountInput } from '@/utils/formatters';

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
  actual_amount: number | null;
  description: string;
  receipt_photos: string[];
  status: string;
  review_comment: string | null;
  writeoff_time: string | null;
  created_at: string;
}

export default function MobileMyExpenses() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('application'); // 'application' | 'writeoff'
  const [applications, setApplications] = useState<ExpenseApplication[]>([]);
  const [writeoffApplications, setWriteoffApplications] = useState<ExpenseApplication[]>([]);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showWriteoffDialog, setShowWriteoffDialog] = useState(false);
  const [selectedApp, setSelectedApp] = useState<ExpenseApplication | null>(null);
  const [selectedWriteoffApp, setSelectedWriteoffApp] = useState<ExpenseApplication | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expenseBalance, setExpenseBalance] = useState<number>(0);
  
  // 费用申请表单
  const [formData, setFormData] = useState({
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    expense_type: 'fuel',
    amount: '',
    description: '',
    receipt_photos: [] as string[]
  });
  
  // 费用冲销表单
  const [actualAmount, setActualAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const isInitialLoad = useRef(true);

  interface Vehicle {
    vehicle_id: string;
    license_plate: string;
    vehicle_type: string;
    is_primary: boolean;
  }
  const [myVehicles, setMyVehicles] = useState<Vehicle[]>([]);

  // 加载我的车辆
  const loadMyVehicles = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_my_vehicles');
      if (error) throw error;
      setMyVehicles(data || []);
    } catch (error: unknown) {
      console.error('加载车辆失败:', error);
    }
  }, []);

  // 加载费用余额
  const loadExpenseBalance = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_driver_expense_balance');
      if (error) throw error;
      if (data && data.success) {
        setExpenseBalance(data.balance || 0);
      }
    } catch (error: unknown) {
      console.error('加载余额失败:', error);
    }
  }, []);

  // 加载费用申请列表
  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError(null);
    const wasInitialLoad = isInitialLoad.current;
    try {
      const { data: driverInfo, error: driverError } = await supabase.rpc('get_my_driver_info');
      
      if (driverError) throw driverError;
      
      if (!driverInfo || driverInfo.length === 0) {
        setApplications([]);
        setError('未找到司机档案信息');
        if (wasInitialLoad) {
          toast({
            title: '提示',
            description: '未找到司机档案信息',
            variant: 'destructive'
          });
        }
        return;
      }

      const driverId = driverInfo[0].driver_id;

      const { data, error } = await supabase
        .from('internal_driver_expense_applications')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setApplications(data || []);
      setError(null);
      isInitialLoad.current = false;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '无法加载费用申请记录';
      console.error('加载失败:', error);
      setError(errorMessage);
      setApplications([]);
      if (wasInitialLoad) {
        toast({
          title: '加载失败',
          description: errorMessage,
          variant: 'destructive'
        });
      }
      isInitialLoad.current = false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // 加载费用冲销列表（已审核通过的申请）
  const loadWriteoffApplications = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('internal_driver_expense_applications')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setWriteoffApplications((data || []) as ExpenseApplication[]);
    } catch (error: unknown) {
      console.error('加载失败:', error);
      toast({
        title: '加载失败',
        description: error instanceof Error ? error.message : '无法加载费用申请',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // 初始化加载
  useEffect(() => {
    try {
      loadApplications();
      loadWriteoffApplications();
      loadMyVehicles();
      loadExpenseBalance();
    } catch (error: unknown) {
      console.error('页面初始化失败:', error);
    }
  }, [loadApplications, loadWriteoffApplications, loadMyVehicles, loadExpenseBalance]);

  // 处理文件选择
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...imageFiles]);
      toast({
        title: "选择成功",
        description: `已添加 ${imageFiles.length} 张照片`,
        duration: 2000,
      });
    }
    
    event.target.value = '';
  };

  // 处理拍照
  const handleCameraFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...imageFiles]);
      toast({
        title: "拍照成功",
        description: `已添加 ${imageFiles.length} 张照片，可继续拍照`,
        duration: 2000,
      });
    }
    
    event.target.value = '';
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
          filesToUpload[i].fileData = base64.split(',')[1];
          resolve(null);
        };
        reader.readAsDataURL(file);
      });
    }

    // 调用七牛云上传
    const { data, error } = await supabase.functions.invoke('qiniu-upload', {
      body: {
        files: filesToUpload,
        namingParams: {
          projectName: 'feiyong',
          customName: `${profile?.full_name || '司机'}-${format(new Date(), 'yyyyMMdd-HHmmss')}`
        }
      }
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error || '上传失败');

    return data.urls;
  };

  // 提交费用申请
  const handleSubmitApplication = async () => {
    if (!formData.expense_date) {
      toast({
        title: '请选择日期',
        description: '请选择费用发生日期',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast({
        title: '请输入金额',
        description: '费用金额必须大于0',
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);
    try {
      // 先上传照片
      const photoUrls = await uploadFilesToQiniu();
      
      // 获取司机ID
      const { data: driverInfo, error: driverError } = await supabase.rpc('get_my_driver_info');
      if (driverError) throw driverError;
      if (!driverInfo || driverInfo.length === 0) {
        throw new Error('未找到司机档案信息');
      }
      const driverId = driverInfo[0].driver_id;

      // 提交申请
      const { data, error } = await supabase
        .from('internal_driver_expense_applications')
        .insert({
          driver_id: driverId,
          expense_date: formData.expense_date,
          expense_type: formData.expense_type,
          amount: parseFloat(formData.amount),
          description: formData.description,
          receipt_photos: photoUrls,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: '提交成功',
        description: '费用申请已提交，等待车队长审核'
      });

      setShowNewDialog(false);
      setFormData({
        expense_date: format(new Date(), 'yyyy-MM-dd'),
        expense_type: 'fuel',
        amount: '',
        description: '',
        receipt_photos: []
      });
      setSelectedFiles([]);
      loadApplications();
      loadExpenseBalance();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '请稍后重试';
      console.error('提交失败:', error);
      toast({
        title: '提交失败',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  // 打开费用冲销对话框
  const handleOpenWriteoff = (app: ExpenseApplication) => {
    setSelectedWriteoffApp(app);
    setActualAmount(app.actual_amount?.toString() || '');
    setShowWriteoffDialog(true);
  };

  // 提交费用冲销
  const handleWriteoff = async () => {
    if (!selectedWriteoffApp) return;

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
        p_application_id: selectedWriteoffApp.id,
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
      setSelectedWriteoffApp(null);
      setActualAmount('');
      loadWriteoffApplications();
      loadExpenseBalance();
    } catch (error: unknown) {
      console.error('冲销失败:', error);
      toast({
        title: '冲销失败',
        description: error instanceof Error ? error.message : '请稍后重试',
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
    <DriverMobileLayout title="我的费用">
      <div className="space-y-4 pb-20">
        {/* 费用余额卡片 */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground mb-1">费用余额</div>
                <div className={`text-2xl font-bold ${expenseBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ¥{expenseBalance.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {expenseBalance >= 0 ? '有结余' : '待补报销'}
                </div>
              </div>
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                <DollarSign className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 标签页：费用申请和费用冲销 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="application">费用申请</TabsTrigger>
            <TabsTrigger value="writeoff">费用冲销</TabsTrigger>
          </TabsList>

          {/* 费用申请标签页 */}
          <TabsContent value="application" className="space-y-4 mt-4">
            {/* 统计卡片 */}
            <div className="grid grid-cols-3 gap-2">
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-xs text-muted-foreground mb-1">待审核</div>
                  <div className="text-lg font-bold text-yellow-600">{stats.pending}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-xs text-muted-foreground mb-1">已通过</div>
                  <div className="text-lg font-bold text-green-600">{stats.approved}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-xs text-muted-foreground mb-1">本月金额</div>
                  <div className="text-lg font-bold text-blue-600">¥{stats.thisMonth.toFixed(0)}</div>
                </CardContent>
              </Card>
            </div>

            {/* 新建申请按钮 */}
            <Button 
              onClick={() => setShowNewDialog(true)} 
              className="w-full"
              size="lg"
            >
              <Plus className="h-5 w-5 mr-2" />
              新建费用申请
            </Button>

            {/* 申请列表 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">费用申请记录</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-2">加载中...</p>
                  </div>
                ) : error && applications.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                ) : applications.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground mt-2">暂无费用申请记录</p>
                  </div>
                ) : (
                  applications.map(app => {
                    const typeConfig = getExpenseTypeConfig(app.expense_type);
                    const statusConfig = getStatusConfig(app.status);
                    const StatusIcon = statusConfig.icon;
                    
                    return (
                      <Card 
                        key={app.id} 
                        className="cursor-pointer hover:shadow-md transition-all"
                        onClick={() => {
                          setSelectedApp(app);
                          setShowDetailDialog(true);
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge className={typeConfig.color}>
                                {typeConfig.label}
                              </Badge>
                              <Badge className={statusConfig.color}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusConfig.label}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <div className="text-lg font-bold text-blue-600">
                                ¥{app.amount.toFixed(2)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(app.expense_date), 'MM-dd', { locale: zhCN })}
                              </div>
                            </div>
                            
                            {app.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {app.description}
                              </p>
                            )}
                            
                            <div className="text-xs text-muted-foreground">
                              单号：{app.application_number}
                            </div>
                            
                            {app.review_comment && (
                              <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                                审批意见：{app.review_comment}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 费用冲销标签页 */}
          <TabsContent value="writeoff" className="space-y-4 mt-4">
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
                ) : writeoffApplications.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground mt-2">暂无已审核通过的费用申请</p>
                  </div>
                ) : (
                  writeoffApplications.map(app => {
                    const typeConfig = getExpenseTypeConfig(app.expense_type);
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
                            
                            {!isWriteoffed && (
                              <div className="ml-2">
                                <div className="text-lg font-bold text-blue-600">
                                  ¥{app.amount.toFixed(2)}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  点击冲销
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 新建费用申请对话框 */}
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>新建费用申请</DialogTitle>
              <DialogDescription>
                填写费用信息并上传相关凭证
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
                <Label>费用金额</Label>
                <Input
                  type="text"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={e => {
                    const value = limitAmountInput(e.target.value);
                    setFormData(prev => ({ ...prev, amount: value }));
                  }}
                />
              </div>
              
              <div className="grid gap-2">
                <Label>费用说明</Label>
                <Textarea
                  placeholder="请描述费用详情..."
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>
              
              <div className="grid gap-2">
                <Label>凭证照片</Label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <label className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Button type="button" variant="outline" className="w-full" asChild>
                        <span>
                          <ImageIcon className="h-4 w-4 mr-2" />
                          选择照片
                        </span>
                      </Button>
                    </label>
                    <label className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        onChange={handleCameraFileSelect}
                        className="hidden"
                      />
                      <Button type="button" variant="outline" className="w-full" asChild>
                        <span>
                          <Camera className="h-4 w-4 mr-2" />
                          拍照
                        </span>
                      </Button>
                    </label>
                  </div>
                  
                  {selectedFiles.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="relative">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`预览 ${index + 1}`}
                            className="w-full h-24 object-cover rounded border"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6"
                            onClick={() => removeSelectedFile(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewDialog(false)}>
                取消
              </Button>
              <Button onClick={handleSubmitApplication} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                提交申请
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 费用申请详情对话框 */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>费用申请详情</DialogTitle>
            </DialogHeader>
            
            {selectedApp && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">申请单号</Label>
                    <p className="text-sm font-medium">{selectedApp.application_number}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">费用日期</Label>
                    <p className="text-sm font-medium">
                      {format(new Date(selectedApp.expense_date), 'yyyy-MM-dd', { locale: zhCN })}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">费用类型</Label>
                    <Badge className={getExpenseTypeConfig(selectedApp.expense_type).color}>
                      {getExpenseTypeConfig(selectedApp.expense_type).label}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">状态</Label>
                    <div>
                      <Badge className={getStatusConfig(selectedApp.status).color}>
                        {getStatusConfig(selectedApp.status).label}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div>
                  <Label className="text-muted-foreground">费用金额</Label>
                  <p className="text-2xl font-bold text-blue-600">¥{selectedApp.amount.toFixed(2)}</p>
                </div>
                
                {selectedApp.description && (
                  <div>
                    <Label className="text-muted-foreground">费用说明</Label>
                    <p className="text-sm">{selectedApp.description}</p>
                  </div>
                )}
                
                {selectedApp.review_comment && (
                  <div>
                    <Label className="text-muted-foreground">审批意见</Label>
                    <p className="text-sm text-orange-600 bg-orange-50 p-2 rounded">
                      {selectedApp.review_comment}
                    </p>
                  </div>
                )}
                
                {selectedApp.receipt_photos && selectedApp.receipt_photos.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">凭证照片</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {selectedApp.receipt_photos.map((photo, index) => (
                        <img
                          key={index}
                          src={photo}
                          alt={`凭证 ${index + 1}`}
                          className="w-full h-24 object-cover rounded border"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <DialogFooter>
              <Button onClick={() => setShowDetailDialog(false)}>关闭</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 费用冲销对话框 */}
        <Dialog open={showWriteoffDialog} onOpenChange={setShowWriteoffDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>费用冲销</DialogTitle>
              <DialogDescription>
                输入实际消费金额
              </DialogDescription>
            </DialogHeader>
            
            {selectedWriteoffApp && (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>申请金额</Label>
                  <div className="p-3 bg-gray-100 rounded text-center font-medium text-lg">
                    ¥{selectedWriteoffApp.amount.toFixed(2)}
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Label>实际消费金额</Label>
                  <Input
                    type="text"
                    placeholder="0.00"
                    value={actualAmount}
                    onChange={e => {
                      const value = limitAmountInput(e.target.value);
                      setActualAmount(value);
                    }}
                  />
                </div>
                
                {actualAmount && !isNaN(parseFloat(actualAmount)) && (
                  <div className="p-3 bg-blue-50 rounded">
                    <div className="text-sm text-muted-foreground mb-1">预计结余</div>
                    <div className={`text-lg font-bold ${(selectedWriteoffApp.amount - parseFloat(actualAmount)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ¥{(selectedWriteoffApp.amount - parseFloat(actualAmount)).toFixed(2)}
                      {(selectedWriteoffApp.amount - parseFloat(actualAmount)) >= 0 ? ' (结余)' : ' (待补)'}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowWriteoffDialog(false)}>
                取消
              </Button>
              <Button onClick={handleWriteoff} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                确认冲销
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DriverMobileLayout>
  );
}
