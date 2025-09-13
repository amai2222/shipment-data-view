import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, Filter, X, Save } from 'lucide-react';

interface SearchFilters {
  keyword: string;
  contract_number: string;
  category: string;
  status: string;
  priority: string;
  counterparty_company: string;
  our_company: string;
  department: string;
  responsible_person: string;
  amount_min: string;
  amount_max: string;
  start_date_from: string;
  start_date_to: string;
  end_date_from: string;
  end_date_to: string;
  created_date_from: string;
  created_date_to: string;
  is_confidential: boolean | null;
  has_files: boolean | null;
  is_expiring_soon: boolean | null;
  expiring_days: number;
  tags: string[];
  sort_by: string;
  sort_order: 'asc' | 'desc';
}

interface SavedSearch {
  id: string;
  name: string;
  filters: SearchFilters;
  created_at: string;
}

interface ContractAdvancedSearchProps {
  onSearch: (filters: SearchFilters) => void;
  onClear: () => void;
  initialFilters?: Partial<SearchFilters>;
}

export function ContractAdvancedSearch({ onSearch, onClear, initialFilters }: ContractAdvancedSearchProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    keyword: '',
    contract_number: '',
    category: '',
    status: '',
    priority: '',
    counterparty_company: '',
    our_company: '',
    department: '',
    responsible_person: '',
    amount_min: '',
    amount_max: '',
    start_date_from: '',
    start_date_to: '',
    end_date_from: '',
    end_date_to: '',
    created_date_from: '',
    created_date_to: '',
    is_confidential: null,
    has_files: null,
    is_expiring_soon: null,
    expiring_days: 30,
    tags: [],
    sort_by: 'created_at',
    sort_order: 'desc',
    ...initialFilters
  });

  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    loadSavedSearches();
  }, []);

  const loadSavedSearches = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_searches')
        .select('*')
        .eq('search_type', 'contract')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const formattedData = data?.map(item => ({
        ...item,
        filters: item.filters as any as SearchFilters
      })) || [];
      setSavedSearches(formattedData);
    } catch (error) {
      console.error('Error loading saved searches:', error);
    }
  };

  const handleSearch = () => {
    onSearch(filters);
  };

  const handleClear = () => {
    const clearedFilters: SearchFilters = {
      keyword: '',
      contract_number: '',
      category: '',
      status: '',
      priority: '',
      counterparty_company: '',
      our_company: '',
      department: '',
      responsible_person: '',
      amount_min: '',
      amount_max: '',
      start_date_from: '',
      start_date_to: '',
      end_date_from: '',
      end_date_to: '',
      created_date_from: '',
      created_date_to: '',
      is_confidential: null,
      has_files: null,
      is_expiring_soon: null,
      expiring_days: 30,
      tags: [],
      sort_by: 'created_at',
      sort_order: 'desc'
    };
    setFilters(clearedFilters);
    onClear();
  };

  const handleSaveSearch = async () => {
    if (!saveSearchName.trim()) {
      toast({
        title: "错误",
        description: "请输入搜索名称",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('saved_searches')
        .insert({
          name: saveSearchName.trim(),
          search_type: 'contract',
          filters: filters as any
        });

      if (error) throw error;

      toast({
        title: "成功",
        description: "搜索条件已保存",
      });

      setShowSaveDialog(false);
      setSaveSearchName('');
      loadSavedSearches();
    } catch (error) {
      console.error('Error saving search:', error);
      toast({
        title: "错误",
        description: "保存搜索条件失败",
        variant: "destructive",
      });
    }
  };

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    Object.entries(filters).forEach(([key, value]) => {
      if (key === 'tags') {
        if (value.length > 0) count++;
      } else if (key === 'is_confidential' || key === 'has_files' || key === 'is_expiring_soon') {
        if (value !== null) count++;
      } else if (typeof value === 'string' && value.trim() !== '') {
        count++;
      }
    });
    return count;
  };

  return (
    <div className="space-y-4">
      {/* 快速搜索栏 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="搜索合同编号、公司名称、负责人..."
                  value={filters.keyword}
                  onChange={(e) => updateFilter('keyword', e.target.value)}
                  className="pl-10"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
            </div>
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              搜索
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Filter className="h-4 w-4 mr-2" />
              高级筛选
              {getActiveFiltersCount() > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {getActiveFiltersCount()}
                </Badge>
              )}
            </Button>
            <Button variant="outline" onClick={handleClear}>
              <X className="h-4 w-4 mr-2" />
              清除
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 高级筛选面板 */}
      {showAdvanced && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <Filter className="h-5 w-5 mr-2" />
                高级筛选
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSaveDialog(true)}
                >
                  <Save className="h-4 w-4 mr-2" />
                  保存搜索
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvanced(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 基础信息 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>合同编号</Label>
                <Input
                  placeholder="输入合同编号"
                  value={filters.contract_number}
                  onChange={(e) => updateFilter('contract_number', e.target.value)}
                />
              </div>
              <div>
                <Label>合同分类</Label>
                <Select value={filters.category || 'all'} onValueChange={(value) => updateFilter('category', value === 'all' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择分类" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部分类</SelectItem>
                    <SelectItem value="行政合同">行政合同</SelectItem>
                    <SelectItem value="内部合同">内部合同</SelectItem>
                    <SelectItem value="业务合同">业务合同</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>合同状态</Label>
                <Select value={filters.status || 'all'} onValueChange={(value) => updateFilter('status', value === 'all' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择状态" />
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
            </div>

            {/* 公司信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>对方公司</Label>
                <Input
                  placeholder="输入对方公司名称"
                  value={filters.counterparty_company}
                  onChange={(e) => updateFilter('counterparty_company', e.target.value)}
                />
              </div>
              <div>
                <Label>我方公司</Label>
                <Input
                  placeholder="输入我方公司名称"
                  value={filters.our_company}
                  onChange={(e) => updateFilter('our_company', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}