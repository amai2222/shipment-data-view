import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ContractTagAssignment } from '@/components/contracts/ContractTagAssignment';
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
  Tag as TagIcon,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

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
  contract_tag_relations?: Array<{
    contract_tags: {
      id: string;
      name: string;
      color: string;
    };
  }>;
}

interface MobileContractDetailProps {
  contract: Contract;
  onBack: () => void;
  onEdit?: (contract: Contract) => void;
}

export function MobileContractDetail({ contract, onBack, onEdit }: MobileContractDetailProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'files' | 'tags'>('details');

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
    const diffDays = differenceInDays(end, now);
    return diffDays <= 30 && diffDays > 0;
  };

  const isExpired = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    return end < now;
  };

  const handleFileAction = (url: string, fileName: string, action: 'view' | 'download') => {
    if (action === 'view') {
      window.open(url, '_blank');
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
    }
  };

  return (
    <div className="space-y-4">
      {/* 页面头部 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Button>
            {onEdit && (
              <Button size="sm" onClick={() => onEdit(contract)}>
                <Edit className="h-4 w-4 mr-2" />
                编辑
              </Button>
            )}
          </div>
          
          <div className="space-y-3">
            <div>
              <h1 className="text-xl font-bold">{contract.contract_number || '合同详情'}</h1>
              <p className="text-sm text-muted-foreground">
                {contract.counterparty_company} - {contract.our_company}
              </p>
            </div>

            {/* 状态标签 */}
            <div className="flex flex-wrap gap-2">
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
          </div>
        </CardContent>
      </Card>

      {/* 标签页导航 */}
      <Card>
        <CardContent className="p-2">
          <div className="flex space-x-1">
            <Button
              variant={activeTab === 'details' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1"
              onClick={() => setActiveTab('details')}
            >
              基本信息
            </Button>
            <Button
              variant={activeTab === 'files' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1"
              onClick={() => setActiveTab('files')}
            >
              <FileText className="h-4 w-4 mr-1" />
              文件
            </Button>
            <Button
              variant={activeTab === 'tags' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1"
              onClick={() => setActiveTab('tags')}
            >
              <TagIcon className="h-4 w-4 mr-1" />
              标签
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 标签页内容 */}
      {activeTab === 'details' && (
        <div className="space-y-4">
          {/* 基本信息 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-lg">
                <Building className="h-5 w-5 mr-2" />
                基本信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">合同编号</label>
                  <p className="font-mono text-sm">{contract.contract_number || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">合同金额</label>
                  <p className="font-semibold text-sm">
                    {contract.contract_amount ? `¥${(contract.contract_amount || 0).toLocaleString()}` : '-'}
                  </p>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">对方公司</label>
                  <p className="text-sm">{contract.counterparty_company}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">我方公司</label>
                  <p className="text-sm">{contract.our_company}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">负责人</label>
                  <p className="text-sm">{contract.responsible_person || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">部门</label>
                  <p className="text-sm">{contract.department || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 时间信息 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-lg">
                <Calendar className="h-5 w-5 mr-2" />
                时间信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">开始日期</label>
                  <p className="text-sm">{format(new Date(contract.start_date), 'yyyy-MM-dd')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">结束日期</label>
                  <p className="text-sm">{format(new Date(contract.end_date), 'yyyy-MM-dd')}</p>
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">创建时间</label>
                  <p className="text-sm">{format(new Date(contract.created_at), 'MM-dd HH:mm')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">访问次数</label>
                  <p className="text-sm">{contract.access_count || 0} 次</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 备注信息 */}
          {contract.remarks && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">备注信息</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{contract.remarks}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'files' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-lg">
              <FileText className="h-5 w-5 mr-2" />
              文件信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {contract.contract_original_url && (
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-sm">合同原件</p>
                    <p className="text-xs text-muted-foreground">原始合同文件</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleFileAction(contract.contract_original_url!, '合同原件', 'view')}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleFileAction(contract.contract_original_url!, '合同原件', 'download')}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
            
            {contract.attachment_url && (
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-sm">合同附件</p>
                    <p className="text-xs text-muted-foreground">相关附件文件</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleFileAction(contract.attachment_url!, '合同附件', 'view')}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleFileAction(contract.attachment_url!, '合同附件', 'download')}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
            
            {!contract.contract_original_url && !contract.attachment_url && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">暂无文件</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'tags' && (
        <ContractTagAssignment
          contractId={contract.id}
          contractNumber={contract.contract_number}
        />
      )}
    </div>
  );
}
