// 货主移动端 - 提交电子回单页面
// 上传银行回单，通知财务收款

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShipperMobileLayout } from '@/components/mobile/ShipperMobileLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import {
  Upload,
  X,
  FileText,
  DollarSign,
  Calendar,
  CheckCircle,
  AlertCircle,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function MobileShipperSubmitReceipt() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const requestNumber = searchParams.get('requestNumber') || '';
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [receiptBank, setReceiptBank] = useState('');
  const [receiptAmount, setReceiptAmount] = useState('');
  const [notes, setNotes] = useState('');

  // 获取申请单信息
  const { data: invoice, isLoading } = useQuery({
    queryKey: ['shipper-invoice', requestNumber],
    queryFn: async () => {
      if (!requestNumber || !user?.partnerId) return null;

      const { data, error } = await supabase.rpc(
        'get_invoice_requests_filtered_1120',
        {
          p_invoicing_partner_id: user.partnerId,
          p_request_number: requestNumber,
          p_page_number: 1,
          p_page_size: 1
        }
      );

      if (error) throw error;
      const result = data as any;
      const invoices = result.records || [];
      return invoices[0] || null;
    },
    enabled: !!requestNumber && !!user?.partnerId
  });

  // 如果有申请单，自动填充金额
  useEffect(() => {
    if (invoice && !receiptAmount) {
      const received = (invoice.total_received_amount || 0) + (invoice.received_amount || 0);
      const remaining = invoice.total_amount - received;
      setReceiptAmount(remaining.toString());
    }
  }, [invoice, receiptAmount]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 9) {
      toast({
        title: '文件过多',
        description: '最多只能上传9张图片',
        variant: 'destructive'
      });
      return;
    }
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!requestNumber) {
      toast({
        title: '错误',
        description: '请先选择申请单',
        variant: 'destructive'
      });
      return;
    }

    if (selectedFiles.length === 0) {
      toast({
        title: '错误',
        description: '请至少上传一张银行回单',
        variant: 'destructive'
      });
      return;
    }

    if (!receiptAmount || parseFloat(receiptAmount) <= 0) {
      toast({
        title: '错误',
        description: '请输入有效的收款金额',
        variant: 'destructive'
      });
      return;
    }

    // 金额校验
    if (invoice) {
      const received = (invoice.total_received_amount || 0) + (invoice.received_amount || 0);
      const remaining = invoice.total_amount - received;
      const receiptAmountNum = parseFloat(receiptAmount);

      if (receiptAmountNum > remaining) {
        toast({
          title: '金额错误',
          description: `收款金额不能超过未收款金额 ¥${remaining.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          variant: 'destructive'
        });
        return;
      }
    }

    setUploading(true);
    try {
      // 上传图片
      const filesToUpload = selectedFiles.map(file => ({
        fileName: file.name,
        fileData: ''
      }));

      // 转换为base64
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

      // 调用七牛云上传函数
      const timestamp = Date.now();
      const { data: uploadData, error: uploadError } = await supabase.functions.invoke('qiniu-upload', {
        body: {
          files: filesToUpload,
          namingParams: {
            projectName: 'ShipperReceipt',
            customName: `货主回单-${requestNumber}-${timestamp}`
          }
        }
      });

      if (uploadError) throw uploadError;
      if (!uploadData.success) throw new Error(uploadData.error || '图片上传失败');
      
      const receiptImageUrls = uploadData.urls || [];

      // 调用后端RPC函数登记收款
      const { data, error } = await supabase.rpc('receive_invoice_payment_1120', {
        p_request_number: requestNumber,
        p_receipt_number: receiptNumber || null,
        p_receipt_bank: receiptBank || null,
        p_received_amount: parseFloat(receiptAmount),
        p_receipt_images: receiptImageUrls.length > 0 ? receiptImageUrls : null,
        p_notes: notes || null
      });

      if (error) throw error;

      const result = data as { 
        success: boolean; 
        message: string;
        is_full_payment: boolean;
        total_received: number;
        remaining_amount: number;
      };
      
      if (result.success) {
        toast({
          title: '提交成功',
          description: result.message || '电子回单已提交，财务人员将进行审核'
        });
        
        // 清空表单
        setSelectedFiles([]);
        setReceiptNumber('');
        setReceiptBank('');
        setReceiptAmount('');
        setNotes('');
        
        // 返回待付款列表
        setTimeout(() => {
          navigate('/m/shipper/pending-payments');
        }, 1500);
      } else {
        throw new Error(result.message || '提交失败');
      }
    } catch (error) {
      console.error('提交回单失败:', error);
      toast({
        title: '提交失败',
        description: (error as Error).message || '操作失败，请重试',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <ShipperMobileLayout>
        <div className="p-4">
          <Card>
            <CardContent className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
              <p className="text-gray-500">加载中...</p>
            </CardContent>
          </Card>
        </div>
      </ShipperMobileLayout>
    );
  }

  const received = invoice ? ((invoice.total_received_amount || 0) + (invoice.received_amount || 0)) : 0;
  const remaining = invoice ? (invoice.total_amount - received) : 0;

  return (
    <ShipperMobileLayout>
      <div className="p-4 space-y-4">
        {/* 申请单信息 */}
        {invoice && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">申请单信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-500 mb-1">申请单号</p>
                <p className="font-semibold text-gray-900">{invoice.request_number}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-sm text-gray-500 mb-1">开票金额</p>
                  <p className="font-semibold text-gray-900">
                    ¥{invoice.total_amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">未收款</p>
                  <p className="font-semibold text-orange-600">
                    ¥{remaining.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 回单信息表单 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">回单信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="receiptNumber">收款单号（可选）</Label>
              <Input
                id="receiptNumber"
                placeholder="请输入收款单号"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="receiptBank">收款银行（可选）</Label>
              <Input
                id="receiptBank"
                placeholder="请输入收款银行"
                value={receiptBank}
                onChange={(e) => setReceiptBank(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="receiptAmount">收款金额 *</Label>
              <Input
                id="receiptAmount"
                type="number"
                placeholder="请输入收款金额"
                value={receiptAmount}
                onChange={(e) => setReceiptAmount(e.target.value)}
                className="mt-1"
              />
              {invoice && (
                <p className="text-xs text-gray-500 mt-1">
                  未收款金额：¥{remaining.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="notes">备注（可选）</Label>
              <Textarea
                id="notes"
                placeholder="请输入备注信息"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* 上传银行回单 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">上传银行回单 *</CardTitle>
            <p className="text-sm text-gray-500">最多上传9张图片</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* 文件选择 */}
            <div>
              <input
                type="file"
                id="fileInput"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <Label htmlFor="fileInput">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => document.getElementById('fileInput')?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  选择图片
                </Button>
              </Label>
            </div>

            {/* 已选择的文件预览 */}
            {selectedFiles.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`预览 ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      onClick={() => handleRemoveFile(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {selectedFiles.length === 0 && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">请上传银行回单图片</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 提交按钮 */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleSubmit}
          disabled={uploading || selectedFiles.length === 0 || !receiptAmount}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              提交中...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              提交电子回单
            </>
          )}
        </Button>

        {/* 提示信息 */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">温馨提示</p>
                <ul className="list-disc list-inside space-y-1 text-blue-600">
                  <li>请确保上传的银行回单清晰可见</li>
                  <li>提交后，财务人员将进行审核</li>
                  <li>审核通过后，您的账户余额将自动更新</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ShipperMobileLayout>
  );
}

