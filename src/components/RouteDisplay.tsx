import React from 'react';
import { Badge } from '@/components/ui/badge';
import { MapPin, ArrowRight } from 'lucide-react';

interface RouteDisplayProps {
  loadingLocation: string | null | undefined;
  unloadingLocation: string | null | undefined;
  variant?: 'compact' | 'detailed' | 'minimal';
  maxLocations?: number;
  className?: string;
}

// 解析多地点字符串
const parseLocations = (locationString: string | null | undefined): string[] => {
  if (!locationString) return [];
  return locationString.split('|').map(loc => loc.trim()).filter(loc => loc.length > 0);
};

// 格式化地点显示（截取前几个字符）
const formatLocationName = (location: string, maxLength: number = 2): string => {
  if (location.length <= maxLength) return location;
  return location.substring(0, maxLength);
};


// 详细模式：显示完整地点名称
const DetailedRoute = ({ loadingLocations, unloadingLocations, maxLocations = 3 }: { 
  loadingLocations: string[], 
  unloadingLocations: string[],
  maxLocations?: number
}) => {
  const displayLoading = loadingLocations.slice(0, maxLocations);
  const displayUnloading = unloadingLocations.slice(0, maxLocations);
  const hasMoreLoading = loadingLocations.length > maxLocations;
  const hasMoreUnloading = unloadingLocations.length > maxLocations;

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex flex-wrap gap-1">
        {displayLoading.map((loc, index) => (
          <Badge key={index} variant="secondary" className="text-xs">
            {loc}
          </Badge>
        ))}
        {hasMoreLoading && (
          <Badge variant="outline" className="text-xs">
            +{loadingLocations.length - maxLocations}
          </Badge>
        )}
      </div>
      
      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      
      <div className="flex flex-wrap gap-1">
        {displayUnloading.map((loc, index) => (
          <Badge key={index} variant="outline" className="text-xs">
            {loc}
          </Badge>
        ))}
        {hasMoreUnloading && (
          <Badge variant="outline" className="text-xs">
            +{unloadingLocations.length - maxLocations}
          </Badge>
        )}
      </div>
    </div>
  );
};

// 最小模式：只显示箭头和地点数量
const MinimalRoute = ({ loadingLocations, unloadingLocations }: { 
  loadingLocations: string[], 
  unloadingLocations: string[] 
}) => {
  const loadingCount = loadingLocations.length;
  const unloadingCount = unloadingLocations.length;
  
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <MapPin className="h-3 w-3" />
      <span>{loadingCount}装</span>
      <ArrowRight className="h-3 w-3" />
      <span>{unloadingCount}卸</span>
    </div>
  );
};

export function RouteDisplay({ 
  loadingLocation, 
  unloadingLocation, 
  variant = 'compact',
  maxLocations = 3,
  className = ''
}: RouteDisplayProps) {
  const loadingLocations = parseLocations(loadingLocation);
  const unloadingLocations = parseLocations(unloadingLocation);

  // 如果没有地点信息
  if (loadingLocations.length === 0 && unloadingLocations.length === 0) {
    return (
      <div className={`text-muted-foreground text-sm ${className}`}>
        未填写路线
      </div>
    );
  }

  const routeProps = { loadingLocations, unloadingLocations, maxLocations };

  return (
    <div className={className}>
      {variant === 'compact' && <CompactRoute {...routeProps} />}
      {variant === 'detailed' && <DetailedRoute {...routeProps} />}
      {variant === 'minimal' && <MinimalRoute {...routeProps} />}
    </div>
  );
}

// 导出便捷的预设组件
export const CompactRoute = (props: Omit<RouteDisplayProps, 'variant'>) => (
  <RouteDisplay {...props} variant="compact" />
);

export const DetailedRoute = (props: Omit<RouteDisplayProps, 'variant'>) => (
  <RouteDisplay {...props} variant="detailed" />
);

export const MinimalRoute = (props: Omit<RouteDisplayProps, 'variant'>) => (
  <RouteDisplay {...props} variant="minimal" />
);
