// 货主-项目级联筛选器组件
// 支持树级展开货主，选择后自动显示关联项目

import { useState, useEffect, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { ChevronRight, ChevronDown, Users, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface Shipper {
  id: string;
  partner_name: string;
  partner_full_name: string;
  parent_id: string | null;
  children?: Shipper[];
  projects?: Project[];
}

interface Project {
  id: string;
  name: string;
  project_code: string;
}

interface ShipperProjectCascadeFilterProps {
  selectedShipperId: string;
  selectedProjectId: string;
  onShipperChange: (shipperId: string) => void;
  onProjectChange: (projectId: string) => void;
  className?: string;
}

export function ShipperProjectCascadeFilter({
  selectedShipperId,
  selectedProjectId,
  onShipperChange,
  onProjectChange,
  className = ''
}: ShipperProjectCascadeFilterProps) {
  const [shippers, setShippers] = useState<Shipper[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedShippers, setExpandedShippers] = useState<Set<string>>(new Set());

  // 加载货主数据（树形结构）
  useEffect(() => {
    const loadShippers = async () => {
      try {
        setLoading(true);

        // 获取所有货主
        const { data: shipperData, error } = await supabase
          .from('partners')
          .select('id, partner_name, partner_full_name, parent_id')
          .eq('partner_type', '货主')
          .order('partner_name');

        if (error) throw error;

        // 构建树形结构
        const shipperMap = new Map<string, Shipper>();
        const rootShippers: Shipper[] = [];

        // 第一遍：创建映射
        shipperData?.forEach(s => {
          shipperMap.set(s.id, {
            ...s,
            children: []
          });
        });

        // 第二遍：构建树形关系
        shipperData?.forEach(s => {
          const shipper = shipperMap.get(s.id)!;
          if (s.parent_id) {
            const parent = shipperMap.get(s.parent_id);
            if (parent) {
              parent.children = parent.children || [];
              parent.children.push(shipper);
            } else {
              rootShippers.push(shipper);
            }
          } else {
            rootShippers.push(shipper);
          }
        });

        setShippers(rootShippers);

      } catch (error) {
        console.error('加载货主数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadShippers();
  }, []);

  // 根据选中的货主加载项目列表
  useEffect(() => {
    const loadProjects = async () => {
      if (!selectedShipperId || selectedShipperId === 'all') {
        // 加载所有项目
        const { data } = await supabase
          .from('projects')
          .select('id, name, project_code')
          .order('name');
        
        setProjects(data || []);
        return;
      }

      try {
        // 获取该货主关联的项目
        const { data, error } = await supabase
          .from('project_partners')
          .select(`
            project_id,
            projects (
              id,
              name,
              project_code
            )
          `)
          .eq('partner_id', selectedShipperId);

        if (error) throw error;

        const projectList = data
          ?.map(pp => pp.projects)
          .filter(Boolean)
          .flat() as Project[];

        setProjects(projectList || []);

        // 如果当前选中的项目不在新列表中，清空选择
        if (selectedProjectId && !projectList.find(p => p.id === selectedProjectId)) {
          onProjectChange('all');
        }

      } catch (error) {
        console.error('加载项目失败:', error);
        setProjects([]);
      }
    };

    loadProjects();
  }, [selectedShipperId]);

  // 切换展开/收起
  const toggleExpand = (shipperId: string) => {
    setExpandedShippers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(shipperId)) {
        newSet.delete(shipperId);
      } else {
        newSet.add(shipperId);
      }
      return newSet;
    });
  };

  // 渲染货主树形选项
  const renderShipperTree = (shipperList: Shipper[], level = 0) => {
    return shipperList.map(shipper => {
      const hasChildren = shipper.children && shipper.children.length > 0;
      const isExpanded = expandedShippers.has(shipper.id);
      const isSelected = selectedShipperId === shipper.id;

      return (
        <div key={shipper.id}>
          <div
            className={`
              flex items-center gap-2 px-3 py-2 cursor-pointer rounded-lg transition-colors
              ${isSelected ? 'bg-blue-100 text-blue-900 font-medium' : 'hover:bg-gray-100'}
            `}
            style={{ paddingLeft: `${level * 20 + 12}px` }}
            onClick={() => onShipperChange(shipper.id)}
          >
            {hasChildren && (
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(shipper.id);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </Button>
            )}
            {!hasChildren && <div className="w-4" />}
            
            <Users className="h-3.5 w-3.5" />
            <span className="flex-1 text-sm">{shipper.partner_name}</span>
            
            {hasChildren && (
              <Badge variant="secondary" className="text-xs">
                {shipper.children.length}
              </Badge>
            )}
          </div>

          {hasChildren && isExpanded && (
            <div className="mt-1">
              {renderShipperTree(shipper.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
        <div className="space-y-2">
          <Label>货主筛选</Label>
          <div className="text-sm text-muted-foreground">加载中...</div>
        </div>
        <div className="space-y-2">
          <Label>项目筛选</Label>
          <div className="text-sm text-muted-foreground">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      {/* 货主筛选（树形） */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          货主筛选
          {selectedShipperId && selectedShipperId !== 'all' && (
            <Badge variant="secondary" className="text-xs">
              已筛选
            </Badge>
          )}
        </Label>
        <div className="border rounded-lg p-2 max-h-64 overflow-y-auto bg-white">
          {/* 全部选项 */}
          <div
            className={`
              flex items-center gap-2 px-3 py-2 cursor-pointer rounded-lg transition-colors mb-1
              ${selectedShipperId === 'all' ? 'bg-blue-100 text-blue-900 font-medium' : 'hover:bg-gray-100'}
            `}
            onClick={() => onShipperChange('all')}
          >
            <Users className="h-3.5 w-3.5" />
            <span className="text-sm">所有货主</span>
          </div>

          {/* 树形货主列表 */}
          {renderShipperTree(shippers)}
        </div>
      </div>

      {/* 项目筛选 */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          项目筛选
          {selectedShipperId && selectedShipperId !== 'all' && (
            <span className="text-xs text-muted-foreground">
              （{projects.length} 个项目）
            </span>
          )}
        </Label>
        <Select value={selectedProjectId} onValueChange={onProjectChange}>
          <SelectTrigger>
            <SelectValue placeholder="选择项目" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有项目</SelectItem>
            {projects.map(project => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
                {project.project_code && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({project.project_code})
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

