/**
 * 加载动画组件
 * 用于Suspense fallback
 */

import { Loader2 } from 'lucide-react';

export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">加载中...</p>
      </div>
    </div>
  );
}

/**
 * 页面级加载动画
 */
export function PageLoading() {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">加载页面中...</p>
      </div>
    </div>
  );
}

/**
 * 内容加载动画（小尺寸）
 */
export function ContentLoading() {
  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

/**
 * 按钮加载动画
 */
export function ButtonLoading() {
  return <Loader2 className="h-4 w-4 animate-spin" />;
}

