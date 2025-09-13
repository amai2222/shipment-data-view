import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, 
  Filter, 
  X, 
  Calendar as CalendarIcon, 
  Save, 
  Bookmark,
  Clock,
  DollarSign,
  Building,
  User,
  Tag as TagIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface SearchFilters {
  // 基础搜索
  keyword: string;
  contract_number: string;
  
  // 分类和状态
  category: string;
  status: string;
  priority: string;
  
  // 公司信息
  counterparty_company: string;
  our_company: string;
  department: string;
  responsible_person: string;
  
  // 金额范围
  amount_min: string;
  amount_max: string;
  
  // 日期范围
  start_date_from: string;
  start_date_to: string;
  end_date_from: string;
  end_date_to: string;
  created_date_from: string;
  created_date_to: string;
  
  // 特殊筛选
  is_confidential: boolean | null;
  has_files: boolean | null;
  is_expiring_soon: boolean | null;
  expiring_days: number;
  
  // 标签
  tags: string[];
  
  // 排序
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
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [responsiblePersons, setResponsiblePersons] = useState<string[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    loadReferenceData();
    loadSavedSearches();
  }, []);

  const loadReferenceData = async () => {
    try {
      // 加载标签
      const { data: tagsData } = await supabase
        .from('contract_tags')
        .select('id, name, color')
        .order('name');

      // 加载部门和负责人
      const { data: contractsData } = await supabase
        .from('contracts')
        .select('department, responsible_person')
        .not('department', 'is', null)
        .not('responsible_person', 'is', null);

      setAvailableTags(tagsData || []);
      
      const uniqueDepartments = [...new Set((contractsData || []).map(c => c.department).filter(Boolean))];
      const uniquePersons = [...new Set((contractsData || []).map(c => c.responsible_person).filter(Boolean))];
      
      setDepartments(uniqueDepartments);
      setResponsiblePersons(uniquePersons);
    } catch (error) {
      console.error('Error loading reference data:', error);
    }
  };

  const loadSavedSearches = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_searches')
        .select('*')
        .eq('search_type', 'contract')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedSearches(data || []);
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
          filters: filters
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

  const handleLoadSavedSearch = (savedSearch: SavedSearch) => {
    setFilters(savedSearch.filters);
    onSearch(savedSearch.filters);
  };

  const handleDeleteSavedSearch = async (searchId: string) => {
    try {
      const { error } = await supabase
        .from('saved_searches')
        .delete()
        .eq('id', searchId);

      if (error) throw error;

      toast({
        title: "成功",
        description: "搜索条件已删除",
      });

      loadSavedSearches();
    } catch (error) {
      console.error('Error deleting saved search:', error);
      toast({
        title: "错误",
        description: "删除搜索条件失败",
        variant: "destructive",
      });
    }
  };

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleTag = (tagId: string) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(tagId)
        ? prev.tags.filter(id => id !== tagId)
        : [...prev.tags, tagId]
    }));
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

            {/* 金额范围 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>最小金额</Label>
                <Input
                  type="number"
                  placeholder="最小金额"
                  value={filters.amount_min}
                  onChange={(e) => updateFilter('amount_min', e.target.value)}
                />
              </div>
              <div>
                <Label>最大金额</Label>
                <Input
                  type="number"
                  placeholder="最大金额"
                  value={filters.amount_max}
                  onChange={(e) => updateFilter('amount_max', e.target.value)}
                />
              </div>
              <div>
                <Label>优先级</Label>
                <Select value={filters.priority || 'all'} onValueChange={(value) => updateFilter('priority', value === 'all' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择优先级" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部优先级</SelectItem>
                    <SelectItem value="urgent">紧急</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                    <SelectItem value="normal">普通</SelectItem>
                    <SelectItem value="low">低</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 日期范围 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>开始日期（从）</Label>
                <Input
                  type="date"
                  value={filters.start_date_from}
                  onChange={(e) => updateFilter('start_date_from', e.target.value)}
                />
              </div>
              <div>
                <Label>开始日期（到）</Label>
                <Input
                  type="date"
                  value={filters.start_date_to}
                  onChange={(e) => updateFilter('start_date_to', e.target.value)}
                />
              </div>
              <div>
                <Label>结束日期（从）</Label>
                <Input
                  type="date"
                  value={filters.end_date_from}
                  onChange={(e) => updateFilter('end_date_from', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>结束日期（到）</Label>
                <Input
                  type="date"
                  value={filters.end_date_to}
                  onChange={(e) => updateFilter('end_date_to', e.target.value)}
                />
              </div>
              <div>
                <Label>创建日期（从）</Label>
                <Input
                  type="date"
                  value={filters.created_date_from}
                  onChange={(e) => updateFilter('created_date_from', e.target.value)}
                />
              </div>
              <div>
                <Label>创建日期（到）</Label>
                <Input
                  type="date"
                  value={filters.created_date_to}
                  onChange={(e) => updateFilter('created_date_to', e.target.value)}
                />
              </div>
            </div>

            {/* 特殊筛选 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>部门</Label>
                <Select value={filters.department || 'all'} onValueChange={(value) => updateFilter('department', value === 'all' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择部门" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部部门</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>负责人</Label>
                <Select value={filters.responsible_person || 'all'} onValueChange={(value) => updateFilter('responsible_person', value === 'all' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择负责人" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部负责人</SelectItem>
                    {responsiblePersons.map(person => (
                      <SelectItem key={person} value={person}>{person}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 标签筛选 */}
            <div>
              <Label>标签</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {availableTags.map(tag => (
                  <Badge
                    key={tag.id}
                    variant={filters.tags.includes(tag.id) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    style={filters.tags.includes(tag.id) ? { backgroundColor: tag.color } : {}}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>

            {/* 特殊条件 */}
            <div className="space-y-4">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_confidential"
                    checked={filters.is_confidential === true}
                    onCheckedChange={(checked) => 
                      updateFilter('is_confidential', checked ? true : null)
                    }
                  />
                  <Label htmlFor="is_confidential">仅显示保密合同</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="has_files"
                    checked={filters.has_files === true}
                    onCheckedChange={(checked) => 
                      updateFilter('has_files', checked ? true : null)
                    }
                  />
                  <Label htmlFor="has_files">仅显示有文件的合同</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_expiring_soon"
                    checked={filters.is_expiring_soon === true}
                    onCheckedChange={(checked) => 
                      updateFilter('is_expiring_soon', checked ? true : null)
                    }
                  />
                  <Label htmlFor="is_expiring_soon">即将到期</Label>
                </div>
              </div>
              
              {filters.is_expiring_soon && (
                <div className="flex items-center space-x-2">
                  <Label>到期天数：</Label>
                  <Input
                    type="number"
                    value={filters.expiring_days}
                    onChange={(e) => updateFilter('expiring_days', parseInt(e.target.value) || 30)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">天内到期</span>
                </div>
              )}
            </div>

            {/* 排序 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>排序字段</Label>
                <Select value={filters.sort_by} onValueChange={(value) => updateFilter('sort_by', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at">创建时间</SelectItem>
                    <SelectItem value="start_date">开始日期</SelectItem>
                    <SelectItem value="end_date">结束日期</SelectItem>
                    <SelectItem value="contract_amount">合同金额</SelectItem>
                    <SelectItem value="contract_number">合同编号</SelectItem>
                    <SelectItem value="counterparty_company">对方公司</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>排序顺序</Label>
                <Select value={filters.sort_order} onValueChange={(value: 'asc' | 'desc') => updateFilter('sort_order', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">降序</SelectItem>
                    <SelectItem value="asc">升序</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={handleClear}>
                清除所有筛选
              </Button>
              <Button onClick={handleSearch}>
                应用筛选
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 保存搜索对话框 */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>保存搜索条件</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>搜索名称</Label>
                <Input
                  placeholder="输入搜索名称"
                  value={saveSearchName}
                  onChange={(e) => setSaveSearchName(e.target.value)}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                  取消
                </Button>
                <Button onClick={handleSaveSearch}>
                  保存
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 已保存的搜索 */}
      {savedSearches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bookmark className="h-5 w-5 mr-2" />
              已保存的搜索
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {savedSearches.map(search => (
                <div key={search.id} className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleLoadSavedSearch(search)}
                  >
                    {search.name}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteSavedSearch(search.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
