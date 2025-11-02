import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ContractTagAssignment } from '@/components/contracts/ContractTagAssignment';
import { ContractFileManager } from '@/components/contracts/ContractFileManager';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Edit, 
  Download, 
  Eye, 
  Calendar, 
  Building, 
  User, 
  DollarSign,
  FileText,
  Shield,
  Clock,
  Tag as TagIcon
} from 'lucide-react';
import { format } from 'date-fns';

interface Contract {
  id: string;
  category: '行政合同' | '内部合同' | '业务合同';
  start_date: string;
  end_date: string;
  counterparty_company: string;
  our_company: string;
  contract_amount?: number;
  contract_original_url?: string;
  attachment_url?: string;
  remarks?: string;
  created_at: string;
  contract_number?: string;
  status?: 'active' | 'expired' | 'terminated' | 'archived';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  responsible_person?: string;
  department?: string;
  is_confidential?: boolean;
  last_accessed_at?: string;
  access_count?: number;
}

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'files' | 'tags'>('details');

  const { toast } = useToast();

  useEffect(() => {
    if (id) {
      loadContract();
      logAccess();
    }
  }, [id]);

  const loadContract = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setContract(data);
    } catch (error) {
      console.error('Error loading contract:', error);
      toast({
        title: "错误",
        description: "加载合同详情失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const logAccess = async () => {
    if (!id) return;
    
    try {
      await supabase.functions.invoke('log_contract_access', {
        body: {
          contract_id: id,
          action: 'view'
        }
      });
    } catch (error) {
      console.error('Error logging access:', error);
    }
  };

  const getStatusBadgeVariant = (status?: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'expired': return 'destructive';
      case 'terminated': return 'secondary';
      case 'archived': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'active': return '有效';
      case 'expired': return '已到期';
      case 'terminated': return '已终止';
      case 'archived': return '已归档';
      default: return '未知';
    }
  };

  const getPriorityBadgeVariant = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'default';
      case 'normal': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  const getPriorityText = (priority?: string) => {
    switch (priority) {
      case 'urgent': return '紧急';
      case 'high': return '高';
      case 'normal': return '普通';
      case 'low': return '低';
      default: return '普通';
    }
  };

  const getCategoryBadgeVariant = (category: string) => {
    switch (category) {
      case '行政合同': return 'secondary';
      case '内部合同': return 'outline';
      case '业务合同': return 'default';
      default: return 'secondary';
    }
  };

  const isExpiringSoon = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays > 0;
  };

  const isExpired = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    return end < now;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">加载中...</div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold mb-4">合同不存在</h2>
          <Button onClick={() => navigate('/contracts')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回合同列表
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate('/contracts')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{contract.contract_number || '合同详情'}</h1>
            <p className="text-muted-foreground">
              {contract.counterparty_company} - {contract.our_company}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            编辑
          </Button>
        </div>
      </div>

      {/* 状态和优先级 */}
      <div className="flex items-center space-x-4">
        <Badge variant={getCategoryBadgeVariant(contract.category)}>
          {contract.category}
        </Badge>
        <Badge variant={getStatusBadgeVariant(contract.status)}>
          {getStatusText(contract.status)}
        </Badge>
        <Badge variant={getPriorityBadgeVariant(contract.priority)}>
          {getPriorityText(contract.priority)}
        </Badge>
        {contract.is_confidential && (
          <Badge variant="destructive">
            <Shield className="h-3 w-3 mr-1" />
            保密
          </Badge>
        )}
        {isExpiringSoon(contract.end_date) && (
          <Badge variant="destructive">
            <Clock className="h-3 w-3 mr-1" />
            即将到期
          </Badge>
        )}
        {isExpired(contract.end_date) && (
          <Badge variant="destructive">
            已过期
          </Badge>
        )}
      </div>

      {/* 标签页导航 */}
      <div className="flex items-center space-x-2">
        <Button
          variant={activeTab === 'details' ? 'default' : 'outline'}
          onClick={() => setActiveTab('details')}
        >
          基本信息
        </Button>
        <Button
          variant={activeTab === 'files' ? 'default' : 'outline'}
          onClick={() => setActiveTab('files')}
        >
          <FileText className="h-4 w-4 mr-2" />
          文件管理
        </Button>
        <Button
          variant={activeTab === 'tags' ? 'default' : 'outline'}
          onClick={() => setActiveTab('tags')}
        >
          <TagIcon className="h-4 w-4 mr-2" />
          标签管理
        </Button>
      </div>

      {/* 标签页内容 */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building className="h-5 w-5 mr-2" />
                基本信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">合同编号</label>
                  <p className="font-mono">{contract.contract_number || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">合同金额</label>
                  <p className="font-semibold">
                    {contract.contract_amount ? `¥${(contract.contract_amount || 0).toLocaleString()}` : '-'}
                  </p>
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">对方公司</label>
                  <p>{contract.counterparty_company}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">我方公司</label>
                  <p>{contract.our_company}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">负责人</label>
                  <p>{contract.responsible_person || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">部门</label>
                  <p>{contract.department || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 时间信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                时间信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">开始日期</label>
                  <p>{format(new Date(contract.start_date), 'yyyy年MM月dd日')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">结束日期</label>
                  <p>{format(new Date(contract.end_date), 'yyyy年MM月dd日')}</p>
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">创建时间</label>
                  <p>{format(new Date(contract.created_at), 'yyyy-MM-dd HH:mm')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">最后访问</label>
                  <p>
                    {contract.last_accessed_at 
                      ? format(new Date(contract.last_accessed_at), 'yyyy-MM-dd HH:mm')
                      : '从未访问'
                    }
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">访问次数</label>
                <p>{contract.access_count || 0} 次</p>
              </div>
            </CardContent>
          </Card>

          {/* 备注信息 */}
          {contract.remarks && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>备注信息</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{contract.remarks}</p>
              </CardContent>
            </Card>
          )}

          {/* 文件信息 */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                文件信息
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contract.contract_original_url && (
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium">合同原件</p>
                        <p className="text-sm text-muted-foreground">原始合同文件</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4 mr-1" />
                        查看
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-1" />
                        下载
                      </Button>
                    </div>
                  </div>
                )}
                
                {contract.attachment_url && (
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium">合同附件</p>
                        <p className="text-sm text-muted-foreground">相关附件文件</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4 mr-1" />
                        查看
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-1" />
                        下载
                      </Button>
                    </div>
                  </div>
                )}
                
                {!contract.contract_original_url && !contract.attachment_url && (
                  <div className="col-span-2 text-center py-8 text-muted-foreground">
                    暂无文件
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'files' && (
        <ContractFileManager
          contractId={contract.id}
          contractNumber={contract.contract_number}
          onFileUpdate={loadContract}
        />
      )}

      {activeTab === 'tags' && (
        <ContractTagAssignment
          contractId={contract.id}
          contractNumber={contract.contract_number}
          onTagUpdate={loadContract}
        />
      )}
    </div>
  );
}
