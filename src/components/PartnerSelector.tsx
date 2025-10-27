// src/components/PartnerSelector.tsx
// 合作方选择组件 - 支持按类型分类和货主层级树展示

import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Building2, Users, Landmark, Home } from 'lucide-react';
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export interface PartnerOption {
  id: string;
  name: string;
  taxRate: number;
  partnerType?: '货主' | '合作商' | '资方' | '本公司';
  parentPartnerId?: string | null;
  hierarchyPath?: string;
  hierarchyDepth?: number;
  isRoot?: boolean;
}

interface PartnerSelectorProps {
  value: string;
  onChange: (value: string) => void;
  partners: PartnerOption[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

// 货主树节点接口
interface OwnerTreeNode extends PartnerOption {
  children: OwnerTreeNode[];
  level: number;
}

export function PartnerSelector({
  value,
  onChange,
  partners,
  disabled = false,
  placeholder = '请选择合作方',
  className = '',
}: PartnerSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>('owner');

  // 按类型分组合作方
  const groupedPartners = useMemo(() => {
    const groups: Record<string, PartnerOption[]> = {
      owner: [],      // 货主
      partner: [],    // 合作商
      financier: [],  // 资方
      company: []     // 本公司
    };

    partners.forEach(p => {
      const type = p.partnerType || '货主';
      switch (type) {
        case '货主':
          groups.owner.push(p);
          break;
        case '合作商':
          groups.partner.push(p);
          break;
        case '资方':
          groups.financier.push(p);
          break;
        case '本公司':
          groups.company.push(p);
          break;
      }
    });

    return groups;
  }, [partners]);

  // 构建货主层级树
  const ownerTree = useMemo(() => {
    const owners = groupedPartners.owner;
    if (owners.length === 0) return [];

    // 创建节点映射
    const nodeMap = new Map<string, OwnerTreeNode>();
    owners.forEach(owner => {
      nodeMap.set(owner.id, {
        ...owner,
        children: [],
        level: owner.hierarchyDepth || 0
      });
    });

    // 构建树结构
    const roots: OwnerTreeNode[] = [];
    nodeMap.forEach(node => {
      if (!node.parentPartnerId || !nodeMap.has(node.parentPartnerId)) {
        // 根节点
        roots.push(node);
      } else {
        // 添加到父节点的 children
        const parent = nodeMap.get(node.parentPartnerId);
        if (parent) {
          parent.children.push(node);
        }
      }
    });

    // 按名称排序
    const sortByName = (a: OwnerTreeNode, b: OwnerTreeNode) => a.name.localeCompare(b.name, 'zh-CN');
    
    const sortTree = (nodes: OwnerTreeNode[]) => {
      nodes.sort(sortByName);
      nodes.forEach(node => {
        if (node.children.length > 0) {
          sortTree(node.children);
        }
      });
    };

    sortTree(roots);
    return roots;
  }, [groupedPartners.owner]);

  // 获取选中的合作方信息
  const selectedPartner = useMemo(() => {
    return partners.find(p => p.id === value);
  }, [partners, value]);

  // 切换节点展开/折叠
  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  // 全部展开
  const expandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (nodes: OwnerTreeNode[]) => {
      nodes.forEach(node => {
        if (node.children.length > 0) {
          allIds.add(node.id);
          collectIds(node.children);
        }
      });
    };
    collectIds(ownerTree);
    setExpandedNodes(allIds);
  };

  // 全部折叠
  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  // 渲染货主树节点
  const renderOwnerTreeNode = (node: OwnerTreeNode, depth: number = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = value === node.id;
    const indent = depth * 20;

    return (
      <div key={node.id} className="w-full">
        <div
          className={`flex items-center py-2 px-2 hover:bg-muted/50 cursor-pointer rounded-sm ${
            isSelected ? 'bg-primary/10 border-l-2 border-primary' : ''
          }`}
          style={{ paddingLeft: `${indent + 8}px` }}
          onClick={() => onChange(node.id)}
        >
          {/* 展开/折叠图标 */}
          <div className="w-5 h-5 flex items-center justify-center mr-1">
            {hasChildren && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNode(node.id);
                }}
                className="hover:bg-muted rounded p-0.5"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            )}
          </div>

