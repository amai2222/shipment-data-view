// 文件路径: src/hooks/useFilterState.ts

import { useState, useMemo } from 'react';
import { isEqual } from 'lodash';

/**
 * 一个可复用的 Hook，用于管理筛选器的 UI 状态和活动状态。
 * 它实现了“待搜索”逻辑，只有在用户确认搜索后才更新活动状态。
 * 
 * @param initialState 筛选器的初始状态对象。
 * @returns 包含筛选器状态和管理函数的对象。
 */
export function useFilterState<T>(initialState: T) {
  // uiFilters: 用户在界面上看到的、尚未应用的筛选条件
  const [uiFilters, setUiFilters] = useState<T>(initialState);
  
  // activeFilters: 用户点击“搜索”后，实际用于数据查询的筛选条件
  const [activeFilters, setActiveFilters] = useState<T>(initialState);

  // isStale: 判断 UI 上的筛选条件是否与当前查询的条件不同
  const isStale = useMemo(() => !isEqual(uiFilters, activeFilters), [uiFilters, activeFilters]);

  /**
   * 处理搜索操作：将 UI 筛选条件应用为活动条件。
   */
  const handleSearch = () => {
    setActiveFilters(uiFilters);
  };

  /**
   * 处理清除操作：将 UI 和活动筛选条件都重置为初始状态。
   */
  const handleClear = () => {
    setUiFilters(initialState);
    setActiveFilters(initialState);
  };

  return {
    uiFilters,
    setUiFilters,
    activeFilters,
    setActiveFilters, // 也导出以备不时之需
    isStale,
    handleSearch,
    handleClear,
  };
}
