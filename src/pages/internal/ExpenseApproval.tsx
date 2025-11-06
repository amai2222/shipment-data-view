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
  Eye
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
  const [page, setPage] = useState(1);
  const pageSize = 15;

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
      setSelectedApp(null);
      setReviewComment('');
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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="pending">待审核</TabsTrigger>
              <TabsTrigger value="approved">已通过</TabsTrigger>
              <TabsTrigger value="rejected">已驳回</TabsTrigger>
              <TabsTrigger value="paid">已付款</TabsTrigger>
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
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      驳回
                    </Button>
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => handleReview(true)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      通过
                    </Button>
                  </div>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
