import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  User, 
  Clock, 
  FileText,
  Edit,
  Trash2,
  Plus,
  Settings
} from 'lucide-react';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  contract_id: string;
  user_id: string;
  action: string;
  details: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  // 关联信息
  contract_number?: string;
  counterparty_company?: string;
  our_company?: string;
  user_email?: string;
  user_name?: string;
}

interface ContractAuditLogsProps {
  contractId?: string;
  onLogUpdate?: () => void;
}

export function ContractAuditLogs({ contractId, onLogUpdate }: ContractAuditLogsProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    user_id: '',
    date_from: '',
    date_to: '',
    keyword: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    loadAuditLogs();
  }, [contractId, filters]);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('contract_access_logs')
        .select(`
          *,
          contracts!inner(contract_number, counterparty_company, our_company)
        `)
        .order('created_at', { ascending: false });

      if (contractId) {
        query = query.eq('contract_id', contractId);
      }

      // 应用筛选条件
      if (filters.action) {
        query = query.eq('action', filters.action);
      }
      if (filters.user_id) {
        query = query.eq('user_id', filters.user_id);
      }
      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Database error:', error);
        // 如果表不存在，返回空数组而不是抛出错误
        if (error.message.includes('relation "contract_access_logs" does not exist')) {
          setLogs([]);
          return;
        }
        throw error;
      }
      
      const formattedData = (data || []).map(item => ({
        ...item,
        contract_number: item.contracts?.contract_number,
        counterparty_company: item.contracts?.counterparty_company,
        our_company: item.contracts?.our_company,
        user_email: item.user_id ? `用户 ${item.user_id}` : null,
        user_name: item.user_id ? `用户 ${item.user_id}` : null
      }));

      // 关键词筛选
      let filteredData = formattedData;
      if (filters.keyword) {
        const keyword = filters.keyword.toLowerCase();
        filteredData = formattedData.filter(log => 
          log.contract_number?.toLowerCase().includes(keyword) ||
          log.counterparty_company?.toLowerCase().includes(keyword) ||
          log.our_company?.toLowerCase().includes(keyword) ||
          log.user_email?.toLowerCase().includes(keyword) ||
          log.user_name?.toLowerCase().includes(keyword) ||
          log.action.toLowerCase().includes(keyword)
        );
      }

      setLogs(filteredData);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      toast({
        title: "错误",
        description: "加载审计日志失败，请检查数据库连接",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'view': return 'default';
      case 'create': return 'secondary';
      case 'update': return 'outline';
      case 'delete': return 'destructive';
      case 'download': return 'default';
      case 'export': return 'secondary';
      default: return 'outline';
    }
  };

  const getActionText = (action: string) => {
    switch (action) {
      case 'view': return '查看';
      case 'create': return '创建';
      case 'update': return '修改';
      case 'delete': return '删除';
      case 'download': return '下载';
      case 'export': return '导出';
      default: return action;
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'view': return <Eye className="h-4 w-4" />;
      case 'create': return <Plus className="h-4 w-4" />;
      case 'update': return <Edit className="h-4 w-4" />;
      case 'delete': return <Trash2 className="h-4 w-4" />;
      case 'download': return <Download className="h-4 w-4" />;
      case 'export': return <FileText className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  const exportLogs = async () => {
    try {
      const csvContent = [
        ['时间', '用户', '操作', '合同编号', '对方公司', '我方公司', 'IP地址', '详情'].join(','),
        ...logs.map(log => [
          format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
          log.user_name || log.user_email || '未知用户',
          getActionText(log.action),
          log.contract_number || '',
          log.counterparty_company || '',
          log.our_company || '',
          log.ip_address || '',
          JSON.stringify(log.details || {})
        ].map(field => `"${field}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `contract_audit_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
    } catch (error) {
      console.error('Error exporting logs:', error);
      toast({
        title: "错误",
        description: "导出日志失败",
        variant: "destructive",
      });
    }
  };

  const clearFilters = () => {
    setFilters({
      action: '',
      user_id: '',
      date_from: '',
      date_to: '',
      keyword: ''
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">审计日志</h2>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={exportLogs}>
            <Download className="h-4 w-4 mr-2" />
            导出日志
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            筛选
          </Button>
        </div>
      </div>

      {/* 筛选面板 */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Filter className="h-5 w-5 mr-2" />
              筛选条件
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>操作类型</Label>
                <Select value={filters.action || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, action: value === 'all' ? '' : value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择操作类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部操作</SelectItem>
                    <SelectItem value="view">查看</SelectItem>
                    <SelectItem value="create">创建</SelectItem>
                    <SelectItem value="update">修改</SelectItem>
                    <SelectItem value="delete">删除</SelectItem>
                    <SelectItem value="download">下载</SelectItem>
                    <SelectItem value="export">导出</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>开始日期</Label>
                <Input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
                />
              </div>

              <div>
                <Label>结束日期</Label>
                <Input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters(prev => ({ ...prev, date_to: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>关键词搜索</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="搜索合同编号、公司名称、用户..."
                  value={filters.keyword}
                  onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={clearFilters}>
                清除筛选
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 日志列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            操作记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无审计日志
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>操作</TableHead>
                    <TableHead>合同信息</TableHead>
                    <TableHead>IP地址</TableHead>
                    <TableHead>详情</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="text-sm">
                            {format(new Date(log.created_at), 'MM-dd HH:mm')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm font-medium">{log.user_name || '未知用户'}</p>
                            <p className="text-xs text-muted-foreground">{log.user_email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(log.action)} className="flex items-center space-x-1">
                          {getActionIcon(log.action)}
                          <span>{getActionText(log.action)}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-mono">{log.contract_number || '未编号'}</p>
                          <p className="text-xs text-muted-foreground">
                            {log.counterparty_company} - {log.our_company}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-mono">{log.ip_address || '-'}</span>
                      </TableCell>
                      <TableCell>
                        {log.details && Object.keys(log.details).length > 0 ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              alert(JSON.stringify(log.details, null, 2));
                            }}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            查看
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
