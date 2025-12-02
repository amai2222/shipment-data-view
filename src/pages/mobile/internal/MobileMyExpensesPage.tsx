// 移动端 - 我的费用页面
// 集成费用申请和费用冲销功能

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

export default function MobileMyExpensesPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('applications');
  const [applications, setApplications] = useState<ExpenseApplication[]>([]);
  const [writeoffApplications, setWriteoffApplications] = useState<ExpenseApplication[]>([]);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showWriteoffDialog, setShowWriteoffDialog] = useState(false);
  const [selectedApp, setSelectedApp] = useState<ExpenseApplication | null>(null);
  const [selectedWriteoffApp, setSelectedWriteoffApp] = useState<ExpenseApplication | null>(null);
  const [actualAmount, setActualAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // 新申请表单
  const [formData, setFormData] = useState({
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    expense_type: 'fuel',
    amount: '',
    description: '',
    receipt_photos: [] as string[]
  });
  
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  
  // 冲销专用图片上传状态
  const [writeoffFiles, setWriteoffFiles] = useState<File[]>([]);
  const [uploadingWriteoff, setUploadingWriteoff] = useState(false);
  
  // TDZ 修复：延迟初始化
  const isMountedRef = useRef(false);
  const hasInitialized = useRef(false);

  // 获取费用类型配置
  const getExpenseTypeConfig = (type: string) => {
    return EXPENSE_TYPES.find(t => t.value === type) || EXPENSE_TYPES[EXPENSE_TYPES.length - 1];
  };

  // 获取状态配置
  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  };

  // 上传文件到七牛云
  const uploadFilesToQiniu = async (): Promise<string[]> => {
    if (selectedFiles.length === 0) return [];
    
    const uploadPromises = selectedFiles.map(async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const { data, error } = await supabase.functions.invoke('upload-to-qiniu', {
        body: formData
      });
      
      if (error) throw error;
      if (!data || !data.url) throw new Error('上传失败：未返回URL');
      
      return data.url;
    });
    
    return Promise.all(uploadPromises);
  };

  // 上传冲销凭证到七牛云
  const uploadWriteoffFilesToQiniu = async (): Promise<string[]> => {
    if (writeoffFiles.length === 0) return [];
    
    const uploadPromises = writeoffFiles.map(async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const { data, error } = await supabase.functions.invoke('upload-to-qiniu', {
        body: formData
      });
      
      if (error) throw error;
      if (!data || !data.url) throw new Error('上传失败：未返回URL');
      
      return data.url;
    });
    
    return Promise.all(uploadPromises);
  };

  // 加载费用申请列表
  const loadApplications = useCallback(async () => {
    setLoading(true);
    try {
      const { data: driverInfo, error: driverError } = await supabase.rpc('get_my_driver_info');
      
      if (driverError) throw driverError;
      
      if (!driverInfo || driverInfo.length === 0) {
        setApplications([]);
        return;
      }

      // 优先使用 id，如果没有则使用 driver_id（兼容性处理）
      const driverId = driverInfo[0].id || driverInfo[0].driver_id;
      
      if (!driverId) {
        console.error('无法获取司机ID，数据:', driverInfo[0]);
        setApplications([]);
        return;
      }

      const { data, error } = await supabase
        .from('internal_driver_expense_applications')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setApplications(data || []);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '无法加载费用申请记录';
      console.error('加载失败:', error);
      toast({
        title: '加载失败',
        description: errorMessage,
        variant: 'destructive'
      });
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // 加载已审核通过的费用申请（用于冲销）
  const loadWriteoffApplications = useCallback(async () => {
    setLoading(true);
    try {
      const { data: driverInfo, error: driverError } = await supabase.rpc('get_my_driver_info');
      
      if (driverError) {
        console.error('获取司机信息失败:', driverError);
        throw driverError;
      }
      
      if (!driverInfo || driverInfo.length === 0) {
        console.warn('未找到司机信息');
        setWriteoffApplications([]);
        return;
      }

      // 优先使用 id，如果没有则使用 driver_id（兼容性处理）
      const driverId = driverInfo[0].id || driverInfo[0].driver_id;
      
      if (!driverId) {
        console.error('无法获取司机ID，数据:', driverInfo[0]);
        setWriteoffApplications([]);
        return;
      }

      console.log('🔍 查询已审核通过的费用申请，司机ID:', driverId);

      const { data, error } = await supabase
        .from('internal_driver_expense_applications')
        .select('*')
        .eq('driver_id', driverId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('查询费用申请失败:', error);
        throw error;
      }
      
      console.log('✅ 查询到已审核通过的费用申请:', data?.length || 0, '条');
      if (data && data.length > 0) {
        console.log('📋 申请列表:', data.map(app => ({
          id: app.id,
          application_number: app.application_number,
          amount: app.amount,
          status: app.status,
          actual_amount: app.actual_amount
        })));
      }
      
      setWriteoffApplications(data || []);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '无法加载费用申请';
      console.error('加载失败:', error);
      toast({
        title: '加载失败',
        description: errorMessage,
        variant: 'destructive'
      });
      setWriteoffApplications([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // 初始化加载
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }

    if (hasInitialized.current) return;
    
    // 延迟初始化，避免 TDZ 错误
    const timer = setTimeout(() => {
      hasInitialized.current = true;
      console.log('🚀 开始加载费用申请数据...');
      loadApplications();
      loadWriteoffApplications();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [loadApplications, loadWriteoffApplications]);

  // 当切换到冲销标签页时，重新加载数据
  useEffect(() => {
    if (activeTab === 'writeoff' && hasInitialized.current) {
      console.log('🔄 切换到冲销标签页，重新加载数据...');
      loadWriteoffApplications();
    }
  }, [activeTab, loadWriteoffApplications]);

  // 实时订阅
  interface RealtimePayload {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new?: ExpenseApplication;
    old?: ExpenseApplication;
  }
  const handleRealtimeUpdate = useCallback((payload: RealtimePayload) => {
    try {
      if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
        setTimeout(() => {
          loadApplications();
          loadWriteoffApplications();
        }, 500);
      }
    } catch (error: unknown) {
      console.error('处理实时更新失败:', error);
    }
  }, [loadApplications, loadWriteoffApplications]);

  useOptimizedRealtimeSubscription(
    'internal_driver_expense_applications',
    handleRealtimeUpdate,
    true
  );

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
      let photoUrls: string[] = [];
      if (selectedFiles.length > 0) {
        setUploading(true);
        photoUrls = await uploadFilesToQiniu();
        setUploading(false);
      }

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
      setSelectedFiles([]);
      
      loadApplications();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '请稍后重试';
      console.error('提交失败:', error);
      toast({
        title: '提交失败',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  // 打开冲销对话框
  const handleOpenWriteoff = (app: ExpenseApplication) => {
    setSelectedWriteoffApp(app);
    setActualAmount(app.actual_amount?.toString() || '');
    setWriteoffFiles([]); // 清空已选图片
    setShowWriteoffDialog(true);
  };

  // 提交冲销
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
      // 先上传凭证照片（如果有）
      let voucherUrls: string[] = [];
      if (writeoffFiles.length > 0) {
        setUploadingWriteoff(true);
        voucherUrls = await uploadWriteoffFilesToQiniu();
        setUploadingWriteoff(false);
      }

      // 提交冲销
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

      // 如果有上传凭证，追加到费用申请的凭证照片
      if (voucherUrls.length > 0) {
        const { error: photoError } = await supabase.rpc('add_expense_application_photos', {
          p_application_id: selectedWriteoffApp.id,
          p_additional_photos: voucherUrls
        });

        if (photoError) {
          console.error('添加凭证照片失败:', photoError);
          // 不阻止冲销成功，只记录错误
          toast({
            title: '提示',
            description: '冲销成功，但凭证照片上传失败，请稍后补充上传',
            variant: 'default'
          });
        }
      }

      toast({
        title: '冲销成功',
        description: `结余：¥${data.balance.toFixed(2)} ${data.balance >= 0 ? '(结余)' : '(待补报销)'}`
      });

      setShowWriteoffDialog(false);
      setSelectedWriteoffApp(null);
      setActualAmount('');
      setWriteoffFiles([]); // 清空已选图片
      loadWriteoffApplications();
      loadApplications();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '请稍后重试';
      console.error('冲销失败:', error);
      toast({
        title: '冲销失败',
        description: errorMessage,
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

  // 文件选择处理
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

    if (imageFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...imageFiles]);
    }
    
    event.target.value = '';
  };

  const handleCameraCapture = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const cameraInput = document.getElementById('camera-file-input') as HTMLInputElement;
    if (cameraInput) {
      cameraInput.value = '';
      cameraInput.click();
    }
  };

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

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 冲销专用文件选择处理
  const handleWriteoffFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length !== files.length) {
      toast({
        title: "提示",
        description: "只能上传图片文件",
        variant: "destructive",
      });
    }

    if (imageFiles.length > 0) {
      setWriteoffFiles(prev => [...prev, ...imageFiles]);
    }
    
    event.target.value = '';
  };

  const handleWriteoffCameraCapture = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const cameraInput = document.getElementById('writeoff-camera-file-input') as HTMLInputElement;
    if (cameraInput) {
      cameraInput.value = '';
      cameraInput.click();
    }
  };

  const handleWriteoffCameraFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      setWriteoffFiles(prev => [...prev, ...imageFiles]);
      toast({
        title: "拍照成功",
        description: `已添加 ${imageFiles.length} 张照片，可继续拍照`,
        duration: 2000,
      });
    }
    
    event.target.value = '';
  };

  const removeWriteoffFile = (index: number) => {
    setWriteoffFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <DriverMobileLayout 
      title="我的费用" 
      showRefresh={true}
      onRefresh={() => {
        loadApplications();
        loadWriteoffApplications();
        toast({ title: '已刷新' });
      }}
    >
      <div className="space-y-4">
        {/* 标签页 */}
        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 bg-gray-100 h-11 rounded-lg p-1">
            <TabsTrigger 
              value="applications" 
              className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-md font-medium transition-all"
            >
              <FileText className="h-4 w-4 mr-1.5" />
              费用申请
              {applications.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs">
                  {applications.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="writeoff" 
              className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-md font-medium transition-all"
            >
              <Calculator className="h-4 w-4 mr-1.5" />
              费用冲销
              {writeoffApplications.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs">
                  {writeoffApplications.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* 费用申请标签页 */}
          <TabsContent value="applications" className="space-y-3 mt-4">
            {/* 新建按钮 */}
            <Button 
              onClick={() => setShowNewDialog(true)}
              className="w-full"
              size="lg"
            >
              <Plus className="h-5 w-5 mr-2" />
              新建费用申请
            </Button>

            {/* 申请列表 */}
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">加载中...</p>
              </div>
            ) : applications.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground mt-2">暂无费用申请</p>
              </div>
            ) : (
              applications.map(app => {
                const typeConfig = getExpenseTypeConfig(app.expense_type);
                const statusConfig = getStatusConfig(app.status);
                const StatusIcon = statusConfig.icon;
                
                return (
                  <Card 
                    key={app.id} 
                    className="cursor-pointer hover:shadow-lg transition-all"
                    onClick={() => {
                      setSelectedApp(app);
                      setShowDetailDialog(true);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={typeConfig.color}>
                              {typeConfig.label}
                            </Badge>
                            <Badge className={statusConfig.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
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
                          </div>
                        </div>
                        
                        <div className="text-right ml-4">
                          <div className="text-2xl font-bold text-primary">
                            ¥{app.amount.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* 费用冲销标签页 */}
          <TabsContent value="writeoff" className="space-y-3 mt-4">
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

            {/* 冲销列表 */}
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
                            
                            {isWriteoffed && balance !== null && (
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
                                  <span className={balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    {balance >= 0 ? '结余：' : '待补：'}
                                  </span>
                                  <span className={balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    ¥{Math.abs(balance).toFixed(2)}
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
          </TabsContent>
        </Tabs>

        {/* 新建费用申请对话框 */}
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
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={e => {
                    const limitedValue = limitAmountInput(e.target.value);
                    setFormData(prev => ({ ...prev, amount: limitedValue }));
                  }}
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
                
                <input
                  id="photo-file-input"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                
                <input
                  id="camera-file-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={handleCameraFileSelect}
                />
                
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
                      <div className="text-sm text-muted-foreground mb-2">凭证照片 ({selectedApp.receipt_photos.length} 张)</div>
                      <div className="grid grid-cols-3 gap-2">
                        {selectedApp.receipt_photos.map((url, index) => (
                          <div key={index} className="relative aspect-square">
                            <img
                              src={url}
                              alt={`凭证${index + 1}`}
                              className="w-full h-full object-cover rounded border"
                            />
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors rounded"
                              title="点击查看大图"
                            >
                              <ImageIcon className="h-4 w-4 text-white opacity-0 hover:opacity-100" />
                            </a>
                          </div>
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

        {/* 冲销对话框 */}
        <Dialog open={showWriteoffDialog} onOpenChange={setShowWriteoffDialog}>
          <DialogContent className="max-w-md">
            {selectedWriteoffApp && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    费用冲销
                  </DialogTitle>
                  <DialogDescription>
                    {selectedWriteoffApp.application_number}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label>费用类型</Label>
                      <div className="mt-1">
                        <Badge className={getExpenseTypeConfig(selectedWriteoffApp.expense_type).color}>
                          {getExpenseTypeConfig(selectedWriteoffApp.expense_type).label}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label>费用日期</Label>
                      <p className="mt-1">{format(new Date(selectedWriteoffApp.expense_date), 'yyyy-MM-dd')}</p>
                    </div>
                    <div>
                      <Label>申请金额</Label>
                      <p className="font-bold text-primary text-lg mt-1">¥{selectedWriteoffApp.amount.toFixed(2)}</p>
                    </div>
                    {selectedWriteoffApp.description && (
                      <div>
                        <Label>费用说明</Label>
                        <p className="mt-1 text-sm bg-muted p-2 rounded">{selectedWriteoffApp.description}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid gap-2">
                    <Label>实际消费金额（元）*</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={actualAmount}
                      onChange={e => {
                        const limitedValue = limitAmountInput(e.target.value);
                        setActualAmount(limitedValue);
                      }}
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
                          <span className="font-medium">¥{selectedWriteoffApp.amount.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">实际金额：</span>
                          <span className="font-medium">¥{parseFloat(actualAmount).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between font-bold border-t pt-1 mt-1">
                          <span className={parseFloat(actualAmount) <= selectedWriteoffApp.amount ? 'text-green-600' : 'text-red-600'}>
                            {parseFloat(actualAmount) <= selectedWriteoffApp.amount ? '结余：' : '待补：'}
                          </span>
                          <span className={parseFloat(actualAmount) <= selectedWriteoffApp.amount ? 'text-green-600' : 'text-red-600'}>
                            ¥{Math.abs(selectedWriteoffApp.amount - parseFloat(actualAmount)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 凭证照片上传 */}
                  <div className="grid gap-2">
                    <Label>凭证照片（可选）</Label>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-24 flex flex-col gap-2"
                        onClick={handleWriteoffCameraCapture}
                        disabled={uploadingWriteoff || submitting}
                      >
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                          <Camera className="h-6 w-6 text-blue-600" />
                        </div>
                        <span className="text-sm">拍照</span>
                        <span className="text-xs text-muted-foreground">可连续拍摄多张</span>
                      </Button>
                      
                      <Button
                        type="button"
                        variant="outline"
                        className="h-24 flex flex-col gap-2"
                        onClick={() => document.getElementById('writeoff-photo-file-input')?.click()}
                        disabled={uploadingWriteoff || submitting}
                      >
                        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                          <ImagePlus className="h-6 w-6 text-green-600" />
                        </div>
                        <span className="text-sm">相册</span>
                      </Button>
                    </div>
                    
                    <input
                      id="writeoff-photo-file-input"
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleWriteoffFileSelect}
                    />
                    
                    <input
                      id="writeoff-camera-file-input"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      className="hidden"
                      onChange={handleWriteoffCameraFileSelect}
                    />
                    
                    {writeoffFiles.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {writeoffFiles.map((file, index) => (
                          <div key={index} className="relative aspect-square">
                            <img 
                              src={URL.createObjectURL(file)} 
                              alt={`凭证${index + 1}`} 
                              className="w-full h-full object-cover rounded-lg border-2 border-gray-200"
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="destructive"
                              className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg"
                              onClick={() => removeWriteoffFile(index)}
                              disabled={submitting}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {uploadingWriteoff && (
                      <div className="flex items-center justify-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        正在上传照片到云端...
                      </div>
                    )}
                  </div>
                </div>
                
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowWriteoffDialog(false);
                      setActualAmount('');
                      setWriteoffFiles([]); // 清空已选图片
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
    </DriverMobileLayout>
  );
}

