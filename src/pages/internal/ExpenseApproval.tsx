// PC端 - 费用申请审核（参考操作日志布局）

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
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
import { PageHeader } from '@/components/PageHeader';
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  RefreshCw,
  Image as ImageIcon,
  Eye,
  Upload,
  Camera,
  ImagePlus,
  X,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

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
  driver_name: string;
  expense_date: string;
  expense_type: string;
  amount: number;
  description: string;
  receipt_photos: string[];
  payment_vouchers?: string[];  // ✅ 支付凭证
  status: string;
  created_at: string;
}

export default function ExpenseApproval() {
  const { toast } = useToast();
  const { profile } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [applications, setApplications] = useState<ExpenseApplication[]>([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedApp, setSelectedApp] = useState<ExpenseApplication | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;
  
  // ✅ 支付凭证相关状态
  const [paymentVoucherFiles, setPaymentVoucherFiles] = useState<File[]>([]);
  const [uploadingVouchers, setUploadingVouchers] = useState(false);

  useEffect(() => {
    loadApplications();
  }, [activeTab]);

  const loadApplications = async () => {
    setLoading(true);
    try {
      // ✅ 根据activeTab查询对应状态的申请
      let query = supabase
        .from('internal_driver_expense_applications')
        .select('*')
        .order('created_at', { ascending: false });
      
      // ✅ 状态过滤：待审核、已审核、驳回
      if (activeTab === 'pending') {
        query = query.eq('status', 'pending');
      } else if (activeTab === 'approved') {
        query = query.eq('status', 'approved');
      } else if (activeTab === 'rejected') {
        query = query.eq('status', 'rejected');
      }
      
      const { data, error } = await query;

      if (error) throw error;
      setApplications((data || []) as any[]);
    } catch (error) {
      console.error('加载失败:', error);
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

  const handleReview = async (approved: boolean) => {
    if (!selectedApp) return;

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
        return;
      }
      
      toast({
        title: approved ? '已通过' : '已驳回',
        description: `费用申请${approved ? '已通过' : '已驳回'}${voucherUrls.length > 0 ? '，支付凭证已上传' : ''}`
      });

      setShowReviewDialog(false);
      setSelectedApp(null);
      setReviewComment('');
      setPaymentVoucherFiles([]);
      loadApplications();
    } catch (error: any) {
      toast({
        title: '操作失败',
        description: error.message,
        variant: 'destructive'
      });
      setUploadingVouchers(false);
    }
  };

  const stats = {
    pending: applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
    total: applications.reduce((sum, a) => sum + a.amount, 0)
  };

  const paginatedApps = applications.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(applications.length / pageSize);

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="费用申请审核"
        description="审核司机提交的费用申请"
        icon={FileText}
        iconColor="text-blue-600"
      />

      {/* 操作栏卡片 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                费用审核
              </CardTitle>
              <CardDescription>
                待审核 {stats.pending} 条 | 金额合计 ¥{stats.total.toFixed(2)}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadApplications}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending">待审核</TabsTrigger>
              <TabsTrigger value="approved">已审核</TabsTrigger>
              <TabsTrigger value="rejected">驳回</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* 申请列表卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>费用申请列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">申请单号</TableHead>
                  <TableHead>司机</TableHead>
                  <TableHead>费用类型</TableHead>
                  <TableHead>费用日期</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                  <TableHead className="max-w-[200px]">说明</TableHead>
                  <TableHead>凭证</TableHead>
                  <TableHead>申请时间</TableHead>
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : paginatedApps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      暂无{activeTab === 'pending' ? '待审核' : ''}申请
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedApps.map(app => (
                    <TableRow key={app.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-xs">{app.application_number}</TableCell>
                      <TableCell className="font-medium">{app.driver_name}</TableCell>
                      <TableCell>
                        <Badge className={EXPENSE_TYPES[app.expense_type]?.color}>
                          {EXPENSE_TYPES[app.expense_type]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(app.expense_date), 'yyyy-MM-dd')}
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        ¥{app.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {app.description || '-'}
                      </TableCell>
                      <TableCell>
                        {app.receipt_photos?.length > 0 ? (
                          <Badge variant="secondary" className="text-xs">
                            <ImageIcon className="h-3 w-3 mr-1" />
                            {app.receipt_photos.length}张
                          </Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(app.created_at), 'MM-dd HH:mm')}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-1 justify-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setSelectedApp(app);
                              setShowReviewDialog(true);
                            }}
                          >
                            {app.status === 'pending' ? <FileText className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* 分页 */}
          {!loading && applications.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                显示 {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, applications.length)} 条，共 {applications.length} 条
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  上一页
                </Button>
                <span className="text-sm flex items-center">第 {page} / {totalPages} 页</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 审核对话框 */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-2xl">
          {selectedApp && (
            <>
              <DialogHeader>
                <DialogTitle>审核费用申请</DialogTitle>
                <DialogDescription>{selectedApp.application_number}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label>司机</Label>
                    <p className="font-medium mt-1">{selectedApp.driver_name}</p>
                  </div>
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
                    <Label>费用金额</Label>
                    <p className="font-bold text-primary text-lg mt-1">¥{selectedApp.amount.toFixed(2)}</p>
                  </div>
                </div>

                {selectedApp.description && (
                  <div>
                    <Label>费用说明</Label>
                    <p className="mt-2 text-sm bg-muted p-3 rounded">{selectedApp.description}</p>
                  </div>
                )}

                {selectedApp.receipt_photos?.length > 0 && (
                  <div>
                    <Label>凭证照片</Label>
                    <div className="grid grid-cols-4 gap-3 mt-2">
                      {selectedApp.receipt_photos.map((url, index) => (
                        <img
                          key={index}
                          src={url}
                          alt={`凭证${index + 1}`}
                          className="w-full h-32 object-cover rounded border cursor-pointer hover:shadow-lg"
                          onClick={() => window.open(url, '_blank')}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* ✅ 支付凭证显示（已审核的记录） */}
                {selectedApp.status === 'approved' && selectedApp.payment_vouchers && selectedApp.payment_vouchers.length > 0 && (
                  <div>
                    <Label>支付凭证 ({selectedApp.payment_vouchers.length} 张)</Label>
                    <div className="grid grid-cols-4 gap-3 mt-2">
                      {selectedApp.payment_vouchers.map((url, index) => (
                        <img
                          key={index}
                          src={url}
                          alt={`支付凭证${index + 1}`}
                          className="w-full h-32 object-cover rounded border cursor-pointer hover:shadow-lg"
                          onClick={() => window.open(url, '_blank')}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* ✅ 支付凭证上传（待审核时） */}
                {selectedApp.status === 'pending' && (
                  <div>
                    <Label>支付凭证（可选，审核通过时上传）</Label>
                    <div className="mt-2 space-y-3">
                      {/* 上传按钮 */}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('payment-voucher-input')?.click()}
                          disabled={uploadingVouchers}
                        >
                          <ImagePlus className="h-4 w-4 mr-2" />
                          选择图片
                        </Button>
                        <input
                          id="payment-voucher-input"
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handlePaymentVoucherSelect}
                        />
                      </div>

                      {/* 支付凭证预览 */}
                      {paymentVoucherFiles.length > 0 && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-2">
                            待上传 ({paymentVoucherFiles.length} 张)
                          </div>
                          <div className="grid grid-cols-4 gap-2">
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
                  </div>
                )}

                {/* ✅ 补充支付凭证（已审核的记录） */}
                {selectedApp.status === 'approved' && (
                  <div className="border-t pt-4">
                    <Label>补充支付凭证</Label>
                    <div className="mt-2 space-y-3">
                      {/* 上传按钮 */}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('additional-payment-voucher-input')?.click()}
                          disabled={uploadingVouchers}
                        >
                          <ImagePlus className="h-4 w-4 mr-2" />
                          选择图片
                        </Button>
                        <input
                          id="additional-payment-voucher-input"
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handlePaymentVoucherSelect}
                        />
                      </div>

                      {/* 支付凭证预览 */}
                      {paymentVoucherFiles.length > 0 && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-2">
                            待上传 ({paymentVoucherFiles.length} 张)
                          </div>
                          <div className="grid grid-cols-4 gap-2">
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
                  </div>
                )}

                {selectedApp.status === 'pending' && (
                  <div>
                    <Label>审批意见（可选）</Label>
                    <Textarea
                      placeholder="输入审批意见..."
                      value={reviewComment}
                      onChange={e => setReviewComment(e.target.value)}
                      rows={3}
                      className="mt-2"
                    />
                  </div>
                )}
              </div>

              {selectedApp.status === 'pending' && (
                <DialogFooter>
                  <div className="flex gap-2 w-full">
                    <Button
                      variant="outline"
                      className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => handleReview(false)}
                      disabled={uploadingVouchers}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      驳回
                    </Button>
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => handleReview(true)}
                      disabled={uploadingVouchers}
                    >
                      {uploadingVouchers ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          上传中...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          通过
                        </>
                      )}
                    </Button>
                  </div>
                </DialogFooter>
              )}

              {selectedApp.status !== 'pending' && (
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowReviewDialog(false);
                      setPaymentVoucherFiles([]);
                    }}
                  >
                    关闭
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
