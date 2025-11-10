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
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
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
  Loader2,
  Upload,
  Camera,
  ImagePlus,
  X
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
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
  payment_vouchers?: string[];  // ✅ 支付凭证
  status: string;
  created_at: string;
}

const EXPENSE_TYPES = {
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

export default function MobileExpenseReview() {
  const { toast } = useToast();
  const { profile } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [applications, setApplications] = useState<ExpenseApplication[]>([]);
  const [filterStatus, setFilterStatus] = useState('pending');
  
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [selectedApp, setSelectedApp] = useState<ExpenseApplication | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewing, setReviewing] = useState(false);
  
  // ✅ 支付凭证相关状态
  const [paymentVoucherFiles, setPaymentVoucherFiles] = useState<File[]>([]);
  const [uploadingVouchers, setUploadingVouchers] = useState(false);

  useEffect(() => {
    loadApplications();
  }, [filterStatus]);

  const loadApplications = async () => {
    setLoading(true);
    try {
      // ✅ 调用实际的查询函数
      let query = supabase
        .from('internal_driver_expense_applications')
        .select('*')
        .order('created_at', { ascending: false });
      
      // ✅ 状态过滤：待审核、已审核、驳回
      if (filterStatus === 'pending') {
        query = query.eq('status', 'pending');
      } else if (filterStatus === 'approved') {
        query = query.eq('status', 'approved');
      } else if (filterStatus === 'rejected') {
        query = query.eq('status', 'rejected');
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      setApplications(data || []);  
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

  // ✅ 上传支付凭证到七牛云
  const uploadPaymentVouchersToQiniu = async (): Promise<string[]> => {
    if (paymentVoucherFiles.length === 0) return [];

    const filesToUpload = paymentVoucherFiles.map(file => ({
      fileName: file.name,
      fileData: ''
    }));

    // 读取文件为 base64
    for (let i = 0; i < paymentVoucherFiles.length; i++) {
      const file = paymentVoucherFiles[i];
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
          customName: `${profile?.full_name || '车队长'}-支付凭证-${format(new Date(), 'yyyyMMdd-HHmmss')}`
        }
      }
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error || '上传失败');

    return data.urls;
  };

  // ✅ 处理支付凭证文件选择
  const handlePaymentVoucherSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
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
      setPaymentVoucherFiles(prev => [...prev, ...imageFiles]);
    }
    
    event.target.value = '';
  };

  // ✅ 处理拍照返回的文件
  const handlePaymentVoucherCameraSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      setPaymentVoucherFiles(prev => [...prev, ...imageFiles]);
      toast({
        title: "拍照成功",
        description: `已添加 ${imageFiles.length} 张照片，可继续拍照`,
        duration: 2000,
      });
    }
    
    event.target.value = '';
  };

  // ✅ 删除支付凭证文件
  const removePaymentVoucherFile = (index: number) => {
    setPaymentVoucherFiles(prev => prev.filter((_, i) => i !== index));
  };

  // ✅ 添加支付凭证到已审核的记录
  const handleAddPaymentVouchers = async () => {
    if (!selectedApp || paymentVoucherFiles.length === 0) return;

    setUploadingVouchers(true);
    try {
      // 先上传照片到七牛云
      const voucherUrls = await uploadPaymentVouchersToQiniu();
      
      if (voucherUrls.length === 0) {
        toast({
          title: '提示',
          description: '没有可上传的凭证',
          variant: 'destructive'
        });
        return;
      }

      // 调用 RPC 函数追加支付凭证
      const { data, error } = await supabase.rpc('add_payment_vouchers', {
        p_application_id: selectedApp.id,
        p_payment_vouchers: voucherUrls
      });

      if (error) throw error;
      
      if (!data.success) {
        toast({
          title: '添加失败',
          description: data.message || '无法添加支付凭证',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: '添加成功',
        description: `已成功添加 ${voucherUrls.length} 张支付凭证`
      });

      // 清空已选文件
      setPaymentVoucherFiles([]);
      
      // 刷新申请列表
      loadApplications();
      
      // 更新当前选中的申请
      if (selectedApp) {
        const updatedVouchers = [
          ...(Array.isArray(selectedApp.payment_vouchers) ? selectedApp.payment_vouchers : []),
          ...voucherUrls
        ];
        setSelectedApp({
          ...selectedApp,
          payment_vouchers: updatedVouchers
        });
      }
    } catch (error: any) {
      console.error('添加支付凭证失败:', error);
      toast({
        title: '添加失败',
        description: error.message || '请稍后重试',
        variant: 'destructive'
      });
    } finally {
      setUploadingVouchers(false);
    }
  };

  // 审批申请
  const handleReview = async (approved: boolean) => {
    if (!selectedApp) return;

    setReviewing(true);
    try {
      // ✅ 如果有支付凭证，先上传
      let voucherUrls: string[] = [];
      if (paymentVoucherFiles.length > 0 && approved) {
        setUploadingVouchers(true);
        voucherUrls = await uploadPaymentVouchersToQiniu();
        setUploadingVouchers(false);
      }

      // ✅ 调用审核RPC函数（如果审核通过且有支付凭证，使用带凭证的函数）
      let result;
      if (approved && voucherUrls.length > 0) {
        const { data, error } = await supabase.rpc('review_expense_application_with_vouchers', {
          p_application_id: selectedApp.id,
          p_approved: approved,
          p_notes: reviewComment || null,
          p_payment_vouchers: voucherUrls
        });
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase.rpc('review_expense_application', {
          p_application_id: selectedApp.id,
          p_approved: approved,
          p_notes: reviewComment || null
        });
        if (error) throw error;
        result = data;
      }
      
      if (!result.success) {
        toast({ title: '审核失败', description: result.message, variant: 'destructive' });
        setReviewing(false);
        return;
      }

      toast({
        title: approved ? '审核通过' : '已驳回',
        description: `费用申请已${approved ? '通过' : '驳回'}${voucherUrls.length > 0 ? '，支付凭证已上传' : ''}`
      });

      setShowReviewDialog(false);
      setSelectedApp(null);
      setReviewComment('');
      setPaymentVoucherFiles([]);
      loadApplications();
    } catch (error: any) {
      console.error('审批失败:', error);
      toast({
        title: '审批失败',
        description: error.message || '请稍后重试',
        variant: 'destructive'
      });
    } finally {
      setReviewing(false);
      setUploadingVouchers(false);
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
                <SelectItem value="approved">已审核</SelectItem>
                <SelectItem value="rejected">驳回</SelectItem>
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
                      <div className="text-sm text-muted-foreground mb-2">凭证照片 ({selectedApp.receipt_photos.length} 张)</div>
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

                  {/* ✅ 支付凭证显示（已审核的记录） */}
                  {selectedApp.status === 'approved' && selectedApp.payment_vouchers && selectedApp.payment_vouchers.length > 0 && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">支付凭证 ({selectedApp.payment_vouchers.length} 张)</div>
                      <div className="grid grid-cols-3 gap-2">
                        {selectedApp.payment_vouchers.map((url, index) => (
                          <img
                            key={index}
                            src={url}
                            alt={`支付凭证${index + 1}`}
                            className="w-full h-20 object-cover rounded border cursor-pointer"
                            onClick={() => window.open(url, '_blank')}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ✅ 支付凭证上传（待审核时） */}
                  {selectedApp.status === 'pending' && (
                    <div className="grid gap-2">
                      <Label>支付凭证（可选，审核通过时上传）</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-20 flex flex-col gap-1"
                          onClick={() => document.getElementById('payment-voucher-camera-input')?.click()}
                          disabled={uploadingVouchers}
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
                          onClick={() => document.getElementById('payment-voucher-input')?.click()}
                          disabled={uploadingVouchers}
                        >
                          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                            <ImagePlus className="h-5 w-5 text-green-600" />
                          </div>
                          <span className="text-xs">相册</span>
                        </Button>
                      </div>
                      <input
                        id="payment-voucher-input"
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handlePaymentVoucherSelect}
                      />
                      <input
                        id="payment-voucher-camera-input"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        className="hidden"
                        onChange={handlePaymentVoucherCameraSelect}
                      />

                      {/* 支付凭证预览 */}
                      {paymentVoucherFiles.length > 0 && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-2">
                            待上传 ({paymentVoucherFiles.length} 张)
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {paymentVoucherFiles.map((file, index) => (
                              <div key={index} className="relative aspect-square">
                                <img 
                                  src={URL.createObjectURL(file)} 
                                  alt={`支付凭证${index + 1}`} 
                                  className="w-full h-full object-cover rounded-lg border-2 border-gray-200"
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="destructive"
                                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg"
                                  aria-label={`删除付款凭证 ${index + 1}`}
                                  title={`删除付款凭证 ${index + 1}`}
                                  onClick={() => removePaymentVoucherFile(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {uploadingVouchers && (
                        <div className="flex items-center justify-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          正在上传支付凭证到云端...
                        </div>
                      )}
                    </div>
                  )}

                  {/* ✅ 补充支付凭证（已审核的记录） */}
                  {selectedApp.status === 'approved' && (
                    <div className="border-t pt-4 grid gap-2">
                      <Label>补充支付凭证</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-20 flex flex-col gap-1"
                          onClick={() => document.getElementById('additional-payment-voucher-camera-input')?.click()}
                          disabled={uploadingVouchers}
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
                          onClick={() => document.getElementById('additional-payment-voucher-input')?.click()}
                          disabled={uploadingVouchers}
                        >
                          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                            <ImagePlus className="h-5 w-5 text-green-600" />
                          </div>
                          <span className="text-xs">相册</span>
                        </Button>
                      </div>
                      <input
                        id="additional-payment-voucher-input"
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handlePaymentVoucherSelect}
                      />
                      <input
                        id="additional-payment-voucher-camera-input"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        className="hidden"
                        onChange={handlePaymentVoucherCameraSelect}
                      />

                      {/* 支付凭证预览 */}
                      {paymentVoucherFiles.length > 0 && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-2">
                            待上传 ({paymentVoucherFiles.length} 张)
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {paymentVoucherFiles.map((file, index) => (
                              <div key={index} className="relative aspect-square">
                                <img 
                                  src={URL.createObjectURL(file)} 
                                  alt={`支付凭证${index + 1}`} 
                                  className="w-full h-full object-cover rounded-lg border-2 border-gray-200"
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="destructive"
                                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg"
                                  aria-label={`删除付款凭证 ${index + 1}`}
                                  title={`删除付款凭证 ${index + 1}`}
                                  onClick={() => removePaymentVoucherFile(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {uploadingVouchers && (
                        <div className="flex items-center justify-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          正在上传支付凭证到云端...
                        </div>
                      )}

                      {/* 提交补充支付凭证按钮 */}
                      {paymentVoucherFiles.length > 0 && !uploadingVouchers && (
                        <Button
                          onClick={handleAddPaymentVouchers}
                          className="w-full"
                          size="sm"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          上传 {paymentVoucherFiles.length} 张支付凭证
                        </Button>
                      )}
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
                          disabled={reviewing || uploadingVouchers}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          驳回
                        </Button>
                        <Button
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleReview(true)}
                          disabled={reviewing || uploadingVouchers}
                        >
                          {reviewing || uploadingVouchers ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          {uploadingVouchers ? '上传中...' : '通过'}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setShowReviewDialog(false);
                        setPaymentVoucherFiles([]);
                      }}
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

