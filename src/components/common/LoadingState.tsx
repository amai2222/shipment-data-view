// 加载状态组件
// 用于显示数据加载中状态

import { RefreshCw } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ 
  message = '加载中...', 
  className = '' 
}: LoadingStateProps) {
  return (
    <div className={`flex items-center justify-center py-8 ${className}`}>
      <RefreshCw className="h-6 w-6 animate-spin mr-2" />
      <span>{message}</span>
    </div>
  );
}

// 表格加载状态
export function TableLoadingState({ colSpan = 8 }: { colSpan?: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="h-24 text-center">
        <LoadingState />
      </td>
    </tr>
  );
}

// 卡片加载状态
export function CardLoadingState() {
  return (
    <div className="p-8">
      <LoadingState />
    </div>
  );
}