          {/* 货主信息 */}
          <div className="flex-1 flex items-center justify-between min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span className="text-sm truncate">{node.name}</span>
              {node.isRoot && (
                <Badge variant="outline" className="text-xs">根</Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
              {(node.taxRate * 100).toFixed(2)}%
            </span>
          </div>
        </div>

        {/* 子节点 */}
        {hasChildren && isExpanded && (
          <div className="ml-0">
            {node.children.map(child => renderOwnerTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // 渲染普通列表（合作商、资方、本公司）
  const renderPartnerList = (partnerList: PartnerOption[]) => {
    if (partnerList.length === 0) {
      return (
        <div className="py-8 text-center text-sm text-muted-foreground">
          暂无此类型的合作方
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {partnerList
          .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
          .map(partner => {
            const isSelected = value === partner.id;
            return (
              <div
                key={partner.id}
                className={`flex items-center justify-between py-2 px-3 hover:bg-muted/50 cursor-pointer rounded-sm ${
                  isSelected ? 'bg-primary/10 border-l-2 border-primary' : ''
                }`}
                onClick={() => onChange(partner.id)}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Users className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <span className="text-sm truncate">{partner.name}</span>
                </div>
                <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                  {(partner.taxRate * 100).toFixed(2)}%
                </span>
              </div>
            );
          })}
      </div>
    );
  };

  // 获取类型图标
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'owner':
        return <Building2 className="h-4 w-4" />;
      case 'partner':
        return <Users className="h-4 w-4" />;
      case 'financier':
        return <Landmark className="h-4 w-4" />;
      case 'company':
        return <Home className="h-4 w-4" />;
      default:
        return <Building2 className="h-4 w-4" />;
    }
  };

  // 获取类型统计
  const getTypeCount = (type: string) => {
    return groupedPartners[type]?.length || 0;
  };

  return (
    <Select open={isOpen} onOpenChange={setIsOpen} value={value} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue>
          {selectedPartner ? (
            <div className="flex items-center gap-2">
              <span>{selectedPartner.name}</span>
              <span className="text-xs text-muted-foreground">
                (税点: {(selectedPartner.taxRate * 100).toFixed(2)}%)
              </span>
            </div>
          ) : (
            placeholder
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-[400px] p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b">
            <TabsList className="w-full justify-start rounded-none h-auto p-1 bg-transparent">
              <TabsTrigger 
                value="owner" 
                className="flex items-center gap-2 data-[state=active]:bg-muted"
              >
                {getTypeIcon('owner')}
                <span>货主</span>
                <Badge variant="secondary" className="ml-1">{getTypeCount('owner')}</Badge>
              </TabsTrigger>
              <TabsTrigger 
                value="partner"
                className="flex items-center gap-2 data-[state=active]:bg-muted"
              >
                {getTypeIcon('partner')}
                <span>合作商</span>
                <Badge variant="secondary" className="ml-1">{getTypeCount('partner')}</Badge>
              </TabsTrigger>
              <TabsTrigger 
                value="financier"
                className="flex items-center gap-2 data-[state=active]:bg-muted"
              >
                {getTypeIcon('financier')}
                <span>资方</span>
                <Badge variant="secondary" className="ml-1">{getTypeCount('financier')}</Badge>
              </TabsTrigger>
              <TabsTrigger 
                value="company"
                className="flex items-center gap-2 data-[state=active]:bg-muted"
              >
                {getTypeIcon('company')}
                <span>本公司</span>
                <Badge variant="secondary" className="ml-1">{getTypeCount('company')}</Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 货主标签页 - 树型结构 */}
          <TabsContent value="owner" className="m-0 p-2">
            {ownerTree.length > 0 && (
              <div className="flex justify-end gap-2 mb-2 px-2">
                <button
                  type="button"
                  onClick={expandAll}
                  className="text-xs text-primary hover:underline"
                >
                  全部展开
                </button>
                <span className="text-xs text-muted-foreground">|</span>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="text-xs text-primary hover:underline"
                >
                  全部折叠
                </button>
              </div>
            )}
            <ScrollArea className="h-[300px]">
              {ownerTree.length > 0 ? (
                <div className="space-y-0.5">
                  {ownerTree.map(node => renderOwnerTreeNode(node))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  暂无货主类型的合作方
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* 合作商标签页 */}
          <TabsContent value="partner" className="m-0 p-2">
            <ScrollArea className="h-[300px]">
              {renderPartnerList(groupedPartners.partner)}
            </ScrollArea>
          </TabsContent>

          {/* 资方标签页 */}
          <TabsContent value="financier" className="m-0 p-2">
            <ScrollArea className="h-[300px]">
              {renderPartnerList(groupedPartners.financier)}
            </ScrollArea>
          </TabsContent>

          {/* 本公司标签页 */}
          <TabsContent value="company" className="m-0 p-2">
            <ScrollArea className="h-[300px]">
              {renderPartnerList(groupedPartners.company)}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SelectContent>
    </Select>
  );
}

