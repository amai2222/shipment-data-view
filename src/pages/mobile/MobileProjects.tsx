import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MobileCard, MobileInfoRow } from '@/components/mobile/MobileCard';
import { MobileSearchBar } from '@/components/mobile/MobileSearchBar';
import { 
  Plus, 
  Building2, 
  Calendar,
  User,
  MapPin,
  Truck,
  Package,
  DollarSign,
  Activity,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { format } from 'date-fns';

interface Project {
  id: string;
  name: string;
  manager: string;
  finance_manager?: string;
  start_date: string;
  end_date: string;
  loading_address: string;
  unloading_address: string;
  cargo_type: string;
  project_status: string;
  planned_total_tons?: number;
  auto_code?: string;
  created_at: string;
}

interface ProjectStats {
  totalRecords: number;
  totalWeight: number;
  totalCost: number;
  completionRate: number;
}

export default function MobileProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [projectStats, setProjectStats] = useState<Record<string, ProjectStats>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin } = usePermissions();

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    filterAndSortProjects();
  }, [projects, searchTerm, filterStatus, sortBy, sortOrder]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      
      // 获取项目列表
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;

      // 获取每个项目的统计数据
      const stats: Record<string, ProjectStats> = {};
      
      for (const project of projectsData || []) {
        const { data: records, error: recordsError } = await supabase
          .from('logistics_records')
          .select('loading_weight, current_cost, extra_cost, driver_payable_cost')
          .eq('project_id', project.id);

        if (!recordsError && records) {
          const totalWeight = records.reduce((sum, r) => sum + (r.loading_weight || 0), 0);
          const totalCost = records.reduce((sum, r) => sum + (r.driver_payable_cost || 0), 0);
          const completionRate = project.planned_total_tons ? 
            Math.min((totalWeight / project.planned_total_tons) * 100, 100) : 0;

          stats[project.id] = {
            totalRecords: records.length,
            totalWeight,
            totalCost,
            completionRate
          };
        }
      }

      setProjects(projectsData || []);
      setProjectStats(stats);
    } catch (error) {
      console.error('Error loading projects:', error);
      toast({
        title: "加载失败",
        description: "无法加载项目列表",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortProjects = () => {
    let filtered = [...projects];

    // 搜索过滤
    if (searchTerm) {
      filtered = filtered.filter(project => 
        project.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.manager?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.auto_code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 状态过滤
    if (filterStatus) {
      filtered = filtered.filter(project => project.project_status === filterStatus);
    }

    // 排序
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'start_date':
          comparison = new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
          break;
        case 'manager':
          comparison = a.manager.localeCompare(b.manager);
          break;
        default:
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredProjects(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '进行中': return 'bg-green-100 text-green-800';
      case '已完成': return 'bg-blue-100 text-blue-800';
      case '已暂停': return 'bg-yellow-100 text-yellow-800';
      case '已取消': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(value);
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      toast({
        title: "权限不足",
        description: "只有管理员可以删除项目",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "删除成功",
        description: "项目已成功删除",
      });

      loadProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: "删除失败",
        description: "无法删除项目",
        variant: "destructive",
      });
    }
  };

  const uniqueStatuses = [...new Set(projects.map(p => p.project_status))];

  const filterOptions = [
    {
      key: 'status',
      label: '项目状态',
      type: 'select' as const,
      options: uniqueStatuses.map(status => ({ value: status, label: status }))
    }
  ];

  const sortOptions = [
    { key: 'created_at', label: '创建时间' },
    { key: 'start_date', label: '开始时间' },
    { key: 'name', label: '项目名称' },
    { key: 'manager', label: '负责人' }
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">项目管理</h1>
        {isAdmin && (
          <Button onClick={() => navigate('/m/projects/new')} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            新增
          </Button>
        )}
      </div>

      {/* 搜索和过滤 */}
      <MobileSearchBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        filters={filterOptions}
        activeFilters={{ status: filterStatus }}
        onFiltersChange={(filters) => setFilterStatus(filters.status || '')}
        sortOptions={sortOptions}
        activeSortBy={sortBy}
        activeSortOrder={sortOrder}
        onSortChange={(sortBy, order) => {
          setSortBy(sortBy);
          setSortOrder(order);
        }}
        placeholder="搜索项目名称、负责人或编号..."
      />

      {/* 项目列表 */}
      <div className="space-y-3">
        {filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">暂无项目</h3>
              <p className="text-muted-foreground mb-4">还没有创建任何项目</p>
              {isAdmin && (
                <Button onClick={() => navigate('/m/projects/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  创建第一个项目
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredProjects.map((project) => {
            const stats = projectStats[project.id] || {
              totalRecords: 0,
              totalWeight: 0,
              totalCost: 0,
              completionRate: 0
            };

            return (
              <MobileCard
                key={project.id}
                onClick={() => navigate(`/m/project/${project.id}`)}
                badge={{
                  text: project.project_status,
                  className: getStatusColor(project.project_status)
                }}
                onView={() => navigate(`/m/project/${project.id}`)}
                onEdit={isAdmin ? () => navigate(`/m/projects/edit/${project.id}`) : undefined}
                onDelete={isAdmin ? () => handleDelete(project.id) : undefined}
              >
                <div className="space-y-3">
                  {/* 项目基本信息 */}
                  <div>
                    <h3 className="font-semibold text-base mb-1">{project.name}</h3>
                    {project.auto_code && (
                      <p className="text-xs text-muted-foreground font-mono">{project.auto_code}</p>
                    )}
                  </div>

                  {/* 详细信息 */}
                  <div className="space-y-2">
                    <MobileInfoRow
                      icon={<User className="h-4 w-4" />}
                      value={project.manager}
                    />
                    
                    <MobileInfoRow
                      icon={<Calendar className="h-4 w-4" />}
                      value={`${format(new Date(project.start_date), 'yyyy-MM-dd')} ~ ${format(new Date(project.end_date), 'yyyy-MM-dd')}`}
                    />
                    
                    <MobileInfoRow
                      icon={<MapPin className="h-4 w-4" />}
                      value={`${project.loading_address.substring(0, 6)} → ${project.unloading_address.substring(0, 6)}`}
                    />

                    <MobileInfoRow
                      icon={<Package className="h-4 w-4" />}
                      value={project.cargo_type}
                    />
                  </div>

                  {/* 统计信息 */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-muted">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">运输次数</p>
                      <p className="text-sm font-semibold">{stats.totalRecords}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">总重量</p>
                      <p className="text-sm font-semibold">{stats.totalWeight.toFixed(1)}吨</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">总费用</p>
                      <p className="text-sm font-semibold">{formatCurrency(stats.totalCost)}</p>
                    </div>
                  </div>

                  {/* 完成度 */}
                  {project.planned_total_tons && (
                    <div className="pt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>完成度</span>
                        <span>{stats.completionRate.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(stats.completionRate, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </MobileCard>
            );
          })
        )}
      </div>
    </div>
  );
}