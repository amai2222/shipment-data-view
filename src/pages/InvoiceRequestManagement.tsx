// 开票申请单管理页面
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { FileText, Search, Filter, Eye, Edit, Trash2, Download, RefreshCw, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// 开票申请单类型定义
interface InvoiceRequest {
  id: string;
  request_number: string;
  partner_id: string;
  partner_name: string;
  invoicing_partner_id?: string;
  invoicing_partner_full_name?: string;
  invoicing_partner_tax_number?: string;
  invoicing_partner_company_address?: string;
  invoicing_partner_bank_name?: string;
  invoicing_partner_bank_account?: string;
  total_amount: number;
  record_count: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Completed' | 'Voided' | 'Merged';
  created_by: string;
  created_at: string;
  updated_at?: string;
  remarks?: string;
  is_voided?: boolean;
  voided_at?: string;
  voided_by?: string;
  void_reason?: string;
  is_merged?: boolean;
  merged_into_id?: string;
  merged_at?: string;
  merged_by?: string;
  merge_reason?: string;
}

// 开票申请单详情类型
interface InvoiceRequestDetail {
  id: string;
  invoice_request_id: string;
  logistics_record_id: string;
  amount: number;
  logistics_record: {
    auto_number: string;
    project_name: string;
    driver_name: string;
    loading_address: string;
    unloading_address: string;
  };
}

export default function InvoiceRequestManagement() {
  const [invoiceRequests, setInvoiceRequests] = useState<InvoiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<InvoiceRequest | null>(null);
  const [requestDetails, setRequestDetails] = useState<InvoiceRequestDetail[]>([]);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    status: '',
    remarks: ''
  });
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false);
  const [voidForm, setVoidForm] = useState({
    reason: ''
  });
  const { toast } = useToast();

  // 加载开票申请单列表
  const loadInvoiceRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('invoice_requests')
        .select(`
          *,
          profiles!invoice_requests_created_by_fkey (
            full_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setInvoiceRequests(data || []);
    } catch (error) {
      console.error('加载开票申请单失败:', error);
      toast({
        title: "加载失败",
        description: `无法加载开票申请单列表: ${error.message || '未知错误'}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 加载开票申请单详情
  const loadRequestDetails = async (requestId: string) => {
    try {
      const { data, error } = await supabase
        .from('invoice_request_details')
        .select(`
          *,
          logistics_records (
            auto_number,
            projects (name),
            drivers (name),
            loading_address,
            unloading_address
          )
        `)
        .eq('invoice_request_id', requestId);

      if (error) throw error;

      const formattedDetails = data?.map(detail => ({
        id: detail.id,
        invoice_request_id: detail.invoice_request_id,
        logistics_record_id: detail.logistics_record_id,
        amount: detail.amount,
        logistics_record: {
          auto_number: detail.logistics_records?.auto_number || '',
          project_name: detail.logistics_records?.projects?.name || '',
          driver_name: detail.logistics_records?.drivers?.name || '',
          loading_address: detail.logistics_records?.loading_address || '',
          unloading_address: detail.logistics_records?.unloading_address || ''
        }
      })) || [];

      setRequestDetails(formattedDetails);
    } catch (error) {
      console.error('加载申请单详情失败:', error);
      toast({
        title: "加载失败",
        description: "无法加载申请单详情",
        variant: "destructive",
      });
    }
  };

  // 更新申请单状态
  const updateRequestStatus = async (requestId: string, status: string, remarks?: string) => {
    try {
      const { error } = await supabase
        .from('invoice_requests')
        .update({
          status,
          remarks,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "更新成功",
        description: "申请单状态已更新",
      });

      loadInvoiceRequests();
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error('更新申请单状态失败:', error);
      toast({
        title: "更新失败",
        description: "无法更新申请单状态",
        variant: "destructive",
      });
    }
  };

  // 删除申请单
  const deleteRequest = async (requestId: string) => {
    if (!confirm('确定要删除这个开票申请单吗？此操作不可撤销。')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('invoice_requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "删除成功",
        description: "开票申请单已删除",
      });

      loadInvoiceRequests();
    } catch (error) {
      console.error('删除申请单失败:', error);
      toast({
        title: "删除失败",
        description: "无法删除开票申请单",
        variant: "destructive",
      });
    }
  };

  // 查看详情
  const handleViewDetails = async (request: InvoiceRequest) => {
    setSelectedRequest(request);
    await loadRequestDetails(request.id);
    setIsDetailDialogOpen(true);
  };

  // 编辑状态
  const handleEditStatus = (request: InvoiceRequest) => {
    setSelectedRequest(request);
    setEditForm({
      status: request.status,
      remarks: request.remarks || ''
    });
    setIsEditDialogOpen(true);
  };

  // 作废申请单
  const voidRequest = async (requestId: string, reason: string) => {
    try {
      const { data, error } = await supabase.rpc('void_invoice_request', {
        p_request_id: requestId,
        p_void_reason: reason
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "作废成功",
          description: data.message,
        });
        loadInvoiceRequests();
        setIsVoidDialogOpen(false);
        setVoidForm({ reason: '' });
      } else {
        throw new Error(data?.message || '作废失败');
      }
    } catch (error) {
      console.error('作废申请单失败:', error);
      toast({
        title: "作废失败",
        description: error instanceof Error ? error.message : '无法作废申请单',
        variant: "destructive",
      });
    }
  };

  // 处理作废
  const handleVoidRequest = (request: InvoiceRequest) => {
    setSelectedRequest(request);
    setIsVoidDialogOpen(true);
  };

  // 状态徽章颜色
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Pending': return 'secondary';
      case 'Approved': return 'default';
      case 'Rejected': return 'destructive';
      case 'Completed': return 'outline';
      case 'Voided': return 'destructive';
      case 'Merged': return 'secondary';
      default: return 'secondary';
    }
  };

  // 状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'Pending': return '待审核';
      case 'Approved': return '已通过';
      case 'Rejected': return '已拒绝';
      case 'Completed': return '已完成';
      case 'Voided': return '已作废';
      case 'Merged': return '已合并';
      default: return status;
    }
  };

  // 过滤后的申请单列表
  const filteredRequests = useMemo(() => {
    return invoiceRequests.filter(request => {
      const matchesSearch = 
        request.request_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.partner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.partner_full_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [invoiceRequests, searchTerm, statusFilter]);

  useEffect(() => {
    loadInvoiceRequests();
  }, []);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader 
        title="开票申请单管理" 
        description="管理和跟踪所有开票申请单的状态"
        icon={FileText}
        iconColor="text-blue-600"
      >
        <Button onClick={loadInvoiceRequests} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </PageHeader>

      {/* 筛选和搜索 */}
      <Card>
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">搜索</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="搜索申请单号、合作方名称..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <Label htmlFor="status">状态筛选</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="Pending">待审核</SelectItem>
                  <SelectItem value="Approved">已通过</SelectItem>
                  <SelectItem value="Rejected">已拒绝</SelectItem>
                  <SelectItem value="Completed">已完成</SelectItem>
                  <SelectItem value="Voided">已作废</SelectItem>
                  <SelectItem value="Merged">已合并</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* 申请单列表 */}
      <Card>
        <CardHeader>
          <CardTitle>开票申请单列表 ({filteredRequests.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              加载中...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>申请单号</TableHead>
                  <TableHead>合作方</TableHead>
                  <TableHead>开票金额</TableHead>
                  <TableHead>运单数量</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>创建人</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {request.request_number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{request.partner_name}</div>
                        {request.invoicing_partner_full_name && (
                          <div className="text-sm text-muted-foreground">
                            {request.invoicing_partner_full_name}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      ¥{request.total_amount.toLocaleString()}
                    </TableCell>
                    <TableCell>{request.record_count}条</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(request.status)}>
                        {getStatusText(request.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(request.created_at), 'yyyy-MM-dd HH:mm')}
                    </TableCell>
                    <TableCell>
                      {request.profiles?.full_name || '未知'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(request)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!request.is_voided && !request.is_merged && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditStatus(request)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleVoidRequest(request)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteRequest(request.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 详情对话框 */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>开票申请单详情 - {selectedRequest?.request_number}</DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-6">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>申请单号</Label>
                  <div className="font-medium">{selectedRequest.request_number}</div>
                </div>
                <div>
                  <Label>状态</Label>
                  <Badge variant={getStatusBadgeVariant(selectedRequest.status)}>
                    {getStatusText(selectedRequest.status)}
                  </Badge>
                </div>
                <div>
                  <Label>合作方</Label>
                  <div>{selectedRequest.partner_name}</div>
                  {selectedRequest.partner_full_name && (
                    <div className="text-sm text-muted-foreground">
                      {selectedRequest.partner_full_name}
                    </div>
                  )}
                </div>
                <div>
                  <Label>开票金额</Label>
                  <div className="font-medium">¥{selectedRequest.total_amount.toLocaleString()}</div>
                </div>
                <div>
                  <Label>运单数量</Label>
                  <div>{selectedRequest.record_count}条</div>
                </div>
                <div>
                  <Label>创建时间</Label>
                  <div>{format(new Date(selectedRequest.created_at), 'yyyy-MM-dd HH:mm:ss')}</div>
                </div>
              </div>

              {/* 银行信息 */}
              {(selectedRequest.bank_name || selectedRequest.bank_account) && (
                <div>
                  <Label>银行信息</Label>
                  <div className="space-y-2">
                    {selectedRequest.bank_name && (
                      <div>银行：{selectedRequest.bank_name}</div>
                    )}
                    {selectedRequest.bank_account && (
                      <div>账号：{selectedRequest.bank_account}</div>
                    )}
                  </div>
                </div>
              )}

              {/* 运单明细 */}
              <div>
                <Label>运单明细</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>运单号</TableHead>
                      <TableHead>项目</TableHead>
                      <TableHead>司机</TableHead>
                      <TableHead>路线</TableHead>
                      <TableHead>金额</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requestDetails.map((detail) => (
                      <TableRow key={detail.id}>
                        <TableCell>{detail.logistics_record.auto_number}</TableCell>
                        <TableCell>{detail.logistics_record.project_name}</TableCell>
                        <TableCell>{detail.logistics_record.driver_name}</TableCell>
                        <TableCell>
                          {detail.logistics_record.loading_address} → {detail.logistics_record.unloading_address}
                        </TableCell>
                        <TableCell>¥{detail.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 编辑状态对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑申请单状态</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="status">状态</Label>
              <Select value={editForm.status} onValueChange={(value) => setEditForm({...editForm, status: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">待审核</SelectItem>
                  <SelectItem value="Approved">已通过</SelectItem>
                  <SelectItem value="Rejected">已拒绝</SelectItem>
                  <SelectItem value="Completed">已完成</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="remarks">备注</Label>
              <Textarea
                id="remarks"
                placeholder="请输入备注信息..."
                value={editForm.remarks}
                onChange={(e) => setEditForm({...editForm, remarks: e.target.value})}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => updateRequestStatus(selectedRequest?.id || '', editForm.status, editForm.remarks)}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 作废对话框 */}
      <Dialog open={isVoidDialogOpen} onOpenChange={setIsVoidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>作废开票申请单</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>申请单号</Label>
              <div className="font-medium">{selectedRequest?.request_number}</div>
            </div>
            
            <div>
              <Label htmlFor="void-reason">作废原因</Label>
              <Textarea
                id="void-reason"
                placeholder="请输入作废原因..."
                value={voidForm.reason}
                onChange={(e) => setVoidForm({...voidForm, reason: e.target.value})}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVoidDialogOpen(false)}>
              取消
            </Button>
            <Button 
              variant="destructive"
              onClick={() => voidRequest(selectedRequest?.id || '', voidForm.reason)}
            >
              确认作废
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
