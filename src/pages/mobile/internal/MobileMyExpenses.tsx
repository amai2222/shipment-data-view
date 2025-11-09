// 移动端 - 我的费用申请（司机端）
// 司机登录后的默认首页

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
  X,
  MapPin,
  Calculator
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
  const [error, setError] = useState<string | null>(null);
  const [expenseBalance, setExpenseBalance] = useState<number>(0);  // ✅ 费用余额
  const [primaryLicensePlate, setPrimaryLicensePlate] = useState<string | null>(null);  // ✅ 主车牌号
  
  // ✅ 补充图片相关状态
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
  const [uploadingAdditional, setUploadingAdditional] = useState(false);
  
  // 新申请表单
  const [formData, setFormData] = useState({
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    expense_type: 'fuel',
    amount: '',
    description: '',
    receipt_photos: [] as string[]
  });
  
  const [uploading, setUploading] = useState(false);
  const isInitialLoad = useRef(true);  // ✅ 跟踪是否是首次加载

  // ✅ 用 useCallback 包装加载函数，避免依赖变化导致重复订阅
  // 加载我的车辆
  const loadMyVehicles = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_my_vehicles');
      if (error) throw error;
      setMyVehicles(data || []);
    } catch (error: any) {
      console.error('加载车辆失败:', error);
      // 不显示错误提示，避免干扰用户体验
    }
  }, []);

  // ✅ 加载待接单的派单数量
  const loadPendingDispatches = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_my_dispatch_orders', {
        p_status: 'pending'
      });
      
      if (error) throw error;
      setPendingDispatchCount(data?.length || 0);
    } catch (error: any) {
      console.error('加载派单失败:', error);
      // 不显示错误提示，避免干扰用户体验
      setPendingDispatchCount(0);
    }
  }, []);

  // ✅ 加载费用余额
  const loadExpenseBalance = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_driver_expense_balance');
      if (error) throw error;
      if (data && data.success) {
        setExpenseBalance(data.balance || 0);
      }
    } catch (error: any) {
      console.error('加载余额失败:', error);
    }
  }, []);

  // ✅ 加载主车牌号
  const loadPrimaryLicensePlate = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_my_vehicles');
      if (error) throw error;
      // 查找主车辆（is_primary = true）
      const primaryVehicle = (data || []).find((v: any) => v.is_primary === true);
      if (primaryVehicle) {
        setPrimaryLicensePlate(primaryVehicle.license_plate);
      } else if (data && data.length > 0) {
        // 如果没有主车辆，使用第一辆车
        setPrimaryLicensePlate(data[0].license_plate);
      }
    } catch (error: any) {
      console.error('加载车牌号失败:', error);
    }
  }, []);

  // ✅ 加载费用申请列表
  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError(null);
    const wasInitialLoad = isInitialLoad.current;
    try {
      // ✅ 使用实际的数据库查询
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

      const driverId = driverInfo[0].driver_id;  // ✅ 修复：使用正确的字段名

      const { data, error } = await supabase
        .from('internal_driver_expense_applications')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setApplications(data || []);
      setError(null);
      isInitialLoad.current = false;  // ✅ 标记首次加载完成
    } catch (error: any) {
      console.error('加载失败:', error);
      setError(error.message || '无法加载费用申请记录');
      setApplications([]);
      // 只在首次加载失败时显示错误提示
      if (wasInitialLoad) {
        toast({
          title: '加载失败',
          description: error.message || '无法加载费用申请记录',
          variant: 'destructive'
        });
      }
      isInitialLoad.current = false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // ✅ 初始化加载
  useEffect(() => {
    // 使用 try-catch 包裹，防止初始化失败导致组件崩溃
    try {
      loadApplications();
      loadMyVehicles();
      loadPendingDispatches();
      loadExpenseBalance();
      loadPrimaryLicensePlate();
      
      // ✅ 预加载常用页面，避免首次点击时出现"刷新"
      setTimeout(() => {
        Promise.all([
          import('./MobileMyDispatches').catch(() => null),
          import('./MobileMyWaybills').catch(() => null),
          import('./MobileDriverSalary').catch(() => null),
          import('./MobileSalaryRecords').catch(() => null),
          import('./MobileQuickEntry').catch(() => null),
          import('./MobileMyVehicles').catch(() => null)
        ]).catch(() => {
          // 预加载失败不影响主功能
          console.warn('部分页面预加载失败，不影响使用');
        });
      }, 1000);
    } catch (error: any) {
      console.error('页面初始化失败:', error);
      setError(error.message || '页面初始化失败');
    }
  }, [loadApplications, loadMyVehicles, loadPendingDispatches]);

  // ✅ 添加实时订阅 - 监听费用申请表的变化
  const handleRealtimeUpdate = useCallback((payload: any) => {
    try {
      console.log('📢 费用申请数据变更:', payload);
      
      // 当有数据变更时，重新加载列表
      if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
        console.log('🔄 正在刷新费用申请列表...');
        
        // 延迟一点刷新，确保数据已提交
        setTimeout(() => {
          loadApplications();
          loadPendingDispatches();  // 同时刷新派单数量
        }, 500);
        
        // 如果是审核状态变更，显示提示
        if (payload.eventType === 'UPDATE' && payload.new?.status !== payload.old?.status) {
          const newStatus = payload.new?.status;
          console.log('✅ 状态变更:', payload.old?.status, '→', newStatus);
          
          if (newStatus === 'approved') {
            toast({
              title: '审核通过 ✅',
              description: `费用申请 ${payload.new?.application_number || ''} 已通过审核`,
            });
          } else if (newStatus === 'rejected') {
            toast({
              title: '审核未通过 ❌',
              description: `费用申请 ${payload.new?.application_number || ''} 已被驳回`,
              variant: 'destructive'
            });
          }
        }
      }
    } catch (error: any) {
      console.error('处理实时更新失败:', error);
      // 不抛出错误，避免影响其他功能
    }
  }, [toast, loadApplications, loadPendingDispatches]);

  // ✅ 订阅派单通知
  const handleDispatchUpdate = useCallback((payload: any) => {
    try {
      console.log('📢 派单数据变更:', payload);
      
      // 新派单通知
      if (payload.eventType === 'INSERT' && payload.new?.status === 'pending') {
        console.log('🔔 收到新派单!');
        toast({
          title: '新派单通知 🔔',
          description: `收到新的派单：${payload.new?.order_number || ''}`,
          duration: 10000,  // 显示10秒
        });
        loadPendingDispatches();
      }
      
      // 派单状态变更
      if (payload.eventType === 'UPDATE') {
        console.log('🔄 派单状态变更，刷新数量');
        loadPendingDispatches();
      }
    } catch (error: any) {
      console.error('处理派单更新失败:', error);
      // 不抛出错误，避免影响其他功能
    }
  }, [toast, loadPendingDispatches]);

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

  // 选择照片（从相册）
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
    
    // ✅ 重置 input，允许重复选择同一文件
    event.target.value = '';
  };

  // ✅ 拍照上传（优化：支持连续拍照多张）
  const handleCameraCapture = (event: React.MouseEvent) => {
    // 阻止事件冒泡，防止触发其他操作
    event.preventDefault();
    event.stopPropagation();
    
    // 触发隐藏的拍照 input
    const cameraInput = document.getElementById('camera-file-input') as HTMLInputElement;
    if (cameraInput) {
      // ✅ 重置 input，确保每次都能触发 change 事件（即使选择同一张照片）
      cameraInput.value = '';
      cameraInput.click();
    }
  };

  // ✅ 处理拍照返回的文件（支持多图）
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
    
    // ✅ 重置 input，允许重复拍照（重要：确保每次拍照都能触发 change 事件）
    event.target.value = '';
  };

  // ✅ 补充图片：选择照片（从相册）
  const handleAdditionalFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
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
      setAdditionalFiles(prev => [...prev, ...imageFiles]);
    }
    
    event.target.value = '';
  };

  // ✅ 补充图片：拍照（优化：支持连续拍照多张）
  const handleAdditionalCameraCapture = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const cameraInput = document.getElementById('additional-camera-input') as HTMLInputElement;
    if (cameraInput) {
      // ✅ 重置 input，确保每次都能触发 change 事件
      cameraInput.value = '';
      cameraInput.click();
    }
  };

  // ✅ 补充图片：处理拍照返回的文件（支持多图）
  const handleAdditionalCameraFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      setAdditionalFiles(prev => [...prev, ...imageFiles]);
      toast({
        title: "拍照成功",
        description: `已添加 ${imageFiles.length} 张照片，可继续拍照`,
        duration: 2000,
      });
    }
    
    // ✅ 重置 input，允许重复拍照
    event.target.value = '';
  };

  // ✅ 删除补充图片
  const removeAdditionalFile = (index: number) => {
    setAdditionalFiles(prev => prev.filter((_, i) => i !== index));
  };

  // ✅ 上传补充图片到七牛云
  const uploadAdditionalFilesToQiniu = async (): Promise<string[]> => {
    if (additionalFiles.length === 0) return [];

    const filesToUpload = additionalFiles.map(file => ({
      fileName: file.name,
      fileData: ''
    }));

    // 读取文件为 base64
    for (let i = 0; i < additionalFiles.length; i++) {
      const file = additionalFiles[i];
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

  // ✅ 提交补充图片
  const handleAddAdditionalPhotos = async () => {
    if (!selectedApp || additionalFiles.length === 0) return;

    setUploadingAdditional(true);
    try {
      // 先上传照片到七牛云
      const photoUrls = await uploadAdditionalFilesToQiniu();
      
      if (photoUrls.length === 0) {
        toast({
          title: '提示',
          description: '没有可上传的照片',
          variant: 'destructive'
        });
        return;
      }

      // 调用 RPC 函数追加图片
      const { data, error } = await supabase.rpc('add_expense_application_photos', {
        p_application_id: selectedApp.id,
        p_additional_photos: photoUrls
      });

      if (error) throw error;
      
      if (!data.success) {
        toast({
          title: '添加失败',
          description: data.message || '无法添加图片',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: '添加成功',
        description: `已成功添加 ${photoUrls.length} 张图片`
      });

      // 清空已选文件
      setAdditionalFiles([]);
      
      // 刷新申请列表和详情
      loadApplications();
      
      // 更新当前选中的申请（追加新图片）
      if (selectedApp) {
        const updatedPhotos = [
          ...(Array.isArray(selectedApp.receipt_photos) ? selectedApp.receipt_photos : []),
          ...photoUrls
        ];
        setSelectedApp({
          ...selectedApp,
          receipt_photos: updatedPhotos
        });
      }
    } catch (error: any) {
      console.error('添加图片失败:', error);
      toast({
        title: '添加失败',
        description: error.message || '请稍后重试',
        variant: 'destructive'
      });
    } finally {
      setUploadingAdditional(false);
    }
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

  // ✅ 如果页面初始化失败，显示错误提示
  if (error && applications.length === 0 && !loading) {
    return (
      <MobileLayout title="工作台" showBack={false}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
          <div className="text-center space-y-4 max-w-md">
            <div className="text-6xl">⚠️</div>
            <h2 className="text-xl font-bold">页面加载失败</h2>
            <p className="text-muted-foreground text-sm">
              {error}
            </p>
            <Button 
              onClick={() => {
                setError(null);
                loadApplications();
                loadMyVehicles();
                loadPendingDispatches();
              }}
              className="mt-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              重试
            </Button>
          </div>
        </div>
      </MobileLayout>
    );
  }

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
                <div className="font-bold text-lg">
                  {profile?.full_name || '司机'}
                  {primaryLicensePlate && (
                    <span className="ml-2 text-sm font-normal">({primaryLicensePlate})</span>
                  )}
                </div>
                <div className="text-xs text-blue-100">
                  {format(new Date(), 'MM月dd日 EEEE', { locale: zhCN })}
                  <span className="ml-2">
                    余额: ¥{expenseBalance.toFixed(2)}
                  </span>
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
                loadExpenseBalance();
                loadPrimaryLicensePlate();
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

        {/* 我的任务卡片 */}
        <Card className="shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600" />
              我的任务
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-4 divide-x">
              <div 
                className="p-4 text-center cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={() => navigate('/m/internal/my-dispatches')}
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-blue-100 flex items-center justify-center mb-2">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div className="font-bold text-base mb-1">派单接单</div>
                <div className="text-xs text-muted-foreground">查看和接受派单</div>
              </div>
          
              <div 
                className="p-4 text-center cursor-pointer hover:bg-green-50 transition-colors"
                onClick={() => navigate('/m/internal/quick-entry')}
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-2">
                  <Plus className="h-6 w-6 text-green-600" />
                </div>
                <div className="font-bold text-base mb-1">手动录单</div>
                <div className="text-xs text-muted-foreground">自主录入运单</div>
              </div>

              <div 
                className="p-4 text-center cursor-pointer hover:bg-orange-50 transition-colors"
                onClick={() => setShowNewDialog(true)}
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-orange-100 flex items-center justify-center mb-2">
                  <FileText className="h-6 w-6 text-orange-600" />
                </div>
                <div className="font-bold text-base mb-1">费用申请</div>
                <div className="text-xs text-muted-foreground">提交费用申请</div>
              </div>

              <div 
                className="p-4 text-center cursor-pointer hover:bg-orange-50 transition-colors"
                onClick={() => navigate('/m/internal/expense-writeoff')}
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-orange-100 flex items-center justify-center mb-2">
                  <Calculator className="h-6 w-6 text-orange-600" />
                </div>
                <div className="font-bold text-base mb-1">费用冲销</div>
                <div className="text-xs text-muted-foreground">费用冲销管理</div>
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
            <div className="grid grid-cols-4 gap-3">
              {/* 我的行程 */}
              <div 
                className="flex flex-col items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/m/internal/my-waybills')}
              >
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                  <MapPin className="h-6 w-6 text-indigo-600" />
                </div>
                <span className="text-xs text-center">我的行程</span>
              </div>

              {/* 我的车辆 */}
              <div 
                className="flex flex-col items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/m/internal/my-vehicles')}
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Truck className="h-6 w-6 text-blue-600" />
                </div>
                <span className="text-xs text-center">我的车辆</span>
              </div>
              
              {/* 收支明细 */}
              <div 
                className="flex flex-col items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/m/internal/salary-records')}
              >
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-purple-600" />
                </div>
                <span className="text-xs text-center">收支明细</span>
              </div>
          
              {/* 我的收入 */}
              <div 
                className="flex flex-col items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/m/internal/driver-salary')}
              >
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <span className="text-xs text-center">我的收入</span>
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
                    <span className="text-xs text-muted-foreground">可连续拍摄多张</span>
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
                
                {/* 隐藏的文件输入 - 相册选择 */}
                <input
                  id="photo-file-input"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                
                {/* ✅ 隐藏的文件输入 - 拍照（单独处理） */}
                <input
                  id="camera-file-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={handleCameraFileSelect}
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
                  
                  {/* 现有凭证照片 */}
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

                  {/* ✅ 补充图片功能 */}
                  <div className="border-t pt-4">
                    <div className="text-sm font-medium mb-3">补充图片</div>
                    
                    {/* 上传按钮区域 */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-20 flex flex-col gap-1"
                        onClick={handleAdditionalCameraCapture}
                        disabled={uploadingAdditional}
                      >
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Camera className="h-5 w-5 text-blue-600" />
                        </div>
                        <span className="text-xs font-medium">拍照</span>
                        <span className="text-[10px] text-muted-foreground leading-tight">可连续拍摄</span>
                      </Button>
                      
                      <Button
                        type="button"
                        variant="outline"
                        className="h-20 flex flex-col gap-2"
                        onClick={() => document.getElementById('additional-photo-input')?.click()}
                        disabled={uploadingAdditional}
                      >
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                          <ImagePlus className="h-5 w-5 text-green-600" />
                        </div>
                        <span className="text-xs">相册</span>
                      </Button>
                    </div>

                    {/* 隐藏的文件输入 - 补充图片 */}
                    <input
                      id="additional-photo-input"
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleAdditionalFileSelect}
                    />
                    
                    <input
                      id="additional-camera-input"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      className="hidden"
                      onChange={handleAdditionalCameraFileSelect}
                    />

                    {/* 补充图片预览 */}
                    {additionalFiles.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-muted-foreground mb-2">
                          待上传 ({additionalFiles.length} 张)
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {additionalFiles.map((file, index) => (
                            <div key={index} className="relative aspect-square">
                              <img 
                                src={URL.createObjectURL(file)} 
                                alt={`补充照片${index + 1}`} 
                                className="w-full h-full object-cover rounded-lg border-2 border-gray-200"
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="destructive"
                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg"
                                onClick={() => removeAdditionalFile(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 上传状态提示 */}
                    {uploadingAdditional && (
                      <div className="flex items-center justify-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg mb-3">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        正在上传照片到云端...
                      </div>
                    )}

                    {/* 提交补充图片按钮 */}
                    {additionalFiles.length > 0 && !uploadingAdditional && (
                      <Button
                        onClick={handleAddAdditionalPhotos}
                        className="w-full"
                        size="sm"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        上传 {additionalFiles.length} 张图片
                      </Button>
                    )}
                  </div>
                </div>
                
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowDetailDialog(false);
                      setAdditionalFiles([]);  // 关闭时清空补充图片
                    }}
                  >
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

