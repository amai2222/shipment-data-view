import React from 'react';
import { Badge } from '@/components/ui/badge';

// 格式化位置名称 - 根据最大长度截取
const formatLocationName = (location: string, maxLength: number = 2): string => {
  if (location.length <= maxLength) return location;
  return location.substring(0, maxLength);
};

// 紧凑模式：只显示前2个字符
const CompactRouteComponent = ({ loadingLocations, unloadingLocations }: { 
  loadingLocations: string[], 
  unloadingLocations: string[] 
}) => {
  const loadingDisplay = loadingLocations.length > 0 
    ? loadingLocations.slice(0, 2).map(loc => formatLocationName(loc)).join('/')
    : '--';
    
  const unloadingDisplay = unloadingLocations.length > 0 
    ? unloadingLocations.slice(0, 2).map(loc => formatLocationName(loc)).join('/')
    : '--';
    
  return (
    <span className="text-xs text-muted-foreground whitespace-nowrap">
      {loadingDisplay} → {unloadingDisplay}
      {(loadingLocations.length > 2 || unloadingLocations.length > 2) && (
        <span className="ml-1">+</span>
      )}
    </span>
  );
};

// 详细模式：显示完整路径
const DetailedRouteComponent = ({ loadingLocations, unloadingLocations }: { 
  loadingLocations: string[], 
  unloadingLocations: string[] 
}) => {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">装</Badge>
        <span className="text-sm">
          {loadingLocations.length > 0 ? loadingLocations.join(' / ') : '未指定'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">卸</Badge>
        <span className="text-sm">
          {unloadingLocations.length > 0 ? unloadingLocations.join(' / ') : '未指定'}
        </span>
      </div>
    </div>
  );
};

// 最小模式：只显示第一个字符
const MinimalRouteComponent = ({ loadingLocations, unloadingLocations }: { 
  loadingLocations: string[], 
  unloadingLocations: string[] 
}) => {
  const loadingFirst = loadingLocations.length > 0 ? formatLocationName(loadingLocations[0], 1) : '-';
  const unloadingFirst = unloadingLocations.length > 0 ? formatLocationName(unloadingLocations[0], 1) : '-';
  
  return (
    <span className="text-xs text-muted-foreground font-mono">
      {loadingFirst}→{unloadingFirst}
    </span>
  );
};

// 路径显示模式类型
export type RouteDisplayMode = 'compact' | 'detailed' | 'minimal';

// 路径显示组件属性
export interface RouteDisplayProps {
  loadingLocations: string | string[];
  unloadingLocations: string | string[];
  mode?: RouteDisplayMode;
  className?: string;
}

export function RouteDisplay({ 
  loadingLocations, 
  unloadingLocations, 
  mode = 'compact',
  className = ''
}: RouteDisplayProps) {
  // 确保位置数据是数组格式
  const loadingArray = Array.isArray(loadingLocations) 
    ? loadingLocations 
    : [loadingLocations].filter(Boolean);
  const unloadingArray = Array.isArray(unloadingLocations) 
    ? unloadingLocations 
    : [unloadingLocations].filter(Boolean);

  // 根据模式选择对应的组件
  const renderRoute = () => {
    switch (mode) {
      case 'compact':
        return <CompactRouteComponent loadingLocations={loadingArray} unloadingLocations={unloadingArray} />;
      case 'detailed':
        return <DetailedRouteComponent loadingLocations={loadingArray} unloadingLocations={unloadingArray} />;
      case 'minimal':
        return <MinimalRouteComponent loadingLocations={loadingArray} unloadingLocations={unloadingArray} />;
      default:
        return <CompactRouteComponent loadingLocations={loadingArray} unloadingLocations={unloadingArray} />;
    }
  };

  return (
    <div className={className}>
      {renderRoute()}
    </div>
  );
}