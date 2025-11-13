// 货主移动端 - 充值页面

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Wallet,
  CreditCard,
  CheckCircle,
  Loader2,
  AlertCircle
} from 'lucide-react';

export default function MobileShipperRecharge() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [processing, setProcessing] = useState(false);

  // 获取当前余额
  const { data: balance = 0, refetch: refetchBalance } = useQuery({
    queryKey: ['shipper-balance', user?.partnerId],
    queryFn: async () => {
      if (!user?.partnerId) return 0;
      const { data, error } = await supabase.rpc('get_partner_balance', {
        p_partner_id: user.partnerId
      });
      if (error) throw error;
      const result = data as { success: boolean; balance: number };
      return result.balance || 0;
    },
    enabled: !!user?.partnerId
  });

  // 快速金额选择
  const quickAmounts = [1000, 5000, 10000, 20000, 50000];

  const handleRecharge = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: '输入错误',
        description: '请输入有效的充值金额',
        variant: 'destructive'
      });
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc('manual_recharge_partner_balance', {
        p_partner_id: user?.partnerId,
        p_amount: parseFloat(amount),
        p_description: description || '货主手动充值'
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string; balance_after: number };
      if (result.success) {
        toast({
          title: '充值成功',
          description: result.message || `账户余额已更新为 ¥${result.balance_after.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        });
        setAmount('');
        setDescription('');
        refetchBalance();
        setTimeout(() => {
          navigate('/m/shipper');
        }, 1500);
      } else {
        throw new Error(result.message || '充值失败');
      }
    } catch (error) {
      console.error('充值失败:', error);
      toast({
        title: '充值失败',
        description: (error as Error).message || '操作失败，请重试',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ShipperMobileLayout>
      <div className="p-4 space-y-4">
        {/* 当前余额 */}
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm mb-1">当前余额</p>
                <p className="text-3xl font-bold">
                  ¥{balance.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <Wallet className="h-12 w-12 text-green-200" />
            </div>
          </CardContent>
        </Card>

        {/* 充值表单 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">账户充值</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 快速金额选择 */}
            <div>
              <Label>快速选择金额</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {quickAmounts.map((quickAmount) => (
                  <Button
                    key={quickAmount}
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(quickAmount.toString())}
                    className={amount === quickAmount.toString() ? 'bg-blue-50 border-blue-500' : ''}
                  >
                    ¥{quickAmount.toLocaleString()}
                  </Button>
                ))}
              </div>
            </div>

            {/* 自定义金额 */}
            <div>
              <Label htmlFor="amount">充值金额 *</Label>
              <Input
                id="amount"
                type="number"
                placeholder="请输入充值金额"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 text-lg"
              />
            </div>

            {/* 备注 */}
            <div>
              <Label htmlFor="description">备注（可选）</Label>
              <Textarea
                id="description"
                placeholder="请输入充值备注"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>

            {/* 提交按钮 */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleRecharge}
              disabled={processing || !amount || parseFloat(amount) <= 0}
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  确认充值
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 提示信息 */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">充值说明</p>
                <ul className="list-disc list-inside space-y-1 text-blue-600">
                  <li>充值后，余额将立即到账</li>
                  <li>余额可用于支付运单费用</li>
                  <li>如有疑问，请联系财务人员</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ShipperMobileLayout>
  );
}

