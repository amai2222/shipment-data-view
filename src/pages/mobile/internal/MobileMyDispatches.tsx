// 移动端 - 司机我的派单页面

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Bell,
  CheckCircle,
  XCircle,
  MapPin,
  Calendar,
  Weight,
  Clock,
  Upload,
  Loader2,
  FileText,
  AlertCircle,
  Package
} from 'lucide-react';
import { format } from 'date-fns';

interface DispatchOrder {
  id: string;
  order_number: string;
  project_name: string;
  loading_location: string;
  unloading_location: string;
  expected_loading_date: string | null;
  expected_weight: number | null;
  status: string;
  remarks: string | null;
  created_at: string;
}

export default function MobileMyDispatches() {
  const { toast } = useToast();
  const { profile } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<DispatchOrder[]>([]);
  const [activeOrders, setActiveOrders] = useState<DispatchOrder[]>([]);
  const [completedOrders, setCompletedOrders] = useState<DispatchOrder[]>([]);
  
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DispatchOrder | null>(null);
  
  // 完成派单表单
  const [completeForm, setCompleteForm] = useState({
    loading_weight: '',
    unloading_weight: '',
    scale_photos: [] as string[],
    completion_remarks: ''
  });
  
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  // ✅ 实时订阅派单变化
  const handleRealtimeUpdate = useCallback((payload: any) => {
    console.log('派单数据变更:', payload);
    
    // 新派单通知
    if (payload.eventType === 'INSERT' && payload.new?.status === 'pending') {
      toast({
        title: '新派单 🔔',
        description: `收到新的派单：${payload.new?.order_number}`,
        duration: 5000
      });
      loadOrders();
    }
    
    // 派单状态变更
    if (payload.eventType === 'UPDATE') {
      loadOrders();
    }
  }, [toast]);

  useOptimizedRealtimeSubscription(
    'dispatch_orders',
    handleRealtimeUpdate,
    true
  );

  const loadOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_my_dispatch_orders', {
        p_status: null
      });
      
      if (error) throw error;
      
      const orders = data || [];
      setPendingOrders(orders.filter((o: any) => o.status === 'pending'));
      setActiveOrders(orders.filter((o: any) => o.status === 'accepted'));
      setCompletedOrders(orders.filter((o: any) => o.status === 'completed'));
    } catch (error) {
      console.error('加载派单失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载派单信息',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // 接受派单
  const handleAccept = async (orderId: string) => {
    try {
      const { data, error } = await supabase.rpc('accept_dispatch_order', {
        p_order_id: orderId
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.message);
      
      toast({
        title: '接单成功 ✅',
        description: '派单已接受，请按时完成'
      });
      
      loadOrders();
      setShowDetailDialog(false);
    } catch (error: any) {
      toast({
        title: '接单失败',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // 拒绝派单
  const handleReject = async (orderId: string) => {
    try {
      const { data, error } = await supabase.rpc('reject_dispatch_order', {
        p_order_id: orderId,
        p_reason: '司机拒绝'
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.message);
      
      toast({
        title: '已拒绝',
        description: '派单已拒绝'
      });
      
      loadOrders();
      setShowDetailDialog(false);
    } catch (error: any) {
      toast({
        title: '操作失败',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // 上传磅单照片
  const handleUploadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        const fileData = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });

        // 调用七牛云上传
        const { data, error } = await supabase.functions.invoke('qiniu-upload', {
          body: {
            files: [{
              fileName: file.name,
              fileData: fileData.split(',')[1]  // 去掉 data:image/xxx;base64, 前缀
            }],
            namingParams: {
              projectName: 'feiyong',  // ✅ 触发费用上传模式
              customName: `派单磅单-${profile?.full_name}-${Date.now()}`
            }
          }
        });

        if (error) throw error;
        if (!data.success) throw new Error('上传失败');

        setCompleteForm(prev => ({
          ...prev,
          scale_photos: [...prev.scale_photos, ...data.urls]
        }));
      }

      toast({
        title: '上传成功',
        description: '磅单照片已上传'
      });
    } catch (error: any) {
      toast({
        title: '上传失败',
        description: error.message || '请重试',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  // 完成派单
  const handleComplete = async () => {
    if (!selectedOrder) return;
    
    if (!completeForm.loading_weight || parseFloat(completeForm.loading_weight) <= 0) {
      toast({
        title: '请填写装货重量',
        description: '装货重量必填且必须大于0',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('complete_dispatch_order', {
        p_order_id: selectedOrder.id,
        p_loading_weight: parseFloat(completeForm.loading_weight),
        p_unloading_weight: completeForm.unloading_weight ? parseFloat(completeForm.unloading_weight) : null,
        p_scale_photos: completeForm.scale_photos.length > 0 ? completeForm.scale_photos : null,
        p_completion_remarks: completeForm.completion_remarks || null
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.message);
      
      toast({
        title: '完成派单 ✅',
        description: `运单已创建：${data.auto_number}`
      });
      
      setShowCompleteDialog(false);
      resetCompleteForm();
      loadOrders();
    } catch (error: any) {
      toast({
        title: '完成失败',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetCompleteForm = () => {
    setCompleteForm({
      loading_weight: '',
      unloading_weight: '',
      scale_photos: [],
      completion_remarks: ''
    });
  };

  const renderOrderCard = (order: DispatchOrder, showActions: boolean = false) => (
    <Card 
      key={order.id} 
      className="cursor-pointer hover:shadow-lg transition-all border-l-4 border-l-blue-500"
      onClick={() => {
        setSelectedOrder(order);
        if (order.status === 'pending') {
          setShowDetailDialog(true);
        } else if (order.status === 'accepted') {
          setShowCompleteDialog(true);
        }
      }}
    >
      <CardContent className="p-4 bg-gradient-to-r from-white to-blue-50/30">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="font-medium">{order.order_number}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {format(new Date(order.created_at), 'MM-dd HH:mm')}
            </div>
          </div>
          <Badge variant={order.status === 'pending' ? 'default' : 'secondary'}>
            {order.status === 'pending' ? '待接单' : order.status === 'accepted' ? '进行中' : '已完成'}
          </Badge>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">项目：</span>
            <span>{order.project_name}</span>
          </div>
          
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div>{order.loading_location}</div>
              <div className="text-xs text-muted-foreground">↓</div>
              <div>{order.unloading_location}</div>
            </div>
          </div>
          
          {order.expected_loading_date && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">预期：</span>
              <span>{order.expected_loading_date}</span>
            </div>
          )}
          
          {order.expected_weight && (
            <div className="flex items-center gap-2">
              <Weight className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">预计：</span>
              <span>{order.expected_weight} 吨</span>
            </div>
          )}
          
          {order.remarks && (
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span className="text-muted-foreground text-xs">{order.remarks}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <MobileLayout title="我的派单">
      <div className="space-y-4 pb-20">
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                进行中 {activeOrders.length > 0 && <Badge variant="secondary" className="ml-1">{activeOrders.length}</Badge>}
              </div>
            </TabsTrigger>
            <TabsTrigger value="pending" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white">
              <div className="flex items-center gap-1">
                <Bell className="h-3 w-3" />
                待接单 {pendingOrders.length > 0 && <Badge variant="destructive" className="ml-1">{pendingOrders.length}</Badge>}
              </div>
            </TabsTrigger>
            <TabsTrigger value="completed" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                已完成
              </div>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-3 mt-4">
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              </div>
            ) : pendingOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>暂无待接单派单</p>
              </div>
            ) : (
              pendingOrders.map(order => renderOrderCard(order, true))
            )}
          </TabsContent>

          <TabsContent value="active" className="space-y-3 mt-4">
            {activeOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>暂无进行中的派单</p>
              </div>
            ) : (
              activeOrders.map(order => renderOrderCard(order))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-3 mt-4">
            {completedOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>暂无已完成的派单</p>
              </div>
            ) : (
              completedOrders.map(order => renderOrderCard(order))
            )}
          </TabsContent>
        </Tabs>

        {/* 派单详情（待接单） */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-[95vw]">
            <DialogHeader>
              <DialogTitle>派单详情</DialogTitle>
              <DialogDescription>
                请确认派单信息并选择接受或拒绝
              </DialogDescription>
            </DialogHeader>

            {selectedOrder && (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <span className="font-medium">派单编号</span>
                  <span className="text-blue-700">{selectedOrder.order_number}</span>
                </div>
                
                <div className="grid gap-3">
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-muted-foreground text-xs">项目</div>
                      <div className="font-medium">{selectedOrder.project_name}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <div className="text-muted-foreground text-xs">线路</div>
                      <div className="font-medium">{selectedOrder.loading_location}</div>
                      <div className="text-xs text-muted-foreground my-1">↓</div>
                      <div className="font-medium">{selectedOrder.unloading_location}</div>
                    </div>
                  </div>
                  
                  {selectedOrder.expected_loading_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-muted-foreground text-xs">预期日期：</span>
                        <span className="ml-2 font-medium">{selectedOrder.expected_loading_date}</span>
                      </div>
                    </div>
                  )}
                  
                  {selectedOrder.expected_weight && (
                    <div className="flex items-center gap-2">
                      <Weight className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-muted-foreground text-xs">预计重量：</span>
                        <span className="ml-2 font-medium">{selectedOrder.expected_weight} 吨</span>
                      </div>
                    </div>
                  )}
                  
                  {selectedOrder.remarks && (
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <div className="text-xs text-yellow-800 font-medium mb-1">备注说明</div>
                      <div className="text-sm text-yellow-900">{selectedOrder.remarks}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => selectedOrder && handleReject(selectedOrder.id)}
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-1" />
                拒绝
              </Button>
              <Button
                onClick={() => selectedOrder && handleAccept(selectedOrder.id)}
                className="flex-1"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                接受
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 完成派单对话框 */}
        <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
          <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>完成派单</DialogTitle>
              <DialogDescription>
                填写实际重量信息并上传磅单照片（可选）
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* 装货重量（必填） */}
              <div className="grid gap-2">
                <Label>
                  装货重量（吨）<span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="实际装货重量"
                  value={completeForm.loading_weight}
                  onChange={(e) => setCompleteForm(prev => ({ ...prev, loading_weight: e.target.value }))}
                />
              </div>

              {/* 卸货重量（可选） */}
              <div className="grid gap-2">
                <Label>卸货重量（吨）</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="实际卸货重量（可选）"
                  value={completeForm.unloading_weight}
                  onChange={(e) => setCompleteForm(prev => ({ ...prev, unloading_weight: e.target.value }))}
                />
              </div>

              {/* 上传磅单照片 */}
              <div className="grid gap-2">
                <Label>磅单照片（可选）</Label>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => document.getElementById('scale-photo-input')?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {uploading ? '上传中...' : '上传磅单照片'}
                  </Button>
                  <input
                    id="scale-photo-input"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleUploadPhoto}
                  />
                  
                  {completeForm.scale_photos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {completeForm.scale_photos.map((url, index) => (
                        <div key={index} className="relative aspect-square">
                          <img 
                            src={url} 
                            alt={`磅单${index + 1}`} 
                            className="w-full h-full object-cover rounded border"
                          />
                          <Button
                            size="icon"
                            variant="destructive"
                            className="absolute top-1 right-1 h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCompleteForm(prev => ({
                                ...prev,
                                scale_photos: prev.scale_photos.filter((_, i) => i !== index)
                              }));
                            }}
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 完成备注 */}
              <div className="grid gap-2">
                <Label>完成备注</Label>
                <Textarea
                  placeholder="输入完成备注..."
                  value={completeForm.completion_remarks}
                  onChange={(e) => setCompleteForm(prev => ({ ...prev, completion_remarks: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
                取消
              </Button>
              <Button onClick={handleComplete} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                确认完成
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MobileLayout>
  );
}

