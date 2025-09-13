import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, 
  Filter, 
  Calendar, 
  Building, 
  DollarSign, 
  FileText, 
  Eye,
  Download,
  Tag as TagIcon,
  Clock,
  Shield
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
  contract_tag_relations?: Array<{
    contract_tags: {
      id: string;
      name: string;
      color: string;
    };
  }>;
}

interface MobileContractListProps {
  onContractSelect: (contract: Contract) => void;
  onSearch?: (filters: any) => void;
}

export function MobileContractList({ onContractSelect, onSearch }: MobileContractListProps) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    loadContracts();
  }, []);

  const loadContracts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          *,
          contract_tag_relations(
            contract_tags(id, name, color)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      const formattedData = (data || []).map(item => ({
        ...item,
        status: item.status as 'active' | 'expired' | 'terminated' | 'archived',
        priority: item.priority as 'low' | 'normal' | 'high' | 'urgent'
      }));
      setContracts(formattedData);
    } catch (error) {
      console.error('Error loading contracts:', error);
      toast({
        title: "错误",
        description: "加载合同列表失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const filters = {
      keyword: searchKeyword,
      category: categoryFilter === 'all' ? '' : categoryFilter,
      status: statusFilter === 'all' ? '' : statusFilter
    };
    onSearch?.(filters);
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
    const diffDays = differenceInDays(end, now);
    return diffDays <= 30 && diffDays > 0;
  };

  const isExpired = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    return end < now;
  };

  const filteredContracts = contracts.filter(contract => {
    const matchesKeyword = !searchKeyword || 
      contract.contract_number?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      contract.counterparty_company.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      contract.our_company.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      contract.responsible_person?.toLowerCase().includes(searchKeyword.toLowerCase());

    const matchesCategory = !categoryFilter || contract.category === categoryFilter;
    const matchesStatus = !statusFilter || contract.status === statusFilter;

    return matchesKeyword && matchesCategory && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 搜索栏 */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="搜索合同编号、公司名称..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="pl-10"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-2 gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="合同分类" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部分类</SelectItem>
                    <SelectItem value="行政合同">行政合同</SelectItem>
                    <SelectItem value="内部合同">内部合同</SelectItem>
                    <SelectItem value="业务合同">业务合同</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="合同状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="active">有效</SelectItem>
                    <SelectItem value="expired">已到期</SelectItem>
                    <SelectItem value="terminated">已终止</SelectItem>
                    <SelectItem value="archived">已归档</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 合同列表 */}
      <div className="space-y-3">
        {filteredContracts.map((contract) => (
          <Card 
            key={contract.id} 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onContractSelect(contract)}
          >
            <CardContent className="p-4">
              <div className="space-y-3">
                {/* 合同编号和状态 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm font-medium">
                      {contract.contract_number || '未编号'}
                    </span>
                    <Badge variant={getCategoryBadgeVariant(contract.category)}>
                      {contract.category}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Badge variant={getStatusBadgeVariant(contract.status)}>
                      {getStatusText(contract.status)}
                    </Badge>
                    {contract.is_confidential && (
                      <Shield className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </div>

                {/* 公司信息 */}
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Building className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">{contract.counterparty_company}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Building className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">{contract.our_company}</span>
                  </div>
                </div>

                {/* 金额和优先级 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">
                      {contract.contract_amount ? `¥${contract.contract_amount.toLocaleString()}` : '未设置'}
                    </span>
                  </div>
                  <Badge variant={getPriorityBadgeVariant(contract.priority)}>
                    {getPriorityText(contract.priority)}
                  </Badge>
                </div>

                {/* 时间信息 */}
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>{format(new Date(contract.end_date), 'yyyy-MM-dd')}</span>
                  </div>
                  {isExpiringSoon(contract.end_date) && (
                    <div className="flex items-center space-x-1 text-orange-600">
                      <Clock className="h-4 w-4" />
                      <span>即将到期</span>
                    </div>
                  )}
                  {isExpired(contract.end_date) && (
                    <div className="flex items-center space-x-1 text-red-600">
                      <span>已过期</span>
                    </div>
                  )}
                </div>

                {/* 标签 */}
                {contract.contract_tag_relations && contract.contract_tag_relations.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <TagIcon className="h-4 w-4 text-gray-500" />
                    <div className="flex flex-wrap gap-1">
                      {contract.contract_tag_relations.slice(0, 3).map((relation: any) => (
                        <Badge
                          key={relation.contract_tags.id}
                          variant="outline"
                          className="text-xs"
                          style={{ 
                            backgroundColor: relation.contract_tags.color + '20',
                            borderColor: relation.contract_tags.color,
                            color: relation.contract_tags.color
                          }}
                        >
                          {relation.contract_tags.name}
                        </Badge>
                      ))}
                      {contract.contract_tag_relations.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{contract.contract_tag_relations.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* 负责人和文件 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">
                      {contract.responsible_person || '未指定负责人'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {contract.contract_original_url && (
                      <Button size="sm" variant="outline" className="h-6 px-2">
                        <FileText className="h-3 w-3 mr-1" />
                        原件
                      </Button>
                    )}
                    {contract.attachment_url && (
                      <Button size="sm" variant="outline" className="h-6 px-2">
                        <FileText className="h-3 w-3 mr-1" />
                        附件
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredContracts.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>暂无合同数据</p>
                <p className="text-sm">请检查筛选条件或添加新合同</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
