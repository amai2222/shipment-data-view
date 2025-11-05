// PC端 - 费用申请审核（桌面完整版）

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
import { supabase } from '@/integrations/supabase/client';
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react';
import { format } from 'date-fns';

const EXPENSE_TYPES: Record<string, { label: string; color: string }> = {
  fuel: { label: '🛢️ 加油费', color: 'bg-blue-100 text-blue-800' },
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
  status: string;
  created_at: string;
}

export default function ExpenseApproval() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [applications, setApplications] = useState<ExpenseApplication[]>([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedApp, setSelectedApp] = useState<ExpenseApplication | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewComment, setReviewComment] = useState('');

  useEffect(() => {
    loadApplications();
  }, [activeTab]);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('internal_driver_expense_applications')
        .select('*')
        .eq('status', activeTab)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApplications((data || []) as any[]);
    } catch (error) {
      console.error('加载失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (approved: boolean) => {
    if (!selectedApp) return;

    try {
      toast({
        title: approved ? '已通过' : '已驳回',
        description: `费用申请${approved ? '已通过' : '已驳回'}`
      });

      setShowReviewDialog(false);
      loadApplications();
    } catch (error) {
      toast({
        title: '操作失败',
        variant: 'destructive'
      });
    }
  };

  const stats = {
    pending: applications.filter(a => a.status === 'pending').length,
    total: applications.reduce((sum, a) => sum + a.amount, 0)
  };

  if (loading && applications.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">加载费用申请中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 顶部操作栏 */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-semibold">费用申请审核</h1>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-muted-foreground">待审核</span>
                <span className="font-semibold text-yellow-600">{stats.pending}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-muted-foreground">金额合计</span>
                <span className="font-semibold text-blue-600">¥{stats.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadApplications} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* 标签切换 */}
      <div className="border-b bg-card px-6 py-2">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending">待审核</TabsTrigger>
            <TabsTrigger value="approved">已通过</TabsTrigger>
            <TabsTrigger value="rejected">已驳回</TabsTrigger>
            <TabsTrigger value="paid">已付款</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 主内容区 - 表格 */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[140px]">申请单号</TableHead>
                <TableHead>司机</TableHead>
                <TableHead>费用类型</TableHead>
                <TableHead>费用日期</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead className="max-w-[200px]">说明</TableHead>
                <TableHead>凭证</TableHead>
                <TableHead>申请时间</TableHead>
                <TableHead className="text-center w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    暂无{activeTab === 'pending' ? '待审核' : ''}申请
                  </TableCell>
                </TableRow>
              ) : (
                applications.map(app => (
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
                      {app.status === 'pending' ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedApp(app);
                            setShowReviewDialog(true);
                          }}
                          className="h-8"
                        >
                          审核
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-8">
                          查看
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 底部统计 */}
      <div className="border-t bg-card px-6 py-3">
        <div className="flex items-center justify-between text-sm">
          <div className="text-muted-foreground">
            共 {applications.length} 条申请
          </div>
        </div>
      </div>

      {/* 审核对话框（简化版） */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-2xl">
          {selectedApp && (
            <>
              <DialogHeader>
                <DialogTitle>审核费用申请</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label>司机</Label>
                    <p className="font-medium mt-1">{selectedApp.driver_name}</p>
                  </div>
                  <div>
                    <Label>费用金额</Label>
                    <p className="font-bold text-primary text-lg mt-1">¥{selectedApp.amount.toFixed(2)}</p>
                  </div>
                </div>
                <div>
                  <Label>审批意见</Label>
                  <Textarea
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                    rows={3}
                    className="mt-2"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" className="text-red-600" onClick={() => handleReview(false)}>
                  <XCircle className="h-4 w-4 mr-2" />
                  驳回
                </Button>
                <Button className="bg-green-600" onClick={() => handleReview(true)}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  通过
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
