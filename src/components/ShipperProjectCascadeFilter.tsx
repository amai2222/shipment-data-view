// 货主-项目级联筛选器组件
// 支持树级展开货主，选择后自动显示关联项目

import { useState, useEffect, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { ChevronRight, ChevronDown, Users, Building2, Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Shipper {
  id: string;
  name: string;
  full_name: string;
  parent_partner_id: string | null;  // 正确的字段名！
  is_root?: boolean;
  partner_type?: string;
  children?: Shipper[];
  projects?: Project[];
}

interface Project {
  id: string;
  name: string;
  project_code?: string;  // 可选字段
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
  const [shipperOpen, setShipperOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set()); // ✅ 默认折叠（空Set）
  const [allShippers, setAllShippers] = useState<Shipper[]>([]); // 保存完整的货主列表用于搜索

  // 加载货主数据（树形结构）
  useEffect(() => {
    const loadShippers = async () => {
      try {
        setLoading(true);

        // 获取所有货主（使用正确的字段名）
        const { data: shipperData, error } = await supabase
          .from('partners')
          .select('*')
          .eq('partner_type', '货主')
          .order('name');

        if (error) {
          console.error('加载货主失败:', error);
          throw error;
        }

        console.log('加载的货主数据:', shipperData);

        // 构建树形结构
        const shipperMap = new Map<string, Shipper>();
        const rootShippers: Shipper[] = [];

        // 第一遍：创建映射
        (shipperData as any[] || []).forEach((s: any) => {
          shipperMap.set(s.id, {
            ...s,
            children: []
          });
        });

        // 第二遍：构建树形关系（使用 parent_partner_id）
        (shipperData as any[] || []).forEach((s: any) => {
          const shipper = shipperMap.get(s.id)!;
          if (s.parent_partner_id) {
            const parent = shipperMap.get(s.parent_partner_id);
            if (parent) {
              parent.children = parent.children || [];
              parent.children.push(shipper);
            } else {
              // 有parent_id但找不到父节点，视为根节点
              rootShippers.push(shipper);
            }
          } else {
            // 无parent_id，是根节点
            rootShippers.push(shipper);
          }
        });

        setShippers(rootShippers);
        
        // 保存所有货主（扁平列表，用于搜索）
        const allShippersList = shipperData || [];
        setAllShippers(allShippersList as Shipper[]);
        
        console.log('构建的树形货主:', rootShippers);
        console.log('所有货主（扁平）:', allShippersList);

      } catch (error) {
        console.error('加载货主数据失败:', error);
        setShippers([]);
        setAllShippers([]);
      } finally {
        setLoading(false);
      }
    };

    loadShippers();
  }, []);

  // 根据选中的货主加载项目列表（包含本级和所有下级货主的项目）
  useEffect(() => {
    const loadProjects = async () => {
      // ✅ 如果选择了"全部"或未选择，加载所有项目
      if (!selectedShipperId || selectedShipperId === 'all') {
        const { data } = await supabase
          .from('projects')
          .select('id, name')
          .order('name');
        
        setProjects(data || []);
        return;
      }

      // ✅ 如果 allShippers 还未加载完成，等待
      if (allShippers.length === 0) {
        console.log('等待货主数据加载完成...');
        return;
      }

      try {
        console.log('开始加载货主的项目（包含下级），货主ID:', selectedShipperId);
        
        // ✅ 第一步：使用递归查询获取所有下级货主ID（包括本级）
        const getAllSubordinateIds = (shipperId: string): string[] => {
          // 递归查找所有下级货主
          const findSubordinates = (parentId: string, visited: Set<string> = new Set()): string[] => {
            if (visited.has(parentId)) {
              return []; // 防止循环引用
            }
            visited.add(parentId);
            
            const result = [parentId]; // 包含本级
            
            // 查找直接下级（从 allShippers 扁平列表中查找）
            const children = allShippers.filter(s => s.parent_partner_id === parentId);
            for (const child of children) {
              result.push(...findSubordinates(child.id, visited));
            }
            
            return result;
          };
          
          return findSubordinates(shipperId);
        };
        
        // 获取所有相关货主ID（本级 + 所有下级）
        const allShipperIds = getAllSubordinateIds(selectedShipperId);
        console.log('相关货主ID列表（本级+下级）:', allShipperIds);
        
        // ✅ 如果没有找到任何相关货主，返回空列表
        if (allShipperIds.length === 0) {
          console.warn('未找到相关货主，返回空项目列表');
          setProjects([]);
          onProjectChange('all');
          return;
        }
        
        // ✅ 第二步：查询这些货主关联的所有项目（只查询这些货主的项目）
        const { data, error } = await supabase
          .from('project_partners')
          .select(`
            project_id,
            projects (
              id,
              name
            )
          `)
          .in('partner_id', allShipperIds); // ✅ 只查询这些货主的项目

        console.log('project_partners 查询结果:', data, error);

        if (error) {
          console.error('查询 project_partners 失败:', error);
          throw error;
        }

        const projectList = data
          ?.map(pp => pp.projects)
          .filter(Boolean)
          .flat() as Project[];

        console.log('提取的项目列表（包含下级）:', projectList);

        // ✅ 第三步：去重（根据项目ID）
        const uniqueProjects = Array.from(
          new Map(projectList.map(p => [p.id, p])).values()
        );

        console.log('去重后的项目列表（仅包含该货主及其下级）:', uniqueProjects);

        // ✅ 只设置这些项目，不包含其他货主的项目
        setProjects(uniqueProjects || []);

        // ✅ 默认选择"所有项目"（表示该货主及其下级的所有项目）
        // 不自动选择第一个项目，让用户看到"所有项目"选项
        onProjectChange('all');

      } catch (error) {
        console.error('加载项目失败:', error);
        setProjects([]);
        onProjectChange('all');
      }
    };

    loadProjects();
  }, [selectedShipperId, allShippers]);

  // 扁平化货主列表（用于下拉框，支持展开/折叠）
  const flattenShippers = (shipperList: Shipper[], level = 0): (Shipper & { level: number })[] => {
    const result: (Shipper & { level: number })[] = [];
    
    shipperList.forEach(shipper => {
      result.push({ ...shipper, level });
      // 只有展开状态才显示子货主
      if (shipper.children && shipper.children.length > 0 && expandedIds.has(shipper.id)) {
        result.push(...flattenShippers(shipper.children, level + 1));
      }
    });
    
    return result;
  };

  // 搜索时使用所有货主（不受展开/折叠限制）
  const getSearchableShippers = (): (Shipper & { level: number })[] => {
    const buildLevel = (shipperList: Shipper[], level = 0): (Shipper & { level: number })[] => {
      const result: (Shipper & { level: number })[] = [];
      shipperList.forEach(shipper => {
        result.push({ ...shipper, level });
        if (shipper.children && shipper.children.length > 0) {
          result.push(...buildLevel(shipper.children, level + 1));
        }
      });
      return result;
    };
    return buildLevel(shippers);
  };

  // 切换展开/折叠
  const toggleExpand = (shipperId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds(prev => {
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
      const isExpanded = expandedIds.has(shipper.id);
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
                  toggleExpand(shipper.id, e);
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
            <span className="flex-1 text-sm">{shipper.name}</span>
            
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
      {/* 货主筛选（可搜索的Combobox） */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          货主筛选
        </Label>
        <Popover open={shipperOpen} onOpenChange={setShipperOpen}>
          <PopoverTrigger asChild>
            <div className="relative cursor-pointer">
              <Input
                value={(!selectedShipperId || selectedShipperId === 'all')
                  ? '全部货主'  // ✅ 选择"全部货主"时显示"全部货主"
                  : allShippers.find(s => s.id === selectedShipperId)?.name || ''}
                placeholder="选择货主..."
                readOnly
                className="h-10 cursor-pointer pr-8"
                onClick={() => setShipperOpen(true)}
              />
              <ChevronsUpDown className="absolute right-3 top-3 h-4 w-4 opacity-50" />
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0">
            <Command shouldFilter={true} filter={(value, search) => {
              // 自定义过滤逻辑：确保"全部货主"总是显示
              if (value === '全部货主') {
                return !search || '全部货主'.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
              }
              // 其他项使用默认过滤
              return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
            }}>
              <CommandInput 
                placeholder="输入货主名称搜索..." 
                className="h-10"
                value={searchValue}
                onValueChange={setSearchValue}
              />
              <CommandEmpty>未找到匹配的货主</CommandEmpty>
              <CommandGroup className="max-h-96 overflow-y-auto p-2">
                {/* ✅ 添加"全部货主"选项（始终显示在顶部） */}
                <CommandItem
                  value="全部货主"
                  onSelect={() => {
                    onShipperChange('all');
                    setShipperOpen(false);
                    setSearchValue('');
                  }}
                  className={cn(
                    "flex items-center cursor-pointer",
                    (!selectedShipperId || selectedShipperId === 'all') && "bg-blue-50"
                  )}
                >
                  <div className="flex items-center gap-1 flex-1">
                    <div className="w-5" />
                    <Check
                      className={cn(
                        "h-4 w-4 text-blue-600",
                        (!selectedShipperId || selectedShipperId === 'all') ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1 text-sm font-medium">全部货主</span>
                  </div>
                </CommandItem>
                
                {/* 分隔线（只在有货主列表时显示） */}
                {((searchValue ? getSearchableShippers() : flattenShippers(shippers)).length > 0) && (
                  <div className="h-px bg-gray-200 my-1" />
                )}
                
                {/* ✅ 有搜索时显示所有匹配的货主，无搜索时显示折叠的树（默认折叠） */}
                {(searchValue ? getSearchableShippers() : flattenShippers(shippers)).map((shipper) => {
                  const hasChildren = shipper.children && shipper.children.length > 0;
                  const isExpanded = expandedIds.has(shipper.id);
                  const isSelected = selectedShipperId === shipper.id;
                  
                  return (
                    <div key={shipper.id} className="relative">
                      <CommandItem
                        value={shipper.name}
                        onSelect={() => {
                          onShipperChange(shipper.id);
                          setShipperOpen(false);
                          setSearchValue(''); // 选择后清空搜索
                        }}
                        className={cn(
                          "flex items-center cursor-pointer",
                          isSelected && "bg-blue-50"
                        )}
                      >
                        <div className="flex items-center gap-1 flex-1" style={{ paddingLeft: `${shipper.level * 16}px` }}>
                          {/* 展开/折叠箭头 */}
                          {hasChildren ? (
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(shipper.id, e);
                              }}
                              className="cursor-pointer hover:bg-gray-200 rounded p-0.5 mr-1"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </div>
                          ) : (
                            <div className="w-5" />
                          )}
                          
                          {/* 选中标记 */}
                          <Check
                            className={cn(
                              "h-4 w-4 text-blue-600",
                              isSelected ? "opacity-100" : "opacity-0"
                            )}
                          />
                          
                          {/* 货主名称 */}
                          <span className="flex-1 text-sm">{shipper.name}</span>
                          
                          {/* 子货主数量 */}
                          {hasChildren && (
                            <Badge variant="outline" className="text-xs ml-2">
                              {shipper.children.length}
                            </Badge>
                          )}
                        </div>
                      </CommandItem>
                    </div>
                  );
                })}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* 项目筛选 */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          项目筛选
          <span className="text-xs text-muted-foreground">
            （{projects.length} 个项目）
          </span>
        </Label>
        <Select value={selectedProjectId} onValueChange={onProjectChange}>
          <SelectTrigger className="h-10">
            <SelectValue placeholder={projects.length > 0 ? "选择项目" : "请先选择货主"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有项目</SelectItem>
            {projects.length === 0 && selectedShipperId !== 'all' && (
              <div className="px-2 py-1 text-sm text-muted-foreground">
                该货主暂无关联项目
              </div>
            )}
            {projects.map((project, index) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
                {project.project_code ? (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({project.project_code})
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground ml-2">
                    (#{index + 1})
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

