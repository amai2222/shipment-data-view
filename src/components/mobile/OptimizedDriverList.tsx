import React, { useMemo, memo, useCallback } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { DriverReportRow } from '@/services/DashboardDataService';
import { formatNumber } from '@/services/DashboardDataService';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

// 司机列表配置接口
interface DriverListConfig {
  unit: string;
  billingTypeId: number;
  showExport?: boolean;
  showSort?: boolean;
  maxHeight?: number;
  minHeight?: number;
}

// 司机行组件
interface DriverRowProps {
  driver: DriverReportRow;
  config: DriverListConfig;
}

const DriverRow = memo<DriverRowProps>(({ driver, config }) => {
  const { unit, billingTypeId } = config;
  
  return (
    <div className="p-2">
      <div className="p-3 bg-muted/50 rounded-lg space-y-2">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-medium text-sm">{driver.driver_name}</p>
            <p className="text-xs text-muted-foreground">
              {driver.license_plate || 'N/A'} • {driver.phone || 'N/A'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">今日: {driver.daily_trip_count}车</p>
            <p className="text-xs text-muted-foreground">总计: {driver.total_trip_count}车</p>
          </div>
        </div>
        
        {billingTypeId !== 2 && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">运输量</span>
            <span>{formatNumber(driver.total_tonnage, unit)}</span>
          </div>
        )}
        
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">司机应收</span>
          <span className="text-green-600 font-medium">
            {formatNumber(driver.total_driver_receivable, '元')}
          </span>
        </div>
      </div>
    </div>
  );
});

DriverRow.displayName = 'DriverRow';

// 优化的司机列表组件
interface OptimizedDriverListProps {
  drivers: DriverReportRow[];
  config: DriverListConfig;
  sortKey?: 'daily' | 'total' | 'amount';
  sortAsc?: boolean;
  onSortChange?: (key: 'daily' | 'total' | 'amount') => void;
  onSortDirectionChange?: (asc: boolean) => void;
  onExport?: () => void;
}

export const OptimizedDriverList = memo<OptimizedDriverListProps>(({
  drivers,
  config,
  sortKey = 'total',
  sortAsc = false,
  onSortChange,
  onSortDirectionChange,
  onExport
}) => {
  // 缓存排序后的司机数据
  const sortedDrivers = useMemo(() => {
    if (!drivers || drivers.length === 0) return [];
    
    const getValue = (key: 'daily' | 'total' | 'amount', driver: DriverReportRow) => {
      switch (key) {
        case 'daily':
          return driver.daily_trip_count;
        case 'total':
          return driver.total_trip_count;
        case 'amount':
          return driver.total_driver_receivable;
        default:
          return 0;
      }
    };
    
    return [...drivers].sort((a, b) => {
      const diff = getValue(sortKey, b) - getValue(sortKey, a);
      return sortAsc ? -diff : diff;
    });
  }, [drivers, sortKey, sortAsc]);

  // 缓存列表高度计算
  const listHeight = useMemo(() => {
    const itemHeight = config.billingTypeId === 2 ? 80 : 100;
    const calculatedHeight = sortedDrivers.length * itemHeight;
    const maxHeight = config.maxHeight || 400;
    const minHeight = config.minHeight || 200;
    
    return Math.min(maxHeight, Math.max(minHeight, calculatedHeight));
  }, [sortedDrivers.length, config]);

  // 缓存行高
  const itemSize = useMemo(() => {
    return config.billingTypeId === 2 ? 80 : 100;
  }, [config.billingTypeId]);

  // 缓存列表项数据
  const itemData = useMemo(() => ({
    drivers: sortedDrivers,
    config
  }), [sortedDrivers, config]);

  // 缓存导出功能
  const handleExport = useCallback(() => {
    if (!onExport) return;
    
    const header = ['司机', '车牌', '电话', '今日车次', '总车次', '总运量', '司机应收'];
    const csv = [header.join(',')].concat(
      sortedDrivers.map(driver => [
        driver.driver_name,
        driver.license_plate || '',
        driver.phone || '',
        driver.daily_trip_count,
        driver.total_trip_count,
        driver.total_tonnage,
        driver.total_driver_receivable
      ].join(','))
    ).join('\n');
    
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `司机排行_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    onExport();
  }, [sortedDrivers, onExport]);

  // 列表项渲染函数
  const renderItem = useCallback(({ index, style, data }: ListChildComponentProps) => {
    const { drivers: driverList, config: driverConfig } = data as {
      drivers: DriverReportRow[];
      config: DriverListConfig;
    };
    
    const driver = driverList[index];
    
    return (
      <div style={style}>
        <DriverRow driver={driver} config={driverConfig} />
      </div>
    );
  }, []);

  if (!sortedDrivers || sortedDrivers.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        暂无司机数据
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 排序和导出控制 */}
      {(config.showSort || config.showExport) && (
        <div className="flex items-center gap-2">
          {config.showSort && onSortChange && (
            <>
              <Select value={sortKey} onValueChange={onSortChange}>
                <SelectTrigger className="h-8 w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">按今日车次</SelectItem>
                  <SelectItem value="total">按总车次</SelectItem>
                  <SelectItem value="amount">按司机应收</SelectItem>
                </SelectContent>
              </Select>
              
              {onSortDirectionChange && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => onSortDirectionChange(!sortAsc)}
                >
                  {sortAsc ? '升序' : '降序'}
                </Button>
              )}
            </>
          )}
          
          {config.showExport && (
            <Button size="sm" onClick={handleExport}>
              导出CSV
            </Button>
          )}
        </div>
      )}

      {/* 虚拟滚动列表 */}
      <List
        height={listHeight}
        itemCount={sortedDrivers.length}
        itemSize={itemSize}
        width="100%"
        itemData={itemData}
      >
        {renderItem}
      </List>
    </div>
  );
});

OptimizedDriverList.displayName = 'OptimizedDriverList';

// 优化的司机统计组件
interface OptimizedDriverStatsProps {
  drivers: DriverReportRow[];
  config: DriverListConfig;
}

export const OptimizedDriverStats = memo<OptimizedDriverStatsProps>(({
  drivers,
  config
}) => {
  // 缓存统计数据
  const stats = useMemo(() => {
    if (!drivers || drivers.length === 0) {
      return {
        totalDrivers: 0,
        totalDailyTrips: 0,
        totalTrips: 0,
        totalTonnage: 0,
        totalReceivable: 0,
        avgDailyTrips: 0,
        avgReceivable: 0
      };
    }

    const totalDailyTrips = drivers.reduce((sum, driver) => sum + driver.daily_trip_count, 0);
    const totalTrips = drivers.reduce((sum, driver) => sum + driver.total_trip_count, 0);
    const totalTonnage = drivers.reduce((sum, driver) => sum + driver.total_tonnage, 0);
    const totalReceivable = drivers.reduce((sum, driver) => sum + driver.total_driver_receivable, 0);

    return {
      totalDrivers: drivers.length,
      totalDailyTrips,
      totalTrips,
      totalTonnage,
      totalReceivable,
      avgDailyTrips: totalDailyTrips / drivers.length,
      avgReceivable: totalReceivable / drivers.length
    };
  }, [drivers]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
      <div className="text-center">
        <p className="text-lg font-bold text-foreground">{stats.totalDrivers}</p>
        <p className="text-xs text-muted-foreground">司机总数</p>
      </div>
      
      <div className="text-center">
        <p className="text-lg font-bold text-primary">{stats.totalDailyTrips}</p>
        <p className="text-xs text-muted-foreground">今日车次</p>
      </div>
      
      <div className="text-center">
        <p className="text-lg font-bold text-green-600">
          {formatNumber(stats.totalReceivable, '元')}
        </p>
        <p className="text-xs text-muted-foreground">总应收</p>
      </div>
      
      <div className="text-center">
        <p className="text-lg font-bold text-blue-600">
          {formatNumber(stats.avgReceivable, '元')}
        </p>
        <p className="text-xs text-muted-foreground">平均应收</p>
      </div>
    </div>
  );
});

OptimizedDriverStats.displayName = 'OptimizedDriverStats';
